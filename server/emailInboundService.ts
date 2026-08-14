import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
// AI Service import will be added later
import { storage } from './storage';

// ── KILL SWITCH ──────────────────────────────────────────────────────────────
// Set to true to re-enable automatic deal creation from inbound emails.
const EMAIL_SCRAPING_ENABLED = false;
// ─────────────────────────────────────────────────────────────────────────────
import { sendNotificationEmail } from './emailService';
import { getWebhooksByType } from './webhookConfig';
import { apiCallTracker } from './apiCallTracker.js';
import { stripDuplicateAddressTokens } from './addressFieldNormalizer';

interface InboundEmail {
  to: string;
  from: string;
  subject: string;
  text: string; // Cleaned text (headers removed, decoded) - used for AI parsing
  rawText: string; // ORIGINAL unmodified text - stored for audit trail
  html: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
  // Jan 2, 2026: Original email info for Outlook linking (extracted from forwarded emails)
  originalSenderEmail?: string; // Original broker's email (from forwarded message)
  originalEmailSubject?: string; // Original email subject (without FW: prefix)
  outlookMessageId?: string; // Original Message-ID if found
}

interface ParsedDealData {
  address?: string;
  // CRITICAL FIX: Use 'zip' and 'state' to match pipeline expectations (not 'zipCode')
  zip?: string;
  state?: string;
  city?: string; // City field for email parsing
  price?: number;
  acres?: number;
  description?: string;
  brokerNotes?: string; // CRITICAL FIX (Nov 21, 2025): AI-extracted broker notes (headers removed)
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  zoning?: string;
  utilities?: string;
  productType?: string;
  attachments?: string[];
  _isMultiProperty?: boolean;
  _allProperties?: any[];
}

export class EmailInboundService {
  
  /**
   * Decode HTML entities in text (e.g., &apos; → ', &quot; → ", &amp; → &)
   * Fixes email subject lines showing HTML entities instead of actual characters
   */
  private static decodeHtmlEntities(text: string): string {
    if (!text) return text;
    
    const entities: Record<string, string> = {
      '&apos;': "'",
      '&#39;': "'",
      '&#x27;': "'",
      '&quot;': '"',
      '&#34;': '"',
      '&amp;': '&',
      '&#38;': '&',
      '&lt;': '<',
      '&#60;': '<',
      '&gt;': '>',
      '&#62;': '>',
      '&nbsp;': ' ',
      '&#160;': ' '
    };
    
    let decoded = text;
    for (const [entity, char] of Object.entries(entities)) {
      decoded = decoded.replace(new RegExp(entity, 'g'), char);
    }
    
    return decoded;
  }
  
