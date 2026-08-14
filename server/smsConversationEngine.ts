// SMS Conversation Engine - Handles multi-step SMS conversations with brokers
import { storage } from './storage';
import { sendSMS } from './smsService';
import { type Broker } from '@shared/schema';

export interface ConversationState {
  brokerId: string;
  step: 'profile_completion' | 'collecting_name' | 'collecting_email' | 'collecting_markets' | 'active' | 'deal_response_pending';
  data?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    marketsServed?: string[];
    pendingDealId?: string;
    awaitingResponse?: boolean;
  };
  lastActivity: Date;
}

export class SMSConversationEngine {
  private static conversations = new Map<string, ConversationState>();

  /**
   * Process incoming SMS and handle conversation flow
   * @param parsedData - Optional pre-parsed address components (city/state/zip) to preserve user input
   * @returns Structured response with message, dealId, and metadata for observability
   */
  static async processConversation(
    phone: string, 
    message: string, 
    twilioData: any, 
    skipConfirmation: boolean = false,
    parsedData?: any  // CRITICAL FIX: Pre-parsed city/state from SMS extraction
  ): Promise<{ message: string; dealId?: string; skipConfirmation: boolean; success: boolean; metadata?: any }> {
    // 🔧 CRITICAL FIX: Normalize phone number BEFORE any database lookups
    // Twilio sends: +17034744399, database stores: 7034744399
    // This ensures existing brokers are found instead of creating duplicates
    const normalizedPhone = phone.replace(/[^0-9]/g, '');
    console.log(`📱 Processing conversation for ${phone} (normalized: ${normalizedPhone}): ${message} [skipConfirmation=${skipConfirmation}]`);
    if (parsedData) {
      console.log(`📊 [PARSED-DATA-RECEIVED] Pre-parsed address components available:`, {
        city: parsedData.city,
        state: parsedData.state,
        zipCode: parsedData.zipCode
      });
    }
    
    // HANDLE OPT-OUT MESSAGES FIRST (STOP, UNSUBSCRIBE, etc.)
    const normalizedMessage = message.trim().toLowerCase();
    const optOutKeywords = ['stop', 'unsubscribe', 'opt out', 'opt-out', 'remove', 'cancel'];
    
    if (optOutKeywords.some(keyword => normalizedMessage === keyword || normalizedMessage.includes(keyword))) {
      console.log(`🚫 Processing opt-out request from ${phone}: ${message}`);
      
      // Find existing broker and mark as inactive
      const existingBroker = await storage.getBrokerByPhone(normalizedPhone);
      if (existingBroker) {
        await storage.updateBroker(existingBroker.id, { 
          isActive: false,
          smsOptIn: false
        });
        console.log(`✅ Broker ${existingBroker.firstName} ${existingBroker.lastName} marked as inactive due to opt-out request`);
      }
      
      // Remove from conversation state
      this.conversations.delete(normalizedPhone);
      
      // Use proper SMS template for opt-out confirmation (compliance)
      try {
        const { TemplateService } = await import('./templateService');
        const template = await TemplateService.getSMSTemplate('sms_unsubscribe', {
          companyName: 'LandLinq',
          supportEmail: 'catalyst@landlinq.ai'
        });
        
        if (template) {
          return { message: template, skipConfirmation, success: true, metadata: { type: 'opt-out' } };
        }
      } catch (error) {
        console.error('❌ Failed to load SMS opt-out template:', error);
      }
      
      // Fallback message (should not be reached if template exists)
      const fallbackMessage = "You have been unsubscribed from LandLinq SMS messages. You will no longer receive text alerts. To re-subscribe, text START. Questions? Email catalyst@landlinq.ai";
      return { message: fallbackMessage, skipConfirmation, success: true, metadata: { type: 'opt-out' } };
    }
    
    // Get or create broker
    let broker = await storage.getBrokerByPhone(normalizedPhone);
    
    if (!broker) {
      broker = await this.createNewBroker(normalizedPhone);
    } else {
      // AUTO OPT-IN: If existing broker texts in, opt them in automatically
      // (implicit consent by initiating SMS conversation - even if they previously opted out)
      if (!broker.smsOptIn || !broker.isActive) {
        const wasInactive = !broker.isActive;
        console.log(`📱 ${wasInactive ? 'REACTIVATING and ' : ''}Auto-opting in broker ${broker.id} who initiated SMS conversation`);
        
        await storage.updateBroker(broker.id, {
          smsOptIn: true,
          smsOptInDate: new Date(),
          isActive: true  // Reactivate if they were opted out
        });
        
        // CRITICAL FIX: Re-fetch with retry to ensure smsOptIn update is committed and visible
        // This prevents race condition where SMS sending checks smsOptIn before DB commit
        console.log(`🔄 Re-fetching broker ${broker.id} to verify database commit...`);
        let updatedBroker = null;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            updatedBroker = await storage.getBrokerById(broker.id);
            
            // VERIFY the update is actually visible in database
            if (updatedBroker && updatedBroker.smsOptIn === true) {
              broker = updatedBroker;
              console.log(`✅ Broker re-fetched successfully - smsOptIn: ${broker.smsOptIn}, isActive: ${broker.isActive}`);
              break;
            } else if (updatedBroker) {
              // Database returned data but smsOptIn is still false - retry
              console.warn(`⚠️ Broker re-fetch attempt ${retryCount + 1}: smsOptIn still false, retrying...`);
              retryCount++;
              if (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 50)); // 50ms backoff
              }
            } else {
              console.warn(`⚠️ Broker re-fetch attempt ${retryCount + 1}: broker not found`);
              retryCount++;
            }
          } catch (error) {
            console.error(`⚠️ Broker re-fetch attempt ${retryCount + 1} failed:`, error);
            retryCount++;
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 50)); // 50ms backoff
            }
          }
        }
        
        // If all retries failed or smsOptIn still not visible, force in-memory override
        // This ensures SMS notifications work even if database has visibility delay
        if (!updatedBroker || updatedBroker.smsOptIn !== true) {
          console.warn(`⚠️ WARNING: Could not verify smsOptIn=true in database after ${maxRetries} retries`);
          console.warn(`⚠️ Forcing in-memory override to allow SMS notifications for this conversation`);
          broker.smsOptIn = true;
          broker.smsOptInDate = new Date();
          broker.isActive = true;
        }
      }
    }

    // Get conversation state
    let conversation = this.conversations.get(normalizedPhone) || this.initializeConversation(broker.id, normalizedPhone);
    
    // PRIORITY: Check if we're waiting for follow-up info on an existing deal
    // First check in-memory conversation state
    if (conversation.step === 'deal_response_pending' && conversation.data?.pendingDealId) {
      console.log(`📱 Follow-up info received for deal ${conversation.data.pendingDealId} (from memory)`);
      const response = await this.handleFollowUpResponse(broker, conversation, message);
      return { message: response, dealId: conversation.data.pendingDealId, skipConfirmation, success: true, metadata: { type: 'follow-up' } };
    }
    
    // FALLBACK: Check database for pending deals with missing info (in case server restarted)
    // ALWAYS check for pending deals FIRST before creating new deals
    const recentDeals = await storage.getDealsByBrokerId(broker.id);
    
    // Find most recent deal (sorted by createdAt desc) that's missing price or acreage
    const pendingDeal = recentDeals
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      })
      .find(deal => {
        const missingPrice = !deal.askingPrice || Number(deal.askingPrice) === 0;
        const missingAcres = !deal.sizeAcres || Number(deal.sizeAcres) === 0;
        return missingPrice || missingAcres;
      });
    
    // If we found a pending deal, check if message supplies the missing fields
    if (pendingDeal) {
      const needsPrice = !pendingDeal.askingPrice || Number(pendingDeal.askingPrice) === 0;
      const needsAcreage = !pendingDeal.sizeAcres || Number(pendingDeal.sizeAcres) === 0;
      
      // Check if message contains the info we're waiting for
      const hasPrice = this.extractPrice(message) !== undefined;
      const hasAcreage = this.extractAcres(message) !== undefined;
      const hasAddress = this.extractAddress(message);
      
      // CRITICAL FIX: If message has a NEW address, ALWAYS create a new deal - never route to follow-up
      // This prevents SMS addresses from being mis-routed as follow-ups
      if (hasAddress) {
        console.log(`📱 ✅ CRITICAL FIX: New address detected ("${hasAddress}") - creating NEW DEAL (not follow-up) despite pending deal ${pendingDeal.id}`);
        // Fall through to deal submission logic below
      } else {
        // No address in message - check if it supplies missing fields for pending deal
        const suppliesRequestedInfo = (needsPrice && hasPrice) || (needsAcreage && hasAcreage);
        
        if (suppliesRequestedInfo) {
          console.log(`📱 Follow-up info received for deal ${pendingDeal.id} (from database fallback) - supplies requested fields`);
          conversation.data = conversation.data || {};
          conversation.data.pendingDealId = pendingDeal.id;
          conversation.step = 'deal_response_pending';
          this.conversations.set(normalizedPhone, conversation);
          const response = await this.handleFollowUpResponse(broker, conversation, message);
          return { message: response, dealId: pendingDeal.id, skipConfirmation, success: true, metadata: { type: 'follow-up' } };
        } else {
          console.log(`📱 Message doesn't supply requested info - treating as new submission`);
        }
      }
    }
    
    // CRITICAL FIX: Check for deal information FIRST, before profile completion state
    // This ensures property addresses ALWAYS create deals, even if broker is in profile_completion state
    // This prevents "Welcome to LandLinq!" being sent when broker retexts a property address
    const isDealSubmission = this.containsDealInformation(message);
    
    console.log(`🔍 [SMS-ENGINE] isDealSubmission check: ${isDealSubmission} for message: "${message.substring(0, 50)}..."`);
    
    if (isDealSubmission) {
      console.log(`✅ [SMS-ENGINE] ROUTING TO DEAL SUBMISSION (message contains address) - OVERRIDES profile_completion state`);
      // Use intelligent response system to check profile and property completeness
      const { IntelligentResponseService } = await import('./intelligentResponseService');
      // Extract basic property data for validation
      const propertyData = {
        address: this.extractAddress(message),
        askingPrice: this.extractPrice(message),
        sizeAcres: this.extractAcres(message)
      };
      
      const responseData = await IntelligentResponseService.generateIntelligentResponse(
        phone,
        propertyData,
        'sms'
      );
      
      // BULLETPROOF SMS: Process ALL texts regardless of content - no barriers
      if (!responseData.shouldProcessDeal) {
        console.log(`📱 Processing deal anyway - all texts must work: ${responseData.responseType}`);
        // Still process the deal but include the intelligent response as additional notes
      }
      
      // ALWAYS process deals - no text message should be rejected
      // CRITICAL FIX: Pass parsedData to preserve user-submitted city/state
      const result = await this.handleDealSubmission(broker, conversation, message, twilioData, skipConfirmation, parsedData);
      
      // Log structured response for observability
      console.log(`📊 [DEAL-SUBMISSION-RESULT] Deal ${result.dealId}: ${result.success ? 'SUCCESS' : 'FAILED'}`, {
        skipConfirmation: result.skipConfirmation,
        hasMessage: !!result.message,
        metadata: result.metadata
      });
      
      return result; // Return full structured response
    }
    
    // Process profile completion flows ONLY if message doesn't contain property address
    // This prevents profile responses like "John Smith" from being treated as deals
    if (conversation.step === 'profile_completion' || 
        conversation.step === 'collecting_name' || 
        conversation.step === 'collecting_email' || 
        conversation.step === 'collecting_markets') {
      console.log(`📱 Processing profile collection step: ${conversation.step}`);
      
      let responseMessage = '';
      switch (conversation.step) {
        case 'profile_completion':
          responseMessage = await this.handleProfileCompletion(broker, conversation, message);
          break;
        case 'collecting_name':
          responseMessage = await this.handleNameCollection(broker, conversation, message);
          break;
        case 'collecting_email':
          responseMessage = await this.handleEmailCollection(broker, conversation, message);
          break;
        case 'collecting_markets':
          responseMessage = await this.handleMarketsCollection(broker, conversation, message);
          break;
      }
      return { message: responseMessage, skipConfirmation, success: true, metadata: { type: conversation.step } };
    }

    // Process other conversation states
    let responseMessage = '';
    switch (conversation.step) {
      case 'active':
        // This is a general inquiry or follow-up
        responseMessage = await this.handleGeneralMessage(broker, conversation, message);
        break;
        
      case 'deal_response_pending':
        // Broker is responding to a follow-up question
        responseMessage = await this.handleFollowUpResponse(broker, conversation, message);
        break;
        
      default:
        const unknownResult = await this.handleUnknownState(broker, conversation, message, skipConfirmation);
        return unknownResult; // Already returns structured data
    }
    
    return { message: responseMessage, skipConfirmation, success: true, metadata: { type: conversation.step } };
  }

  /**
   * Handle general messages when not collecting specific info
   */
  private static async handleGeneralMessage(broker: Broker, conversation: ConversationState, message: string): Promise<string> {
    const { TemplateService } = await import('./templateService');
    
    // No general help template exists - use Deal Submitted as fallback
    const template = await TemplateService.getSMSTemplate('Deal Submitted', {
      brokerName: broker.firstName || 'there',
      address: 'your inquiry'
    });
    
    if (!template) {
      console.error('No general help SMS template configured in outreach management - cannot send SMS');
      return '';
    }
    
    return template;
  }

  /**
   * Extract address from message
   * Supports both labeled format ("Property Address: ...") and free-form text
   */
  private static extractAddress(message: string): string | undefined {
    // First, try to extract from labeled format: "Property Address: 1201 27th Street E., Bradenton, FL 34208"
    const labeledMatch = message.match(/(?:property\s+)?address[:\s]+([^\n\r]+?)(?=\s*(?:zip|property\s+name|price|\n|$))/i);
    if (labeledMatch) {
      const fullAddress = labeledMatch[1].trim();
      // Clean up any trailing punctuation
      return fullAddress.replace(/[,;]+$/, '').trim();
    }
    
    // Fallback: Extract street address with optional city, state, ZIP
    // Match: "1201 27th Street E., Bradenton, FL 34208" or "105 LYTLE COVE ROAD, SWANNANOA, NC"
    // CRITICAL: Use word boundaries (\b) to prevent matching garbage like "8rd" or "yest"
    // Updated to capture city/state even WITHOUT ZIP code
    const fullAddressMatch = message.match(/(\d+[^,\n\r]*\b(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|way|blvd|boulevard|ct|court|pl|place|cove)\b\.?[^,\n\r]*(?:,\s*[A-Za-z\s]+(?:,?\s*[A-Z]{2})?(?:\s*\d{5})?)?)/i);
    if (fullAddressMatch) {
      return fullAddressMatch[1].trim();
    }
    
    // Last resort: Just capture the street portion without city/state
    const streetMatch = message.match(/(\d+[^,\n\r]*\b(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|way|blvd|boulevard|ct|court|pl|place)\b[^,\n\r]*)/i);
    return streetMatch ? streetMatch[1].trim() : undefined;
  }

  /**
   * Extract price from message  
   */
  private static extractPrice(message: string): number | undefined {
    // Look for price with $ sign first (most explicit)
    const dollarMatch = message.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
    if (dollarMatch) {
      return parseInt(dollarMatch[1].replace(/,/g, ''));
    }
    
    // Look for price with context keywords
    const contextMatch = message.match(/(?:price|asking|sale|offer|value)[:\s]+\$?\s*([\d,]+(?:\.\d{2})?)/i);
    if (contextMatch) {
      return parseInt(contextMatch[1].replace(/,/g, ''));
    }
    
    // Look for large numbers (likely prices) 6+ digits
    const largeNumberMatch = message.match(/\b([\d,]{6,})\b/);
    if (largeNumberMatch) {
      return parseInt(largeNumberMatch[1].replace(/,/g, ''));
    }
    
    return undefined;
  }

  /**
   * Extract acres from message
   */
  private static extractAcres(message: string): number | undefined {
    const acreMatch = message.match(/([\d.]+)\s*(?:acres?|ac\b)/i);
    return acreMatch ? parseFloat(acreMatch[1]) : undefined;
  }

  /**
   * Create a new broker from SMS signup - UPDATED to use smart broker merge
   * This prevents duplicate profiles when broker already exists with same phone via email
   */
  private static async createNewBroker(phone: string): Promise<Broker> {
    console.log(`🆕 Finding or creating broker for phone: ${phone}`);
    
    // Use smart findOrCreateBroker to prevent duplicates
    const { broker, isNew, wasUpdated } = await storage.findOrCreateBroker({
      phone: phone,
      smsConsent: true, // AUTO OPT-IN: Broker initiated SMS conversation
      smsOptIn: true
    });
    
    if (isNew) {
      console.log(`✅ New broker created with ID: ${broker.id} (auto opted-in to SMS)`);
    } else if (wasUpdated) {
      console.log(`🔗 Existing broker ${broker.id} updated with SMS opt-in`);
    } else {
      console.log(`✅ Found existing broker ${broker.id} for phone ${phone}`);
    }
    
    return broker;
  }

  /**
   * Initialize conversation state for a broker
   * UPDATED: Start as 'active' since SMS brokers always have phone (contact method)
   */
  private static initializeConversation(brokerId: string, phone: string): ConversationState {
    const conversation: ConversationState = {
      brokerId,
      step: 'active', // CHANGED: SMS brokers have phone, so profile is complete
      data: {},
      lastActivity: new Date()
    };
    
    this.conversations.set(phone, conversation);
    return conversation;
  }

  /**
   * Check if message contains deal information (address, property details)
   */
  private static containsDealInformation(message: string): boolean {
    const text = message.toLowerCase();
    
    // Check for address patterns
    const addressPatterns = [
      /\d+[^,\n\r]*\b(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|way|blvd|boulevard|ct|court|pl|place)\b/i,
      /\d+[^,\n\r]*acres?/i,
      /\$[\d,]+(?:\.\d{2})?/,
      /\d+(?:\.\d+)?\s*(?:million|mil|M)/i,
      /\d+\s*units?/i,
      /multifamily|apartments?|btr|build.to.rent|lot.development/i
    ];
    
    // If message contains any address or property-related patterns, it's likely a deal
    return addressPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Check if message is PURE follow-up info (just price/acreage) vs a new property submission
   * Returns TRUE only if message contains ONLY price and/or acreage without property description
   */
  private static isPureFollowUpInfo(message: string): boolean {
    const text = message.trim().toLowerCase();
    
    // Location/property indicators mean it's a NEW submission, not follow-up info
    const propertyIndicators = [
      /\b(?:in|near|off|on|at)\s+\w+/i,  // "in Charlotte", "near Gastonia", "off Highway"
      /\b(?:county|city|town|township|parish)\b/i,
      /\b(?:highway|hwy|route|interstate|i-\d+)\b/i,
      /\b(?:parcel|lot|tract|site|property|land)\s+\d+/i,  // "Parcel 123", "Lot 45"
      /\d+[^,\n\r]*\b(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|way|blvd|boulevard|ct|court|pl|place)\b/i,  // Street address
      /\b(?:north|south|east|west|n|s|e|w)\s+\w+/i,  // "North Main"
      /\b(?:multifamily|apartments?|btr|build.to.rent|lot.development|subdivision|development)\b/i
    ];
    
    // If message has property indicators, it's a NEW submission, not follow-up
    if (propertyIndicators.some(pattern => pattern.test(text))) {
      return false;
    }
    
    // Check if message contains price and/or acreage patterns
    const hasPricePattern = /^\$?[\d,]+(?:\.\d{2})?(?:\s*(?:k|m|million))?$/i.test(text) ||
                           /^[\d,]+(?:\.\d{2})?\s*(?:dollars?|usd)?$/i.test(text);
    const hasAcreagePattern = /^[\d.]+\s*(?:acres?|ac)$/i.test(text);
    const hasBoth = /^\$?[\d,]+.*[\d.]+\s*(?:acres?|ac)/i.test(text) && text.length < 50; // Price and acres together, short message
    
    // Pure follow-up if it's ONLY price and/or acreage with no other context
    return hasPricePattern || hasAcreagePattern || hasBoth;
  }

  /**
   * Handle profile completion flow
   */
  private static async handleProfileCompletion(broker: Broker, conversation: ConversationState, message: string): Promise<string> {
    console.log(`👤 Handling profile completion for broker ${broker.id}`);
    
    // Check what information is missing
    // UPDATED: Only require ONE contact method (email OR phone)
    // Name and markets are OPTIONAL - not required for profile completion
    const missing = [];
    
    // Only check for contact method
    // Check if email is a temporary SMS email (format: sms-<phone>-<timestamp>@temp.landlinq.ai)
    const isTempEmail = broker.email && /^sms-\d+-\d+@temp\.landlinq\.ai$/.test(broker.email);
    const hasEmail = broker.email && broker.email.trim() !== '' && !isTempEmail;
    const hasPhone = broker.phone && broker.phone.trim() !== '';
    const hasContactMethod = hasPhone || hasEmail;
    
    if (!hasContactMethod) {
      missing.push('email'); // Need at least one contact method
    }
    // Name is OPTIONAL - never required for profile completion
    // Markets are OPTIONAL - never required for profile completion

    if (missing.length === 0) {
      // Profile is complete (has email OR phone)
      conversation.step = 'active';
      this.conversations.set(broker.phone!, conversation);
      
      // If there's a pending deal, acknowledge the completion
      if (conversation.data?.pendingDealId) {
        const dealId = conversation.data.pendingDealId;
        delete conversation.data.pendingDealId;
        
        return `✅ Perfect! Your contact information is now complete in our system.

Your deal ${dealId} is being reviewed by our team and you'll hear back within 24 hours.

${await this.sendWelcomeAndCriteria(broker)}`;
      } else {
        // New broker registration
        return await this.sendWelcomeAndCriteria(broker);
      }
    }

    // Collect email only if broker has NO contact method (shouldn't happen for SMS)
    // For SMS submissions, this should never trigger since phone is always verified
    if (missing.includes('email')) {
      conversation.step = 'collecting_email';
      this.conversations.set(broker.phone!, conversation);
      
      return `🎉 Welcome to LandLinq! We're excited to work with you.

What's your email address?`;
    }

    return "Let me help you complete your profile.";
  }

  /**
   * Handle name collection with AI-powered parsing
   */
  private static async handleNameCollection(broker: Broker, conversation: ConversationState, message: string): Promise<string> {
    console.log(`📝 Collecting name for broker ${broker.id}: ${message}`);
    
    // Use GPT-5 intelligent parsing
    const { parseProfileDataWithAI } = await import('./aiSmsProfileParser');
    const parsed = await parseProfileDataWithAI(message, 'name');
    
    // Check if we got valid name data
    if (!parsed.firstName) {
      return "I didn't catch your name. Please send your first and last name (e.g., 'John Smith').";
    }

    // Update broker with parsed name
    await storage.updateBroker(broker.id, {
      firstName: parsed.firstName,
      lastName: parsed.lastName || parsed.firstName // Use first name as last if only one provided
    });

    console.log(`✅ Updated broker ${broker.id} with name: ${parsed.firstName} ${parsed.lastName || '(no last name)'} [confidence: ${parsed.confidence}]`);

    // If AI also extracted email and/or markets from the message, save them too!
    if (parsed.email && (!broker.email || broker.email.includes('temp'))) {
      await storage.updateBroker(broker.id, { email: parsed.email });
      console.log(`   🎁 BONUS: Also extracted email: ${parsed.email}`);
    }
    
    if (parsed.markets && parsed.markets.length > 0 && (!broker.marketsCovered || broker.marketsCovered.length === 0)) {
      await storage.updateBroker(broker.id, { marketsCovered: parsed.markets });
      console.log(`   🎁 BONUS: Also extracted markets: ${parsed.markets.join(', ')}`);
    }

    // Re-fetch broker to check what's still missing
    const updatedBroker = await storage.getBrokerById(broker.id);
    if (!updatedBroker) {
      return "Profile update failed. Please try again.";
    }

    // UPDATED: Profile is complete once we have name + contact method (phone)
    // Since SMS submissions always have phone, profile is complete after name collection
    // Email and markets are OPTIONAL and not required
    conversation.step = 'active';
    this.conversations.set(broker.phone!, conversation);
    
    return await this.sendWelcomeAndCriteria(updatedBroker);
  }

  /**
   * Handle email collection with AI-powered parsing
   */
  private static async handleEmailCollection(broker: Broker, conversation: ConversationState, message: string): Promise<string> {
    console.log(`📧 Collecting email for broker ${broker.id}: ${message}`);
    
    // Use GPT-5 intelligent parsing
    const { parseProfileDataWithAI } = await import('./aiSmsProfileParser');
    const parsed = await parseProfileDataWithAI(message, 'email');
    
    // Check if we got valid email data
    if (!parsed.email) {
      return "That doesn't look like a valid email address. Please send your email (e.g., 'john@company.com').";
    }

    // Update broker with parsed email
    await storage.updateBroker(broker.id, { email: parsed.email });
    console.log(`✅ Updated broker ${broker.id} with email: ${parsed.email} [confidence: ${parsed.confidence}]`);

    // If AI also extracted markets from the message, save them too!
    if (parsed.markets && parsed.markets.length > 0 && (!broker.marketsCovered || broker.marketsCovered.length === 0)) {
      await storage.updateBroker(broker.id, { marketsCovered: parsed.markets });
      console.log(`   🎁 BONUS: Also extracted markets: ${parsed.markets.join(', ')}`);
    }

    // Re-fetch broker to check what's still missing
    const updatedBroker = await storage.getBrokerById(broker.id);
    if (!updatedBroker) {
      return "Profile update failed. Please try again.";
    }

    // UPDATED: Profile is complete once we have contact method (email)
    // Markets are OPTIONAL and not required
    conversation.step = 'active';
    this.conversations.set(broker.phone!, conversation);
    
    return await this.sendWelcomeAndCriteria(updatedBroker);
  }

  /**
   * Handle markets collection with AI-powered parsing
   */
  private static async handleMarketsCollection(broker: Broker, conversation: ConversationState, message: string): Promise<string> {
    console.log(`🗺️ Collecting markets for broker ${broker.id}: ${message}`);
    
    // Use GPT-5 intelligent parsing
    const { parseProfileDataWithAI } = await import('./aiSmsProfileParser');
    const parsed = await parseProfileDataWithAI(message, 'markets');
    
    // Check if we got valid market data
    if (!parsed.markets || parsed.markets.length === 0) {
      return "I didn't catch any markets. Please tell me what markets you serve (e.g., 'Charlotte NC, Atlanta GA').";
    }

    // Update broker with parsed markets
    await storage.updateBroker(broker.id, { 
      marketsCovered: parsed.markets
    });

    console.log(`✅ Updated broker ${broker.id} with markets: ${parsed.markets.join(', ')} [confidence: ${parsed.confidence}]`);

    // Profile complete!
    conversation.step = 'active';
    this.conversations.set(broker.phone!, conversation);
    
    const updatedBroker = await storage.getBrokerById(broker.id);
    if (!updatedBroker) {
      return "Profile update failed. Please try again.";
    }
    
    return await this.sendWelcomeAndCriteria(updatedBroker);
  }

  /**
   * Send welcome message and acquisition criteria
   */
  private static async sendWelcomeAndCriteria(broker: Broker): Promise<string> {
    console.log(`🎉 Sending welcome and criteria to broker ${broker.id}`);
    
    const { TemplateService } = await import('./templateService');
    const firstName = broker.firstName || 'there';
    const markets = broker.marketsCovered || [];
    
    // Get market-specific acquisition criteria
    const criteriaResponse = await this.getMarketCriteria(markets);
    
    // Use template from outreach management
    const template = await TemplateService.getSMSTemplate('Broker Registered', {
      brokerName: firstName,
      markets: markets.join(', ') || 'your area',
      criteria: criteriaResponse
    });

    if (!template) {
      console.error('No broker welcome SMS template configured in outreach management - cannot send SMS');
      return '';
    }
    
    return template;
  }

  /**
   * Get acquisition criteria for specific markets
   */
  private static async getMarketCriteria(markets: string[]): Promise<string> {
    // Our primary markets
    const primaryMarkets = [
      'charlotte', 'raleigh', 'greensboro', 'asheville', 'wilmington', // NC
      'atlanta', 'augusta', 'savannah', 'columbus', 'macon', // GA
      'nashville', 'memphis', 'knoxville', 'chattanooga', // TN
      'columbia', 'charleston', 'greenville', // SC
      'richmond', 'virginia beach', 'norfolk', 'newport news' // VA
    ];

    const servicedMarkets = [];
    const developingMarkets = [];

    for (const market of markets) {
      const marketLower = market.toLowerCase();
      const isServiced = primaryMarkets.some(pm => marketLower.includes(pm));
      
      if (isServiced) {
        servicedMarkets.push(market);
      } else {
        developingMarkets.push(market);
      }
    }

    let criteria = '';

    if (servicedMarkets.length > 0) {
      criteria += `🎯 FOR ${servicedMarkets.join(', ')}:

🏢 CONVENTIONAL APARTMENTS:
• 200+ units, 4+ acres, 15+ DUA
• $2.00+ PSF rent (Green) / $1.75+ PSF (Yellow)
• Sewer required

🏘️ ACTIVE ADULT:
• 150+ units, 4+ acres, 12+ DUA  
• 20K+ age 55+ within 5 miles
• $75K+ household income (55+)

🏡 BUILD-TO-RENT:
• 70+ units, 5+ acres, 5+ DUA
• Max $2,400/unit rent
• Sewer required

🏗️ LOT DEVELOPMENT:
• 50+ units, 6+ acres, 3+ DUA
• Residential zoning, sewer preferred`;
    }

    if (developingMarkets.length > 0) {
      if (criteria) criteria += '\n\n';
      criteria += `🚀 FOR ${developingMarkets.join(', ')}:
We're currently developing in these markets but still very interested! We often partner for developments in emerging markets, so please send any opportunities you have.`;
    }

    return criteria;
  }

  /**
   * Handle deal submission in active conversation
   * @param parsedData - Optional pre-parsed address components to preserve user input
   * @returns Structured response with message, dealId, and metadata for observability
   */
  private static async handleDealSubmission(
    broker: Broker, 
    conversation: ConversationState, 
    message: string, 
    twilioData: any, 
    skipConfirmation: boolean = false,
    parsedData?: any  // CRITICAL FIX: Pre-parsed city/state from earlier extraction
  ): Promise<{ message: string; dealId: string; skipConfirmation: boolean; success: boolean; metadata?: any }> {
    console.log(`🏢 Handling deal submission for broker ${broker.id} [skipConfirmation=${skipConfirmation}]`);
    
    // Import the deal processing logic
    const { UnifiedDealPipeline } = await import('./unifiedDealPipeline');
    const { SMSInboundService } = await import('./smsInboundService');
    
    // CRITICAL FIX: Use pre-parsed data ONLY if it has actual content
    // Check for both null/undefined AND empty objects
    let dealData;
    const hasParsedData = parsedData && typeof parsedData === 'object' && Object.keys(parsedData).length > 0;
    
    if (hasParsedData) {
      console.log('✅ [USING-PARSED-DATA] Using pre-parsed city/state from earlier extraction:', {
        address: parsedData.address,
        city: parsedData.city,
        state: parsedData.state,
        zipCode: parsedData.zipCode
      });
      dealData = parsedData;
    } else {
      console.log('⚠️ [NO-PARSED-DATA] Re-parsing SMS message (parsedData empty or not provided)');
      // Parse deal data using AI
      dealData = await SMSInboundService.extractDealDataFromSMS({ 
        Body: message, 
        From: broker.phone || '', 
        To: '', 
        MessageSid: '' 
      });
    }
    
    // CRITICAL FIX (Nov 25, 2025): ALWAYS try to extract city/state from raw SMS as fallback
    // Bug: AI parsing sometimes returns null city/state even when present in SMS text
    // Solution: Use deterministic extraction from raw text to supplement AI results
    if ((!dealData.city || !dealData.state) && message) {
      console.log('🔍 [FALLBACK-EXTRACTION] City/state missing from AI parsing, trying deterministic extraction from raw SMS...');
      
      // Extract state - look for 2-letter state codes or full state names
      const statePattern = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/i;
      const stateMatch = message.match(statePattern);
      if (!dealData.state && stateMatch) {
        dealData.state = stateMatch[1].toUpperCase();
        console.log(`✅ [FALLBACK] Extracted state: ${dealData.state}`);
      }
      
      // Extract ZIP code (5 digits)
      const zipPattern = /\b(\d{5})(?:-\d{4})?\b/;
      const zipMatch = message.match(zipPattern);
      if (!dealData.zipCode && zipMatch) {
        dealData.zipCode = zipMatch[1];
        console.log(`✅ [FALLBACK] Extracted ZIP: ${dealData.zipCode}`);
      }
      
      // Extract city - look for patterns like "City, ST" or "City ST ZIP"
      // Match text before state abbreviation
      const cityStatePattern = /\b([A-Za-z][A-Za-z\s]{1,30}?),?\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/i;
      const cityMatch = message.match(cityStatePattern);
      if (!dealData.city && cityMatch && cityMatch[1]) {
        // Clean up the city name
        const cityCandidate = cityMatch[1].trim();
        // Validate it's not a street suffix or common word
        const invalidCityWords = ['rd', 'road', 'st', 'street', 'ave', 'avenue', 'dr', 'drive', 'ln', 'lane', 'way', 'blvd', 'ct', 'court'];
        if (!invalidCityWords.includes(cityCandidate.toLowerCase())) {
          dealData.city = cityCandidate;
          console.log(`✅ [FALLBACK] Extracted city: ${dealData.city}`);
        }
      }
      
      console.log(`📊 [FALLBACK-RESULT] After fallback extraction:`, {
        city: dealData.city || 'STILL MISSING',
        state: dealData.state || 'STILL MISSING',
        zipCode: dealData.zipCode || 'STILL MISSING'
      });
    }
    
    // BULLETPROOF SMS: ALWAYS create deals even with missing address
    if (!dealData.address) {
      console.log('📱 No address found, creating deal with fallback address - all texts must work');
      dealData.address = `SMS Submission - Details TBD (${message.substring(0, 50)}...)`;
    }

    // BULLETPROOF: Always process deals no matter what - ALL texts must work
    let result;
    try {
      // 🔍 CHECK: Is this a reply to update an existing incomplete deal?
      // Look for the most recent deal from this broker with missing ZIP/state
      const recentIncompleteDeals = await storage.getDealsByBrokerId(broker.id);
      
      let targetDeal = null;
      for (const deal of recentIncompleteDeals) {
        // Check if deal is missing ZIP or state
        const missingZip = !deal.zip || deal.zip.trim() === '';
        const missingState = !deal.state || deal.state.trim() === '';
        
        if (missingZip || missingState) {
          targetDeal = deal;
          console.log(`🔍 Found incomplete deal #${deal.dealNumber} (${deal.id}) missing ${missingZip ? 'ZIP' : ''}${missingZip && missingState ? ' and ' : ''}${missingState ? 'state' : ''}`);
          break;
        }
      }
      
      // If we found an incomplete deal AND the message has completion data, UPDATE instead of creating new
      if (targetDeal && (dealData.zipCode || dealData.state || dealData.city)) {
        console.log(`📝 UPDATE MODE: Updating existing deal #${targetDeal.dealNumber} with missing info from SMS reply`);
        
        // Build update object with only the fields we have
        const updateData: any = {};
        if (dealData.zipCode) updateData.zip = dealData.zipCode;
        if (dealData.state) updateData.state = dealData.state;
        if (dealData.city) updateData.city = dealData.city;
        if (dealData.price && dealData.price > 0) updateData.askingPrice = dealData.price;
        if (dealData.acres && dealData.acres > 0) updateData.sizeAcres = dealData.acres;
        
        console.log(`📝 Updating deal ${targetDeal.id} with:`, updateData);
        
        // Update the deal
        await storage.updateDeal(targetDeal.id, updateData);
        
        // Mark the follow-up as resolved
        try {
          const { FollowUpService } = await import('./followUpService');
          await FollowUpService.markFollowUpResolved(targetDeal.id, 'sms');
          console.log(`✅ Follow-up marked as resolved for deal ${targetDeal.id}`);
        } catch (err) {
          console.error(`⚠️ Failed to mark follow-up as resolved:`, err);
        }
        
        result = {
          dealId: targetDeal.id,
          classification: targetDeal.classification || 'unclassified',
          status: 'updated',
          message: 'Deal updated with missing information'
        };
        
      } else {
        // No incomplete deal found OR message doesn't have completion data - create new deal
        console.log(`📝 CREATE MODE: Creating new deal from SMS submission`);
        
        // Auto-generate property name from address (street address without city/state/zip)
        let propertyName = '';
        if (dealData.address) {
          // Extract just the street address (before first comma or city name)
          const streetAddressMatch = dealData.address.match(/^([^,]+)/);
          if (streetAddressMatch) {
            propertyName = streetAddressMatch[1].trim();
          } else {
            propertyName = dealData.address;
          }
        }
        
        // CRITICAL FIX: Normalize address fields to convert empty strings to undefined
        // Prevents '' from being stored in database instead of proper null values
        const { normalizeAddressFields, logAddressNormalization } = await import('./addressFieldNormalizer');
        const beforeNormalization = { ...dealData };
        const normalizedDealData = normalizeAddressFields(dealData);
        logAddressNormalization(beforeNormalization, normalizedDealData, 'Before pipeline submission');
        
        const submissionData = {
          address: normalizedDealData.address,
          propertyName: propertyName || undefined,  // Use undefined instead of null for type compatibility
          zip: normalizedDealData.zipCode || undefined,  // Use undefined to preserve null/undefined semantics
          // CRITICAL FIX: Use normalized values (empty strings converted to undefined)
          // This ensures missing city/state are properly detected by geocoding/validation
          city: normalizedDealData.city,
          state: normalizedDealData.state,
          askingPrice: dealData.price || 0,
          acreage: dealData.acres || 0,
          productTypes: dealData.productType ? [dealData.productType] : [],
          contactPhone: broker.phone || '',
          contactEmail: broker.email?.includes('@temp.landlinq.ai') ? undefined : (broker.email || undefined), // Don't use temp emails
          contactName: `${broker.firstName || ''} ${broker.lastName || ''}`.trim() || 'SMS User',
          submissionMethod: 'sms' as const,
          source: 'conversation',
          originalData: twilioData
        };

        // Log submission data for debugging
        console.log(`📊 [SUBMISSION-DATA] Final values before pipeline:`, {
          address: submissionData.address,
          city: submissionData.city,
          state: submissionData.state,
          zip: submissionData.zip
        });

        // Pass verified broker to prevent race condition (broker has confirmed smsOptIn=true)
        // Pass skipConfirmation=true flag to prevent double confirmations (instant ack already sent)
        console.log(`\n🚨🚨🚨 [SMS-PIPELINE-START] CALLING UNIFIED DEAL PIPELINE 🚨🚨🚨`);
        console.log(`🔍 [DEBUG] UnifiedDealPipeline.processDealSubmission with skipConfirmation=${skipConfirmation}`);
        console.log(`📍 [SUBMISSION] Address: "${submissionData.address}"`);
        console.log(`📍 [SUBMISSION] City: "${submissionData.city}"`);
        console.log(`📍 [SUBMISSION] State: "${submissionData.state}"`);
        console.log(`📍 [SUBMISSION] ZIP: "${submissionData.zip}"`);
        console.log(`📍 [SUBMISSION] Broker: ${broker.phone} (${broker.email})`);
        
        result = await UnifiedDealPipeline.processDealSubmission(submissionData, broker, skipConfirmation);
        
        console.log(`\n🚨🚨🚨 [SMS-PIPELINE-COMPLETE] PIPELINE RETURNED 🚨🚨🚨`);
        // CRITICAL BUG FIX: Verify deal was actually created
        console.log(`📊 [DEAL-CREATION-RESULT] Full result object:`, JSON.stringify(result, null, 2));
        console.log(`📊 [DEAL-CREATION-RESULT] Summary:`, {
          dealId: result?.dealId,
          classification: result?.classification,
          status: result?.status,
          success: result?.success !== false, // UnifiedPipeline returns {success: false} on failure
          hasResult: !!result
        });
        
        // CRITICAL: If UnifiedPipeline returned success=false, throw error to trigger retry
        if (result && result.success === false) {
          console.error(`\n🚨🚨🚨 [CRITICAL-ERROR] PIPELINE FAILED! 🚨🚨🚨`);
          console.error(`❌ [CRITICAL] UnifiedDealPipeline.processDealSubmission FAILED:`, {
            reason: result.reason || 'Unknown',
            message: result.message || 'Deal creation failed'
          });
          throw new Error(`Deal creation failed: ${result.reason || result.message || 'Unknown error'}`);
        }
        
        // Verify dealId exists (another way pipeline can fail silently)
        if (!result || !result.dealId) {
          console.error(`\n🚨🚨🚨 [CRITICAL-ERROR] NO DEAL ID RETURNED! 🚨🚨🚨`);
          console.error(`❌ [CRITICAL] UnifiedDealPipeline returned no dealId!`, result);
          throw new Error('Deal creation failed: No dealId returned from pipeline');
        }
        
        console.log(`\n🚨🚨🚨 [SMS-SUCCESS] DEAL ${result.dealId} CREATED! 🚨🚨🚨`);
      }
      
      // SAVE ORIGINAL SMS: Store SMS content in communications table for "View Original SMS" feature
      if (result?.dealId) {
        try {
          await storage.createCommunication({
            brokerId: broker?.id || undefined,
            relatedDealId: result.dealId,
            channel: 'sms' as const,
            direction: 'inbound' as const,
            phone: broker.phone || twilioData.From,
            rawText: twilioData.Body || message,
            message: twilioData.Body || message,
            status: 'resolved' as const
          });
          console.log(`✅ Original SMS saved to communications table for deal ${result.dealId}`);
        } catch (commError) {
          console.error(`⚠️ Failed to save SMS to communications (non-critical):`, commError);
        }
        
        // REMOVED: Follow-up service call moved to unified pipeline to ensure correct message order
        // The unified pipeline handles follow-ups AFTER confirmation to prevent out-of-order SMS
        // (Confirmation must be sent BEFORE missing info request)
      }
    } catch (error) {
      console.error('\n🚨🚨🚨 [SMS-DEAL-CREATION-FAILED] 🚨🚨🚨');
      console.error('❌ SMS deal processing failed:', error);
      console.error('❌ Error name:', (error as any)?.name);
      console.error('❌ Error message:', (error as any)?.message);
      console.error('❌ Error stack:', (error as any)?.stack);
      console.error('🔄 Background job will retry this submission');
      
      // CRITICAL FIX: Re-throw the error so the background job knows it failed and retries
      // Previously we created a fake "fallback deal" which prevented retries and made failures invisible
      throw error;
    }
    
    // Store deal ID for follow-up
    conversation.data = conversation.data || {};
    conversation.data.pendingDealId = result.dealId;

    // Check if we're missing critical property information (price or acres)
    const missingPropertyFields = [];
    if (!dealData.price || dealData.price === 0) missingPropertyFields.push('asking price');
    if (!dealData.acres || dealData.acres === 0) missingPropertyFields.push('acreage');
    
    if (missingPropertyFields.length > 0) {
      // Set conversation state to wait for follow-up info
      conversation.step = 'deal_response_pending';
      console.log(`📱 Deal created with missing property info: ${missingPropertyFields.join(', ')}`);
    }
    
    this.conversations.set(broker.phone!, conversation);

    // Use template from outreach management for deal confirmations
    const { TemplateService } = await import('./templateService');
    
    const classification = result?.classification || 'unclassified';
    const dealId = result?.dealId || `fallback-${Date.now()}`;
    const address = dealData?.address || 'SMS submission received';

    // Get SMS template based on classification
    // FIXED: Use correct event name that exists in database (deal_submitted, not Deal Submitted)
    let templateType = 'deal_submitted';
    if (classification === 'high_priority') {
      templateType = 'deal_submitted'; // Green = under review
    } else if (classification === 'potentially') {
      templateType = 'deal_submitted'; // Yellow = under review
    } else if (classification === 'clear_no') {
      templateType = 'rejected'; // RED = send rejection SMS with reason
    }

    // Shorten rejection reason for SMS (keep concise)
    const fullRejectionReason = result?.aiExplanation || result?.rejectionReason || 'Property does not meet current acquisition criteria';
    const { SMSRejectionHelper } = await import('./smsRejectionHelper');
    const smsRejectionReason = SMSRejectionHelper.shortenForSMS(fullRejectionReason);

    const template = await TemplateService.getSMSTemplate(templateType, {
      address: address, // Primary variable for simple template: "Got your deal for {{address}}!"
      propertyAddress: address, // Backup for alternate templates
      dealId: dealId,
      classification: classification.replace('_', ' ').toUpperCase(),
      analystName: 'Catalyst Team',
      brokerName: `${broker.firstName || ''} ${broker.lastName || ''}`.trim() || 'there',
      companyName: 'Catalyst Capital Partners',
      rejectionReason: smsRejectionReason, // Shortened for SMS
      declineReason: smsRejectionReason, // Shortened for SMS
      marketFeedback: smsRejectionReason // Shortened for SMS
    });

    // CRITICAL FIX: Respect skipConfirmation flag to prevent duplicate SMS
    // If skipConfirmation=true, instant acknowledgment was already sent
    // Return structured data to prevent background job from sending another SMS
    if (skipConfirmation) {
      console.log(`⏭️ [SKIP-CONFIRMATION] skipConfirmation=true - deal created but NOT sending duplicate SMS (instant ack already sent)`);
      return {
        message: '', // Empty message = no SMS sent
        dealId: dealId,
        skipConfirmation: true,
        success: true,
        metadata: { reason: 'Instant acknowledgment already sent' }
      };
    }
    
    if (!template) {
      console.error(`No ${templateType} SMS template configured in outreach management - cannot send SMS`);
      return {
        message: '',
        dealId: dealId,
        skipConfirmation: false,
        success: false,
        metadata: { error: 'No template configured' }
      };
    }
    
    // CHANGED: Send ONLY confirmation SMS here
    // Missing info requests are now handled separately by FollowUpService
    const response = template;

    // Check if we need to collect additional contact information for conversation state
    // UPDATED: Profile is complete with just ONE contact method (email OR phone)
    // Name and markets are OPTIONAL - not required for profile completion
    const missingInfo = [];
    
    // Only check for contact method - email is only required if broker doesn't have phone
    // Check if email is a temporary SMS email (format: sms-<phone>-<timestamp>@temp.landlinq.ai)
    const isTempEmail = broker.email && /^sms-\d+-\d+@temp\.landlinq\.ai$/.test(broker.email);
    const hasEmail = broker.email && broker.email.trim() !== '' && !isTempEmail;
    const hasPhone = broker.phone && broker.phone.trim() !== '';
    const hasContactMethod = hasPhone || hasEmail;
    
    if (!hasContactMethod) {
      missingInfo.push('email'); // Need at least one contact method
    }
    // Name is OPTIONAL - never required for profile completion
    // Markets are OPTIONAL - never required for profile completion

    // Set conversation state if broker profile is incomplete (but don't send SMS here)
    // For SMS submissions, profile is always complete since they have phone
    if (missingInfo.length > 0 && missingPropertyFields.length === 0) {
      conversation.step = 'profile_completion';
      conversation.data = conversation.data || {};
      conversation.data.pendingDealId = result.dealId;
      this.conversations.set(broker.phone!, conversation);
    }

    // Return structured data for observability
    return {
      message: response,
      dealId: dealId,
      skipConfirmation: false,
      success: true,
      metadata: { 
        classification,
        templateType,
        brokerPhone: broker.phone 
      }
    };
  }

  /**
   * Generate detailed rejection reason for red deals using templates
   */
  private static async generateRejectionReason(result: any, dealData: any): Promise<string> {
    const { TemplateService } = await import('./templateService');
    
    // Use template from outreach management for rejection reasons
    const template = await TemplateService.getSMSTemplate('status_rejected', {
      address: dealData?.address || 'Property',
      acres: dealData?.acres?.toString() || 'unknown',
      price: dealData?.price?.toString() || 'unknown',
      reasons: result?.reasons?.join(', ') || 'criteria not met',
      brokerName: 'there'
    });

    if (template) {
      return '\n\n' + template;
    }

    // Fallback if template not configured
    let reason = '\n\n❌ WHY THIS DIDN\'T QUALIFY:';
    
    // This would be populated by the actual analysis results
    // For now, we'll provide common rejection reasons
    
    if (dealData.acres && dealData.acres < 4) {
      reason += '\n• Too small: We need 4+ acres minimum';
    }
    
    if (dealData.price && dealData.acres) {
      const pricePerAcre = dealData.price * 1000000 / dealData.acres;
      if (pricePerAcre > 1000000) {
        reason += '\n• Price per acre too high for our models';
      }
    }
    
    if (!dealData.zoning || !dealData.zoning.toLowerCase().includes('multifamily')) {
      reason += '\n• Needs multifamily zoning or entitlements';
    }

    reason += '\n\n💡 WHAT WE\'RE LOOKING FOR:\n• 4+ acres minimum\n• Multifamily zoning\n• Under $1M per acre\n• 50+ unit potential';
    
    return reason;
  }

  /**
   * Handle follow-up responses - UPDATE existing deal with new info
   */
  private static async handleFollowUpResponse(broker: Broker, conversation: ConversationState, message: string): Promise<string> {
    console.log(`📱 Updating deal ${conversation.data?.pendingDealId} with follow-up info: ${message}`);
    
    try {
      const dealId = conversation.data?.pendingDealId;
      if (!dealId) {
        console.error('❌ No pending deal ID found in conversation state');
        conversation.step = 'active';
        this.conversations.set(broker.phone!, conversation);
        return "Got it! If you have another property, just send the address.";
      }
      
      // Extract price and acres from the follow-up message using AI
      const { SMSInboundService } = await import('./smsInboundService');
      const extractedData = await SMSInboundService.extractDealDataFromSMS({ 
        Body: message, 
        From: broker.phone || '', 
        To: '', 
        MessageSid: '' 
      });
      
      // Build update object with any new information found
      const updateData: any = {};
      if (extractedData.price && extractedData.price > 0) {
        updateData.price = extractedData.price;
      }
      if (extractedData.acres && extractedData.acres > 0) {
        updateData.sizeAcres = extractedData.acres.toString();
      }
      if (extractedData.zipCode) {
        updateData.zip = extractedData.zipCode;
        console.log(`📍 Adding ZIP code to deal update: ${extractedData.zipCode}`);
      }
      
      // Update the deal if we found any new information
      if (Object.keys(updateData).length > 0) {
        console.log(`📝 Updating deal ${dealId} with:`, updateData);
        await storage.updateDeal(dealId, updateData);
        
        // If ZIP code was added, re-run HelloData analysis for proper classification
        if (extractedData.zipCode) {
          console.log(`🔄 ZIP code added - re-running HelloData analysis for deal ${dealId}`);
          try {
            const deal = await storage.getDealById(dealId);
            if (deal) {
              const { UnifiedDealPipeline } = await import('./unifiedDealPipeline');
              const comparableResult = await UnifiedDealPipeline.runComparableSearchAndClassify(deal);
              
              // Update classification based on HelloData results
              const classificationUpdates: any = {
                classification: comparableResult.classification,
                status: comparableResult.status,
                aiReasoning: comparableResult.reasoning,
                assignedAnalyst: comparableResult.assignedAnalyst
              };
              
              if (comparableResult.comparableData) {
                classificationUpdates.comparableData = comparableResult.comparableData;
              }
              
              await storage.updateDeal(dealId, classificationUpdates);
              console.log(`✅ Deal ${dealId} re-classified as ${comparableResult.classification}`);
            }
          } catch (error) {
            console.error('❌ Error re-running HelloData analysis:', error);
          }
        }
        
        // Reset conversation state to active
        conversation.step = 'active';
        conversation.data = { ...conversation.data, pendingDealId: undefined };
        this.conversations.set(broker.phone!, conversation);
        
        // Use template for acknowledgment - use Deal Submitted template for updates
        const { TemplateService } = await import('./templateService');
        const deal = await storage.getDealById(dealId);
        const template = await TemplateService.getSMSTemplate('Deal Submitted', {
          brokerName: `${broker.firstName || ''} ${broker.lastName || ''}`.trim() || 'there',
          address: deal?.address || 'the property'
        });
        
        if (template) {
          return template;
        }
        
        return `Thanks! I've updated the deal with the ${Object.keys(updateData).map(k => k === 'price' ? 'asking price' : 'acreage').join(' and ')}. Our team will review it.`;
      } else {
        // No useful data extracted - acknowledge and reset
        conversation.step = 'active';
        conversation.data = { ...conversation.data, pendingDealId: undefined };
        this.conversations.set(broker.phone!, conversation);
        
        return "Thanks for the info! Our team will review the deal and get back to you.";
      }
    } catch (error) {
      console.error('❌ Error updating deal with follow-up info:', error);
      conversation.step = 'active';
      this.conversations.set(broker.phone!, conversation);
      return "Got it! Our team will review the deal and be in touch.";
    }
  }

  /**
   * Handle unknown conversation state
   */
  private static async handleUnknownState(broker: Broker, conversation: ConversationState, message: string, skipConfirmation: boolean = false): Promise<{ message: string; dealId?: string; skipConfirmation: boolean; success: boolean; metadata?: any }> {
    // Reset to active state and try to process as deal
    conversation.step = 'active';
    this.conversations.set(broker.phone!, conversation);
    
    const result = await this.handleDealSubmission(broker, conversation, message, {}, skipConfirmation);
    
    // Log structured response for observability
    console.log(`📊 [UNKNOWN-STATE-RESULT] Deal ${result.dealId}: ${result.success ? 'SUCCESS' : 'FAILED'}`, {
      metadata: result.metadata
    });
    
    return result; // Return full structured response
  }

  /**
   * Get conversation state for a phone number
   */
  static getConversationState(phone: string): ConversationState | undefined {
    return this.conversations.get(phone);
  }

  /**
   * Clean up old conversations (older than 24 hours)
   */
  static cleanupOldConversations(): void {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const entries = Array.from(this.conversations.entries());
    for (const [phone, conversation] of entries) {
      if (conversation.lastActivity < dayAgo) {
        this.conversations.delete(phone);
      }
    }
  }
}

// Clean up old conversations every hour
setInterval(() => {
  SMSConversationEngine.cleanupOldConversations();
}, 60 * 60 * 1000);