  /**
   * Sanitize address by removing pricing-related phrases
   * Fixes addresses like "6500 South Boulevard, Call For, Charlotte NC" -> "6500 South Boulevard, Charlotte NC"
   * Handles edge cases: parentheses, multi-line, trailing/interior phrases
   */
  private static sanitizeAddressFromPricingText(address: string): string {
    if (!address) return address;
    
    // Log potential email subject patterns but DO NOT reject them
    // Let the downstream validation handle it - rejection here was too aggressive
    const trimmedAddress = address.trim();
    
    const emailSubjectPatterns = [
      /^deal\s*submission$/i,
      /^property\s*submission$/i,
      /^land\s*submission$/i,
      /^fw:\s*/i,
      /^re:\s*/i,
      /^fwd:\s*/i,
      /^submission$/i,
      /^property$/i,
    ];
    
    for (const pattern of emailSubjectPatterns) {
      if (pattern.test(trimmedAddress)) {
        console.log(`⚠️ [ADDRESS-VALIDATION] Possible email subject detected as address: "${address}" - will proceed with validation`);
        break;
      }
    }
    
    // Log warning if address has no street number
    const hasStreetNumber = /^\d+/.test(trimmedAddress);
    if (!hasStreetNumber && trimmedAddress.length < 50) {
      console.log(`⚠️ [ADDRESS-VALIDATION] Address may be invalid (no street number): "${address}"`);
    }
    
    // Remove common pricing phrases that may have been captured with the address
    // Pattern strategy: Match phrase WITH surrounding punctuation, then clean up properly
    const pricingPatterns = [
      // Parenthetical pricing phrases: "(Call for Pricing)" or "(POA)"
      /\s*\(\s*(?:call|contact|inquire)\s+for\s*(?:pricing|price|info|information)?\s*\)/gi,
      /\s*\(\s*(?:poa|tbd|negotiable|upon\s+request)\s*\)/gi,
      
      // Comma-separated pricing phrases in middle: ", Call for Pricing," -> ","
      /,\s*(?:call|contact|inquire)\s+for\s*(?:pricing|price|info|information)?\s*,/gi,
      /,\s*(?:poa|tbd|negotiable|upon\s+request)\s*,/gi,
      
      // Trailing pricing phrases with "Property Package" or similar: "Call For Pricing Property Package" or "For Pricing Property Pa..."
      /\s*(?:call|contact|inquire)?\s*for\s+pricing\s+property\s+pa(?:ckage)?.*$/gi,
      /\s*call\s+for\s+pricing.*$/gi,
      
      // Trailing pricing phrases: ", Call for Pricing" or "- Call for Pricing"
      /[,\-\s]+(?:call|contact|inquire)\s+for\s*(?:pricing|price|info|information)?\s*$/gi,
      /[,\-\s]+(?:poa|tbd|negotiable|upon\s+request)\s*$/gi,
      /[,\-\s]+\$\s*tbd\s*$/gi
    ];
    
    let sanitized = address;
    pricingPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, (match) => {
        // If pattern starts with comma and ends with comma, preserve single comma
        if (match.trim().startsWith(',') && match.trim().endsWith(',')) {
          return ',';
        }
        // If pattern is in parentheses, remove completely
        if (match.includes('(') || match.includes(')')) {
          return '';
        }
        // Otherwise just remove the phrase
        return '';
      });
    });
    
    // Post-processing cleanup
    sanitized = sanitized
      // Remove empty parentheses: "()" or "( )"
      .replace(/\(\s*\)/g, '')
      // Remove orphaned commas/separators
      .replace(/,\s*,+/g, ',') // Multiple commas -> single comma
      .replace(/^\s*,\s*/,'') // Leading comma
      .replace(/,\s*$/,'') // Trailing comma
      .replace(/\s+-\s*$/,'') // Trailing dash
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*/g, ', ') // Ensure comma+space separation
      .trim();
    
    // If we removed text, log it for debugging
    if (sanitized !== address) {
      console.log(`🧹 Address sanitized: "${address}" -> "${sanitized}"`);
    }
    
    return sanitized;
  }
  
  /**
   * Webhook endpoint to receive emails from SendGrid Inbound Parse
   */
  static async handleInboundEmail(req: Request, res: Response) {
    if (!EMAIL_SCRAPING_ENABLED) {
      console.log('📧 [DISABLED] Inbound email received but email-to-deal scraping is turned off.');
      return res.status(200).json({ message: 'Email received. Automatic deal creation is currently disabled.' });
    }
    try {
      console.log('📧 Received inbound email webhook');
      console.log('🔍 [DEBUG] Request body keys:', Object.keys(req.body || {}).join(', '));
      console.log('🔍 [DEBUG] Is array?', Array.isArray(req.body));
      console.log('🔍 [DEBUG] Has event field?', !!req.body?.event);
      console.log('🔍 [DEBUG] Has sg_message_id?', !!req.body?.sg_message_id);
      console.log('🔍 [DEBUG] Has sg_event_id?', !!req.body?.sg_event_id);
      console.log('🔍 [DEBUG] Has from field?', !!req.body?.from);
      console.log('🔍 [DEBUG] Has to field?', !!req.body?.to);
      console.log('🔍 [DEBUG] Has subject field?', !!req.body?.subject);
      
      // DETECT WEBHOOK TYPE: SendGrid sends different formats for different webhooks
      // Event Webhook: Array of events like [{"event": "open", "sg_message_id": "..."}]
      // Inbound Parse: Single object with {to, from, subject, text, ...}
      
      if (Array.isArray(req.body)) {
        console.log('📊 Detected SendGrid Event Webhook (not Inbound Parse) - ignoring');
        return res.status(200).json({ 
          message: 'Event webhook received but not processed', 
          note: 'This endpoint is for Inbound Parse emails only. Event webhooks are not processed here.' 
        });
      }
      
      // Check if this looks like an event webhook sent as object (some configurations)
      // CRITICAL FIX: Only block if it has 'event' OR 'sg_event_id' (true event webhooks)
      // DO NOT block on 'sg_message_id' alone - Inbound Parse emails also have this field!
      if (req.body && (req.body.event || req.body.sg_event_id)) {
        console.log('📊 Detected SendGrid Event Webhook object format (not Inbound Parse) - ignoring');
        console.log('📊 Event type:', req.body.event || 'unknown');
        console.log('📊 Event ID:', req.body.sg_event_id || 'unknown');
        return res.status(200).json({ 
          message: 'Event webhook received but not processed',
          event_type: req.body.event || 'unknown'
        });
      }
      
      // Parse the inbound email data from SendGrid
      const emailData = await EmailInboundService.parseInboundEmail(req.body);
      
      if (!emailData) {
        console.log('❌ Invalid email data received');
        return res.status(400).json({ error: 'Invalid email data' });
      }

      console.log(`📧 Processing email from ${emailData.from} to ${emailData.to} - Subject: ${emailData.subject}`);

      // CAPTURE RAW PAYLOAD FOR DEBUGGING
      const { sendGridDebugger } = await import('./sendgridDebugger.js');
      sendGridDebugger.capturePayload(req.headers as Record<string, string>, req.body);

      // FILTER: Only process emails sent to deals@catalyst.landlinq.ai as deals
      // CRITICAL FIX (Dec 2, 2025): Use includes() instead of strict equality
      // Email "To" field may include display name like "LandLinq <deals@catalyst.landlinq.ai>"
      const toAddress = (emailData.to || '').toLowerCase();
      const isDealSubmission = toAddress.includes('deals@catalyst.landlinq.ai');
      
      if (!isDealSubmission) {
        console.log(`📧 Email sent to ${emailData.to} - not processing as deal (only deals@catalyst.landlinq.ai emails are treated as deals)`);
        return res.status(200).json({ 
          message: 'Email received but not processed as deal', 
          reason: 'Only emails to deals@catalyst.landlinq.ai are processed as deals',
          to: emailData.to
        });
      }

      console.log(`📧 Email confirmed sent to deals@catalyst.landlinq.ai - processing as deal`);

      // EMAIL LOOP DETECTION: Block emails FROM our own automated addresses
      // This prevents infinite loops where confirmation emails get re-submitted
      const fromAddress = emailData.from.toLowerCase();
      const ourDomains = [
        'catalyst@landlinq.ai',
        'noreply@landlinq.ai',
        '@landlinq.ai',
        'catalyst.landlinq.ai'
      ];
      
      const isFromOurSystem = ourDomains.some(domain => fromAddress.includes(domain));
      
      if (isFromOurSystem) {
        console.error('❌ [LOOP-DETECTION] Email FROM our own system - blocking to prevent infinite loop');
        console.error(`   From: ${emailData.from}`);
        console.error(`   Subject: ${emailData.subject}`);
        console.error('❌ NO DEAL CREATED - This is a reply to our automated email');
        
        return res.status(200).json({ 
          message: 'Email from LandLinq system blocked to prevent loop',
          reason: 'LOOP_PREVENTION',
          from: emailData.from,
          dealCreated: false
        });
      }
      
      console.log('✅ [LOOP-CHECK] Email NOT from our system - proceeding');

      // SENDGRID AUTOMATED EMAIL DETECTION: Block SendGrid's own monitoring/event notification emails
      // These emails contain tracking IDs and message IDs that AI might misinterpret as addresses
      const isSendGridAutomated = EmailInboundService.detectSendGridAutomatedEmail(emailData);
      
      if (isSendGridAutomated) {
        console.error('❌ [SENDGRID-AUTOMATED] SendGrid automated email detected - blocking');
        console.error(`   From: ${emailData.from}`);
        console.error(`   Subject: ${emailData.subject}`);
        console.error(`   Contains SendGrid metadata that would corrupt address extraction`);
        console.error('❌ NO DEAL CREATED - This is SendGrid internal messaging');
        
        // Notify admin team about blocked email for monitoring
        await EmailInboundService.notifyTeamOfBlockedSendGridEmail(emailData);
        
        return res.status(200).json({ 
          message: 'SendGrid automated email blocked',
          reason: 'SENDGRID_AUTOMATED_EMAIL',
          from: emailData.from,
          dealCreated: false
        });
      }
      
      console.log('✅ [SENDGRID-CHECK] Email NOT SendGrid automated - proceeding');

      // PERMANENT DEDUPLICATION: Check database to prevent SendGrid replays forever
      const emailHash = `${emailData.from}|${emailData.subject}|${emailData.text.substring(0, 100)}`.toLowerCase();
      
      // Check if this email was already processed (permanent storage in database)
      const existingEntry = await storage.checkEmailProcessed(emailHash);
      if (existingEntry) {
        const minutesAgo = Math.round((Date.now() - existingEntry.processedAt.getTime()) / (1000 * 60));
        console.log(`⚠️ DUPLICATE EMAIL BLOCKED - already processed ${minutesAgo} minutes ago`);
        console.log(`   Original Deal ID: ${existingEntry.dealId || 'none'}`);
        console.log(`   SendGrid replay detected and blocked permanently`);
        return res.status(200).json({ 
          message: 'Email already processed (permanent deduplication)',
          dealId: existingEntry.dealId,
          duplicate: true,
          processedAt: existingEntry.processedAt
        });
      }

      // Extract deal information from email content with enhanced parsing - ALWAYS works with fallbacks
      const dealData = await EmailInboundService.extractDealData(emailData) || {};
      
      // LOGGING: Track address extraction
      console.log('🔍 [ADDRESS-DEBUG] Extracted deal data:', {
        hasAddress: !!dealData.address,
        address: dealData.address || 'NO ADDRESS EXTRACTED',
        hasZip: !!dealData.zip,
        zip: dealData.zip || 'NO ZIP CODE',
        hasPrice: !!dealData.price,
        price: dealData.price || 'NO PRICE',
        hasAcres: !!dealData.acres,
        acres: dealData.acres || 'NO ACREAGE'
      });
      
      // CRITICAL VALIDATION: Reject emails with NO valid property data
      // If address, price, AND acres are all missing, this is garbage data (likely automated test/monitoring)
      // Use word boundaries to avoid false positives (e.g., "Swannanoa" contains "na" but isn't invalid)
      const INVALID_ADDRESS_PATTERNS = [
        /\bn\/?a\b/i,           // Match "n/a", "N/A", "na", "NA" as standalone words only
        /\btbd\b/i,             // "tbd", "TBD" as standalone
        /address\s+tbd/i,       // "address tbd"
        /property\s+submission/i, // "property submission"
        /emergency\s+email/i,   // "emergency email submission"
        /\bnone\b/i,            // "none" as standalone
        /\bunknown\b/i,         // "unknown" as standalone  
        /\bnull\b/i,            // "null" as standalone
        /1600\s+camden/i,       // "1600 camden" (office address)
        /catalyst\s+office/i,   // "catalyst office"
        /office\s+address/i     // "office address"
      ];
      
      const normalizedAddress = (dealData.address || '').trim().toLowerCase();
      
      // Enhanced validation: Check if address looks real (not random garbage)
      const hasInvalidTokens = INVALID_ADDRESS_PATTERNS.some(pattern => pattern.test(normalizedAddress));
      const hasNumbers = /\d/.test(normalizedAddress); // Must have at least one number
      const hasLetters = /[a-z]/.test(normalizedAddress); // Must have at least one letter
      const notJustRandomChars = !/^[0-9\s]+[a-z0-9]{10,}$/i.test(normalizedAddress); // Reject "6 C1u61um1q8tas8rd" pattern
      
      const hasValidAddress = dealData.address && 
                             normalizedAddress.length > 5 &&
                             !hasInvalidTokens &&
                             hasNumbers &&
                             hasLetters &&
                             notJustRandomChars;
      
      // Explicitly coerce to numbers to avoid string truthiness issues
      const priceNum = Number(dealData.price) || 0;
      const acresNum = Number(dealData.acres) || 0;
      const hasValidPrice = priceNum > 0;
      const hasValidAcres = acresNum > 0;
      
      const hasValidData = hasValidAddress || hasValidPrice || hasValidAcres;
      
      if (!hasValidData) {
        console.error('❌ [VALIDATION-FAILED] Email contains NO valid property data - rejecting to prevent garbage deal creation');
        console.error(`   Email from: ${emailData.from}`);
        console.error(`   Subject: ${emailData.subject}`);
        console.error(`   Text length: ${emailData.text.length} characters`);
        console.error(`   Address: ${dealData.address || 'NONE'}`);
        console.error(`   Price: ${dealData.price || 'NONE'}`);
        console.error(`   Acres: ${dealData.acres || 'NONE'}`);
        console.error('❌ NO DEAL CREATED - NO CONFIRMATION EMAIL SENT');
        
        // Log this for investigation but don't create a deal or send confirmation
        await EmailInboundService.notifyTeamOfGarbageEmail(emailData);
        
        return res.status(200).json({ 
          message: 'Email received but rejected - insufficient property data',
          reason: 'No valid address, price, or acreage found',
          dealCreated: false
        });
      }
      
      console.log('✅ [VALIDATION-PASSED] Email has valid property data - proceeding with deal creation');
      
      // Use intelligent response system to check profile and property completeness
      const { IntelligentResponseService } = await import('./intelligentResponseService');
      
      // Extract the actual email address from emailData.from or use the already extracted one
      const contactEmail = dealData.contactEmail || IntelligentResponseService.extractContactInfo(emailData.from).email || emailData.from;
      
      // ============================
      // REPLY DETECTION: Check if this email is a response to an existing thread
      // ============================
      const { ResolutionService } = await import('./resolutionService');
      const responseAnalysis = await ResolutionService.analyzeInboundMessage(
        emailData.text + ' ' + emailData.subject,
        contactEmail,
        undefined, // no phone for email
        'email'
      );
      
      console.log('🔍 [REPLY-DETECTION] Analysis result:', {
        isResponse: responseAnalysis.isResponse,
        confidence: responseAnalysis.confidence,
        threadKey: responseAnalysis.threadKey,
        originalDealId: responseAnalysis.originalDealId,
        resolvedFields: responseAnalysis.resolvedFields
      });
      
      // If this is a response to an existing thread, process it and update the deal
      if (responseAnalysis.isResponse && responseAnalysis.originalDealId) {
        console.log(`✅ DETECTED REPLY to existing deal ${responseAnalysis.originalDealId}`);
        
        // Get the original deal to find the broker ID
        const originalDeal = await storage.getDealById(responseAnalysis.originalDealId);
        const brokerId = originalDeal?.brokerId || '';
        
        // Process the response and update the existing deal
        const resolutionResult = await ResolutionService.processResponse(responseAnalysis, {
          brokerId,
          content: emailData.text + ' ' + emailData.subject,
          channel: 'email',
          providerMessageId: emailData.subject // Use subject as a unique ID
        });
        
        if (resolutionResult.resolved && resolutionResult.updatedDeal) {
          console.log(`✅ Successfully updated existing deal ${responseAnalysis.originalDealId}`);
          console.log(`   Fields resolved: ${resolutionResult.fieldsResolved.join(', ')}`);
          
          // Send confirmation that we received their information
          await EmailInboundService.sendUpdateConfirmationEmail(emailData, resolutionResult.updatedDeal, resolutionResult.fieldsResolved);
          
          // Mark email as processed in database (permanent deduplication)
          await storage.markEmailProcessed({
            emailHash,
            dealId: responseAnalysis.originalDealId,
            from: emailData.from,
            subject: emailData.subject || ''
          });
          
          return res.json({ 
            success: true, 
            dealId: responseAnalysis.originalDealId,
            updated: true,
            fieldsResolved: resolutionResult.fieldsResolved
          });
        } else {
          console.log(`⚠️ Reply detected but resolution failed - creating new deal as fallback`);
        }
      } else {
        console.log('📝 Not a reply to existing thread - proceeding with new deal creation');
      }
      // ============================ End Reply Detection ============================
      
      // CRITICAL FIX (Dec 9, 2025): REMOVED fire-and-forget confirmation to fix multi-property handling
      // Previously, this block sent ONE confirmation before multi-property detection happened.
      // This caused: (1) Multi-property emails only got 1 confirmation, (2) Duplicate emails for single properties
      // Now: Let UnifiedDealPipeline handle confirmations for EACH property - set skipConfirmation=false below
      console.log('\n' + '='.repeat(80));
      console.log('⚡ [CONFIRMATION-DEFERRED] Confirmation will be sent by UnifiedDealPipeline');
      console.log('='.repeat(80));
      console.log(`📧 Broker Email: ${contactEmail}`);
      console.log(`📍 Property Address: ${dealData.address || 'NONE'}`);
      console.log(`🔍 Reason: Pipeline handles single AND multi-property confirmations correctly`);
      console.log('='.repeat(80));
      
      // CRITICAL FIX (Dec 9, 2025): DO NOT save dedup hash here!
      // Previously this saved hash with dealId=null BEFORE the job ran.
      // If deal creation failed, the hash remained and blocked ALL retries forever.
      // Now: Only save hash AFTER successful deal creation in backgroundJobProcessor.ts
      // SendGrid retries will create duplicate jobs but backgroundJobProcessor handles that
      console.log('⏭️ [DEDUPLICATION] Hash will be saved AFTER deal creation succeeds (in background job)');
      
      // OPTIMIZATION: Queue email processing as background job to prevent SendGrid timeouts
      // This prevents duplicate submissions from SendGrid's retry mechanism (3hr, 6hr, 12hr retries)
      const { db } = await import('./db');
      const { backgroundJobs } = await import('../shared/schema');
      
      // CRITICAL FIX (Dec 1, 2025): Create communication BEFORE background job
      // This ensures original email content is NEVER lost, even if job processing fails
      let communicationId: string | undefined;
      const originalEmailContent = emailData.text || emailData.html || '';
      const originalSubject = emailData.subject || 'No Subject';
      
      console.log('📧 [COMM-FIRST] Creating communication BEFORE background job...');
      console.log(`📧 [COMM-FIRST] Original email content length: ${originalEmailContent.length} chars`);
      
      try {
        // Find or create broker for communication linking
        let broker;
        try {
          const emailPrefix = emailData.from.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') || 'Email';
          const { broker: foundBroker } = await storage.findOrCreateBroker({
            email: emailData.from,
            firstName: emailPrefix,
            lastName: 'Submission'
          });
          broker = foundBroker;
          console.log(`📧 [COMM-FIRST] Found/created broker: ${broker?.id || 'NONE'}`);
        } catch (brokerError) {
          console.error('⚠️ [COMM-FIRST] Broker creation failed, continuing with null brokerId:', brokerError);
        }
        
        // Create communication with original email content
        const providerMsgId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const communication = await storage.createCommunication({
          brokerId: broker?.id || null, // Allow null brokerId
          email: emailData.from,
          phone: null,
          channel: 'email',
          direction: 'inbound',
          rawText: originalEmailContent || 'No content',
          subject: originalSubject,
          relatedDealId: null, // Will be linked when deal is created
          status: 'pending_followup',
          providerMessageId: providerMsgId
        });
        
        communicationId = communication.id;
        console.log(`✅ [COMM-FIRST] Communication CREATED: ${communicationId}`);
        console.log(`📧 [COMM-FIRST] rawText length saved: ${(communication as any).rawText?.length || 0} chars`);
      } catch (commError) {
        console.error('❌ [COMM-FIRST] Failed to create communication:', commError);
        console.error('⚠️ [COMM-FIRST] Continuing with backup content in job payload');
        // Don't throw - we'll still include backup content in the job
      }
      
      // Queue the email processing job in database
      await db.insert(backgroundJobs).values({
        jobType: 'process_email',
        payload: {
          emailData: {
            from: emailData.from,
            to: emailData.to,
            subject: emailData.subject,
            text: emailData.text,
            html: emailData.html,
            attachments: emailData.attachments
          },
          dealData,
          contactEmail,
          emailHash,
          skipConfirmation: false,  // FIXED (Dec 9): Let pipeline send confirmation for each property
          // CRITICAL: Include communication tracking for deal linking
          communicationId,
          // BACKUP: Original email content in case communication wasn't created
          originalEmailContent,
          originalSubject
        },
        status: 'pending',
        scheduledFor: new Date(),
        attempts: 0,
        maxAttempts: 3
      });
      
      console.log('\n' + '='.repeat(80));
      console.log('🔄 [EMAIL-WEBHOOK] BACKGROUND JOB QUEUED');
      console.log('='.repeat(80));
      console.log(`📧 Email From: ${emailData.from}`);
      console.log(`🔑 Email Hash: ${emailHash}`);
      console.log(`⏭️ skipConfirmation: TRUE (instant confirmation already sent)`);
      console.log(`📊 Job Type: process_email`);
      console.log(`🎯 Next Step: Background processor will handle full pipeline`);
      console.log('='.repeat(80));
      console.log(`✅ [EMAIL-WEBHOOK] Webhook response will be sent in <3s - processing continues in background`);
      
      // Respond immediately to SendGrid to prevent timeouts and retries
      res.json({ 
        success: true, 
        message: 'Email received and queued for processing',
        queued: true
      });

    } catch (error) {
      console.error('❌ Error processing inbound email:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Extract content from email attachments (Excel and PDF files)
   */
  private static async extractAttachmentContent(emailData: InboundEmail): Promise<string[]> {
    const content: string[] = [];
    
    if (!emailData.attachments || emailData.attachments.length === 0) {
      return content;
    }

    try {
      for (const attachment of emailData.attachments) {
        console.log(`📧 Processing attachment: ${attachment.filename} (${attachment.contentType})`);
        
        // Handle Excel files
        if (attachment.contentType?.includes('excel') || 
            attachment.contentType?.includes('spreadsheet') ||
            attachment.filename?.match(/\.(xlsx?|csv)$/i)) {
          
          try {
            const excelResult = await EmailInboundService.parseExcelAttachment(attachment);
            if (excelResult.text) {
              content.push(`EXCEL FILE: ${attachment.filename}\n${excelResult.text}`);
            }
          } catch (error) {
            console.error(`❌ Error parsing Excel file ${attachment.filename}:`, error);
          }
        }
        
        // Handle PDF files
        else if (attachment.contentType?.includes('pdf') || 
                 attachment.filename?.toLowerCase().endsWith('.pdf')) {
          
          try {
            const pdfContent = await EmailInboundService.parsePdfAttachment(attachment);
            if (pdfContent) {
              content.push(`PDF FILE: ${attachment.filename}\n${pdfContent}`);
            }
          } catch (error) {
            console.error(`❌ Error parsing PDF file ${attachment.filename}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error processing attachments:', error);
    }

    return content;
  }

  /**
   * Use enhanced parsing capabilities from routes.ts
   */
  private static async useEnhancedParsing(text: string, attachments: any[] = []): Promise<any> {
    try {
      // Import the enhanced parsing function from routes
      // Since parseDealFromText is not exported, we'll create a simplified version here
      // that uses the same logic but is accessible
      
      const result = await EmailInboundService.enhancedTextParsing(text, attachments);
      return result;
    } catch (error) {
      console.error('❌ Enhanced parsing failed:', error);
      return null;
    }
  }

  /**
   * Enhanced text parsing with PDF, multi-property, and complex description support
   */
  private static async enhancedTextParsing(text: string, attachments: any[] = []): Promise<any> {
    const extractedInfo: any = {
      submissionMethod: 'email',
      rawText: text,
      attachmentData: [],
      multipleProperties: []
    };

    // STEP 1: Process PDF attachments if available
    let combinedText = text;
    if (attachments && attachments.length > 0) {
      console.log(`🔍 Processing ${attachments.length} attachments for data extraction...`);
      
      for (const attachment of attachments) {
        if (attachment.contentType?.includes('pdf') || attachment.filename?.toLowerCase().endsWith('.pdf')) {
          try {
            console.log(`📄 Extracting text from PDF: ${attachment.filename}`);
            
            let buffer: Buffer;
            
            // Method 1: Direct content (base64 or buffer)
            if (typeof attachment.content === 'string') {
              buffer = Buffer.from(attachment.content, 'base64');
            } else if (Buffer.isBuffer(attachment.content)) {
              buffer = attachment.content;
            }
            // Method 2: Download from URL (SendGrid sends URLs sometimes)
            else if (attachment.url || attachment.content_id) {
              const pdfUrl = attachment.url || attachment.content_id;
              console.log(`📥 Downloading PDF from URL: ${pdfUrl}`);
              
              try {
                const axios = (await import('axios')).default;
                const response = await axios.get(pdfUrl, { 
                  responseType: 'arraybuffer',
                  timeout: 10000 // 10 second timeout
                });
                buffer = Buffer.from(response.data);
                console.log(`✅ Downloaded ${buffer.length} bytes from ${pdfUrl}`);
              } catch (downloadError) {
                console.error(`❌ Failed to download PDF from ${pdfUrl}:`, downloadError);
                continue;
              }
            } else {
              console.log(`⚠️ Skipping PDF - no content or URL available:`, Object.keys(attachment));
              continue;
            }

            const pdfParse = (await import('pdf-parse')).default;
            const pdfData = await pdfParse(buffer);
            let rawPdfText = pdfData.text?.trim();
            
            console.log(`📄 Raw PDF text extracted: ${rawPdfText?.length || 0} characters`);
            
            // ALWAYS use AI to clean/validate PDF text
            // This handles both scanned PDFs and text with encoding errors
            let pdfText = '';
            if (rawPdfText && rawPdfText.length > 0) {
              console.log('🤖 Using AI to clean and validate PDF text...');
              try {
                const { extractTextFromPDFWithOCR } = await import('./ocrService');
                pdfText = await extractTextFromPDFWithOCR(buffer, attachment.filename);
                console.log(`✅ AI processed ${pdfText?.length || 0} characters from PDF`);
              } catch (ocrError) {
                console.error('❌ AI processing failed for PDF:', ocrError);
                // Fallback to raw text if AI fails
                pdfText = rawPdfText;
                console.log('⚠️ Using raw PDF text as fallback');
              }
            } else {
              console.log('⚠️ PDF contains no text - may be image-only');
            }
            
            if (pdfText && pdfText.length > 10) {
              console.log(`✅ Final PDF text: ${pdfText.length} characters from ${attachment.filename}`);
              combinedText += `\n\nPDF CONTENT FROM ${attachment.filename}:\n${pdfText}`;
              extractedInfo.attachmentData.push({
                filename: attachment.filename,
                type: 'pdf',
                content: pdfText,
                length: pdfText.length
              });
            } else {
              console.warn(`⚠️ PDF ${attachment.filename} contains no extractable text after processing`);
            }
          } catch (error) {
            console.error(`❌ Failed to parse PDF ${attachment.filename}:`, error);
          }
        }
      }
    }
    
    // PREPROCESSING: Clean up hybrid address-acreage formats AFTER appending attachments
    // Converts: "30044-26.51 acres" → "30044. 26.51 acres"
    // This handles both email body text AND PDF attachment text
    combinedText = combinedText.replace(/(\d{5})-(\d+\.?\d*)\s*acres?/gi, '$1. $2 acres');
    console.log('📧 Preprocessing: Normalized hybrid address-acreage formats in combined text');

    // STEP 2: Check for multiple properties in the text
    console.log('🔍 Checking for multiple properties in email...');
    const hasMultipleProperties = EmailInboundService.detectMultipleProperties(combinedText);
    
    let result: any;
    
    if (hasMultipleProperties) {
      console.log('🏘️ Multiple properties detected! Processing each property...');
      const propertySegments = EmailInboundService.splitMultipleProperties(combinedText);
      
      if (propertySegments.length > 1) {
        const multipleProperties = [];
        for (let i = 0; i < propertySegments.length; i++) {
          const segment = propertySegments[i];
          const property = await EmailInboundService.extractPropertyFromSegment(segment);
          multipleProperties.push(property);
          console.log(`✅ Property ${i + 1}: ${property.address || 'Address TBD'} - $${property.price || '0'} - ${property.acres || '0'} acres`);
        }
        
        result = {
          address: multipleProperties[0]?.address || null,
          // FIX (Dec 1, 2025): Include city/state/zip in multi-property result!
          // Without these, geocoding fails because address is sent without location context
          city: multipleProperties[0]?.city || null,
          state: multipleProperties[0]?.state || null,
          zip: multipleProperties[0]?.zip || null,
          askingPrice: multipleProperties[0]?.price || null,
          sizeAcres: multipleProperties[0]?.acres || null,
          attachmentData: extractedInfo.attachmentData,
          isMultiProperty: true,
          multipleProperties: multipleProperties
        };
      } else {
        // Fallback to single property if splitting failed
        result = await EmailInboundService.extractSingleProperty(combinedText, extractedInfo);
      }
    } else {
      // Single property
      console.log('📍 Single property detected');
      result = await EmailInboundService.extractSingleProperty(combinedText, extractedInfo);
    }

    function getMultiplier(unit: string): number {
      const multipliers: Record<string, number> = {
        'k': 1000, 'm': 1000000, 'mm': 1000000, 'mil': 1000000, 'million': 1000000, 'b': 1000000000
      };
      return multipliers[unit.toLowerCase()] || 1;
    }

    return result;
  }

  /**
   * Detect if the text contains multiple properties
   * SAFEGUARD: Requires valid address patterns to prevent false positives from AI parsing failures
   */
  private static detectMultipleProperties(text: string): boolean {
    console.log('🔍 Checking for multiple property indicators...');
    
    // SAFEGUARD: Check for valid address patterns first to prevent false positives
    // This prevents multi-property detection when AI parsing fails and produces garbage like "6 C1u61um1q8tas8rd"
    // Pattern validates ADDRESS STRUCTURE with REQUIRED valid street suffix to avoid matching email headers:
    // - Starts with street number
    // - Optional directional (N, S.W., NE, etc.)
    // - 1-5 word street name (alphanumeric, periods, apostrophes, hyphens)
    // - MUST end with valid street suffix (St, Street, Ave, Avenue, Rd, Road, Dr, Drive, Ln, Lane, Way, Blvd, Boulevard, Ct, Court, Pl, Place, Pkwy, Parkway, Cir, Circle, Loop, Trail, Terrace, Pike, Highway, etc.)
    // Matches: "123 Main St", "456 N.W. 7th Avenue", "789 County Road", "100 Park Loop"
    // Blocks: Email headers like "76 244 lightspeed chrlnc", IP addresses, timestamps
    const validAddressPatterns = text.match(/\d+\s+(?:(?:[NSEW]\.?|[NS]\.?[EW]\.?)\s+)?(?:[A-Za-z0-9.'\-]+\s+){0,5}\b(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|way|blvd|boulevard|ct|court|pl|place|pkwy|parkway|cir|circle|loop|trail|terrace|pike|highway)\b/gi) || [];
    
    if (validAddressPatterns.length < 2) {
      console.log(`⚠️ Multi-property detection skipped: Found ${validAddressPatterns.length} valid address pattern(s), need 2+ to prevent false positives from AI parsing failures`);
      return false;
    }
    
    console.log(`✅ Found ${validAddressPatterns.length} valid address patterns - proceeding with multi-property detection`);
    
    // Check for numbered properties (1. 2. etc.)
    const numberedCount = (text.match(/(?:^|\n)\s*\d+[\.\)]/gm) || []).length;
    if (numberedCount > 1) {
      console.log(`📍 Found ${numberedCount} numbered property indicators with ${validAddressPatterns.length} valid addresses`);
      return true;
    }
    
    // Check for lettered properties (A. B. etc.)
    const letteredCount = (text.match(/(?:^|\n)\s*[A-Z][\.\)]/gm) || []).length;
    if (letteredCount > 1) {
      console.log(`📍 Found ${letteredCount} lettered property indicators with ${validAddressPatterns.length} valid addresses`);
      return true;
    }
    
    // Check for multiple property/address patterns
    const propertyKeywords = text.match(/\b(?:property|address|location|parcel|lot|site)\b/gi) || [];
    
    if (propertyKeywords.length > 2 || validAddressPatterns.length > 1) {
      console.log(`📍 Found ${propertyKeywords.length} property keywords and ${validAddressPatterns.length} valid addresses`);
      return true;
    }
    
    // Check for multiple price indicators
    const pricePatterns = text.match(/\$\s*[\d,]+(?:,\d{3})*(?:\.\d+)?/g) || [];
    if (pricePatterns.length > 1) {
      console.log(`📍 Found ${pricePatterns.length} price indicators`);
      return true;
    }
    
    console.log('📍 Single property detected');
    return false;
  }

  /**
   * Split text containing multiple properties into individual property segments
   */
  private static splitMultipleProperties(text: string): string[] {
    console.log('🔄 Splitting multiple properties...');
    
    // Strategy 1: Split by numbered list (1. 2. etc.)
    const numberedSections = text.match(/(?:^|\n)\s*(\d+[\.\)]\s*[^\n]*(?:\n(?!\s*\d+[\.\)]).)*)/gm);
    if (numberedSections && numberedSections.length > 1) {
      console.log(`✅ Split into ${numberedSections.length} numbered properties`);
      return numberedSections.map(section => section.trim());
    }
    
    // Strategy 2: Split by lettered list (A. B. etc.)  
    const letteredSections = text.match(/(?:^|\n)\s*([A-Z][\.\)]\s*[^\n]*(?:\n(?!\s*[A-Z][\.\)]).)*)/gm);
    if (letteredSections && letteredSections.length > 1) {
      console.log(`✅ Split into ${letteredSections.length} lettered properties`);
      return letteredSections.map(section => section.trim());
    }
    
    // Strategy 3: Split by address patterns - FIXED: Require word boundaries to prevent false matches like "8rd" or "yest"
    // CRITICAL BUGFIX: Deduplicate addresses before splitting to prevent creating duplicate deals for same property
    const addressMatches = Array.from(text.matchAll(/(\d+\s+[a-zA-Z\s]+\b(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|way|blvd|boulevard|circle|court|place|parkway|trail|terrace)\b[^\n]*(?:\n(?!\d+\s+[a-zA-Z]).)*)/gmi));
    
    if (addressMatches.length > 1) {
      // Extract unique addresses by normalizing and deduplicating
      const uniqueAddresses = new Map<string, string>();
      
      for (const match of addressMatches) {
        const fullText = match[0].trim();
        // Extract just the address part (first line usually)
        const addressLine = fullText.split('\n')[0].trim();
        // Normalize: lowercase, remove extra spaces, remove punctuation
        const normalized = addressLine.toLowerCase().replace(/[,\.]/g, '').replace(/\s+/g, ' ').trim();
        
        // Only keep first occurrence of each unique address
        if (!uniqueAddresses.has(normalized)) {
          uniqueAddresses.set(normalized, fullText);
          console.log(`📍 [DEDUP] Added unique address: ${addressLine}`);
        } else {
          console.log(`⚠️ [DEDUP] Skipping duplicate address: ${addressLine}`);
        }
      }
      
      const uniqueSegments = Array.from(uniqueAddresses.values());
      
      if (uniqueSegments.length > 1) {
        console.log(`✅ Split into ${uniqueSegments.length} UNIQUE address-based properties (deduplicated from ${addressMatches.length} total matches)`);
        console.log('📍 [DEBUG] Unique addresses:', uniqueSegments.map(m => m.substring(0, 100)).join(' | '));
        return uniqueSegments;
      } else {
        console.log(`⚠️ After deduplication, only ${uniqueSegments.length} unique address found - treating as single property`);
        return [text]; // Return full text as single property
      }
    }
    
    // Strategy 4: Split by paragraphs containing property info
    const paragraphs = text.split(/\n\s*\n/).filter(para => para.trim().length > 20);
    const propertyParagraphs = paragraphs.filter(para => {
      return /(?:property|address|acres?|acreage|\$[\d,]+|location)/i.test(para);
    });
    
    if (propertyParagraphs.length > 1) {
      console.log(`✅ Split into ${propertyParagraphs.length} paragraph-based properties`);
      return propertyParagraphs;
    }
    
    console.log('❌ Could not split properties, treating as single property');
    return [text];
  }

  /**
   * Detect if email is from SendGrid's own automated systems (monitoring, events, notifications)
   * These emails contain message IDs and tracking codes that AI might misinterpret as property addresses
   */
  private static detectSendGridAutomatedEmail(emailData: InboundEmail): boolean {
    // Check email content for SendGrid metadata patterns
    const text = (emailData.text || '').toLowerCase();
    const subject = (emailData.subject || '').toLowerCase();
    const html = (emailData.html || '').toLowerCase();
    const combinedContent = `${text} ${subject} ${html}`;
    
    // Pattern 1: SendGrid message IDs (format: "sg_message_id", "message id:", etc.)
    if (/sg[_\s-]message[_\s-]id/i.test(combinedContent)) {
      console.log('🚫 [SENDGRID-DETECT] Found SendGrid message ID pattern');
      return true;
    }
    
    // Pattern 2: SendGrid event IDs (format: "sg_event_id", "event id:", etc.)
    if (/sg[_\s-]event[_\s-]id/i.test(combinedContent)) {
      console.log('🚫 [SENDGRID-DETECT] Found SendGrid event ID pattern');
      return true;
    }
    
    // Pattern 3: Email delivery/monitoring notifications
    const monitoringKeywords = [
      'email delivery',
      'bounce notification',
      'delivery status',
      'email status notification',
      'sendgrid notification',
      'message delivery',
      'smtp response'
    ];
    
    if (monitoringKeywords.some(keyword => combinedContent.includes(keyword))) {
      console.log('🚫 [SENDGRID-DETECT] Found email monitoring keyword');
      return true;
    }
    
    // Pattern 4: Garbage address patterns that indicate metadata extraction
    // These are patterns we've seen from SendGrid metadata being parsed
    const garbageAddressPatterns = [
      /\d+\s+[A-Z]\d[a-z]\d{2}[a-z]\d[a-z]\d[a-z]\d{2}[a-z]\d{2}[a-z]\d[a-z]\d/i,  // "6 C1u61um1q8tas8rd" pattern
      /\d+\s+\d{2}[a-z]{3,8}est\b/i,  // "25 77btyest" pattern
      /\b[a-z0-9]{20,}\b/i  // Very long alphanumeric strings (message IDs)
    ];
    
    if (garbageAddressPatterns.some(pattern => pattern.test(text))) {
      console.log('🚫 [SENDGRID-DETECT] Found garbage address pattern matching SendGrid metadata');
      return true;
    }
    
    // Pattern 5: SendGrid domain in FROM address (but not customer forwarding)
    const from = (emailData.from || '').toLowerCase();
    if (from.includes('sendgrid.') || from.includes('@sg.') || from.includes('sendgrid')) {
      console.log('🚫 [SENDGRID-DETECT] Email from SendGrid domain');
      return true;
    }
    
    return false;
  }

  /**
   * Check if an address is likely an office/company address (not a property)
   */
  private static isOfficeAddress(address: string): boolean {
    if (!address) return false;
    
    // Office indicators: Suite, Floor, Office, Building, etc.
    const officePatterns = /\b(?:suite|ste|floor|flr|office|building|bldg|unit #\d+)\b/i;
    
    // Company footer indicators: "Sent by", company names with Office
    const footerPatterns = /\b(?:sent by|northmarq|broker|realty|capital|partners).*office/i;
    
    // Known office addresses that should NEVER be extracted as property addresses
    const knownOfficeAddresses = [
      /1801\s+west\s+end\s+ave/i,  // Northmarq Nashville office
      /1801\s+west\s+end\s+avenue/i,
      // Add more known office addresses here as they're discovered
    ];
    
    // Check if address matches any known office address
    for (const officeAddr of knownOfficeAddresses) {
      if (officeAddr.test(address)) {
        console.log(`🚫 [OFFICE-FILTER] Detected known office address: ${address}`);
        return true;
      }
    }
    
    return officePatterns.test(address) || footerPatterns.test(address);
  }

  /**
   * Validate city and state before appending to address (NO MOCK DATA rule)
   */
  private static validateCityState(city: string | null | undefined, state: string | null | undefined): { isValid: boolean; reason?: string } {
    // US State codes whitelist (all 50 states + DC, PR, VI, GU, etc.)
    const VALID_US_STATES = new Set([
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
      'DC', 'PR', 'VI', 'GU', 'AS', 'MP'
    ]);
    
    // Garbage terms that are NOT real cities (common AI hallucinations)
    const GARBAGE_CITY_TERMS = new Set([
      'deal', 'property', 'submit', 'submission', 'opportunity', 'site',
      'parcel', 'land', 'acre', 'acres', 'development', 'project'
    ]);
    
    // Reject if state is missing or invalid
    if (!state || state.length !== 2) {
      return { isValid: false, reason: 'Missing or invalid state code' };
    }
    
    if (!VALID_US_STATES.has(state.toUpperCase())) {
      return { isValid: false, reason: `Invalid state code: ${state}` };
    }
    
    // Reject if city is missing, too short, or matches garbage terms
    if (!city || city.trim().length < 2) {
      return { isValid: false, reason: 'Missing or too short city name' };
    }
    
    const cityLower = city.trim().toLowerCase();
    if (GARBAGE_CITY_TERMS.has(cityLower)) {
      return { isValid: false, reason: `Garbage placeholder city: ${city}` };
    }
    
    // City must contain only letters, spaces, hyphens (no numbers or special chars)
    if (!/^[a-zA-Z\s\-'.]+$/.test(city)) {
      return { isValid: false, reason: `Invalid city characters: ${city}` };
    }
    
    return { isValid: true };
  }

  /**
   * SERVER-SIDE SANITIZATION: Strip fake city/state placeholders from address string
   * This is a fail-safe if AI still generates placeholders despite prompt rules
   * CRITICAL: Handles ZIP codes, spelled-out states, and validates against whitelists
   */
  private static sanitizeFakeCityState(address: string | null): string | null {
    if (!address) return address;
    
    // Valid US state codes (DO NOT strip these)
    const VALID_US_STATES = new Set([
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
      'DC', 'PR', 'VI', 'GU', 'AS', 'MP'
    ]);
    
    // Garbage city/state names that indicate fake data
    const GARBAGE_TERMS = new Set([
      'deal', 'property', 'submit', 'submission', 'opportunity', 'site',
      'parcel', 'land', 'acre', 'acres', 'development', 'project'
    ]);
    
    // Split address by commas to analyze components
    const parts = address.split(',').map(p => p.trim());
    
    if (parts.length < 2) {
      // No city/state components to validate
      return address;
    }
    
    // Check the last component - could be:
    // - "ST" (state code)
    // - "ST 12345" (state + ZIP)
    // - "Submission" (garbage spelled-out)
    const lastPart = parts[parts.length - 1];
    const secondToLastPart = parts.length >= 2 ? parts[parts.length - 2] : null;
    
    // Extract state code from last part (with or without ZIP)
    // Matches: "NC", "NC 28805", "NC  28805-1234"
    const stateMatch = lastPart.match(/^([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/i);
    
    if (stateMatch) {
      const stateCode = stateMatch[1].toUpperCase();
      const isInvalidState = !VALID_US_STATES.has(stateCode);
      const isGarbageCity = secondToLastPart && GARBAGE_TERMS.has(secondToLastPart.toLowerCase());
      
      if (isInvalidState || isGarbageCity) {
        // Strip last 2 components (city + state/ZIP)
        const cleanedParts = parts.slice(0, -2);
        const cleanedAddress = cleanedParts.join(', ');
        console.log(`🧹 [ADDRESS-SANITIZE] Stripped fake city/state:`);
        console.log(`   Before: "${address}"`);
        console.log(`   Reason: ${isInvalidState ? `Invalid state: ${stateCode}` : `Garbage city: ${secondToLastPart}`}`);
        console.log(`   After:  "${cleanedAddress}"`);
        return cleanedAddress || null;
      }
    } else if (secondToLastPart && GARBAGE_TERMS.has(lastPart.toLowerCase())) {
      // Last part is a spelled-out garbage term like "Submission"
      // Strip last 2 components
      const cleanedParts = parts.slice(0, -2);
      const cleanedAddress = cleanedParts.join(', ');
      console.log(`🧹 [ADDRESS-SANITIZE] Stripped fake location:`);
      console.log(`   Before: "${address}"`);
      console.log(`   Reason: Garbage term: ${lastPart}`);
      console.log(`   After:  "${cleanedAddress}"`);
      return cleanedAddress || null;
    }
    
    // No fake data detected - return original
    return address;
  }

  /**
   * Extract property information from a text segment using AI
   */
  private static async extractPropertyFromSegment(segment: string): Promise<any> {
    // Use AI to extract property details from segment
    const { parsePropertyDataWithFallback } = await import('./aiEmailParser.js');
    const aiParsed = await parsePropertyDataWithFallback(segment);
    
    // CRITICAL: Store ONLY street address, not full concatenated address
    // City/state/ZIP will be stored separately and combined by formatFullAddress()
    const streetAddress = EmailInboundService.sanitizeFakeCityState(aiParsed.address) || null;
    
    // Validate city/state to prevent fake data (NO MOCK DATA rule)
    const cityStateValidation = EmailInboundService.validateCityState(aiParsed.city, aiParsed.state);
    const validCity = cityStateValidation.isValid ? aiParsed.city : null;
    const validState = cityStateValidation.isValid ? aiParsed.state : null;
    
    if (cityStateValidation.isValid && aiParsed.city && aiParsed.state) {
      console.log(`✅ [CITY-STATE-VALIDATION] Accepted: ${aiParsed.city}, ${aiParsed.state}`);
    } else if (aiParsed.city || aiParsed.state) {
      console.log(`❌ [CITY-STATE-VALIDATION] Rejected: city="${aiParsed.city}", state="${aiParsed.state}" - ${cityStateValidation.reason}`);
      console.log(`   → NOT storing fake city/state (NO MOCK DATA rule)`);
    }
    
    return {
      address: streetAddress,
      city: validCity,
      state: validState,
      zip: aiParsed.zip || null,
      price: aiParsed.askingPrice,
      acres: aiParsed.sizeAcres,
      productType: aiParsed.productType || undefined,
      zoning: aiParsed.zoning || undefined,
      description: segment.substring(0, 300)
    };
  }

  /**
   * Detect and fetch property listing URLs to extract accurate address information
   */
  private static async extractAddressFromURL(text: string): Promise<{address: string | null, city: string | null, state: string | null, zip: string | null} | null> {
    // Detect property listing URLs (Marcus & Millichap, LoopNet, etc.)
    const urlPattern = /https?:\/\/(www\.)?(marcusmillichap\.com|loopnet\.com|crexi\.com|ten-x\.com)\/[^\s]+/gi;
    const urls = text.match(urlPattern);
    
    if (!urls || urls.length === 0) {
      return null; // No property listing URLs found
    }
    
    console.log(`🔗 [URL-FETCH] Found ${urls.length} property listing URL(s): ${urls[0]}`);
    
    try {
      // Fetch the first URL
      const response = await fetch(urls[0], {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LandLinq/1.0; +https://landlinq.ai)'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      if (!response.ok) {
        console.log(`⚠️ [URL-FETCH] Failed to fetch ${urls[0]}: ${response.status}`);
        return null;
      }
      
      const html = await response.text();
      console.log(`✅ [URL-FETCH] Successfully fetched page (${html.length} chars)`);
      
      // Use AI to extract address from the fetched HTML
      const { parsePropertyDataWithFallback } = await import('./aiEmailParser.js');
      const extracted = await parsePropertyDataWithFallback(html.substring(0, 8000)); // First 8000 chars
      
      if (extracted.address) {
        console.log(`✅ [URL-FETCH] Extracted address from listing: ${extracted.address}, ${extracted.city}, ${extracted.state}`);
        return {
          address: extracted.address,
          city: extracted.city,
          state: extracted.state,
          zip: extracted.zip
        };
      }
      
      return null;
    } catch (error) {
      console.error(`❌ [URL-FETCH] Error fetching URL:`, error);
      return null;
    }
  }

  /**
   * Extract single property information using AI (replaces complex regex)
   */
  private static async extractSingleProperty(combinedText: string, extractedInfo: any): Promise<any> {
    // ENHANCEMENT: Try to extract address from property listing URLs first
    let urlExtractedAddress = null;
    try {
      urlExtractedAddress = await EmailInboundService.extractAddressFromURL(combinedText);
    } catch (urlError) {
      console.log(`⚠️ [URL-FETCH] URL extraction failed (non-critical):`, urlError);
    }
    
    // Use AI to extract all property details
    const { parsePropertyDataWithFallback } = await import('./aiEmailParser.js');
    const aiParsed = await parsePropertyDataWithFallback(combinedText);
    
    // If URL extraction found a valid address, use it instead of AI-parsed address
    if (urlExtractedAddress && urlExtractedAddress.address) {
      console.log(`🎯 [URL-FETCH] Using URL-extracted address instead of email text`);
      aiParsed.address = urlExtractedAddress.address;
      aiParsed.city = urlExtractedAddress.city || aiParsed.city;
      aiParsed.state = urlExtractedAddress.state || aiParsed.state;
      aiParsed.zip = urlExtractedAddress.zip || aiParsed.zip;
    }
    
    // CRITICAL: Store ONLY street address, not full concatenated address
    // City/state/ZIP will be stored separately and combined by formatFullAddress()
    const streetAddress = EmailInboundService.sanitizeFakeCityState(aiParsed.address) || null;
    
    // Validate city/state to prevent fake data (NO MOCK DATA rule)
    const cityStateValidation = EmailInboundService.validateCityState(aiParsed.city, aiParsed.state);
    const validCity = cityStateValidation.isValid ? aiParsed.city : null;
    const validState = cityStateValidation.isValid ? aiParsed.state : null;
    
    if (cityStateValidation.isValid && aiParsed.city && aiParsed.state) {
      console.log(`✅ [CITY-STATE-VALIDATION] Accepted: ${aiParsed.city}, ${aiParsed.state}`);
    } else if (aiParsed.city || aiParsed.state) {
      console.log(`❌ [CITY-STATE-VALIDATION] Rejected: city="${aiParsed.city}", state="${aiParsed.state}" - ${cityStateValidation.reason}`);
      console.log(`   → NOT storing fake city/state (NO MOCK DATA rule)`);
    }
    
    // Return AI-parsed data in expected format with separate address components
    return {
      address: streetAddress,
      city: validCity,
      state: validState,
      zip: aiParsed.zip || null,
      askingPrice: aiParsed.askingPrice,
      sizeAcres: aiParsed.sizeAcres,
      unitCount: aiParsed.unitCount,
      productType: aiParsed.productType,
      zoning: aiParsed.zoning,
      hasEntitlements: aiParsed.hasEntitlements,
      sewerAvailable: aiParsed.sewerAvailable,
      propertyName: aiParsed.propertyName,
      parcelId: aiParsed.parcelId,
      squareFootage: aiParsed.squareFootage,
      parkingSpaces: aiParsed.parkingSpaces,
      stories: aiParsed.stories,
      description: aiParsed.brokerNotes,
      attachmentData: extractedInfo.attachmentData,
      isMultiProperty: false,
      multipleProperties: []
    };
  }

  /**
   * Parse Excel attachment and extract text content
   * ENHANCED: Intelligently extract financial data from proforma spreadsheets
   * Returns both the full text content and a financial summary for ingestion notes
   */
  private static async parseExcelAttachment(attachment: any): Promise<{text: string | null, financialSummary: string | null}> {
    try {
      // Convert base64 content to buffer if needed
      let buffer: Buffer;
      if (typeof attachment.content === 'string') {
        buffer = Buffer.from(attachment.content, 'base64');
      } else if (Buffer.isBuffer(attachment.content)) {
        buffer = attachment.content;
      } else {
        console.log('❌ Unsupported attachment content format');
        return {text: null, financialSummary: null};
      }

      // Parse Excel workbook
      const workbook = XLSX.read(buffer);
      const allContent: string[] = [];
      const financialData: any = {};

      // Extract content from all sheets
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const csvContent = XLSX.utils.sheet_to_csv(sheet);
        
        if (csvContent.trim()) {
          allContent.push(`SHEET: ${sheetName}\n${csvContent}`);
          
          // ENHANCED: Extract key financial metrics from proforma
          const noi = csvContent.match(/(?:NOI|Net Operating Income|Net Income)[\s,:]*([$]?\s*[\d,]+)/i);
          const capRate = csvContent.match(/(?:Cap Rate|Capitalization Rate)[\s,:]*([\d.]+)%?/i);
          const purchasePrice = csvContent.match(/(?:Purchase Price|Acquisition Price|Sale Price)[\s,:]*([$]?\s*[\d,]+)/i);
          const units = csvContent.match(/(?:Total Units|Unit Count|Units)[\s,:]*([\d,]+)/i);
          const sqft = csvContent.match(/(?:Total (?:SF|Square Feet)|Rentable SF)[\s,:]*([\d,]+)/i);
          const occupancy = csvContent.match(/(?:Occupancy Rate?|Occupied)[\s,:]*([\d.]+)%?/i);
          
          if (noi) financialData.noi = noi[1].replace(/[,$]/g, '').trim();
          if (capRate) financialData.capRate = capRate[1];
          if (purchasePrice) financialData.purchasePrice = purchasePrice[1].replace(/[,$]/g, '').trim();
          if (units) financialData.units = units[1].replace(/,/g, '').trim();
          if (sqft) financialData.sqft = sqft[1].replace(/,/g, '').trim();
          if (occupancy) financialData.occupancy = occupancy[1];
        }
      });

      // Create financial summary for ingestion notes
      let financialSummary = null;
      if (Object.keys(financialData).length > 0) {
        let summary = '📊 Financial Data from Excel:\n';
        if (financialData.purchasePrice) summary += `   Purchase Price: $${financialData.purchasePrice}\n`;
        if (financialData.noi) summary += `   NOI: $${financialData.noi}\n`;
        if (financialData.capRate) summary += `   Cap Rate: ${financialData.capRate}%\n`;
        if (financialData.units) summary += `   Units: ${financialData.units}\n`;
        if (financialData.sqft) summary += `   Square Footage: ${financialData.sqft} SF\n`;
        if (financialData.occupancy) summary += `   Occupancy: ${financialData.occupancy}%\n`;
        financialSummary = summary;
        console.log('📊 Extracted financial data from Excel:', financialData);
      }

      return {
        text: allContent.join('\n\n'),
        financialSummary
      };
    } catch (error) {
      console.error('❌ Error parsing Excel file:', error);
      return {text: null, financialSummary: null};
    }
  }

  /**
   * Parse PDF attachment and extract text content
   */
  private static async parsePdfAttachment(attachment: any): Promise<string | null> {
    try {
      // Convert base64 content to buffer if needed
      let buffer: Buffer;
      if (typeof attachment.content === 'string') {
        buffer = Buffer.from(attachment.content, 'base64');
      } else if (Buffer.isBuffer(attachment.content)) {
        buffer = attachment.content;
      } else {
        console.log('❌ Unsupported attachment content format');
        return null;
      }

      // Dynamically import pdf-parse to avoid startup issues
      const pdfParse = (await import('pdf-parse')).default;
      
      // Parse PDF and extract text
      const pdfData = await pdfParse(buffer);
      return pdfData.text?.trim() || null;
    } catch (error) {
      console.error('❌ Error parsing PDF file:', error);
      return null;
    }
  }

  /**
   * Extract deal data using OpenAI for enhanced parsing
   */
  private static async extractDealDataWithAI(emailData: InboundEmail, fullText?: string): Promise<ParsedDealData | null> {
    let startTime = Date.now();
    try {
      // Check if OpenAI API key is available
      if (!process.env.OPENAI_API_KEY) {
        console.error('⚠️ [PRODUCTION-CRITICAL] OPENAI_API_KEY environment variable is NOT SET!');
        console.error('⚠️ [PRODUCTION-CRITICAL] System will use FALLBACK REGEX parser (known to have address parsing bugs)');
        console.error('⚠️ [PRODUCTION-CRITICAL] To fix: Add OPENAI_API_KEY to production deployment secrets');
        console.log('📧 OpenAI API key not available, falling back to regex parsing');
        return null;
      }
      
      console.log('✅ [AI-EXTRACTION] OpenAI API key found, using AI-powered address extraction');

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // CRITICAL: Prioritize main body text over metadata/headers
      // The email body is where brokers write the actual property address
      const mainBodyText = emailData.text || '';
      const emailContent = fullText || `
MAIN EMAIL BODY (PRIMARY SOURCE - EXTRACT ADDRESS FROM HERE):
${mainBodyText}

${emailData.subject && emailData.subject !== '(No Subject)' ? `Subject: ${emailData.subject}` : ''}
${emailData.html ? `HTML Content: ${emailData.html}` : ''}
${emailData.attachments?.length ? `Attachments: ${emailData.attachments.map(a => a.filename).join(', ')}` : ''}

Email From: ${emailData.from}
      `.trim();

      const extractionPrompt = `
You are a real estate data extraction expert. Your job is to ONLY extract information that is EXPLICITLY STATED in this email - NEVER infer, guess, or make up any information.

Email and Attachment Content:
${emailContent}

For each field, you must provide evidence from the source text or return null. Respond with valid JSON only:
{
  "address": {
    "value": "STREET ADDRESS ONLY - e.g. '3201 W Franklin Blvd'" or null,
    "evidence_text": "quote from source text" or null,
    "is_explicit": true/false
  },
  "city": {
    "value": "CITY NAME ONLY - e.g. 'Gastonia'" or null,
    "evidence_text": "quote from source text" or null,
    "is_explicit": true/false
  },
  "state": {
    "value": "2-LETTER STATE CODE ONLY - e.g. 'NC'" or null,
    "evidence_text": "quote from source text" or null,
    "is_explicit": true/false
  },
  "zip": {
    "value": "ZIP CODE ONLY - e.g. '28052'" or null,
    "evidence_text": "quote from source text" or null,
    "is_explicit": true/false
  },
  "price": {
    "value": number or null,
    "evidence_text": "quote from source text" or null,
    "is_explicit": true/false
  },
  "acres": {
    "value": number or null,
    "evidence_text": "quote from source text" or null,
    "is_explicit": true/false
  },
  "contactName": {
    "value": "name as written" or null,
    "evidence_text": "quote from source text" or null,
    "is_explicit": true/false
  },
  "contactEmail": {
    "value": "email address" or null,
    "evidence_text": "quote from source text" or null,
    "is_explicit": true/false
  },
  "contactPhone": {
    "value": "phone as written" or null,
    "evidence_text": "quote from source text" or null,
    "is_explicit": true/false
  },
  "zoning": {
    "value": "zoning as stated" or null,
    "evidence_text": "quote from source text" or null,
    "is_explicit": true/false
  },
  "description": {
    "value": "brief description from content" or null,
    "evidence_text": "quote from source text" or null,
    "is_explicit": true/false
  },
  "utilities": {
    "value": "utilities as mentioned" or null,
    "evidence_text": "quote from source text" or null,
    "is_explicit": true/false
  }
}

⚡ CRITICAL ADDRESS SEPARATION RULE - MANDATORY:
When you see an address like "3201 W Franklin Blvd Gastonia, NC 28052", you MUST split it:
- address: "3201 W Franklin Blvd" (street only)
- city: "Gastonia" (city only)
- state: "NC" (2-letter code only)
- zip: "28052" (ZIP only)

🚨 ABSOLUTELY FORBIDDEN: Never put city/state/zip in the address field!
🚨 Example: "3201 W Franklin Blvd, Gastonia, NC 28052" in address field is WRONG!

STRICT RULES - FOLLOW EXACTLY:
1. ONLY extract information that is explicitly written in the source text
2. NEVER infer, guess, estimate, or assume any information
3. For each field, provide the exact text quote as evidence_text
4. Set is_explicit=true ONLY if the information is clearly stated
5. If information is missing, vague, or unclear, return null for that field
6. DO NOT convert units, formats, or make calculations
7. DO NOT fill in missing information based on context clues
8. Contact email should come from the From field of the email
9. **CRITICAL - NEVER CORRECT TYPOS OR SPELLING**: If the email says "FERMONT DR", extract "FERMONT DR" - DO NOT change it to "Fremont Dr" or any other spelling. Preserve the EXACT spelling as written, even if it looks like a typo!

CRITICAL ADDRESS RULES - READ CAREFULLY:
- **ABSOLUTE PRIORITY**: Extract the address from the "MAIN EMAIL BODY" section FIRST - this is where brokers write the actual property they're submitting
- **EXAMPLE**: If main body says "48 SWANNANOA RIVER RD" - extract "48 SWANNANOA RIVER RD" (NOT any other address found in HTML or metadata)
- **VALIDATION**: Addresses like "43 Lane" are TOO SHORT and INVALID - need full address like "43 Example Lane" with street name
- **PRIORITY #2**: If you see an explicitly LABELED property address (e.g., "Address:", "Property Address:", "Location:"), extract THAT address - it is the property being submitted
- **DO NOT extract footer/signature addresses**: IGNORE ALL addresses in email footers/signatures, including:
  * Any address containing Suite, Floor, Office, Building numbers
  * Broker office addresses (e.g., "1801 West End Avenue" - this is Northmarq's office, NOT a property!)
  * Addresses following contact names, phone numbers, or company names at the end of emails
  * Any address after "Sent by", "Get Outlook for", signature separators, or company logos
- **PRESERVE EXACT FORMAT**: Extract addresses EXACTLY as written, including ZIP codes even without city/state
- **ZIP-Only Addresses**: "0 West Trinity Lane, 37207" → Extract exactly as "0 West Trinity Lane, 37207" (don't add city/state)
- **Example**: If the email says "West Stone Drive, Kingsport, TN 37645" in the body AND "1801 West End Ave, Nashville, TN" in the footer → Extract "West Stone Drive, Kingsport, TN 37645" (the property, NOT the office!)
- Do NOT confuse phrases like "in one of" or "in downtown" with state abbreviations (IN, OF, etc.)
- Do NOT abbreviate "Suite" to "SU" - Suite is NOT a state abbreviation  
- Extract the full address including city and state from context if available
- Example: "745 E Argyle Avenue in one of Nashville's fastest-growing districts" → "745 E Argyle Avenue, Nashville, TN"
- Do NOT extract "IN One, Of", "SU" (from Suite), or similar nonsense from descriptive phrases
- If you see "Suite" in the address, either include it fully or exclude it entirely - NEVER abbreviate it to "SU"

CRITICAL CITY/STATE RULES - NO MOCK DATA ALLOWED:
- ⚠️ **NEVER GENERATE PLACEHOLDER CITY/STATE VALUES** - This is CRITICAL!
- If city/state are NOT explicitly mentioned in the email, return null for those fields
- **FORBIDDEN PLACEHOLDER VALUES**: "Deal", "Property", "Submit", "Site", "SU", "PR" (from words, not states), or ANY made-up city/state
- Valid state codes ONLY: AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA, ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, SD, TN, TX, UT, VT, VA, WA, WV, WI, WY, DC
- **BAD EXAMPLE**: "48 Swannanoa rd" → DO NOT add fake "Deal, SU" - return street address ONLY
- **GOOD EXAMPLE**: "48 Swannanoa Road" → Return address without city/state (they weren't provided)
- **GOOD EXAMPLE**: "48 Swannanoa Road, Asheville, NC" → Return full address (city/state were explicit)
- If you're not 100% certain about city/state, return null - DO NOT GUESS OR INFER

⚡ CRITICAL - ADDRESSES WITHOUT COMMAS (Common in emails):
Many email addresses don't use commas between components. You MUST still split them into separate fields!

Example: Input: "1216 fremont dr wingate nc 28174" (NO COMMAS)
→ address: "1216 fremont dr"
→ city: "wingate"
→ state: "nc"
→ zip: "28174"
**NOTE**: Even without commas, you MUST extract city/state/ZIP as separate fields!

Example: Input: "500 main st charlotte nc" (NO COMMAS, no ZIP)
→ address: "500 main st"
→ city: "charlotte"
→ state: "nc"
→ zip: null

**PATTERN FOR COMMA-LESS ADDRESSES**:
When you see: [street number] [street name] [street suffix] [city name] [state code] [optional ZIP]
Split it as: address = street portion, city = word before state code, state = 2-letter code, zip = 5 digits

CRITICAL PRICE RULES:
- ONLY extract the PROPERTY asking price, NOT demographic data or household income
- Look for explicit price indicators: "asking price", "listed at", "priced at", "$X for property", "sale price"
- DO NOT extract: household income, average income, median home values, construction costs, projected costs
- If you see "$109,000 household income" or "average incomes over $X" - that is NOT the property price
- If no explicit property price is stated, return null

Example: If the email says "I have a property" but doesn't specify address, price, or size - ALL those fields should be null.
`;

      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      startTime = Date.now();
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are a professional real estate data extraction expert. Extract only clearly stated information from emails. Respond with valid JSON only."
          },
          {
            role: "user",
            content: extractionPrompt
          }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2000
      });
      const responseTime = Date.now() - startTime;
      apiCallTracker.logCall('OpenAI', 'extractDealData', true, responseTime);

      const extracted = JSON.parse(response.choices[0].message.content || '{}');
      
      // STRICT EVIDENCE-BASED VALIDATION - Only accept explicitly stated information
      const result: ParsedDealData = {};
      let explicitFieldCount = 0;
      const totalFields = 12; // Total number of fields we check (including city, state, zip)
      
      // Calculate confidence based on explicit evidence only (will be recalculated after extraction)
      let confidencePercentage = 0;
      console.log(`📧 Starting AI extraction validation...`);
      
      // Helper function to validate evidence-based fields
      const validateField = (field: any, fieldName: string) => {
        if (field && 
            field.is_explicit === true && 
            field.evidence_text && 
            field.evidence_text.trim().length > 0 && 
            field.value !== null && 
            field.value !== undefined) {
          console.log(`📧 EXPLICIT ${fieldName}: "${field.value}" (Evidence: "${field.evidence_text}")`);
          explicitFieldCount++;
          return field.value;
        } else {
          console.log(`📧 NO EXPLICIT ${fieldName} - marking as null (missing evidence or not explicit)`);
          return null;
        }
      };
      
      // Only extract explicitly stated information with evidence
      const addressValue = validateField(extracted.address, 'ADDRESS');
      if (addressValue && typeof addressValue === 'string' && addressValue.length > 5) {
        const addr = addressValue.trim();
        
        // CRITICAL VALIDATION: Reject suspiciously short addresses
        // Valid: "48 SWANNANOA RIVER RD" - has street number + street name + type
        // Invalid: "43 Lane" - just number + type (missing street name)
        const hasStreetNumber = /^\d+/.test(addr);
        const hasStreetType = /(road|street|avenue|drive|lane|boulevard|court|place|parkway|way|circle|trail|rd|st|ave|dr|ln|blvd|ct|pl|pkwy|highway|hwy)\b/i.test(addr);
        const hasStreetName = /^\d+\s+\w+.*?(road|street|avenue|drive|lane|boulevard|court|place|parkway|way|circle|trail|rd|st|ave|dr|ln|blvd|ct|pl|pkwy|highway|hwy)\b/i.test(addr);
        
        // INTERSECTION ADDRESSES: Accept "NC-98 & Old Murray Dr" or "Main St and Oak Ave"
        // These are valid property locations even without a traditional street number
        const isIntersection = /\s+(&|and)\s+/i.test(addr);
        
        // ROUTE/HIGHWAY ADDRESSES: Accept "NC-98", "US-1", "Hwy 64", "Route 7"
        // These use route numbers instead of street numbers
        const hasRouteNumber = /\b(nc|nc-|us|us-|state|state-|route|rt|hwy|highway|sr|cr)\s*-?\d+/i.test(addr);
        
        // Address must have: street number AND street name AND street type
        // Reject addresses like "43 Lane" that are just number + type
        const addressWords = addr.split(/\s+/);
        const isValidLength = addressWords.length >= 3; // At minimum: "123 Main St"
        
        // ACCEPT if: traditional address OR intersection OR route address
        const isTraditionalAddress = hasStreetNumber && hasStreetType && hasStreetName && isValidLength;
        const isValidIntersection = isIntersection && hasStreetType && isValidLength;
        const isValidRouteAddress = hasRouteNumber && isValidLength;
        
        if (isTraditionalAddress || isValidIntersection || isValidRouteAddress) {
          result.address = addr;
          if (isIntersection) {
            console.log(`✅ [ADDRESS-VALIDATION] Accepted: "${addr}" (intersection address)`);
          } else if (hasRouteNumber) {
            console.log(`✅ [ADDRESS-VALIDATION] Accepted: "${addr}" (route/highway address)`);
          } else {
            console.log(`✅ [ADDRESS-VALIDATION] Accepted: "${addr}" (has number + name + type)`);
          }
        } else {
          console.log(`❌ [ADDRESS-VALIDATION] Rejected: "${addr}" - TOO SHORT or INCOMPLETE`);
          console.log(`   - Has number: ${hasStreetNumber}, Has type: ${hasStreetType}, Has name: ${hasStreetName}, Valid length: ${isValidLength}`);
          console.log(`   - Is intersection: ${isIntersection}, Has route: ${hasRouteNumber}`);
        }
      }
      
      // CRITICAL: Extract city, state, and zip SEPARATELY for accurate geocoding
      const cityValue = validateField(extracted.city, 'CITY');
      if (cityValue && typeof cityValue === 'string' && cityValue.length >= 2) {
        result.city = cityValue.trim();
        console.log(`✅ [CITY] Extracted: "${result.city}"`);
      }
      
      const stateValue = validateField(extracted.state, 'STATE');
      if (stateValue && typeof stateValue === 'string' && stateValue.length === 2) {
        result.state = stateValue.trim().toUpperCase();
        console.log(`✅ [STATE] Extracted: "${result.state}"`);
      }
      
      const zipValue = validateField(extracted.zip, 'ZIP');
      if (zipValue && typeof zipValue === 'string') {
        // Accept 5-digit or 9-digit ZIP codes
        const cleanZip = zipValue.trim().replace(/[^0-9-]/g, '');
        if (/^\d{5}(-\d{4})?$/.test(cleanZip)) {
          result.zip = cleanZip;
          console.log(`✅ [ZIP] Extracted: "${result.zip}"`);
        }
      }
      
      // Log full address components for debugging
      console.log(`📍 [ADDRESS-COMPONENTS] Full extraction:`, {
        street: result.address || 'null',
        city: result.city || 'null',
        state: result.state || 'null',
        zip: result.zip || 'null'
      });
      
      const priceValue = validateField(extracted.price, 'PRICE');
      if (priceValue && !isNaN(priceValue) && priceValue > 0) {
        result.price = Number(priceValue);
      }
      
      const acresValue = validateField(extracted.acres, 'ACRES');
      if (acresValue && !isNaN(acresValue) && acresValue > 0) {
        result.acres = Number(acresValue);
      }
      
      const nameValue = validateField(extracted.contactName, 'NAME');
      if (nameValue && typeof nameValue === 'string') {
        result.contactName = nameValue.trim();
      }
      
      const emailValue = validateField(extracted.contactEmail, 'EMAIL');
      if (emailValue && typeof emailValue === 'string') {
        result.contactEmail = emailValue.trim();
      }
      
      const phoneValue = validateField(extracted.contactPhone, 'PHONE');
      if (phoneValue && typeof phoneValue === 'string') {
        result.contactPhone = phoneValue.trim();
      }
      
      const zoningValue = validateField(extracted.zoning, 'ZONING');
      if (zoningValue && typeof zoningValue === 'string') {
        result.zoning = zoningValue.trim();
      }
      
      validateField(extracted.description, 'DESCRIPTION');
      validateField(extracted.utilities, 'UTILITIES');
      
      // Handle description and utilities with evidence validation
      const descValue = validateField(extracted.description, 'DESCRIPTION');
      if (descValue && typeof descValue === 'string') {
        result.description = descValue.trim().substring(0, 200);
      }
      
      const utilValue = validateField(extracted.utilities, 'UTILITIES');
      if (utilValue && typeof utilValue === 'string') {
        result.utilities = utilValue.trim();
      }

      // Recalculate confidence with final count
      confidencePercentage = Math.round((explicitFieldCount / totalFields) * 100);
      
      // Log complete extraction summary with ALL address components
      console.log(`📧 EXTRACTION SUMMARY:`, {
        address: result.address || 'NOT EXTRACTED',
        city: result.city || 'NOT EXTRACTED',
        state: result.state || 'NOT EXTRACTED',
        zip: result.zip || 'NOT EXTRACTED',
        price: result.price || 'NOT EXTRACTED', 
        acres: result.acres || 'NOT EXTRACTED',
        contactName: result.contactName || 'NOT EXTRACTED'
      });
      console.log(`📧 EVIDENCE-BASED extraction completed with ${confidencePercentage}% confidence (${explicitFieldCount}/${totalFields} explicit fields)`);
      
      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      apiCallTracker.logCall('OpenAI', 'extractDealData', false, responseTime, {
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      console.error('❌ OpenAI extraction failed:', error);
      return null;
    }
  }

  /**
   * Decode quoted-printable encoding (RFC 2045)
   * Fixes email content with trailing "=" or encoded characters like "=20" (space)
   */
  private static decodeQuotedPrintable(text: string): string {
    if (!text) return text;
    
    // Remove soft line breaks (trailing "=" at end of line)
    // "409 Carver Ln. Lebanon, TN 37087 =" becomes "409 Carver Ln. Lebanon, TN 37087"
    text = text.replace(/=\s*(\r?\n)/g, '');
    
    // Decode =XX hex sequences (=20 = space, =3D = "=", etc.)
    text = text.replace(/=([0-9A-F]{2})/gi, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
    
    return text;
  }

  /**
   * Remove email headers and metadata from message text
   * Strips routing information, technical headers, and extracts clean message body
   * ENHANCED: Aggressive removal of SendGrid routing headers
   */
  private static removeEmailHeaders(text: string): string {
    if (!text) return text;

    console.log('🧹 [HEADER-REMOVAL] Starting header removal...');
    console.log('📝 [HEADER-REMOVAL] Original length:', text.length);
    
    // SAFETY CHECK: Only run aggressive header removal if text actually looks like it has headers
    // This prevents corrupting simple one-line property submissions like "4200 Monroe Road Charlotte nc"
    const textLower = text.toLowerCase();
    const hasHeaderPatterns = 
      /^(received|return-path|x-|arc-|dkim-signature|message-id|content-type|mime-version|from|to|reply-to|date|subject):/im.test(text) ||
      textLower.includes('received:') ||
      textLower.includes('message-id:') ||
      textLower.includes('mime-version:') ||
      textLower.includes('content-type:') ||
      textLower.includes('mx.sendgrid.net') ||
      textLower.includes('with esmtp') ||
      textLower.includes('received: from') ||
      textLower.includes('dkim-signature:') ||
      textLower.includes('authentication-results:');
    
    if (!hasHeaderPatterns) {
      console.log('✅ [HEADER-REMOVAL] No header patterns detected - skipping header removal to prevent corruption');
      console.log('📝 [HEADER-REMOVAL] Returning original text unchanged');
      return text.trim();
    }
    
    console.log('⚠️ [HEADER-REMOVAL] Header patterns detected - proceeding with removal');
    
    // STEP 1: Remove entire header block if present (everything before double newline)
    const doubleNewlineIndex = text.indexOf('\n\n');
    if (doubleNewlineIndex !== -1) {
      console.log('✂️ [HEADER-REMOVAL] Found double newline at position', doubleNewlineIndex);
      text = text.substring(doubleNewlineIndex + 2);
    }

    // STEP 2: Aggressively remove lines that look like email headers (case-insensitive)
    const lines = text.split('\n');
    let startIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineLower = line.toLowerCase();
      
      // Skip empty lines at start
      if (line === '') {
        startIndex = i + 1;
        continue;
      }
      
      // AGGRESSIVE HEADER DETECTION: Match SendGrid patterns
      const isHeaderLine = (
        // Standard email headers (case-insensitive)
        /^(received|return-path|x-|arc-|dkim-signature|message-id|content-type|mime-version|date|authentication-results|delivered-to|from|to|subject|cc|bcc):\s+/i.test(line) ||
        // SendGrid specific patterns (case-insensitive)
        lineLower.includes('received:') ||
        lineLower.includes('received: from') ||
        lineLower.includes('mail-') && lineLower.includes('.google.com') ||
        lineLower.includes('mx.sendgrid.net') ||
        lineLower.includes('sendgrid.net') ||
        lineLower.includes('by mx.') ||
        lineLower.includes('with smtp') ||
        lineLower.includes('with esmtp') ||
        lineLower.includes('esmtp id') ||
        lineLower.includes('smtp id') ||
        // DKIM signatures and technical headers
        lineLower.includes('dkim-signature:') ||
        lineLower.includes('v=1; a=rsa') ||
        lineLower.includes('s 230601') ||
        lineLower.includes('d=gmail.com') ||
        // DKIM signature continuation lines (multi-line DKIM parameters)
        /^(h=|bh=|b=|c=|d=|s=|t=|a=|v=)[a-zA-Z0-9+\/=:;\-\s]+/.test(line) ||
        // Base64-like patterns (DKIM signature values)
        /^[a-zA-Z0-9+\/=]{40,}$/.test(line) ||
        // Technical identifiers
        line.startsWith('for <') ||
        lineLower.startsWith('for <') ||
        /^[0-9a-f]{20,}$/i.test(line) || // Long hex IDs
        /\[[\d\.]+\]/.test(line) && lineLower.includes('by') || // IP addresses with "by"
        // IP address patterns with SMTP info
        /\d+\.\d+\.\d+\.\d+/.test(line) && (lineLower.includes('by') || lineLower.includes('from'))
      );
      
      if (isHeaderLine) {
        console.log(`🗑️ [HEADER-REMOVAL] Removing header line ${i}: "${line.substring(0, 80)}..."`);
        startIndex = i + 1;
      } else {
        // Found first real content line
        console.log(`✅ [HEADER-REMOVAL] First content line at ${i}: "${line.substring(0, 80)}..."`);
        break;
      }
    }
    
    // Get the clean message body
    text = lines.slice(startIndex).join('\n').trim();

    // STEP 3: Remove common email footers and disclaimers
    const footerPatterns = [
      /This email and any attachments[\s\S]*?confidential[\s\S]*/gi,
      /This message is intended only for[\s\S]*/gi,
      /If you are not the intended recipient[\s\S]*/gi,
    ];
    
    footerPatterns.forEach(pattern => {
      text = text.replace(pattern, '');
    });

    console.log('✅ [HEADER-REMOVAL] Final clean text length:', text.length);
    console.log('📝 [HEADER-REMOVAL] First 200 chars:', text.substring(0, 200));

    return text.trim();
  }

  /**
   * Parse incoming email from SendGrid webhook format
   */
  public static async parseInboundEmail(body: any): Promise<InboundEmail | null> {
    try {
      console.log('\n' + '='.repeat(80));
      console.log('📧 [SENDGRID-PARSE] RAW WEBHOOK PAYLOAD ANALYSIS');
      console.log('='.repeat(80));
      console.log('Body Keys:', Object.keys(body));
      console.log('Body Keys Count:', Object.keys(body).length);
      
      // Check for different attachment formats
      console.log('\n🔍 [SENDGRID-PARSE] Attachment Detection:');
      console.log(`   Has 'attachments' key: ${!!body.attachments ? '✅' : '❌'}`);
      console.log(`   Has 'attachment1' key: ${!!body.attachment1 ? '✅' : '❌'}`);
      console.log(`   Has 'attachment-info' key: ${!!body['attachment-info'] ? '✅' : '❌'}`);
      console.log(`   Has 'email' key (raw MIME): ${!!body.email ? '✅' : '❌'}`);
      
      if (body.email) {
        console.log(`   Email field length: ${body.email.length}`);
        console.log(`   Contains MIME-Version: ${body.email.includes('MIME-Version') ? '✅' : '❌'}`);
        console.log(`   Contains boundary=: ${body.email.includes('boundary=') ? '✅' : '❌'}`);
        console.log(`   Contains Content-Type: multipart: ${body.email.includes('Content-Type: multipart') ? '✅' : '❌'}`);
        console.log(`   Email preview: ${body.email.substring(0, 200)}...`);
      }
      
      console.log('\n📦 [SENDGRID-PARSE] Full Body (first 2000 chars):');
      console.log(JSON.stringify(body, null, 2).substring(0, 2000));
      console.log('='.repeat(80) + '\n');
      
      // CRITICAL FIX (Dec 1, 2025): Improved MIME detection for emails with attachments
      // Check for ANY MIME indicators, not just "MIME-Version" which may be case-sensitive or in different positions
      // Apple Mail and other clients use "boundary=" and "Content-Type: multipart" which indicate MIME structure
      const hasMimeIndicators = body.email && typeof body.email === 'string' && (
        body.email.includes('MIME-Version') ||
        body.email.includes('boundary=') ||
        body.email.includes('Content-Type: multipart') ||
        body.email.includes('content-type: multipart') // case-insensitive check
      );
      
      if (hasMimeIndicators) {
        console.log('📧 [SENDGRID-PARSE] Detected RAW MIME format (found MIME indicators) - parsing with mailparser...');
        
        try {
          const { simpleParser } = await import('mailparser');
          const parsed = await simpleParser(body.email);
          
          console.log('\n✅ [SENDGRID-PARSE] Successfully parsed raw MIME message');
          console.log('   From:', parsed.from?.text);
          console.log('   Subject:', parsed.subject);
          console.log('   Attachments found:', parsed.attachments?.length || 0);
          
          if (parsed.attachments && parsed.attachments.length > 0) {
            console.log('\n📎 [SENDGRID-PARSE] MIME Attachments:');
            parsed.attachments.forEach((att: any, idx: number) => {
              console.log(`   ${idx + 1}. ${att.filename}`);
              console.log(`      Type: ${att.contentType}`);
              console.log(`      Size: ${att.size} bytes`);
              console.log(`      Has content: ${!!att.content ? '✅' : '❌'}`);
            });
          }
          
          // Extract attachments from parsed MIME
          const parsedAttachments = (parsed.attachments || []).map((att: any) => ({
            filename: att.filename,
            content: att.content, // This is a Buffer
            contentType: att.contentType,
            size: att.size
          }));
          
          if (parsedAttachments.length > 0) {
            console.log('📧 [SENDGRID-PARSE] Extracted attachments from raw MIME:');
            parsedAttachments.forEach((att: any, idx: number) => {
              console.log(`  ${idx + 1}. ${att.filename} (${att.contentType}, ${att.size} bytes)`);
            });
          }
          
          // CRITICAL FIX (Dec 9, 2025): Extract COMPLETE text from BOTH text and HTML parts
          // Some email clients split content across MIME parts - we need all of it
          let rawTextOriginal = parsed.text || '';
          
          // If HTML has more content than text, extract text from HTML as well
          if (parsed.html) {
            // Simple HTML to text conversion - remove tags but keep content
            const htmlText = (parsed.html as string)
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<\/p>/gi, '\n\n')
              .replace(/<\/div>/gi, '\n')
              .replace(/<[^>]+>/g, '')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .trim();
            
            // Use the longer content (text or HTML-extracted)
            if (htmlText.length > rawTextOriginal.length) {
              console.log(`📧 [MIME-FIX] HTML content (${htmlText.length} chars) is longer than text (${rawTextOriginal.length} chars) - using HTML`);
              rawTextOriginal = htmlText;
            }
          }
          
          console.log(`📧 [MIME-PARSE] Final text content length: ${rawTextOriginal.length}`);
          console.log(`📧 [MIME-PARSE] Text preview: ${rawTextOriginal.substring(0, 300)}...`);
          
          const cleanedText = EmailInboundService.decodeHtmlEntities(rawTextOriginal);
          
          return {
            to: parsed.to?.text || 'catalyst@landlinq.ai',
            from: parsed.from?.text || 'unknown@sender.com',
            subject: EmailInboundService.decodeHtmlEntities(parsed.subject || 'Deal Submission'),
            rawText: rawTextOriginal, // ORIGINAL unmodified for audit
            text: cleanedText, // Cleaned for AI parsing
            html: parsed.html || '',
            attachments: parsedAttachments
          };
        } catch (mimeError) {
          console.error('❌ Failed to parse raw MIME message:', mimeError);
          // Fall through to regular parsing
        }
      }
      
      // Log ALL possible text fields to find which one SendGrid uses
      console.log('📧 [SENDGRID-PARSE] Checking ALL text field options:');
      Object.keys(body).forEach(key => {
        const value = body[key];
        if (typeof value === 'string') {
          console.log(`   body.${key}:`, value.length > 0 ? `"${value.substring(0, 100)}..."` : 'EMPTY STRING');
        } else {
          console.log(`   body.${key}:`, typeof value);
        }
      });
      
      // Handle different SendGrid webhook formats
      let parsedAttachments = [];
      
      // Handle attachments from multipart form data (SendGrid format)
      console.log('\n📎 [SENDGRID-PARSE] Checking for multipart attachments...');
      if (body.attachments) {
        console.log('   Found "attachments" key in body');
        console.log('   Type:', typeof body.attachments);
        console.log('   Is Array:', Array.isArray(body.attachments));
        
        try {
          // If it's already an array, use it
          if (Array.isArray(body.attachments)) {
            parsedAttachments = body.attachments;
            console.log(`   ✅ Using attachments array directly (${parsedAttachments.length} items)`);
          } else {
            // Try to parse as JSON string
            parsedAttachments = JSON.parse(body.attachments);
            console.log(`   ✅ Parsed attachments from JSON string (${parsedAttachments.length} items)`);
          }
        } catch (e) {
          console.log('   ❌ Could not parse attachments as JSON, treating as empty array');
          console.log('   Error:', e);
          parsedAttachments = [];
        }
      } else {
        console.log('   ❌ No "attachments" key found in body');
      }
      
      // Try multiple field names for email body content - EXPANDED LIST
      const textContent = body.text || body.plain || body.content || body.body || 
                         body.plaintext || body['text/plain'] || body.bodyPlain || 
                         body.email || body.message || '';
      console.log('📧 [SENDGRID-PARSE] Final text content length:', textContent.length);
      
      // FALLBACK: If body is empty, use subject as text content (handles emails with no body)
      let rawTextContent = textContent.trim() || body.subject || '';
      
      // DIAGNOSTIC LOGGING: Trace text transformations to debug corruption
      console.log('🔍 [DIAGNOSTIC] Raw text BEFORE preprocessing:', textContent.substring(0, 200));
      
      // CRITICAL FIX (Nov 21, 2025): Store ORIGINAL text before any processing
      // This preserves the audit trail for debugging address corruption issues
      const rawTextOriginal = rawTextContent;
      
      // CRITICAL FIX: Decode quoted-printable encoding (removes trailing "=" and decodes special characters)
      // Quoted-printable uses "=" for soft line breaks and encoding: "37087 =" means line break after 37087
      let cleanedText = this.decodeQuotedPrintable(rawTextContent);
      console.log('🔍 [DIAGNOSTIC] Text AFTER quoted-printable decode:', cleanedText.substring(0, 200));
      
      // CRITICAL FIX: Remove email headers and metadata from the text content
      cleanedText = this.removeEmailHeaders(cleanedText);
      console.log('🔍 [DIAGNOSTIC] Text AFTER header removal:', cleanedText.substring(0, 200));
      
      console.log('📧 [SENDGRID-PARSE] Using text content:', cleanedText.length > 0 ? `"${cleanedText.substring(0, 200)}"` : 'EMPTY');
      
      return {
        to: body.to || 'catalyst@landlinq.ai',
        from: body.from || 'unknown@sender.com',
        subject: EmailInboundService.decodeHtmlEntities(body.subject || 'Deal Submission'),
        rawText: rawTextOriginal, // ORIGINAL unmodified for audit
        text: EmailInboundService.decodeHtmlEntities(cleanedText), // Cleaned for AI parsing
        html: body.html || '',
        attachments: parsedAttachments
      };
    } catch (error) {
      console.error('❌ Error parsing inbound email:', error);
      return null;
    }
  }

  /**
   * Detect if email is a reply to an existing deal conversation
   * Returns { isReply: boolean, dealId: string | null, threadKey: string | null }
   */
  /**
   * Extract email address from "Name <email@example.com>" format
   */
  private static extractEmailAddress(fromField: string): string {
    if (!fromField) return '';
    
    // Match email inside angle brackets: "Jack Berg <jack@example.com>" -> "jack@example.com"
    const match = fromField.match(/<([^>]+)>/);
    if (match) {
      return match[1].trim().toLowerCase();
    }
    
    // If no angle brackets, assume it's just an email
    return fromField.trim().toLowerCase();
  }

  public static async detectReplyContext(emailData: InboundEmail, rawBody: any): Promise<{ isReply: boolean; dealId: string | null; threadKey: string | null }> {
    try {
      console.log('\n🔍 [REPLY-DETECTION] Checking if email is a reply...');
      
      const subject = emailData.subject || '';
      const from = emailData.from || '';
      
      // Extract clean email address for database lookup
      const cleanEmail = this.extractEmailAddress(from);
      console.log(`📧 [REPLY-DETECTION] From field: "${from}" -> Clean email: "${cleanEmail}"`);
      
      // METHOD 1: Extract Deal ID from subject line
      // Look for patterns like "Deal ID: 1eb33223" or "Re: Quick Property Info Needed - Deal ID: xyz"
      const dealIdMatch = subject.match(/Deal ID:\s*([a-f0-9-]+)/i);
      if (dealIdMatch) {
        const dealId = dealIdMatch[1];
        console.log(`✅ [REPLY-DETECTION] Found Deal ID in subject: ${dealId}`);
        return {
          isReply: true,
          dealId,
          threadKey: `${cleanEmail}|${dealId}`
        };
      }
      
      // METHOD 2: Check for "Re:" prefix in subject (common reply indicator)
      const isReply = subject.toLowerCase().startsWith('re:');
      if (isReply) {
        console.log(`📧 [REPLY-DETECTION] Subject has "Re:" prefix - likely a reply`);
        
        // DATABASE LOOKUP: Find most recent deal from this sender email
        try {
          console.log(`🔍 [REPLY-DETECTION] Looking up recent deals from ${cleanEmail}...`);
          const recentDeals = await storage.getRecentDealsByEmail(cleanEmail);
          
          if (recentDeals && recentDeals.length > 0) {
            // Use the most recent deal (first in array)
            const latestDeal = recentDeals[0];
            console.log(`✅ [REPLY-DETECTION] Found recent deal: ${latestDeal.id} (${latestDeal.address})`);
            return {
              isReply: true,
              dealId: latestDeal.id,
              threadKey: `${from}|${latestDeal.id}`
            };
          } else {
            console.log(`⚠️ [REPLY-DETECTION] No recent deals found for ${from} - treating as new submission`);
          }
        } catch (dbError) {
          console.error(`❌ [REPLY-DETECTION] Database lookup failed:`, dbError);
        }
        
        return {
          isReply: true,
          dealId: null, // Couldn't find deal
          threadKey: `${from}|${subject.replace(/^re:\s*/i, '').trim().toLowerCase()}`
        };
      }
      
      // METHOD 3: Check email headers (In-Reply-To, References)
      const inReplyTo = rawBody['in-reply-to'] || rawBody.inReplyTo;
      const references = rawBody.references || rawBody.References;
      
      if (inReplyTo || references) {
        console.log(`✅ [REPLY-DETECTION] Found reply headers:`);
        if (inReplyTo) console.log(`   In-Reply-To: ${inReplyTo}`);
        if (references) console.log(`   References: ${references}`);
        
        // DATABASE LOOKUP: Try to find deal by message ID in communications table
        try {
          console.log(`🔍 [REPLY-DETECTION] Looking up communications by message ID...`);
          const comm = await storage.getCommunicationByProviderMessageId(inReplyTo || references);
          
          if (comm && comm.relatedDealId) {
            console.log(`✅ [REPLY-DETECTION] Found deal via message ID: ${comm.relatedDealId}`);
            return {
              isReply: true,
              dealId: comm.relatedDealId,
              threadKey: inReplyTo || references || null
            };
          }
        } catch (dbError) {
          console.error(`❌ [REPLY-DETECTION] Message ID lookup failed:`, dbError);
        }
        
        return {
          isReply: true,
          dealId: null, // Couldn't find deal by message ID
          threadKey: inReplyTo || references || null
        };
      }
      
      console.log(`❌ [REPLY-DETECTION] No reply indicators found - treating as new submission`);
      return {
        isReply: false,
        dealId: null,
        threadKey: null
      };
      
    } catch (error) {
      console.error('❌ [REPLY-DETECTION] Error detecting reply context:', error);
      return {
        isReply: false,
        dealId: null,
        threadKey: null
      };
    }
  }

  /**
   * Parse terse email replies like "28805 NC" or "$500,000 / 10 acres"
   * Designed specifically for broker follow-up responses, not full deal submissions
   */
  public static parseReplyData(text: string): { zip?: string; state?: string; price?: number; acres?: number } {
    console.log(`🔍 [REPLY-PARSE] Parsing terse reply: "${text}"`);
    const result: { zip?: string; state?: string; price?: number; acres?: number } = {};
    
    // ZIP CODE: 5 digits
    const zipMatch = text.match(/\b(\d{5})\b/);
    if (zipMatch) {
      // CRITICAL FIX: Use 'zip' not 'zipCode' to match pipeline expectations
      result.zip = zipMatch[1];
      console.log(`   ZIP: ${result.zip}`);
    }
    
    // STATE: 2-letter code
    const stateMatch = text.match(/\b([A-Z]{2})\b/);
    if (stateMatch) {
      result.state = stateMatch[1];
      console.log(`   State: ${result.state}`);
    }
    
    // PRICE: Dollar amount
    const priceMatch = text.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
    if (priceMatch) {
      result.price = parseFloat(priceMatch[1].replace(/,/g, ''));
      console.log(`   Price: $${result.price}`);
    }
    
    // ACREAGE: Number followed by "acres" or "ac"
    const acresMatch = text.match(/([\d,]+(?:\.\d+)?)\s*(?:acres?|ac\b)/i);
    if (acresMatch) {
      result.acres = parseFloat(acresMatch[1].replace(/,/g, ''));
      console.log(`   Acres: ${result.acres}`);
    }
    
    console.log(`✅ [REPLY-PARSE] Extracted:`, result);
    return result;
  }

  /**
   * Extract deal information from email content using OpenAI and pattern matching
   */
  public static async extractDealData(emailData: InboundEmail): Promise<ParsedDealData> {
    let text = emailData.text + ' ' + emailData.subject;
    const dealData: ParsedDealData = {};

    try {
      // CRITICAL FIX: If plain text is empty/minimal (<100 chars), extract text from HTML
      // This handles image-heavy marketing emails (like Northmarq) where text is in HTML
      if (text.trim().length < 100 && emailData.html && emailData.html.length > 100) {
        console.log('⚠️ [HTML-EXTRACTION] Plain text minimal (<100 chars), extracting from HTML...');
        console.log(`   Plain text length: ${text.trim().length}`);
        console.log(`   HTML length: ${emailData.html.length}`);
        
        // Strip HTML tags and extract text content
        const htmlText = emailData.html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')   // Remove styles
          .replace(/<[^>]+>/g, ' ')                          // Remove HTML tags
          .replace(/&nbsp;/g, ' ')                           // Replace &nbsp;
          .replace(/&amp;/g, '&')                            // Replace &amp;
          .replace(/&lt;/g, '<')                             // Replace &lt;
          .replace(/&gt;/g, '>')                             // Replace &gt;
          .replace(/\s+/g, ' ')                              // Normalize whitespace
          .trim();
        
        console.log(`✅ [HTML-EXTRACTION] Extracted ${htmlText.length} chars from HTML`);
        console.log(`   Preview: ${htmlText.substring(0, 200)}...`);
        
        // Combine HTML text with subject for better extraction
        text = htmlText + ' ' + emailData.subject;
      }
      
      // PREPROCESSING: Clean up hybrid address-acreage formats
      // Converts: "30044-26.51 acres" → "30044. 26.51 acres"
      // This handles emails where acreage is embedded at the end of the address line
      text = text.replace(/(\d{5})-(\d+\.?\d*)\s*acres?/gi, '$1. $2 acres');
      console.log('📧 Preprocessing: Cleaned up hybrid address-acreage formats');
      
      console.log('📧 Using enhanced parsing with PDF and multi-property support...');
      
      // STEP 1: Use our enhanced parsing system from routes.ts
      const enhancedResult = await EmailInboundService.useEnhancedParsing(text, emailData.attachments || []);
      
      if (enhancedResult) {
        console.log('✅ Enhanced parsing completed successfully');
        
        // Handle multi-property scenarios
        if (enhancedResult.isMultiProperty && enhancedResult.multipleProperties?.length > 1) {
          console.log(`🏘️ Multi-property detected: ${enhancedResult.multipleProperties.length} properties`);
          
          // Store multi-property info for the caller to handle
          dealData._isMultiProperty = true;
          dealData._allProperties = enhancedResult.multipleProperties;
          
          // Use first property as primary deal data
          const primary = enhancedResult.multipleProperties[0];
          dealData.address = primary.address ? this.sanitizeAddressFromPricingText(primary.address) : undefined;
          dealData.price = primary.price;
          dealData.acres = primary.acres;
          
          // FIX (Dec 1, 2025): Include city/state/zip for multi-property submissions!
          // Without this, geocoding fails because address is sent without location context
          dealData.city = primary.city || enhancedResult.city || undefined;
          dealData.state = primary.state || enhancedResult.state || undefined;
          dealData.zip = primary.zip || enhancedResult.zip || undefined;
          
          if (dealData.city && dealData.state) {
            console.log(`✅ [MULTI-PROPERTY] Using city/state: ${dealData.city}, ${dealData.state}${dealData.zip ? ` ${dealData.zip}` : ''}`);
          }
        } else {
          // Single property processing
          const rawAddress = enhancedResult.address || enhancedResult.addressExtraction?.value;
          console.log(`🔍 [ADDRESS-TRACE] Raw address from enhanced result: "${rawAddress}"`);
          console.log(`🔍 [ADDRESS-TRACE] Enhanced result fields:`, {
            address: enhancedResult.address,
            addressExtraction: enhancedResult.addressExtraction?.value
          });
          
          dealData.address = rawAddress ? this.sanitizeAddressFromPricingText(rawAddress) : undefined;
          console.log(`🔍 [ADDRESS-TRACE] After sanitization: "${dealData.address}"`);
          
          // FIX (Nov 25, 2025): USE AI-extracted city/state/ZIP if available!
          // The AI parser already extracted these - don't throw them away
          // Geocoding will fill in missing data, but we should use what AI found first
          dealData.city = enhancedResult.city || undefined;
          dealData.state = enhancedResult.state || undefined;
          dealData.zip = enhancedResult.zip || undefined;
          
          if (dealData.city && dealData.state) {
            console.log(`✅ [EMAIL-PARSER] Using AI-extracted city/state: ${dealData.city}, ${dealData.state}${dealData.zip ? ` ${dealData.zip}` : ''}`);
          } else {
            console.log(`📧 [EMAIL-PARSER] City/state not extracted by AI - will be filled by geocoding enrichment`);
          }
          
          dealData.price = enhancedResult.askingPrice || enhancedResult.priceExtraction?.value;
          dealData.acres = enhancedResult.sizeAcres || enhancedResult.acreageExtraction?.value;
        }
        
        // Add enhanced details
        if (enhancedResult.complexDetails) {
          const complexInfo = enhancedResult.complexDetails;
          let description = [];
          if (complexInfo.unitMix) description.push(`Units: ${complexInfo.unitMix}`);
          if (complexInfo.developmentInfo) description.push(`Development: ${complexInfo.developmentInfo}`);
          if (complexInfo.noi) description.push(`NOI: $${complexInfo.noi}`);
          if (complexInfo.capRate) description.push(`Cap Rate: ${complexInfo.capRate}%`);
          if (complexInfo.condition) description.push(`Condition: ${complexInfo.condition}`);
          if (description.length > 0) {
            dealData.description = description.join(' | ');
          }
        }
        
        // Handle forwarded emails and contact information
        if (enhancedResult.originalSender || enhancedResult.brokerName) {
          dealData.contactName = enhancedResult.brokerName || enhancedResult.originalSender;
          if (enhancedResult.brokerContact) {
            if (enhancedResult.brokerContact.includes('@')) {
              dealData.contactEmail = enhancedResult.brokerContact;
            } else {
              dealData.contactPhone = enhancedResult.brokerContact;
            }
          }
        }
        
        // CRITICAL FIX (Nov 22, 2025): Use AI parser's phone number instead of regex fallback
        // The regex fallback can extract timestamps or wrong numbers
        if (enhancedResult.primaryContact?.phone) {
          // Normalize phone to E.164 format (+1XXXXXXXXXX) for consistent storage/lookup
          const rawPhone = enhancedResult.primaryContact.phone;
          const cleaned = rawPhone.replace(/\D/g, ''); // Remove non-digits
          
          let normalizedPhone = rawPhone;
          if (cleaned.length === 11 && cleaned.startsWith('1')) {
            normalizedPhone = `+${cleaned}`; // Already has +1 prefix, just add +
          } else if (cleaned.length === 10) {
            normalizedPhone = `+1${cleaned}`; // Add +1 prefix
          } else if (rawPhone.startsWith('+1')) {
            normalizedPhone = rawPhone.replace(/\s/g, ''); // Already E.164, remove spaces
          }
          
          dealData.contactPhone = normalizedPhone;
          console.log(`📞 Using AI-extracted contact phone (normalized): ${dealData.contactPhone}`);
        }
        
        // Log PDF processing results
        if (enhancedResult.attachmentData?.length > 0) {
          console.log(`📄 Processed ${enhancedResult.attachmentData.length} PDF attachments`);
        }
      }
      
      // STEP 2: Fallback to existing logic if enhanced parsing didn't extract enough
      let aiExtractedData: any = null;
      if (!dealData.address && !dealData.price && !dealData.acres) {
        console.log('📧 Enhanced parsing incomplete, using fallback methods...');
        
        // Extract and append attachment content using existing method
        const attachmentContent = await EmailInboundService.extractAttachmentContent(emailData);
        if (attachmentContent.length > 0) {
          text += '\n\nATTACHMENT CONTENT:\n' + attachmentContent.join('\n\n');
        }

        // Try OpenAI extraction
        aiExtractedData = await EmailInboundService.extractDealDataWithAI(emailData, text);
        if (aiExtractedData) {
          Object.assign(dealData, aiExtractedData);
          console.log('📧 AI extraction successful as fallback');
        } else {
          // CRITICAL FIX (Nov 22, 2025): DO NOT use regex fallback - it has bugs that prepend acreage digits to addresses
          console.error('⚠️ [PRODUCTION-CRITICAL] AI extraction failed - OPENAI_API_KEY likely missing');
          console.error('⚠️ [PRODUCTION-CRITICAL] Skipping regex fallback to prevent data corruption');
          console.error('⚠️ [PRODUCTION-CRITICAL] To fix: Ensure OPENAI_API_KEY is set in production environment');
          
          // CRITICAL FIX (Dec 9, 2025): Preserve email body as brokerNotes when AI fails
          // This ensures the original email content is not lost
          if (!dealData.brokerNotes && text && text.length > 10) {
            // Clean the text - remove MIME headers if present
            let cleanedBody = text;
            if (/^(Received:|MIME-Version:|Content-Type:|boundary=)/im.test(text)) {
              const bodyMatch = text.match(/\r?\n\r?\n([\s\S]+)/);
              if (bodyMatch) {
                cleanedBody = bodyMatch[1]
                  .replace(/--[a-zA-Z0-9_=+\/-]+--?/g, '')
                  .replace(/^Content-Type:.*$/gim, '')
                  .replace(/^Content-Transfer-Encoding:.*$/gim, '')
                  .trim();
              }
            }
            dealData.brokerNotes = cleanedBody.substring(0, 2000);
            console.log(`📧 Preserved email body as brokerNotes (${dealData.brokerNotes.length} chars)`);
          }
        }
      }
      
      // Extract email address and name from sender
      if (emailData.from) {
        const emailMatch = emailData.from.match(/([^<]+)<([^>]+)>|([^@]+@[^@]+)/);
        if (emailMatch) {
          dealData.contactEmail = emailMatch[2] || emailMatch[3];
          dealData.contactName = emailMatch[1]?.trim() || emailData.from.split('@')[0];
        }
      }

      // SAFE FALLBACK (Dec 9, 2025): Run ALWAYS to supplement any missing fields
      // Previously only ran when ALL fields were missing, which left gaps when AI partially failed
      // Now runs if ANY key field (address, price, acres) is missing
      const needsAcres = !dealData.acres && !(dealData as any).sizeAcres;
      const needsPrice = !dealData.price;
      const needsAddress = !dealData.address;
      const useRegexFallback = needsAddress || needsPrice || needsAcres;
      
      if (useRegexFallback) {
        console.log(`📧 Running safe fallback extraction (needs: ${[needsAddress ? 'address' : '', needsPrice ? 'price' : '', needsAcres ? 'acres' : ''].filter(Boolean).join(', ')})...`);
        
        // ONLY extract address if we need it - prevent overwriting valid AI-extracted address
        if (needsAddress) {
          // Extract address - SIMPLIFIED patterns without acreage matching to prevent "8" prefix bug
          const safeAddressPatterns = [
            // Explicit address indicators (limit capture length)
            /(?:address|location|property|site)[:=\s]+([^\n\r]{1,150})/i,
            // Full address with city, state, ZIP: "3301 Rocky River Rd, Charlotte, NC 28215"
            /(\d+\s+[a-zA-Z0-9\s']+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Way|Blvd|Boulevard|Ct|Court|Pl|Place),?\s+[a-zA-Z\s]+,?\s+[A-Z]{2}\s*,?\s*\d{5}(?:-\d{4})?)/i,
            // Address with city, state (no ZIP): "3301 Rocky River Rd, Charlotte, NC"
            /(\d+\s+[a-zA-Z0-9\s']+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Way|Blvd|Boulevard),?\s+[a-zA-Z\s]+,?\s+[A-Z]{2})/i,
            // Street only: "3301 Rocky River Rd" - NO acreage matching to prevent "8" prefix bug
            /(\d+\s+[a-zA-Z0-9\s']{1,50}?(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Way|Blvd|Boulevard))/i
          ];
          
          for (const pattern of safeAddressPatterns) {
            const match = text.match(pattern);
            if (match) {
              const potentialAddress = match[1].trim();
              if (this.isValidAddress(potentialAddress)) {
                dealData.address = this.formatAddress(potentialAddress);
                console.log(`📧 Safe fallback extracted address: ${dealData.address}`);
                break;
              }
            }
          }
        }

        // ONLY extract price if we need it - prevent overwriting valid AI-extracted price
        if (needsPrice) {
          const priceMatch = text.match(/(?:asking|price|cost|value)[:=\s]*\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*([kmb]?|mm|mil|million)?/i) ||
                             text.match(/\$\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*([kmb]?|mm|mil|million)?/i);
          if (priceMatch) {
            const numericValue = parseFloat(priceMatch[1].replace(/,/g, ''));
            const multiplierMap: Record<string, number> = {
              'k': 1000, 'm': 1000000, 'mm': 1000000, 'mil': 1000000, 'million': 1000000, 'b': 1000000000
            };
            const multiplier = priceMatch[2] ? (multiplierMap[priceMatch[2].toLowerCase()] || 1) : 1;
            dealData.price = numericValue * multiplier;
            console.log(`📧 Safe fallback extracted price: $${dealData.price}`);
          }
        }

        // ONLY extract acreage if we need it - prevent overwriting valid AI-extracted acres
        if (needsAcres) {
          const acreageMatch = text.match(/([\d.]+)[\s]*(?:acres?|ac\b)/i);
          if (acreageMatch) {
            dealData.acres = parseFloat(acreageMatch[1]);
            console.log(`📧 Safe fallback extracted acres: ${dealData.acres}`);
          }
        }
      }

      // Extract zoning
      const zoningMatch = text.match(/(?:zoning|zoned)[:=\s]+([^\n\r]+)/i);
      if (zoningMatch) {
        dealData.zoning = zoningMatch[1].trim();
      }

      // SIMPLE ADDRESS FALLBACK: Handle plain-text addresses without labels
      // If no address found yet, check if email body is a simple one-line address
      if (!dealData.address) {
        const emailBodyText = emailData.text.trim();
        
        // Check if it's a relatively short, single-line text (likely just an address)
        const isSingleLine = !emailBodyText.includes('\n') || emailBodyText.split('\n').length <= 2;
        const isShortEnough = emailBodyText.length > 10 && emailBodyText.length < 200;
        const hasNumbers = /\d/.test(emailBodyText);
        const hasLetters = /[a-zA-Z]/.test(emailBodyText);
        
        if (isSingleLine && isShortEnough && hasNumbers && hasLetters) {
          console.log('📧 Using simple plain-text fallback for address:', emailBodyText);
          dealData.address = emailBodyText.trim();
          
          // Extract city from simple address
          const city = this.extractCity(dealData.address);
          if (city) {
            dealData.city = city;
            console.log(`📧 Extracted city from simple address: ${city}`);
          }
          
          // Extract state code from simple address
          const stateCode = this.extractState(dealData.address);
          if (stateCode) {
            dealData.state = stateCode;
            console.log(`📧 Extracted state code from simple address: ${stateCode}`);
          }
          
          // Extract ZIP code from simple address
          const zipCode = this.extractZipCode(dealData.address);
          if (zipCode) {
            // CRITICAL FIX: Use 'zip' not 'zipCode' to match pipeline expectations
            dealData.zip = zipCode;
            console.log(`📧 Extracted ZIP code from simple address: ${zipCode}`);
          }
        }
      }

      // Use entire email content as description if no specific address found
      if (!dealData.address && text.length > 10) {
        dealData.description = text.substring(0, 1000); // Limit length
      }

      // FINAL SANITIZATION: Remove pricing text from address regardless of extraction method
      if (dealData.address) {
        const originalAddress = dealData.address;
        dealData.address = this.sanitizeAddressFromPricingText(dealData.address);
        
        // CRITICAL FIX: Detect if address looks corrupted (too short, missing words)
        const addressParts = dealData.address.trim().split(/\s+/);
        const isSuspiciouslyShort = dealData.address.length < 8;
        const hasTooFewWords = addressParts.length < 3;
        
        if (isSuspiciouslyShort || hasTooFewWords) {
          console.error(`❌ [PARSING-BUG] Address looks corrupted!`);
          console.error(`   Original: "${originalAddress}"`);
          console.error(`   After processing: "${dealData.address}"`);
          console.error(`   Length: ${dealData.address.length}, Words: ${addressParts.length}`);
          console.error(`   → Setting as NULL to trigger missing-info flow`);
          
          // Set to null instead of using corrupted data - this triggers follow-up
          dealData.address = undefined;
        }
      }

      console.log('📧 Extracted deal data:', {
        address: dealData.address || 'NULL (corrupted or missing)',
        price: dealData.price,
        acres: dealData.acres,
        contactEmail: dealData.contactEmail,
        contactName: dealData.contactName
      });

      return dealData;

    } catch (error) {
      console.error('❌ Error extracting deal data:', error);
      return dealData;
    }
  }

  /**
   * Save ALL email attachments to object storage and return metadata with URLs and OCR results
   * CRITICAL FIX (Dec 2, 2025): Made public so /api/inbound-email can call it directly
   */
  public static async saveEmailAttachments(emailData: InboundEmail): Promise<{
    documentUrls: Array<{url: string, filename: string, type: string, ocrData?: any}>,
    ingestionNotes: string[]
  }> {
    const documentUrls: Array<{url: string, filename: string, type: string, ocrData?: any}> = [];
    const ingestionNotes: string[] = [];
    
    console.log('\n' + '='.repeat(80));
    console.log('📎 [ATTACHMENT-DEBUG] Starting attachment processing');
    console.log('='.repeat(80));
    console.log(`Total attachments received: ${emailData.attachments?.length || 0}`);
    
    if (!emailData.attachments || emailData.attachments.length === 0) {
      console.log('⚠️ [ATTACHMENT-DEBUG] No attachments to process');
      console.log('='.repeat(80) + '\n');
      return { documentUrls, ingestionNotes };
    }
    
    // Log details of each attachment
    emailData.attachments.forEach((att, idx) => {
      console.log(`\n📄 [ATTACHMENT-DEBUG] Attachment ${idx + 1}:`);
      console.log(`   Filename: ${att.filename || 'UNNAMED'}`);
      console.log(`   Content Type: ${att.contentType || 'UNKNOWN'}`);
      console.log(`   Has Content: ${!!att.content ? '✅' : '❌'}`);
      console.log(`   Content Length: ${att.content ? att.content.length : 0} bytes`);
      console.log(`   Content Type: ${typeof att.content}`);
    });

    try {
      const { ObjectStorageService } = await import('./objectStorage');
      const objectStorage = new ObjectStorageService();
      
      // Import OCR service for image processing
      const { processImageAttachment } = await import('./ocrService');

      console.log(`📧 Processing ${emailData.attachments.length} email attachments...`);
      console.log(`📧 Attachment details:`, emailData.attachments.map(a => ({
        filename: a.filename,
        contentType: a.contentType,
        size: (a as any).size || (Buffer.isBuffer(a.content) ? a.content.length : 'unknown'),
        isBuffer: Buffer.isBuffer(a.content)
      })));

      for (const attachment of emailData.attachments) {
        // Determine file type
        const filename = attachment.filename.toLowerCase();
        const isImage = attachment.contentType?.includes('image') || 
                       filename.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/);
        const isPDF = attachment.contentType?.includes('pdf') || filename.endsWith('.pdf');
        const isExcel = attachment.contentType?.includes('spreadsheet') || 
                       attachment.contentType?.includes('excel') ||
                       filename.match(/\.(xlsx?|csv)$/);
        
        // Accept ALL file types now
        const fileType = isImage ? 'image' : 
                        isPDF ? 'pdf' : 
                        isExcel ? 'excel' : 
                        'other';

        console.log(`📧 Saving attachment: ${attachment.filename}`);

        // Generate a unique filename
        const timestamp = Date.now();
        const safeName = attachment.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `email-attachments/${timestamp}-${safeName}`;
        
        // Get the private object directory for storage
        const privateDir = objectStorage.getPrivateObjectDir();
        const fullPath = `${privateDir}/${fileName}`;
        
        // Parse the storage path
        const pathParts = fullPath.split('/');
        if (pathParts.length < 2) continue;
        
        const bucketName = pathParts[1];
        const objectName = pathParts.slice(2).join('/');
        
        // Create file in object storage
        const { objectStorageClient } = await import('./objectStorage');
        const bucket = objectStorageClient.bucket(bucketName);
        const file = bucket.file(objectName);
        
        // Convert attachment content to buffer (handle both base64 strings and Buffers)
        const buffer = Buffer.isBuffer(attachment.content) 
          ? attachment.content 
          : Buffer.from(attachment.content, 'base64');
        
        // Upload the file
        await file.save(buffer, {
          metadata: {
            contentType: attachment.contentType,
            metadata: {
              originalFilename: attachment.filename,
              source: 'email_attachment',
              uploadedAt: new Date().toISOString()
            }
          }
        });

        // Generate the object URL path for accessing the file
        const objectUrl = `/objects/${fileName}`;
        
        // Run OCR on images to extract text
        let ocrData = undefined;
        if (isImage && process.env.OPENAI_API_KEY) {
          try {
            console.log(`🔍 Running OCR on image: ${attachment.filename}`);
            const ocrResult = await processImageAttachment(buffer, attachment.filename);
            ocrData = ocrResult;
            
            // Add OCR results to ingestion notes
            ingestionNotes.push(`📷 Image OCR from ${attachment.filename}:`);
            if (ocrResult.extractedText) {
              ingestionNotes.push(`   Text: ${ocrResult.extractedText.substring(0, 200)}${ocrResult.extractedText.length > 200 ? '...' : ''}`);
            }
            if (ocrResult.propertyDetails) {
              const details = ocrResult.propertyDetails;
              if (details.fullAddress) ingestionNotes.push(`   Full Address: ${details.fullAddress}`);
              else if (details.address || details.city || details.state || details.zipCode) {
                const addressParts = [details.address, details.city, details.state, details.zipCode].filter(Boolean);
                ingestionNotes.push(`   Address: ${addressParts.join(', ')}`);
              }
              if (details.price) ingestionNotes.push(`   Price: ${details.price}`);
              if (details.acreage) ingestionNotes.push(`   Acreage: ${details.acreage}`);
              if (details.units) ingestionNotes.push(`   Units: ${details.units}`);
            }
          } catch (ocrError) {
            console.error(`⚠️ OCR failed for ${attachment.filename}:`, ocrError);
            ingestionNotes.push(`⚠️ OCR failed for image ${attachment.filename}`);
          }
        }
        
        // ENHANCED: Extract financial data from Excel files
        if (isExcel) {
          try {
            console.log(`📊 Extracting financial data from Excel: ${attachment.filename}`);
            const excelResult = await EmailInboundService.parseExcelAttachment(attachment);
            if (excelResult.financialSummary) {
              ingestionNotes.push(excelResult.financialSummary);
            }
          } catch (excelError) {
            console.error(`⚠️ Excel parsing failed for ${attachment.filename}:`, excelError);
          }
        }
        
        documentUrls.push({
          url: objectUrl,
          filename: attachment.filename,
          type: fileType,
          ocrData
        });
        
        console.log(`✅ Saved ${fileType} attachment: ${attachment.filename} → ${objectUrl}`);
      }
    } catch (error) {
      console.error('❌ [ATTACHMENT-DEBUG] Error saving email attachments:', error);
      console.error('Error details:', error);
      
      // CRITICAL FIX (Nov 21, 2025): Provide specific error message for missing storage credentials
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isStorageConfigMissing = errorMessage.includes('GOOGLE_APPLICATION_CREDENTIALS') || 
                                      errorMessage.includes('storage') || 
                                      errorMessage.includes('bucket');
      
      if (isStorageConfigMissing) {
        ingestionNotes.push(`\n❌ ATTACHMENT SAVE FAILED: Object storage credentials missing`);
        ingestionNotes.push(`   Root cause: GOOGLE_APPLICATION_CREDENTIALS not configured in production`);
        ingestionNotes.push(`   ${emailData.attachments.length} attachment(s) were NOT saved`);
        ingestionNotes.push(`   Files: ${emailData.attachments.map(a => a.filename).join(', ')}`);
      } else {
        ingestionNotes.push(`\n❌ Error processing attachments: ${errorMessage}`);
      }
      
      // Don't fail deal creation if attachment saving fails (per user requirement)
    }

    console.log('\n📊 [ATTACHMENT-DEBUG] Summary:');
    console.log(`   Total attachments processed: ${emailData.attachments.length}`);
    console.log(`   Successfully saved: ${documentUrls.length}`);
    console.log(`   Failed: ${emailData.attachments.length - documentUrls.length}`);
    console.log('='.repeat(80) + '\n');

    return { documentUrls, ingestionNotes };
  }

  /**
   * Create a deal record from the parsed email data (now handles incomplete information)
   */
  static async createDealFromEmail(
    emailData: InboundEmail, 
    dealData: ParsedDealData, 
    missingInfo: string[] = [],
    skipConfirmation: boolean = false
  ): Promise<any> {
    try {
      // CRITICAL FIX (Nov 29, 2025): Re-parse email if dealData is missing critical fields
      // This fixes the race condition where background jobs are created with null dealData
      // and the setImmediate quick parse hasn't updated the job yet
      if (!dealData.address || dealData.address === null) {
        console.log('⚠️ [CREATE-DEAL] dealData.address is empty - re-parsing email content');
        console.log('   This happens when background job processes before quick parse completes');
        
        try {
          const reparsedData = await EmailInboundService.extractDealData(emailData);
          if (reparsedData) {
            // Merge reparsed data into dealData, preserving any fields that were already set
            dealData = {
              ...reparsedData,
              ...Object.fromEntries(
                Object.entries(dealData).filter(([_, v]) => v !== null && v !== undefined)
              ),
              // Always prefer reparsed address/city/state/zip if dealData had nulls
              address: reparsedData.address || dealData.address,
              city: reparsedData.city || dealData.city,
              state: reparsedData.state || dealData.state,
              zip: reparsedData.zip || dealData.zip
            };
            
            console.log('✅ [CREATE-DEAL] Successfully re-parsed email. New address data:', {
              address: dealData.address,
              city: dealData.city,
              state: dealData.state,
              zip: dealData.zip
            });
          } else {
            console.log('⚠️ [CREATE-DEAL] Re-parsing returned null - will proceed with original dealData');
          }
        } catch (reparseError) {
          console.error('❌ [CREATE-DEAL] Failed to re-parse email:', reparseError);
          // Continue with original dealData
        }
      }
      
      // Save email attachments to object storage and get OCR results
      const { documentUrls, ingestionNotes } = await EmailInboundService.saveEmailAttachments(emailData);
      
      // Extract links from email body text
      const { extractLinksFromText } = await import('./linkExtraction');
      const extractedLinks = extractLinksFromText(emailData.text + ' ' + emailData.subject);
      
      // Add links to documentUrls
      for (const link of extractedLinks) {
        documentUrls.push({
          url: link.url,
          filename: link.description || 'Link',
          type: link.type
        });
        ingestionNotes.push(`🔗 Link found: ${link.description || link.type} - ${link.url}`);
      }
      
      // ENHANCED: Add extracted property details to ingestion notes
      if (dealData.description && dealData.description.length > 0) {
        ingestionNotes.push(`\n📊 Property Details from Attachments:`);
        ingestionNotes.push(dealData.description);
      }
      
      // CRITICAL ALERT (Nov 21, 2025): Add warning when regex fallback parser was used
      if ((dealData as any)._usingRegexFallback) {
        ingestionNotes.push(`\n⚠️ PRODUCTION ALERT: AI extraction failed - used REGEX FALLBACK PARSER`);
        ingestionNotes.push(`   This parser has known bugs (adds list prefixes, duplicates city/state)`);
        ingestionNotes.push(`   Root cause: OPENAI_API_KEY likely missing in production environment`);
        ingestionNotes.push(`   MANUAL REVIEW REQUIRED: Verify address, city, and state fields for accuracy`);
      }
      
      // Create or find broker record - SMART MERGE to prevent duplicates
      // Uses findOrCreateBroker which checks both email AND phone before creating new
      const contactEmail = dealData.contactEmail || emailData.from;
      const contactPhone = dealData.contactPhone;
      
      // Extract name from contact info or use email prefix
      let firstName = '';
      let lastName = '';
      
      if (dealData.contactName) {
        const nameParts = dealData.contactName.trim().split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      } else if (contactEmail && contactEmail.includes('@')) {
        firstName = contactEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') || 'Email';
        lastName = 'Submission';
      }
      
      // Use smart findOrCreateBroker to prevent duplicate profiles
      const { broker, isNew: isNewBroker, wasUpdated } = await storage.findOrCreateBroker({
        email: contactEmail,
        phone: contactPhone,
        firstName,
        lastName
      });
      
      if (isNewBroker) {
        console.log(`📧 Created new broker ${broker.id} for email: ${contactEmail}`);
      } else if (wasUpdated) {
        console.log(`🔗 Updated existing broker ${broker.id} with new info from email`);
      } else {
        console.log(`✅ Found existing broker ${broker.id} for email: ${contactEmail}`);
      }

      // Send welcome messages for new brokers
      if (isNewBroker && broker) {
        try {
          const { defaultBusinessSettings } = await import('./memoryBusinessSettings');
          const businessSettings = defaultBusinessSettings;
          
          // Get welcome email template
          const emailTemplates = businessSettings.emailTemplates as any[];
          const welcomeEmailTemplate = emailTemplates?.find((t: any) => t.event === 'broker_registered');
          if (welcomeEmailTemplate) {
            const { sendNotificationEmail } = await import('./emailService');
            
            // Replace template variables
            const brokerName = broker.firstName ? `${broker.firstName} ${broker.lastName}`.trim() : 'Valued Partner';
            const emailContent = welcomeEmailTemplate.content
              .replace(/\{\{brokerName\}\}/g, brokerName)
              .replace(/\{\{brokerEmail\}\}/g, broker.email)
              .replace(/\{\{brokerPhone\}\}/g, broker.phone || 'Not provided')
              .replace(/\{\{brokerCompany\}\}/g, broker.brokerage || 'TBD')
              .replace(/\{\{registrationDate\}\}/g, new Date().toLocaleDateString());
            
            await sendNotificationEmail({
              to: broker.email || '',
              subject: welcomeEmailTemplate.subject.replace(/\{\{brokerName\}\}/g, brokerName),
              html: emailContent.replace(/\n/g, '<br/>'),
              type: 'broker_invitation',
              priority: 'high'
            });
          }

          // Send welcome SMS using TemplateService
          if (broker.phone) {
            const { sendSMS } = await import('./smsService');
            const { TemplateService } = await import('./templateService');
            
            const brokerName = broker.firstName || 'Valued Partner';
            const smsContent: string | null = await TemplateService.getSMSTemplate('broker_registered', {
              brokerName,
              brokerEmail: broker.email || '',
              brokerPhone: broker.phone || '',
              companyName: businessSettings.companyName || 'LandLinq'
            });
            
            if (smsContent) {
              const smsResult = await sendSMS({
                to: broker.phone,
                message: smsContent
              });
              
              if (smsResult.success && smsResult.delivered) {
                console.log(`✅ Welcome SMS sent to broker (SID: ${smsResult.sid})`);
              } else if (smsResult.success && !smsResult.delivered) {
                console.log(`⏭️ Welcome SMS not delivered - ${smsResult.reason || smsResult.mode}`);
              } else {
                console.log(`❌ Welcome SMS failed - ${smsResult.error}`);
              }
            } else {
              console.error('❌ CRITICAL: broker_registered SMS template not found in outreach management');
            }
          }
          
          console.log(`📧 Welcome messages sent to new broker: ${broker.email} (via email submission)`);
        } catch (welcomeError) {
          console.error('Error sending welcome messages to new broker:', welcomeError);
          // Don't fail deal creation if welcome messages fail
        }
      }

      // LOGGING: Track what address is being saved
      // CRITICAL FIX (Dec 9, 2025): Smart address fallback - use City, State if BOTH available, otherwise explicit placeholder
      const addressFallback = (dealData.city && dealData.state) 
        ? `${dealData.city}, ${dealData.state}` 
        : '[No Address Provided]';
      
      console.log('🔍 [ADDRESS-DEBUG] Preparing deal submission with address:', {
        extractedAddress: dealData.address || 'NO ADDRESS',
        willUseAddress: dealData.address || addressFallback,
        hasZip: !!dealData.zip,
        zip: dealData.zip || 'NO ZIP CODE',
        emailSubject: emailData.subject,
        emailFrom: emailData.from
      });
      
      // Prepare deal data for creation - handle incomplete information gracefully
      const dealSubmission = {
        // Property Details - use city/state fallback or explicit placeholder when no address
        address: dealData.address || addressFallback,
        // CRITICAL FIX: Use parsed city/state values instead of hardcoded empty strings
        city: dealData.city || null, // null triggers geocoding fallback
        state: dealData.state || null, // null triggers geocoding fallback
        // CRITICAL FIX: Use 'zip' not 'zipCode' to match pipeline expectations
        zip: dealData.zip || null, // null triggers geocoding fallback
        county: '',
        
        // Property Information - indicate when information is missing
        sizeAcres: dealData.acres || 0,
        currentZoning: dealData.zoning || '',
        proposedUse: '',
        askingPrice: dealData.price || 0,
        
        // Development Details
        developmentType: 'Unknown', // Will be determined by AI analysis
        productTypes: dealData.productType ? [dealData.productType] : [], // Product type from keyword extraction
        estimatedUnits: 0,
        
        // Infrastructure - undefined by default, only set when explicitly stated by brokers
        sewerAvailable: undefined,
        waterAvailable: undefined,
        gasAvailable: undefined,
        electricAvailable: undefined,
        
        // Financial
        propertyTaxes: 0,
        
        // CRITICAL FIX (Nov 21, 2025): Use AI broker notes for additionalDetails instead of raw email text
        // Priority: 1) AI-extracted brokerNotes (headers removed), 2) cleaned email text, 3) subject
        // This prevents email headers from appearing in broker notes field
        // ENHANCEMENT (Dec 9, 2025): Append extracted links so users can access them
        additionalDetails: `${dealData.brokerNotes || dealData.description || emailData.text || emailData.subject}${
          missingInfo.length > 0 ? `\n\n[INCOMPLETE SUBMISSION - Missing: ${missingInfo.join(', ')}]` : ''
        }${
          extractedLinks.length > 0 ? `\n\n📎 LINKS FROM EMAIL:\n${extractedLinks.map(l => `• ${l.description || l.type}: ${l.url}`).join('\n')}` : ''
        }`,
        
        // CRITICAL FIX (Dec 9, 2025): Pass brokerNotes separately so it displays in dashboard
        // Previously this was only in additionalDetails but dashboard shows brokerNotes column
        brokerNotes: dealData.brokerNotes || dealData.description || emailData.text || undefined,
        
        // Document URLs from attachments and links (extract just the URLs as strings)
        documentUrls: documentUrls.length > 0 ? documentUrls.map(doc => doc.url) : undefined,
        
        // Ingestion notes from OCR, links, and parsing
        ingestionNotes: ingestionNotes.length > 0 ? ingestionNotes.join('\n') : undefined,
        
        // Broker Information
        brokerId: broker?.id || '',
        contactName: dealData.contactName || 'Email Submission',
        contactEmail: dealData.contactEmail || emailData.from,
        contactPhone: dealData.contactPhone || '',
        submissionMethod: 'email' as const,
        
        // CRITICAL: Set status and classification for all email deals
        status: 'pending_review',
        classification: 'unclassified',
        
        // Source tracking
        source: 'email',
        originalEmail: {
          from: emailData.from,
          subject: emailData.subject,
          receivedAt: new Date().toISOString()
        },
        
        // CRITICAL FIX (Nov 24, 2025): Save raw email content for communication logging
        // This enables the "View Original Email" feature in the deal dashboard
        rawEmailContent: emailData.text || emailData.subject || 'No email content available'
      };
      
      // CRITICAL FIX (Nov 21, 2025): Strip duplicate city/state/zip tokens from address
      // This prevents "8 6106 Burlington Rd Gibsonville" + city="Gibsonville" duplication
      const cleanedDealData = stripDuplicateAddressTokens({
        address: dealSubmission.address,
        city: dealSubmission.city || undefined,
        state: dealSubmission.state || undefined,
        zip: dealSubmission.zip || undefined
      });
      
      // Apply cleaned address back to dealSubmission
      dealSubmission.address = cleanedDealData.address || dealSubmission.address;

      // MULTI-PROPERTY HANDLING: Create multiple deals if email contained multiple properties
      if (dealData._isMultiProperty && dealData._allProperties && dealData._allProperties.length > 1) {
        console.log(`🏘️ Creating ${dealData._allProperties.length} separate deals for multi-property email`);
        
        const { UnifiedDealPipeline } = await import('./unifiedDealPipeline');
        const createdDeals = [];
        
        for (let i = 0; i < dealData._allProperties.length; i++) {
          const property = dealData._allProperties[i];
          
          // Create individual deal for this property
          const propertyDealSubmission = {
            ...dealSubmission,
            address: property.address || `Property ${i + 1} from email submission`,
            askingPrice: property.price ? property.price.toString() : '0',
            sizeAcres: property.acres ? property.acres.toString() : '0',
            additionalDetails: `Property ${i + 1} of ${dealData._allProperties.length} from multi-property email submission\n\n${property.description || dealSubmission.additionalDetails}`,
            // CRITICAL FIX (Dec 9, 2025): Include property-specific notes in brokerNotes
            brokerNotes: property.description || dealData.brokerNotes || emailData.text || null
          };
          
          try {
            const pipelineResult = await UnifiedDealPipeline.processDealSubmission(propertyDealSubmission, skipConfirmation);
            if (pipelineResult.success && pipelineResult.dealId) {
              const propertyDeal = await storage.getDealById(pipelineResult.dealId);
              if (propertyDeal) {
                createdDeals.push(propertyDeal);
                console.log(`✅ Deal ${i + 1}/${dealData._allProperties.length} created: ${pipelineResult.dealId} (${property.address})`);
                
                // UPLOAD ATTACHMENTS: Upload email attachments to object storage for this property
                const attachmentMetadata: any[] = [];
                if (emailData.attachments && emailData.attachments.length > 0) {
                  console.log(`📎 Uploading ${emailData.attachments.length} attachment(s) for property deal ${i + 1}`);
                  const { ObjectStorageService } = await import('./objectStorage');
                  const objectStorage = new ObjectStorageService();
                  
                  for (const attachment of emailData.attachments) {
                    try {
                      // Decode base64 content to binary buffer (SendGrid provides base64 strings)
                      const buffer = Buffer.from(attachment.content, 'base64');
                      
                      const storageUrl = await objectStorage.uploadAttachment(
                        buffer,
                        attachment.filename,
                        attachment.contentType,
                        pipelineResult.dealId
                      );
                      
                      attachmentMetadata.push({
                        filename: attachment.filename,
                        contentType: attachment.contentType,
                        size: buffer.length,
                        storageUrl: storageUrl,
                        uploadedAt: new Date().toISOString()
                      });
                      
                      console.log(`✅ Uploaded: ${attachment.filename} (${(buffer.length / 1024).toFixed(2)} KB) for property ${i + 1}`);
                    } catch (uploadError) {
                      console.error(`❌ Failed to upload attachment ${attachment.filename}:`, uploadError);
                      // Continue with other attachments
                    }
                  }
                  
                  // CRITICAL FIX (Dec 1, 2025): Save uploaded attachment URLs to deal's documentUrls column
                  // Bug: Attachments were uploaded to object storage but never linked to the deal record
                  if (attachmentMetadata.length > 0) {
                    const uploadedUrls = attachmentMetadata.map(att => att.storageUrl);
                    console.log(`📎 Saving ${uploadedUrls.length} attachment URL(s) to property deal ${i + 1} documentUrls`);
                    
                    try {
                      await storage.updateDeal(pipelineResult.dealId, {
                        documentUrls: uploadedUrls
                      });
                      console.log(`✅ Property deal ${i + 1} documentUrls updated with ${uploadedUrls.length} attachment(s)`);
                    } catch (updateError) {
                      console.error(`⚠️ Failed to update property deal ${i + 1} documentUrls:`, updateError);
                    }
                  }
                }
                
                // SAVE ORIGINAL EMAIL: Store email content for each property deal
                // CRITICAL FIX: Use providerMessageId for deduplication, keep eventType stable for analytics
                try {
                  await storage.createCommunication({
                    brokerId: broker?.id || undefined,
                    relatedDealId: pipelineResult.dealId,
                    channel: 'email' as const,
                    direction: 'inbound' as const,
                    eventType: 'email_received', // Stable identifier for analytics (filtering direction='inbound' + eventType='email_received')
                    providerMessageId: (emailData as any).providerMessageId || `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Use Message-ID from SendGrid
                    subject: `${emailData.subject} (Property ${i + 1}/${dealData._allProperties.length})`,
                    message: emailData.text || emailData.html || 'No content',
                    rawText: emailData.text || emailData.html || 'No content',
                    status: 'resolved' as const,
                    attachments: attachmentMetadata.length > 0 ? attachmentMetadata : undefined
                  });
                  console.log(`✅ Original email saved for property deal ${i + 1}: ${pipelineResult.dealId}`);
                  if (attachmentMetadata.length > 0) {
                    console.log(`✅ Saved ${attachmentMetadata.length} attachment metadata for property ${i + 1}`);
                  }
                } catch (commError) {
                  console.error(`⚠️ Failed to save email for property ${i + 1} (non-critical):`, commError);
                  console.error('Error details:', commError);
                }
              }
            }
          } catch (error) {
            console.error(`❌ Failed to create deal ${i + 1}/${dealData._allProperties.length}:`, error);
          }
        }
        
        console.log(`🎉 Multi-property processing complete: ${createdDeals.length}/${dealData._allProperties.length} deals created successfully`);
        return createdDeals[0] || null; // Return first deal for compatibility
        
      } else {
        // Single property - process through UnifiedDealPipeline for proper handling
        const { UnifiedDealPipeline } = await import('./unifiedDealPipeline');
        
        console.log(`📧 Processing email submission through UnifiedDealPipeline...`);
        const pipelineResult = await UnifiedDealPipeline.processDealSubmission(dealSubmission, skipConfirmation);
        
        if (pipelineResult.success && pipelineResult.dealId) {
          const deal = await storage.getDealById(pipelineResult.dealId);
          console.log(`✅ Deal processed through pipeline: ${pipelineResult.dealId}`);
          
          // UPLOAD ATTACHMENTS: Upload email attachments to object storage
          const attachmentMetadata: any[] = [];
          if (emailData.attachments && emailData.attachments.length > 0) {
            console.log(`📎 Uploading ${emailData.attachments.length} attachment(s) for deal ${pipelineResult.dealId}`);
            const { ObjectStorageService } = await import('./objectStorage');
            const objectStorage = new ObjectStorageService();
            
            for (const attachment of emailData.attachments) {
              try {
                // Decode base64 content to binary buffer (SendGrid provides base64 strings)
                const buffer = Buffer.from(attachment.content, 'base64');
                
                const storageUrl = await objectStorage.uploadAttachment(
                  buffer,
                  attachment.filename,
                  attachment.contentType,
                  pipelineResult.dealId
                );
                
                attachmentMetadata.push({
                  filename: attachment.filename,
                  contentType: attachment.contentType,
                  size: buffer.length,
                  storageUrl: storageUrl,
                  uploadedAt: new Date().toISOString()
                });
                
                console.log(`✅ Uploaded: ${attachment.filename} (${(buffer.length / 1024).toFixed(2)} KB)`);
              } catch (uploadError) {
                console.error(`❌ Failed to upload attachment ${attachment.filename}:`, uploadError);
                // Continue with other attachments
              }
            }
            
            // CRITICAL FIX (Dec 1, 2025): Save uploaded attachment URLs to deal's documentUrls column
            // Bug: Attachments were uploaded to object storage but never linked to the deal record
            // Now: Extract storageUrls from attachmentMetadata and save to deal.documentUrls
            if (attachmentMetadata.length > 0) {
              const uploadedUrls = attachmentMetadata.map(att => att.storageUrl);
              console.log(`📎 Saving ${uploadedUrls.length} attachment URL(s) to deal.documentUrls`);
              
              try {
                await storage.updateDeal(pipelineResult.dealId, {
                  documentUrls: uploadedUrls
                });
                console.log(`✅ Deal documentUrls updated with ${uploadedUrls.length} attachment(s)`);
              } catch (updateError) {
                console.error(`⚠️ Failed to update deal documentUrls:`, updateError);
              }
            }
          }
          
          // SAVE ORIGINAL EMAIL: Store email content in communications table for "View Original Email" feature
          // CRITICAL FIX: Use UPSERT pattern - update existing communication or create new one
          // The background job processor may have already created/linked a communication record
          try {
            // CRITICAL: Use the exact providerMessageId from emailData if it exists
            // This must match what routes.ts used when creating the communication record
            const providerMsgId = (emailData as any).providerMessageId;
            
            // Check if a communication already exists for this deal (linked by background job processor)
            const { db } = await import('./db');
            const { communications } = await import('@shared/schema');
            const { eq, and, or, isNull, desc, sql } = await import('drizzle-orm');
            
            // Look for existing communication by:
            // 1. Already linked to this deal
            // 2. Matching providerMessageId (if we have one)
            // 3. FALLBACK: Unlinked inbound email from same broker within 5 minutes
            const existingComm = await db.select()
              .from(communications)
              .where(
                or(
                  eq(communications.relatedDealId, pipelineResult.dealId),
                  providerMsgId ? eq(communications.providerMessageId, providerMsgId) : sql`FALSE`
                )
              )
              .limit(1);
            
            if (existingComm.length > 0) {
              // UPDATE existing communication with attachment metadata
              console.log(`📧 Communication already exists (ID: ${existingComm[0].id}) - updating with attachment metadata`);
              await db.update(communications)
                .set({
                  relatedDealId: pipelineResult.dealId,
                  status: 'resolved',
                  attachments: attachmentMetadata.length > 0 ? attachmentMetadata : existingComm[0].attachments
                })
                .where(eq(communications.id, existingComm[0].id));
              console.log(`✅ Updated existing communication with dealId and attachments`);
            } else {
              // FALLBACK: Look for recent unlinked inbound email from same broker (within 10 minutes)
              // This handles cases where providerMessageId didn't match
              let fallbackComm = null;
              if (broker?.id) {
                const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
                const brokerComms = await db.select()
                  .from(communications)
                  .where(
                    and(
                      eq(communications.brokerId, broker.id),
                      eq(communications.channel, 'email'),
                      eq(communications.direction, 'inbound'),
                      isNull(communications.relatedDealId),
                      sql`${communications.createdAt} > ${tenMinutesAgo}`
                    )
                  )
                  .orderBy(desc(communications.createdAt))
                  .limit(1);
                
                if (brokerComms.length > 0) {
                  fallbackComm = brokerComms[0];
                  console.log(`📧 Found unlinked communication via broker fallback (ID: ${fallbackComm.id})`);
                }
              }
              
              if (fallbackComm) {
                // UPDATE the fallback communication
                await db.update(communications)
                  .set({
                    relatedDealId: pipelineResult.dealId,
                    status: 'resolved',
                    attachments: attachmentMetadata.length > 0 ? attachmentMetadata : fallbackComm.attachments
                  })
                  .where(eq(communications.id, fallbackComm.id));
                console.log(`✅ Linked fallback communication to deal ${pipelineResult.dealId}`);
              } else {
                // CREATE new communication (fallback for emails not coming through background job)
                const newProviderMsgId = providerMsgId || `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                console.log(`📧 [COMM-CREATE] Creating NEW communication for deal ${pipelineResult.dealId}`);
                console.log(`📧 [COMM-CREATE] providerMessageId: ${newProviderMsgId}`);
                console.log(`📧 [COMM-CREATE] brokerId: ${broker?.id || 'undefined'}`);
                console.log(`📧 [COMM-CREATE] email: ${emailData.from}`);
                
                const commData = {
                  brokerId: broker?.id || null,
                  relatedDealId: pipelineResult.dealId,
                  email: emailData.from,
                  phone: null,
                  channel: 'email' as const,
                  direction: 'inbound' as const,
                  eventType: 'email_received',
                  providerMessageId: newProviderMsgId,
                  subject: emailData.subject || 'No Subject',
                  message: emailData.text || emailData.html || 'No content',
                  rawText: emailData.text || emailData.html || 'No content',
                  status: 'resolved' as const,
                  attachments: attachmentMetadata.length > 0 ? attachmentMetadata : undefined
                };
                
                try {
                  const newComm = await storage.createCommunication(commData as any);
                  console.log(`✅ [COMM-CREATE] Successfully created communication ID: ${newComm.id} for deal ${pipelineResult.dealId}`);
                } catch (createErr) {
                  console.error(`❌ [COMM-CREATE] FAILED to create communication:`, createErr);
                  console.error(`❌ [COMM-CREATE] Data attempted:`, JSON.stringify(commData, null, 2));
                  throw createErr; // Re-throw to see the error
                }
              }
            }
            
            if (attachmentMetadata.length > 0) {
              console.log(`✅ Saved ${attachmentMetadata.length} attachment metadata records`);
            }
          } catch (commError) {
            console.error(`⚠️ Failed to save email to communications (non-critical):`, commError);
            console.error('Error details:', commError);
            // Don't fail deal creation if communication save fails
          }
          
          return deal;
        } else {
          console.error(`❌ Pipeline processing failed for email submission`);
          return null;
        }
      }

    } catch (error) {
      console.error('❌ Error creating deal from email:', error);
      return null;
    }
  }

  /**
   * Create a minimal deal when all else fails - ensures ALL emails work
   */
  private static async createMinimalDealFromEmail(emailData: InboundEmail, contactEmail: string): Promise<any> {
    try {
      console.log('🚨 Creating minimal fallback deal to ensure email submission succeeds');
      
      // Try to find or create a broker with minimal info - uses smart merge
      let broker;
      if (contactEmail) {
        const emailPrefix = contactEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') || 'Email';
        const { broker: foundBroker } = await storage.findOrCreateBroker({
          email: contactEmail,
          firstName: emailPrefix,
          lastName: 'Submission'
        });
        broker = foundBroker;
      }
      
      // Create minimal deal
      const minimalDeal = {
        address: 'Email Submission - Details TBD',
        city: '',
        state: '',
        // CRITICAL FIX: Use 'zip' not 'zipCode' to match pipeline expectations
        zip: '',
        county: '',
        sizeAcres: '0',
        currentZoning: '',
        proposedUse: '',
        askingPrice: '0',
        developmentType: 'Unknown',
        estimatedUnits: 0,
        sewerAvailable: null,
        waterAvailable: null,
        gasAvailable: null,
        electricAvailable: null,
        propertyTaxes: 0,
        additionalDetails: `Minimal deal created from email: ${emailData.from}\nSubject: ${emailData.subject}\nContent: ${emailData.text}`,
        brokerId: broker?.id || '',
        contactName: 'Email Submission',
        contactEmail: contactEmail,
        contactPhone: '',
        submissionMethod: 'email' as const,
        
        // CRITICAL: Set status and classification for minimal deals too
        status: 'pending_review',
        classification: 'unclassified',
        
        source: 'email',
        originalEmail: {
          from: emailData.from,
          subject: emailData.subject,
          receivedAt: new Date().toISOString()
        }
      };
      
      const deal = await storage.createDeal(minimalDeal);
      console.log('✅ Minimal fallback deal created successfully:', deal?.id);
      
      // SAVE ORIGINAL EMAIL: Store email content even for minimal deals
      if (deal) {
        try {
          await storage.createCommunication({
            brokerId: broker?.id || null,
            relatedDealId: deal.id,
            channel: 'email',
            direction: 'inbound',
            eventType: 'email_received', // Stable identifier for analytics
            providerMessageId: (emailData as any).providerMessageId || `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Use Message-ID from SendGrid
            subject: emailData.subject || 'No Subject',
            message: emailData.text || emailData.html || 'No content',
            rawText: emailData.text || emailData.html || 'No content',
            status: 'resolved'
          });
          console.log(`✅ Original email saved for minimal deal: ${deal.id}`);
        } catch (commError) {
          console.error(`⚠️ Failed to save email for minimal deal (non-critical):`, commError);
        }
      }
      
      return deal;
      
    } catch (error) {
      console.error('❌ Even minimal deal creation failed:', error);
      return null;
    }
  }

  /**
   * Format address to proper case and add commas
   * Converts "188 COLE RD CHARLOTTE NC" to "188 Cole Road, Charlotte, NC"
   * Converts "1600 CAMDEN RD CHARLOTTE NC 28203" to "1600 Camden Road, Charlotte, NC 28203"
   * CRITICAL: Preserves addresses with only ZIP code like "0 West Trinity Lane, 37207"
   */
  private static formatAddress(address: string): string {
    if (!address) return address;
    
    // Trim and clean up extra spaces
    let formatted = address.trim().replace(/\s+/g, ' ');
    
    // Remove ALL unwanted commas before proper formatting
    // "1600, Camden, Road" -> "1600 Camden Road"
    formatted = formatted.replace(/^(\d+)\s*,\s*/, '$1 '); // Remove comma after street number
    formatted = formatted.replace(/,\s*(?=[A-Z][a-z]+\s+(?:Rd|St|Ave|Dr|Ln|Road|Street|Avenue|Drive|Lane|Blvd|Boulevard|Ct|Court|Pl|Place|Pkwy|Parkway))/gi, ' '); // Remove commas before street type
    
    // Convert to title case (capitalize first letter of each word)
    formatted = formatted.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
    
    // Expand common street abbreviations to full words
    // Match abbreviations followed by space, comma, or end of string
    const abbreviations: Record<string, string> = {
      ' Rd': ' Road',
      ' St': ' Street',
      ' Ave': ' Avenue',
      ' Dr': ' Drive',
      ' Ln': ' Lane',
      ' Blvd': ' Boulevard',
      ' Ct': ' Court',
      ' Pl': ' Place',
      ' Pkwy': ' Parkway'
    };
    
    for (const [abbr, full] of Object.entries(abbreviations)) {
      // Match abbreviation followed by space, comma, or end of string
      formatted = formatted.replace(new RegExp(abbr + '(?=\\s|,|$)', 'g'), full);
    }
    
    // CRITICAL FIX: Check if address ends with just ZIP code (no city/state)
    // Pattern: "Street Type + ZIP" like "Trinity Lane 37207"
    const hasOnlyZip = /\b(Road|Street|Avenue|Drive|Lane|Boulevard|Court|Place|Parkway|Way|Circle|Trail)\s+\d{5}$/i.test(formatted);
    
    if (hasOnlyZip) {
      // Don't format - just add comma before ZIP: "0 West Trinity Lane 37207" -> "0 West Trinity Lane, 37207"
      formatted = formatted.replace(/\s+(\d{5})$/, ', $1');
      return formatted;
    }
    
    // Handle addresses with ZIP code: Use street type indicators as anchors
    // "1600 Camden Road Charlotte NC 28203" -> "1600 Camden Road, Charlotte, NC 28203"
    if (formatted.match(/\b(Road|Street|Avenue|Drive|Lane|Boulevard|Court|Place|Parkway|Way|Circle|Trail)\b/i)) {
      // Match: Street-type + City + State + ZIP
      formatted = formatted.replace(
        /\b(Road|Street|Avenue|Drive|Lane|Boulevard|Court|Place|Parkway|Way|Circle|Trail)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+([A-Z]{2})\s+(\d{5})$/i,
        '$1, $2, $3 $4'
      );
    } else {
      // Fallback: just add commas before last 1-2 words + state + ZIP
      formatted = formatted.replace(/\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+([A-Z]{2})\s+(\d{5})$/i, ', $1, $2 $3');
    }
    
    // Handle addresses without ZIP code
    if (!/\d{5}$/.test(formatted)) {
      if (formatted.match(/\b(Road|Street|Avenue|Drive|Lane|Boulevard|Court|Place|Parkway|Way|Circle|Trail)\b/i)) {
        formatted = formatted.replace(
          /\b(Road|Street|Avenue|Drive|Lane|Boulevard|Court|Place|Parkway|Way|Circle|Trail)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,1})\s+([A-Z]{2})$/i,
          '$1, $2, $3'
        );
      } else {
        formatted = formatted.replace(/\s+([A-Z][a-z]+)\s+([A-Z]{2})$/i, ', $1, $2');
      }
    }
    
    // Ensure state code is uppercase
    formatted = formatted.replace(/,\s*([a-z]{2})(?:\s|$)/i, (match, state, offset, string) => {
      return `, ${state.toUpperCase()}${match.endsWith(' ') ? ' ' : ''}`;
    });
    
    return formatted;
  }

  /**
   * Validate if extracted text looks like a real property address
   */
  private static isValidAddress(address: string): boolean {
    if (!address || address.length < 5) return false;
    
    // Must contain at least a number and some alphabetic characters
    const hasNumber = /\d/.test(address);
    const hasLetters = /[a-zA-Z]/.test(address);
    
    // Should not be just a price or acreage description
    const isPriceOnly = /^\$?[\d,]+(?:\.\d{2})?$/.test(address.trim());
    const isAcreageOnly = /^[\d.]+\s*(?:acres?|ac)$/i.test(address.trim());
    
    // Should not be overly long (likely description text)
    const isTooLong = address.length > 200;
    
    // Should contain street indicators
    const hasStreetIndicator = /(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|way|blvd|boulevard|ct|court|pl|place|pkwy|parkway)/i.test(address);
    
    return hasNumber && hasLetters && !isPriceOnly && !isAcreageOnly && !isTooLong && hasStreetIndicator;
  }

  /**
   * Extract ZIP code from address string
   */
  private static extractZipCode(address: string): string | null {
    if (!address) return null;
    
    // Match 5-digit ZIP code or ZIP+4 format at end of address or after state abbreviation
    // Patterns:
    // 1. After 2-letter state code: "NC 28202" or "NC 28202-1234"
    // 2. At end of string: "...28202" or "...28202-1234"
    const zipPatterns = [
      /\b[A-Z]{2}\s+(\d{5})(?:-\d{4})?\b/,  // After state abbreviation
      /\b(\d{5})(?:-\d{4})?\s*$/             // At end of address
    ];
    
    for (const pattern of zipPatterns) {
      const match = address.match(pattern);
      if (match) {
        return match[1]; // Return just the 5-digit ZIP
      }
    }
    
    return null;
  }

  /**
   * Extract state code from address string
   */
  private static extractState(address: string): string | null {
    if (!address) return null;
    
    // Valid US state codes
    const VALID_US_STATES = new Set([
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
      'DC', 'PR', 'VI', 'GU', 'AS', 'MP'
    ]);
    
    // Match 2-letter state codes in various positions:
    // 1. After comma with optional ZIP: "City, ST" or "City, ST 12345"
    // 2. Before ZIP without comma: "City ST 12345"
    // 3. At end of address: "...City, ST"
    const statePatterns = [
      /,\s*([A-Z]{2})(?:\s+\d{5})?(?:\s*$|,)/,  // After comma with optional ZIP
      /\b([A-Z]{2})\s+\d{5}/,                     // Before ZIP code
      /,\s*([A-Z]{2})\s*$/                        // At end after comma
    ];
    
    for (const pattern of statePatterns) {
      const match = address.match(pattern);
      if (match && VALID_US_STATES.has(match[1])) {
        return match[1];
      }
    }
    
    return null;
  }

  /**
   * Extract city name from address string
   * Patterns: "123 Main St, Charlotte, NC" → "Charlotte"
   *           "123 Main St, Charlotte NC 28202" → "Charlotte"
   */
  private static extractCity(address: string): string | null {
    if (!address) return null;
    
    // Valid US state codes (needed to validate city extraction)
    const VALID_US_STATES = new Set([
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
      'DC', 'PR', 'VI', 'GU', 'AS', 'MP'
    ]);
    
    // Match city before state code
    // Patterns:
    // 1. "street, CITY, STATE ZIP" → captures CITY
    // 2. "street, CITY STATE ZIP" → captures CITY (no comma before state)
    // 3. "street, CITY, STATE" → captures CITY
    const cityPatterns = [
      /,\s*([^,]+?),\s*([A-Z]{2})(?:\s+\d{5})?/i,  // "..., City, ST" or "..., City, ST 12345"
      /,\s*([^,]+?)\s+([A-Z]{2})\s+\d{5}/i,        // "..., City ST 12345" (no comma before state)
      /,\s*([^,]+?)\s+([A-Z]{2})\s*$/i             // "..., City ST" at end
    ];
    
    for (const pattern of cityPatterns) {
      const match = address.match(pattern);
      if (match && VALID_US_STATES.has(match[2].toUpperCase())) {
        const city = match[1].trim();
        // Validate city: should be 2-50 chars, no numbers
        if (city.length >= 2 && city.length <= 50 && !/^\d/.test(city)) {
          return city;
        }
      }
    }
    
    return null;
  }

  /**
   * PUBLIC HELPERS: Export address parsing functions for use in other modules
   */
  static parseCity(address: string): string | null {
    return this.extractCity(address);
  }

  static parseState(address: string): string | null {
    return this.extractState(address);
  }

  static parseZipCode(address: string): string | null {
    return this.extractZipCode(address);
  }

  /**
   * Forward email and deal data to external webhooks
   */
  static async forwardToExternalWebhooks(emailData: InboundEmail, deal: any): Promise<void> {
    const externalWebhooks = getWebhooksByType('email');
    
    if (externalWebhooks.length === 0) {
      console.log('📧 No external email webhooks configured');
      return;
    }

    const forwardData = {
      originalEmail: emailData,
      createdDeal: {
        id: deal.id,
        address: deal.address,
        askingPrice: deal.askingPrice,
        sizeAcres: deal.sizeAcres,
        classification: 'unclassified',
        createdAt: deal.createdAt,
        broker: deal.broker
      },
      timestamp: new Date().toISOString(),
      source: 'landlinq-replit-app'
    };

    for (const webhook of externalWebhooks) {
      try {
        console.log(`📧 Forwarding to external webhook: ${webhook.name} (${webhook.url})`);
        
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'LandLinq-Webhook-Forwarder/1.0'
          },
          body: JSON.stringify(forwardData)
        });

        if (response.ok) {
          console.log(`✅ Successfully forwarded to ${webhook.name}`);
        } else {
          console.error(`❌ Failed to forward to ${webhook.name}: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.error(`❌ Error forwarding to ${webhook.name}:`, error);
      }
    }
  }

  /**
   * Send confirmation email back to the broker using proper template from outreach management
   */
  private static async sendConfirmationEmail(emailData: InboundEmail, deal: any) {
    try {
      // Use proper template from outreach management
      const { TemplateService } = await import('./templateService');
      const contactName = deal.contactName || emailData.from.split('@')[0] || 'Valued Partner';
      
      const template = await TemplateService.getEmailTemplate('Deal Submitted', {
        brokerName: contactName,
        address: deal.address || 'the property',
        dealId: deal.id || 'Pending',
        propertyAddress: deal.address || 'the property',
        date: new Date().toLocaleDateString(),
        dealValue: deal.askingPrice ? `$${deal.askingPrice.toLocaleString()}` : 'To be determined',
        brokerEmail: emailData.from,
        analystName: 'Austin Blondell',
        companyName: 'LandLinq - Catalyst Capital Partners',
        brandColor: '#4A90E2',
        brandColorDark: '#081729',
        logoUrl: 'https://landlinq.ai/logo.png',
        dashboardUrl: 'https://landlinq.ai/dashboard',
        contactPhone: '(704) 610-1549',
        contactEmail: 'deals@catalyst.landlinq.ai',
        websiteUrl: 'https://landlinq.ai'
      });
      
      if (template) {
        await sendNotificationEmail({
          to: emailData.from,
          subject: template.subject,
          html: template.html, // templateService always returns properly formatted HTML with logo/blue line/footer
          text: template.content,
          type: 'status_update',
          priority: 'urgent'
        });
        
        console.log(`📧 Confirmation email sent to ${emailData.from} using outreach template`);
      } else {
        console.error('❌ CRITICAL: Deal Submitted template not configured in outreach management');
        console.error('❌ NO EMAIL SENT - Only outreach templates are allowed');
        console.error('❌ Configure Deal Submitted template in outreach management tab');
        // NO FALLBACK - Only outreach templates should be sent
      }

    } catch (error) {
      console.error('❌ Error sending confirmation email:', error);
      // NO FALLBACK - Only outreach templates should be sent
      console.error('❌ NO EMAIL SENT - Only outreach templates are allowed');
      console.error('❌ Configure required email templates in outreach management tab');
      console.error('❌ Original error:', error);
    }
  }

  /**
   * Send confirmation email when broker provides missing information via reply
   */
  private static async sendUpdateConfirmationEmail(emailData: InboundEmail, deal: any, fieldsResolved: string[]) {
    try {
      const { TemplateService } = await import('./templateService');
      const contactName = deal.contactName || emailData.from.split('@')[0] || 'Valued Partner';
      
      // Use a generic confirmation template or create a specific one
      const template = await TemplateService.getEmailTemplate('Deal Submitted', {
        brokerName: contactName,
        address: deal.address || 'the property',
        dealId: deal.id || 'Pending',
        propertyAddress: deal.address || 'the property',
        date: new Date().toLocaleDateString(),
        dealValue: deal.askingPrice ? `$${deal.askingPrice.toLocaleString()}` : 'To be determined',
        brokerEmail: emailData.from,
        analystName: 'Austin Blondell',
        fieldsResolved: fieldsResolved.join(', '),
        companyName: 'LandLinq - Catalyst Capital Partners',
        brandColor: '#4A90E2',
        brandColorDark: '#081729',
        logoUrl: 'https://landlinq.ai/logo.png',
        dashboardUrl: 'https://landlinq.ai/dashboard',
        contactPhone: '(704) 610-1549',
        contactEmail: 'deals@catalyst.landlinq.ai',
        websiteUrl: 'https://landlinq.ai'
      });
      
      if (template) {
        await sendNotificationEmail({
          to: emailData.from,
          subject: `✅ Information Received - ${deal.address || 'Your Property'}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
              <h2>Thank you for the additional information!</h2>
              <p>Hi ${contactName},</p>
              <p>We've received and updated your submission with the following information:</p>
              <ul>
                ${fieldsResolved.map(field => `<li>${field}</li>`).join('')}
              </ul>
              <p><strong>Deal ID:</strong> ${deal.id}</p>
              <p><strong>Property:</strong> ${deal.address || 'Pending'}</p>
              <p>Our team will review this information and get back to you shortly.</p>
              <p>Best regards,<br/>Catalyst Capital Partners</p>
            </div>
          `,
          type: 'status_update',
          priority: 'medium'
        });
        
        console.log(`📧 Update confirmation email sent to ${emailData.from}`);
      }
    } catch (error) {
      console.error('❌ Error sending update confirmation email:', error);
    }
  }

  /**
   * Send help email for invalid submissions using outreach templates ONLY
   */
  static async sendHelpEmail(emailData: InboundEmail): Promise<void> {
    try {
      // Use outreach template for help/guidance emails
      const { TemplateService } = await import('./templateService');
      const contactName = emailData.from.split('@')[0] || 'Valued Partner';
      
      const template = await TemplateService.getEmailTemplate('Info Missing', {
        brokerName: contactName,
        brokerEmail: emailData.from,
        contactEmail: 'catalyst@landlinq.ai',
        supportEmail: 'catalyst@landlinq.ai'
      });
      
      if (template) {
        await sendNotificationEmail({
          to: emailData.from,
          subject: template.subject,
          html: template.html, // templateService always returns properly formatted HTML with logo/blue line/footer
          text: template.content,
          type: 'welcome',
          priority: 'medium'
        });
        
        console.log(`📧 Help email sent to ${emailData.from} using outreach template`);
      } else {
        console.error('❌ CRITICAL: Info Missing template not configured in outreach management');
        console.error('❌ NO EMAIL SENT - Only outreach templates are allowed');
        console.error('❌ Configure Info Missing template in outreach management tab');
        // NO FALLBACK - Only outreach templates should be sent
      }
    } catch (error) {
      console.error('❌ Error sending help email:', error);
      console.error('❌ NO EMAIL SENT - Only outreach templates are allowed');
    }
  }

  /**
   * Notify team members about new deal from email using outreach templates ONLY
   */
  /**
   * Notify admin team when SendGrid automated email is blocked
   */
  private static async notifyTeamOfBlockedSendGridEmail(emailData: InboundEmail) {
    try {
      const adminEmail = 'jack@catalystcp.com';

      await sendNotificationEmail({
        to: adminEmail,
        subject: `🚫 SendGrid Automated Email Blocked`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
            <div style="background: #10b981; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">🚫 SendGrid Automated Email Blocked</h1>
            </div>
            <div style="padding: 30px; background: #fff;">
              <p><strong>A SendGrid automated/monitoring email was detected and blocked to prevent garbage deal creation.</strong></p>
              
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0;">Email Details:</h3>
                <p style="margin: 5px 0;"><strong>From:</strong> ${emailData.from}</p>
                <p style="margin: 5px 0;"><strong>To:</strong> ${emailData.to}</p>
                <p style="margin: 5px 0;"><strong>Subject:</strong> ${emailData.subject || 'No Subject'}</p>
                <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
              </div>
              
              <div style="background: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0;">✅ Protection Active:</h3>
                <p style="margin: 0;"><strong>NO DEAL CREATED</strong> - SendGrid metadata prevented from corrupting database</p>
                <p style="margin: 5px 0 0 0;"><strong>NO CONFIRMATION SENT</strong> - No garbage emails to you or brokers</p>
              </div>
              
              <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0;">⚠️ Monitor This:</h3>
                <p style="margin: 0;">If you see legitimate broker emails being blocked, contact development immediately.</p>
                <p style="margin: 5px 0 0 0;">This notification helps us verify the filter is working correctly without blocking real submissions.</p>
              </div>
              
              <h3>Email Content Preview:</h3>
              <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; max-height: 300px; overflow-y: auto;">
                <pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px; margin: 0;">${emailData.text?.substring(0, 500) || 'No content'}</pre>
              </div>
            </div>
          </div>
        `,
        type: 'system_alert',
        priority: 'low'
      });
      
      console.log('📧 Admin notified of blocked SendGrid email');

    } catch (error) {
      console.error('❌ Error sending blocked email notification:', error);
    }
  }

  /**
   * Notify team when garbage email is received (automated test/monitoring data)
   */
  private static async notifyTeamOfGarbageEmail(emailData: InboundEmail) {
    try {
      const teamEmails = [
        'jack@catalystcp.com'
      ];

      // Send notification about garbage email
      for (const email of teamEmails) {
        await sendNotificationEmail({
          to: email,
          subject: `🗑️ LandLinq - Garbage Email Blocked`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
              <div style="background: #f59e0b; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">🗑️ Garbage Email Blocked</h1>
              </div>
              <div style="padding: 30px; background: #fff;">
                <h2>Invalid Email Prevented Deal Creation</h2>
                <p>An email was received but contained NO valid property data (no address, price, or acreage). This was likely from automated testing or monitoring.</p>
                
                <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin: 0 0 10px 0;">Email Details:</h3>
                  <p style="margin: 5px 0;"><strong>From:</strong> ${emailData.from}</p>
                  <p style="margin: 5px 0;"><strong>Subject:</strong> ${emailData.subject || 'No Subject'}</p>
                  <p style="margin: 5px 0;"><strong>Text Length:</strong> ${emailData.text?.length || 0} characters</p>
                  <p style="margin: 5px 0;"><strong>Received:</strong> ${new Date().toLocaleString()}</p>
                </div>
                
                <div style="background: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin: 0 0 10px 0;">✅ Action Taken:</h3>
                  <p style="margin: 0;"><strong>NO DEAL CREATED</strong> - Email rejected to prevent garbage data</p>
                  <p style="margin: 5px 0 0 0;"><strong>NO CONFIRMATION SENT</strong> - Broker was not notified</p>
                </div>
                
                <h3>Email Content Preview:</h3>
                <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; max-height: 300px; overflow-y: auto;">
                  <pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px; margin: 0;">${emailData.text?.substring(0, 500) || 'No content'}</pre>
                </div>
              </div>
            </div>
          `,
          type: 'system_alert',
          priority: 'normal'
        });
      }
      
      console.log('📧 Team notified of blocked garbage email');

    } catch (error) {
      console.error('❌ Error sending garbage email notification:', error);
    }
  }

  /**
   * Notify team when email parsing fails - requires manual processing
   */
  static async notifyTeamOfFailedParse(emailData: InboundEmail, contactEmail: string) {
    try {
      const teamEmails = [
        'austin@catalystcp.com',
        'jack@catalystcp.com'
      ];

      // Prepare attachments list
      const attachmentsList = emailData.attachments && emailData.attachments.length > 0 
        ? emailData.attachments.map((att: any) => 
            `<li>${att.filename || 'Unnamed'} (${Math.round((att.size || 0) / 1024)}KB)</li>`
          ).join('')
        : '<li>No attachments</li>';

      // Get the full email content (text or HTML)
      const emailContent = emailData.text || emailData.html || 'No content available';
      
      // Send direct notification - this is an error condition, not a standard template
      for (const email of teamEmails) {
        await sendNotificationEmail({
          to: email,
          subject: `⚠️ LandLinq - Email Parse Failed - Manual Processing Required`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
              <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">⚠️ Email Parse Failed</h1>
              </div>
              <div style="padding: 30px; background: #fff;">
                <h2>Manual Processing Required</h2>
                <p>An email was received at <a href="mailto:catalyst@landlinq.ai">catalyst@landlinq.ai</a> but could not be automatically parsed into a deal.</p>
                
                <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin: 0 0 10px 0;">Email Details:</h3>
                  <p style="margin: 5px 0;"><strong>From:</strong> <a href="mailto:${contactEmail}">${contactEmail}</a></p>
                  <p style="margin: 5px 0;"><strong>Subject:</strong> ${emailData.subject || 'No Subject'}</p>
                  <p style="margin: 5px 0;"><strong>Received:</strong> ${new Date().toLocaleString()}</p>
                </div>
                
                <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin: 0 0 10px 0;">Action Required:</h3>
                  <p style="margin: 0;">Please review the original email content below and manually create the deal in the system.</p>
                </div>
                
                <div style="background: #e0f2fe; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin: 0 0 10px 0;">📎 Attachments (${emailData.attachments?.length || 0}):</h3>
                  <ul style="margin: 5px 0; padding-left: 20px;">
                    ${attachmentsList}
                  </ul>
                </div>
                
                <h3>Full Email Content:</h3>
                <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; max-height: 600px; overflow-y: auto;">
                  ${emailData.html || `<pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px; margin: 0;">${emailContent}</pre>`}
                </div>
              </div>
            </div>
          `,
          type: 'deal_alert',
          priority: 'urgent'
        });
      }
      
      console.log('📧 Team notified of failed email parse - manual processing required');

    } catch (error) {
      console.error('❌ Error sending failed parse notification:', error);
    }
  }

  static async notifyTeamOfNewDeal(deal: any) {
    try {
      const teamEmails = [
        'jack@catalystcp.com',
        'aj@catalystcp.com',
        'austin@catalystcp.com'
      ];

      // Use outreach template for team notifications
      const { TemplateService } = await import('./templateService');
      
      const template = await TemplateService.getEmailTemplate('status_under_review', {
        dealId: deal.id || 'Pending',
        address: deal.address || 'the property',
        propertyAddress: deal.address || 'the property',
        contactEmail: deal.contactEmail || 'unknown',
        brokerEmail: deal.contactEmail || 'unknown',
        brokerName: deal.contactName || 'Unknown Broker',
        receivedDate: new Date().toLocaleString(),
        date: new Date().toLocaleDateString(),
        companyName: 'LandLinq - Catalyst Capital Partners',
        brandColor: '#4A90E2',
        brandColorDark: '#081729',
        logoUrl: 'https://landlinq.ai/logo.png',
        dashboardUrl: 'https://landlinq.ai/dashboard',
        analystName: 'Austin Blondell',
        contactPhone: '(704) 610-1549',
        websiteUrl: 'https://landlinq.ai'
      });
      
      if (template) {
        for (const email of teamEmails) {
          await sendNotificationEmail({
            to: email,
            subject: template.subject,
            html: template.html, // templateService always returns properly formatted HTML with logo/blue line/footer
            text: template.content,
            type: 'deal_alert',
            priority: 'high'
          });
        }
        
        console.log('📧 Team notification emails sent using outreach template');
      } else {
        console.error('❌ CRITICAL: Deal Under Review - In Progress template not configured in outreach management');
        console.error('❌ NO TEAM EMAILS SENT - Only outreach templates are allowed');
        console.error('❌ Configure Deal Under Review - In Progress template in outreach management tab');
        // NO FALLBACK - Only outreach templates should be sent
      }

    } catch (error) {
      console.error('❌ Error sending team notifications:', error);
      console.error('❌ NO TEAM EMAILS SENT - Only outreach templates are allowed');
    }
  }
}