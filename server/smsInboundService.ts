import { Request, Response } from 'express';
import { UnifiedDealPipeline } from './unifiedDealPipeline';

interface TwilioInboundSMS {
  From: string;
  To: string;
  Body: string;
  FromCity?: string;
  FromState?: string;
  FromCountry?: string;
  MessageSid: string;
}

interface ParsedSMSData {
  address?: string;
  price?: number;
  acres?: number;
  contactPhone?: string;
  description?: string;
  zoning?: string;
  contactName?: string;
  productType?: string;
  // CRITICAL FIX: Include city, state, and zipCode for complete address handling
  city?: string;
  state?: string;
  zipCode?: string;
}

export class SMSInboundService {
  
  /**
   * Webhook endpoint to receive SMS from Twilio - Optimized for instant response
   * Queues processing as background job to prevent Twilio timeouts and retries
   */
  static async handleInboundSMS(req: Request, res: Response) {
    const startTime = Date.now();
    try {
      console.log('📱 [SMS-WEBHOOK] Received inbound SMS webhook');
      
      // Parse SMS data from Twilio
      const smsData = SMSInboundService.parseTwilioSMS(req.body);
      
      if (!smsData || !smsData.Body) {
        console.log('❌ [SMS-WEBHOOK] Invalid SMS data received');
        return res.status(400).send('<?xml version="1.0" encoding="UTF-8"?><Response><Message>Invalid message format</Message></Response>');
      }

      // Mask phone number for security (show last 4 digits only)
      const maskedPhone = smsData.From ? `***-***-${smsData.From.slice(-4)}` : 'unknown';
      const messagePreview = smsData.Body.substring(0, 50) + (smsData.Body.length > 50 ? '...' : '');
      
      console.log(`📱 [SMS-WEBHOOK] Processing SMS from ${maskedPhone}`);
      console.log(`📱 [SMS-WEBHOOK] Message length: ${smsData.Body.length} chars, preview: "${messagePreview}"`);
      console.log(`📱 [SMS-WEBHOOK] Message SID: ${smsData.MessageSid}`);

      // ⚡ CRITICAL: Atomic deduplication using onConflictDoNothing
      // This prevents race conditions when concurrent Twilio retries arrive
      const { storage } = await import('./storage');
      const insertResult = await storage.markSMSProcessed({
        messageSid: smsData.MessageSid,
        from: smsData.From,
        bodyPreview: smsData.Body.substring(0, 100)
      });
      
      // If insertResult is null, this is a duplicate (insert was a no-op due to conflict)
      if (!insertResult) {
        console.log('\n' + '='.repeat(80));
        console.log('🚫 [SMS-DEDUP] DUPLICATE TWILIO WEBHOOK DETECTED - BLOCKING');
        console.log('='.repeat(80));
        console.log(`📱 MessageSid: ${smsData.MessageSid}`);
        console.log(`📞 From: ${maskedPhone}`);
        console.log(`📝 Message: "${messagePreview}"`);
        console.log(`⚡ Action: Atomic insert detected duplicate - returning empty TwiML to stop retries`);
        console.log('='.repeat(80));
        
        // Return empty TwiML response to stop Twilio from retrying
        return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      }
      
      console.log('✅ [SMS-DEDUP] MessageSid marked as processed (atomic insert succeeded) - preventing future duplicates');

      // =================================================================================
      // STEP 1: CHECK FOR ACTIVE CONVERSATIONS FIRST (conversation threading)
      // =================================================================================
      // CRITICAL: This must happen BEFORE property pattern matching
      // Replies like "NC 28786" don't match property patterns, so they'd be missed
      // if we check property patterns first
      console.log('\n' + '='.repeat(80));
      console.log('🔍 [CONVERSATION-CHECK] Checking for active conversations...');
      console.log('='.repeat(80));
      
      const { ResolutionService } = await import('./resolutionService');
      const conversationAnalysis = await ResolutionService.analyzeInboundMessage(
        smsData.Body,      // content
        undefined,         // fromEmail
        smsData.From,      // fromPhone
        'sms'              // channel
      );
      
      console.log(`📊 [CONVERSATION-CHECK] Analysis:`, {
        isResponse: conversationAnalysis.isResponse,
        originalDealId: conversationAnalysis.originalDealId,
        threadKey: conversationAnalysis.threadKey,
        confidence: conversationAnalysis.confidence
      });
      
      // If this is a reply to an existing conversation, handle it immediately and EXIT
      if (conversationAnalysis.isResponse && conversationAnalysis.originalDealId) {
        console.log(`✅ [CONVERSATION-REPLY] This is a reply to existing deal ${conversationAnalysis.originalDealId}`);
        console.log('📝 [CONVERSATION-REPLY] Processing reply to update existing deal...');
        
        // Get broker first (needed for processResponse)
        let broker = await storage.getBrokerByPhone(smsData.From);
        
        if (!broker) {
          console.error(`❌ [CONVERSATION-REPLY] Cannot find broker for phone ${maskedPhone}`);
          // Fall through to property parsing as fallback
        } else {
          // CRITICAL: Auto re-opt-in to SMS when broker texts us
          if (!broker.smsOptIn) {
            console.log(`📝 [SMS-OPT-IN] Re-enabling SMS notifications for broker ${broker.id} (they texted us)`);
            const updated = await storage.updateBroker(broker.id, { smsOptIn: true });
            if (updated) broker = updated;
          }
          
          // Process the conversation reply (updates deal, resolves communication, sends confirmation)
          const replyResult = await ResolutionService.processResponse(
            conversationAnalysis,
            {
              brokerId: broker.id,
              content: smsData.Body,
              channel: 'sms',
              providerMessageId: smsData.MessageSid
            }
          );
          
          if (replyResult.resolved) {
            console.log(`✅ [CONVERSATION-REPLY] Successfully processed reply - deal ${conversationAnalysis.originalDealId} updated`);
            console.log(`📊 [CONVERSATION-REPLY] Fields resolved: ${replyResult.fieldsResolved.join(', ')}`);
            console.log(`✓ [CONVERSATION-REPLY] Deal updated: ${replyResult.dealUpdated ? 'YES' : 'NO'}`);
            
            // Send success TwiML response and EXIT
            const processingTime = Date.now() - startTime;
            console.log(`✅ [SMS-WEBHOOK] Conversation reply processed in ${processingTime}ms`);
            return res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
          } else {
            console.error(`❌ [CONVERSATION-REPLY] Failed to process reply:`, replyResult.errors?.join(', '));
            // Fall through to property parsing as fallback
          }
        }
      } else {
        console.log('⏭️ [CONVERSATION-CHECK] No active conversation found - proceeding to property analysis');
      }
      
      // =================================================================================
      // STEP 1.5: FALLBACK - CHECK FOR INCOMPLETE DEALS (Dec 9, 2025)
      // =================================================================================
      // CRITICAL FIX: If ResolutionService didn't find active communications, check for
      // recent incomplete deals from this broker. This catches replies like "charlotte nc 28215"
      // that don't match property patterns but ARE responses to missing info requests.
      console.log('\n' + '='.repeat(80));
      console.log('🔍 [FALLBACK-CHECK] Checking for incomplete deals from this broker...');
      console.log('='.repeat(80));
      
      let incompleteDealUpdated = false;
      try {
        // Get or create broker
        let fallbackBroker = await storage.getBrokerByPhone(smsData.From);
        
        if (fallbackBroker) {
          console.log(`✅ [FALLBACK] Found broker: ${fallbackBroker.id}`);
          
          // Check if message contains city/state/zip patterns (potential reply to missing info)
          // More flexible patterns that search ANYWHERE in the message
          const statePattern = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/i;
          const zipPattern = /\b(\d{5})\b/;
          // City pattern: Look for word(s) before state abbreviation ANYWHERE in message
          const cityStatePattern = /([A-Za-z][A-Za-z\s]{1,30}?)\s*,?\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/i;
          
          const hasState = statePattern.test(smsData.Body);
          const hasZip = zipPattern.test(smsData.Body);
          const cityMatch = smsData.Body.match(cityStatePattern);
          const hasLocationInfo = hasState || hasZip;
          
          console.log(`📊 [FALLBACK] Message analysis: hasState=${hasState}, hasZip=${hasZip}, hasCity=${!!cityMatch}`);
          
          if (hasLocationInfo) {
            // Look for recent incomplete deals from this broker
            const recentDeals = await storage.getDealsByBrokerId(fallbackBroker.id);
            
            // Find the most recent deal that is missing ZIP or state (created in last 7 days)
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            
            // Filter for incomplete deals, sort by createdAt DESC (most recent first)
            // Handle null createdAt defensively by using updatedAt as fallback, then current time
            const getTimestamp = (d: typeof recentDeals[0]): number => {
              if (d.createdAt) return new Date(d.createdAt).getTime();
              if (d.updatedAt) return new Date(d.updatedAt).getTime();
              return Date.now(); // Treat deals without timestamps as very recent (don't exclude)
            };
            
            const incompleteDeals = recentDeals
              .filter(deal => {
                const dealTime = getTimestamp(deal);
                if (dealTime < sevenDaysAgo) return false;
                
                const missingZip = !deal.zip || deal.zip.trim() === '';
                const missingState = !deal.state || deal.state.trim() === '';
                return missingZip || missingState;
              })
              .sort((a, b) => {
                const aTime = getTimestamp(a);
                const bTime = getTimestamp(b);
                return bTime - aTime; // Most recent first
              });
            
            console.log(`📊 [FALLBACK] Found ${incompleteDeals.length} incomplete deals in last 7 days`);
            const incompleteDeal = incompleteDeals[0]; // Get the most recent incomplete deal
            
            if (incompleteDeal) {
              console.log(`🎯 [FALLBACK] Found incomplete deal #${incompleteDeal.dealNumber} (${incompleteDeal.id})`);
              console.log(`📝 [FALLBACK] Missing: ZIP=${!incompleteDeal.zip}, State=${!incompleteDeal.state}`);
              
              // Extract location data from the message
              const extractedState = smsData.Body.match(statePattern)?.[1]?.toUpperCase();
              const extractedZip = smsData.Body.match(zipPattern)?.[1];
              const extractedCity = cityMatch?.[1]?.trim();
              
              // Build update object
              const updateData: Record<string, string> = {};
              if (extractedZip && (!incompleteDeal.zip || incompleteDeal.zip.trim() === '')) {
                updateData.zip = extractedZip;
              }
              if (extractedState && (!incompleteDeal.state || incompleteDeal.state.trim() === '')) {
                updateData.state = extractedState;
              }
              if (extractedCity && (!incompleteDeal.city || incompleteDeal.city.trim() === '')) {
                updateData.city = extractedCity;
              }
              
              if (Object.keys(updateData).length > 0) {
                console.log(`📝 [FALLBACK] Updating deal with:`, updateData);
                await storage.updateDeal(incompleteDeal.id, updateData);
                console.log(`✅ [FALLBACK] Deal #${incompleteDeal.dealNumber} updated successfully!`);
                
                // Mark follow-up as resolved
                try {
                  const { FollowUpService } = await import('./followUpService');
                  await FollowUpService.markFollowUpResolved(incompleteDeal.id, 'sms');
                  console.log(`✅ [FALLBACK] Follow-up marked as resolved`);
                } catch (err) {
                  console.error(`⚠️ [FALLBACK] Failed to mark follow-up as resolved:`, err);
                }
                
                // Send confirmation SMS
                try {
                  const { sendSMS } = await import('./smsService');
                  const confirmMessage = `Thanks! Updated ${incompleteDeal.address} with ${Object.keys(updateData).join(', ')}. Continuing analysis! -Catalyst`;
                  await sendSMS({
                    to: smsData.From,
                    message: confirmMessage,
                    brokerOverride: fallbackBroker
                  });
                  console.log(`✅ [FALLBACK] Sent confirmation SMS`);
                } catch (smsErr) {
                  console.error(`⚠️ [FALLBACK] Failed to send confirmation SMS:`, smsErr);
                }
                
                incompleteDealUpdated = true;
                
                // Queue background job to re-run classification with new data
                console.log(`🔄 [FALLBACK] Queuing re-classification job for updated deal...`);
                const { db } = await import('./db');
                const { backgroundJobs } = await import('../shared/schema');
                await db.insert(backgroundJobs).values({
                  jobType: 'reclassify_deal',
                  payload: {
                    dealId: incompleteDeal.id,
                    reason: 'Missing info provided via SMS reply'
                  },
                  status: 'pending',
                  scheduledFor: new Date(),
                  attempts: 0,
                  maxAttempts: 3
                });
                console.log(`✅ [FALLBACK] Re-classification job queued`);
                
                // Return success - don't create a new deal!
                const processingTime = Date.now() - startTime;
                console.log(`✅ [SMS-WEBHOOK] Incomplete deal updated in ${processingTime}ms`);
                return res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
              } else {
                console.log(`⚠️ [FALLBACK] No new data to update (fields already filled)`);
              }
            } else {
              console.log(`⏭️ [FALLBACK] No incomplete deals found for this broker`);
            }
          } else {
            console.log(`⏭️ [FALLBACK] Message doesn't contain location info (city/state/zip)`);
          }
        } else {
          console.log(`⏭️ [FALLBACK] No broker found for phone ${maskedPhone}`);
        }
      } catch (fallbackError) {
        console.error(`❌ [FALLBACK] Error checking for incomplete deals:`, fallbackError);
        // Continue to property parsing
      }
      console.log('='.repeat(80));
      
      // =================================================================================
      // STEP 2: PROPERTY PATTERN MATCHING (only runs if not a conversation reply)
      // =================================================================================
      // CRITICAL FIX: Extract address and check for missing fields BEFORE sending "under review" message
      // New flow: (1) Send minimal "Received!" (2) Extract/validate (3) Send missing info OR queue job
      const messageText = smsData.Body.toLowerCase();
      
      // Test regex patterns individually for debugging
      // CRITICAL FIX: Support multi-word street names (e.g., "Bethel Church Road", "Martin Luther King Blvd")
      // Changed from \w+ (single word) to (?:[A-Za-z0-9.'-]+\s+)+ (multiple words)
      const hasAddress = /\d+\s+(?:[A-Za-z0-9.'-]+\s+)+(street|st|road|rd|lane|ln|drive|dr|ave|avenue|way|court|ct|circle|cir|boulevard|blvd|parkway|pkwy|highway|hwy|place|pl|cove)/i.test(smsData.Body);
      const hasPrice = /\$\d{1,3}(,?\d{3})*/.test(smsData.Body);
      const hasAcreage = /\d+(\.\d+)?\s*(acre|ac)/i.test(smsData.Body);
      const looksLikePropertySubmission = hasAddress || hasPrice || hasAcreage;
      
      console.log('\n' + '='.repeat(80));
      console.log('⚡ [INSTANT-SMS] PROPERTY DETECTION ANALYSIS');
      console.log('='.repeat(80));
      console.log(`📱 SMS From: ${maskedPhone}`);
      console.log(`📝 Message Preview: "${messagePreview}"`);
      console.log(`🏠 Has Address Pattern: ${hasAddress ? 'YES ✓' : 'NO ✗'}`);
      console.log(`💰 Has Price Pattern: ${hasPrice ? 'YES ✓' : 'NO ✗'}`);
      console.log(`📏 Has Acreage Pattern: ${hasAcreage ? 'YES ✓' : 'NO ✗'}`);
      console.log(`🎯 Looks Like Property Submission: ${looksLikePropertySubmission ? 'YES - EXTRACT & VALIDATE' : 'NO - SKIP TO CONVERSATION ENGINE'}`);
      console.log('='.repeat(80));
      
      // Note: Missing info requests are now handled by UnifiedDealPipeline AFTER deal creation
      // Background job is always queued for property submissions
      let shouldQueueBackgroundJob = true;
      let parsedData: ParsedSMSData | null = null;
      
      if (looksLikePropertySubmission) {
        console.log('⚡ [INSTANT-ACK] Sending minimal "Received!" acknowledgment...');
        try {
          const { sendSMS } = await import('./smsService');
          const { TemplateService } = await import('./templateService');
          
          // CRITICAL FIX: Create or activate conversation for property submissions
          // Bug: Property submissions were not creating conversations, so messaging dashboard was empty
          console.log('💬 [CONVERSATION] Creating/activating conversation for property submission...');
          let broker = await storage.getBrokerByPhone(smsData.From);
          
          if (!broker) {
            console.log('📝 [CONVERSATION] Creating broker profile for property submission');
            broker = await storage.createBroker({
              firstName: 'SMS',
              lastName: 'Contact',
              phone: smsData.From,
              email: null,
              smsConsent: true  // CRITICAL FIX: Implicit SMS opt-in when broker texts us
            });
          } else if (!broker.smsOptIn) {
            // CRITICAL FIX: Enable SMS opt-in for existing brokers who text us
            console.log(`📝 [SMS-OPT-IN] Enabling SMS notifications for existing broker ${broker.id}`);
            const updated = await storage.updateBroker(broker.id, { smsOptIn: true });
            if (updated) broker = updated;
          }
          
          let conversation = await storage.getConversationByBrokerId(broker.id);
          
          if (!conversation) {
            console.log('💬 [CONVERSATION] Creating new conversation for property submission');
            conversation = await storage.createConversation({
              brokerId: broker.id,
              status: 'active'
            });
          } else if (conversation.status !== 'active') {
            console.log('💬 [CONVERSATION] Activating existing conversation');
            const updated = await storage.updateConversation(conversation.id, { status: 'active' });
            if (updated) conversation = updated; // CRITICAL: Reload conversation to get fresh data
          }
          
          // Save property submission message to conversation
          await storage.createConversationMessage({
            conversationId: conversation.id,
            direction: 'inbound',
            body: smsData.Body,
            messageType: 'manual',
            twilioMessageSid: smsData.MessageSid,
            deliveryStatus: 'delivered'
          });
          
          console.log(`✅ [CONVERSATION] Property submission saved to conversation ${conversation.id}`);
          
          // Broadcast to WebSocket clients
          try {
            const indexModule = await import('./index');
            const app = (indexModule as any).app;
            if (app && app.broadcastNotification) {
              app.broadcastNotification({
                type: 'new_message',
                conversationId: conversation.id,
                message: { direction: 'inbound', body: smsData.Body }
              });
              console.log('📡 [CONVERSATION] Broadcasted property submission to WebSocket');
            }
          } catch (broadcastError) {
            console.error('⚠️ [CONVERSATION] Failed to broadcast:', broadcastError);
          }
          
          // STEP 2: Extract address components synchronously (with 10s timeout)
          // CRITICAL: Do this BEFORE sending confirmation so we can use the actual address
          console.log('🔍 [EXTRACT] Extracting address components synchronously...');
          const extractionTimeout = 10000; // 10 second max
          const extractionPromise = SMSInboundService.extractDealDataFromSMS(smsData);
          const timeoutPromise = new Promise<ParsedSMSData>((_, reject) => 
            setTimeout(() => reject(new Error('Extraction timeout')), extractionTimeout)
          );
          
          try {
            parsedData = await Promise.race([extractionPromise, timeoutPromise]);
            console.log('✅ [EXTRACT] Successfully extracted:', {
              address: parsedData.address,
              zip: parsedData.zipCode,
              state: parsedData.state
            });
          } catch (extractError) {
            console.error('⚠️ [EXTRACT] Extraction failed or timed out:', extractError);
            // Fall back to background processing
            parsedData = null;
          }
          
          // CRITICAL FIX (Nov 25, 2025): Use RAW SMS body when extraction fails/times out
          // The broker sent their address - always confirm with what they actually sent!
          let displayAddress = 'your property submission';
          if (parsedData?.address) {
            // Use parsed data if available
            const addressParts = [parsedData.address];
            if (parsedData.city && parsedData.city.trim()) addressParts.push(parsedData.city.trim());
            if (parsedData.state && parsedData.state.trim()) addressParts.push(parsedData.state.trim());
            if (parsedData.zipCode && parsedData.zipCode.trim()) addressParts.push(parsedData.zipCode.trim());
            // Join only non-empty parts to avoid "Hwy, , SC" when city is missing
            displayAddress = addressParts.filter(p => p).join(', ');
          } else if (smsData.Body && smsData.Body.trim()) {
            // FALLBACK: If extraction failed, use the raw SMS body (cleaned up)
            // This ensures we always confirm with the actual address the broker sent
            const rawBody = smsData.Body.trim();
            // Clean up: replace newlines with commas, collapse multiple spaces
            displayAddress = rawBody
              .replace(/\n+/g, ', ')  // Replace newlines with ", "
              .replace(/,\s*,/g, ',') // Remove double commas
              .replace(/\s+/g, ' ')   // Collapse multiple spaces
              .trim();
            console.log(`📧 [INSTANT-ACK] Using raw SMS body as fallback: "${displayAddress}"`);
          }
          console.log(`📧 [INSTANT-ACK] Sending confirmation for: ${displayAddress}`);
          
          const receiptTemplate = await TemplateService.getSMSTemplate('deal_submitted', {
            brokerName: 'there',
            address: displayAddress
          });
          
          const receiptMessage = receiptTemplate || `Received: ${displayAddress}!\n\nUnder review. Decision in 24hrs.\n\n-Catalyst`;
          
          const receiptResult = await sendSMS({
            to: smsData.From,
            message: receiptMessage,
            brokerOverride: broker  // Pass broker to prevent race condition
          });
          
          if (receiptResult.success && receiptResult.delivered) {
            console.log(`✅ [INSTANT-ACK] Confirmation sent (SID: ${receiptResult.sid})`);
          } else if (receiptResult.success && !receiptResult.delivered) {
            console.log(`⏭️ [INSTANT-ACK] Confirmation not delivered - ${receiptResult.reason || receiptResult.mode}`);
          } else {
            console.log(`❌ [INSTANT-ACK] Confirmation failed - ${receiptResult.error}`);
          }
          
          // STEP 3: Try to geocode to auto-fill missing ZIP code (if we have enough info)
          if (parsedData && parsedData.address && !parsedData.zipCode) {
            console.log('🔍 [GEOCODE] Attempting to auto-fill missing ZIP code via geocoding...');
            try {
              const { GeocodioService } = await import('./geocodioService');
              const geocodio = new GeocodioService();
              
              // Only geocode if we have a reasonable address (with city or state)
              const hasMinimumInfo = parsedData.address.includes(',') || parsedData.state;
              
              if (hasMinimumInfo) {
                // CRITICAL FIX: Build full address with user-provided city/state to prevent ambiguous geocoding
                // Bug fix: Previously geocoded only street address, causing wrong city matches
                const geocodeAddressParts = [parsedData.address];
                if (parsedData.city) geocodeAddressParts.push(parsedData.city);
                if (parsedData.state) geocodeAddressParts.push(parsedData.state);
                const fullSMSGeocodeAddress = geocodeAddressParts.join(', ');
                
                console.log(`📍 [SMS-GEOCODE-DEBUG] Full address for geocoding: "${fullSMSGeocodeAddress}"`);
                const geocodeResult = await geocodio.geocodeAddress(fullSMSGeocodeAddress);
                
                if (geocodeResult.success && geocodeResult.zipCode) {
                  // CRITICAL: If user provided state explicitly, validate geocoding matches it
                  if (parsedData.state && geocodeResult.state) {
                    const userState = parsedData.state.toUpperCase().trim();
                    const geocodedState = geocodeResult.state.toUpperCase().trim();
                    
                    if (userState !== geocodedState) {
                      console.log(`❌ [GEOCODE] State mismatch! User provided: ${userState}, Geocoding returned: ${geocodedState}`);
                      console.log(`⚠️ [GEOCODE] Rejecting geocoding result - user's state takes priority`);
                      console.log(`📧 [GEOCODE] Will request ZIP code from user instead`);
                      // Don't auto-fill ZIP - state mismatch means wrong location
                    } else {
                      console.log(`✅ [GEOCODE] State match confirmed (${userState}) - auto-filling ZIP: ${geocodeResult.zipCode}`);
                      parsedData.zipCode = geocodeResult.zipCode;
                      
                      // CRITICAL: Only update city/state/ZIP fields - keep original street address
                      // Do NOT overwrite parsedData.address with formattedAddress (contains city/state/ZIP)
                      
                      // Fill in city if missing
                      if (!parsedData.city && geocodeResult.city) {
                        console.log(`✅ [GEOCODE] Auto-filled city: ${geocodeResult.city}`);
                        parsedData.city = geocodeResult.city;
                      }
                    }
                  } else {
                    // CRITICAL FIX: Even if AI didn't extract state, validate against RAW SMS text
                    console.log(`⚠️ [GEOCODE] No user state in parsed data - checking RAW SMS text for validation...`);
                    
                    // Extract city/state from raw SMS text for validation
                    const rawCity = this.extractCityFromText(smsData.Body) || undefined;
                    const rawState = this.extractStateFromText(smsData.Body) || undefined;
                    
                    console.log(`🔍 [VALIDATION] Extracted from raw SMS: city="${rawCity}", state="${rawState}"`);
                    console.log(`🔍 [VALIDATION] Geocoding returned: city="${geocodeResult.city}", state="${geocodeResult.state}"`);
                    
                    // If we found state in raw text, VALIDATE it matches geocoding
                    if (rawState && geocodeResult.state) {
                      const rawStateNorm = rawState.toUpperCase().trim();
                      const geocodedStateNorm = geocodeResult.state.toUpperCase().trim();
                      
                      if (rawStateNorm !== geocodedStateNorm) {
                        console.log(`❌ [GEOCODE-REJECT] State mismatch! Raw SMS: ${rawStateNorm}, Geocoding: ${geocodedStateNorm}`);
                        console.log(`⚠️ [GEOCODE-REJECT] Rejecting geocoding result - raw text state takes priority`);
                        console.log(`📧 [GEOCODE-REJECT] Will request complete address info from user instead`);
                        // REJECT geocoding - state mismatch means wrong location
                        // Don't auto-fill anything - let missing info flow handle it
                      } else {
                        console.log(`✅ [GEOCODE] State match confirmed (${rawStateNorm}) - accepting geocoding result`);
                        // State matches - safe to use geocoding result
                        parsedData.zipCode = geocodeResult.zipCode;
                        parsedData.state = geocodeResult.state;
                        parsedData.city = geocodeResult.city || rawCity;
                        console.log(`✅ [GEOCODE] Auto-filled: ZIP=${geocodeResult.zipCode}, State=${geocodeResult.state}, City=${parsedData.city}`);
                      }
                    } else if (rawCity && geocodeResult.city) {
                      // No state in raw text, but we have city - validate city instead
                      const rawCityNorm = rawCity.toLowerCase().trim();
                      const geocodedCityNorm = geocodeResult.city.toLowerCase().trim();
                      
                      if (rawCityNorm !== geocodedCityNorm) {
                        console.log(`❌ [GEOCODE-REJECT] City mismatch! Raw SMS: ${rawCityNorm}, Geocoding: ${geocodedCityNorm}`);
                        console.log(`⚠️ [GEOCODE-REJECT] Rejecting geocoding result - city doesn't match`);
                        // Don't auto-fill - wrong location
                      } else {
                        console.log(`✅ [GEOCODE] City match confirmed - accepting geocoding result`);
                        parsedData.zipCode = geocodeResult.zipCode;
                        parsedData.state = geocodeResult.state;
                        parsedData.city = geocodeResult.city;
                      }
                    } else {
                      // No city or state in raw text - too risky to auto-fill
                      console.log(`⚠️ [GEOCODE] Cannot validate geocoding - no city/state in raw SMS text`);
                      console.log(`⚠️ [GEOCODE] Skipping auto-fill to prevent wrong location`);
                    }
                  }
                } else {
                  console.log('⚠️ [GEOCODE] Could not auto-fill ZIP code via geocoding');
                }
              } else {
                console.log('⚠️ [GEOCODE] Insufficient address info for geocoding');
              }
            } catch (geocodeError) {
              console.error('❌ [GEOCODE] Error during geocoding:', geocodeError);
              // Continue anyway - missing info check will catch it
            }
          }
          
          // STEP 4: Log missing fields for debugging (but DON'T send missing info request yet)
          // CRITICAL FIX (Nov 21, 2025): Defer missing info request until AFTER confirmation SMS
          // Architect feedback: Confirmation must be sent BEFORE missing info request to avoid confusion
          if (parsedData) {
            const { FollowUpService } = await import('./followUpService');
            
            // Create temporary deal object for validation
            const tempDeal = {
              address: parsedData.address || '',
              zip: parsedData.zipCode || '',
              state: parsedData.state || ''
            } as any;
            
            const missingFieldsAnalysis = FollowUpService.analyzeMissingFields(tempDeal);
            
            console.log(`📊 [VALIDATION] Missing fields analysis (after auto-fill attempt):`, {
              hasMissingFields: missingFieldsAnalysis.hasMissingFields,
              missingFields: missingFieldsAnalysis.missingFields,
              zip: tempDeal.zip,
              state: tempDeal.state
            });
            
            // NOTE: We're NOT sending missing info SMS here anymore
            // The UnifiedDealPipeline will handle missing info requests AFTER sending confirmation
            // This ensures correct message order: Receipt → Confirmation → Missing Info (if needed)
            if (missingFieldsAnalysis.hasMissingFields) {
              console.log(`📝 [DEFERRED] Missing info detected: ${missingFieldsAnalysis.missingFields.join(', ')}`);
              console.log(`📝 [DEFERRED] Will be handled by UnifiedDealPipeline AFTER confirmation is sent`);
            } else {
              console.log('✅ [COMPLETE] All vital info present - will queue for full processing');
            }
          }
          
        } catch (error) {
          console.error('❌ [INSTANT-ACK] Error in instant processing:', error);
          // Fall back to background processing on any error
        }
      } else {
        console.log('💬 [CONVERSATION] Not a property submission - routing to messaging dashboard');
        
        // Route to messaging dashboard for direct broker conversations
        try {
          // Find or create broker
          let broker = await storage.getBrokerByPhone(smsData.From);
          
          if (!broker) {
            // Create broker profile for unknown numbers
            console.log('📝 [CONVERSATION] Creating broker profile for new number');
            broker = await storage.createBroker({
              firstName: 'SMS',
              lastName: 'Contact',
              phone: smsData.From,
              email: null,
              smsConsent: true  // CRITICAL FIX: Implicit SMS opt-in when broker texts us
            });
          } else if (!broker.smsOptIn) {
            // CRITICAL FIX: Enable SMS opt-in for existing brokers who text us
            console.log(`📝 [SMS-OPT-IN] Enabling SMS notifications for existing broker ${broker.id}`);
            const updated = await storage.updateBroker(broker.id, { smsOptIn: true });
            if (updated) broker = updated;
          }
          
          // Find or create conversation
          let conversation = await storage.getConversationByBrokerId(broker.id);
          
          if (!conversation) {
            console.log('💬 [CONVERSATION] Creating new conversation thread');
            conversation = await storage.createConversation({
              brokerId: broker.id,
              status: 'active'
            });
          } else if (conversation.status !== 'active') {
            // CRITICAL FIX: Activate archived conversations when new inbound SMS arrives
            console.log(`💬 [CONVERSATION] Reactivating archived conversation ${conversation.id}`);
            const updated = await storage.updateConversation(conversation.id, { status: 'active' });
            if (updated) conversation = updated;
          }
          
          // Save inbound message to conversation
          const newMessage = await storage.createConversationMessage({
            conversationId: conversation.id,
            direction: 'inbound',
            body: smsData.Body,
            messageType: 'manual',
            twilioMessageSid: smsData.MessageSid,
            deliveryStatus: 'delivered'
          });
          
          console.log(`✅ [CONVERSATION] Message saved to conversation ${conversation.id}`);
          
          // Broadcast new message to WebSocket clients for real-time updates
          try {
            const indexModule = await import('./index');
            const app = (indexModule as any).app;
            if (app && app.broadcastNotification) {
              app.broadcastNotification({
                type: 'new_message',
                conversationId: conversation.id,
                message: newMessage
              });
              console.log('📡 [CONVERSATION] Broadcasted message to WebSocket clients');
            }
          } catch (broadcastError) {
            console.error('⚠️ [CONVERSATION] Failed to broadcast message:', broadcastError);
            // Don't fail the SMS processing if broadcast fails
          }
          
          // Don't queue background job for conversation messages
          shouldQueueBackgroundJob = false;
        } catch (conversationError) {
          console.error('❌ [CONVERSATION] Failed to save conversation message:', conversationError);
          // Still don't queue background job
          shouldQueueBackgroundJob = false;
        }
      }

      // STEP 6: Only queue background job if we didn't send missing info request
      if (shouldQueueBackgroundJob) {
        console.log('🔄 [BACKGROUND] Queuing background job for full processing...');
        const { db } = await import('./db');
        const { backgroundJobs } = await import('../shared/schema');
        
        // CRITICAL FIX: Include parsedData in payload to preserve extracted city/state
        // This ensures the background job has access to the AI-extracted address components
        console.log('📊 [BACKGROUND] Including parsed data in job payload:', {
          address: parsedData?.address,
          city: parsedData?.city,
          state: parsedData?.state,
          zipCode: parsedData?.zipCode
        });
        
        await db.insert(backgroundJobs).values({
          jobType: 'process_sms',
          payload: {
            from: smsData.From,
            message: smsData.Body,
            metadata: smsData,
            // CRITICAL: Only include parsedData if it has actual data
            // If parsing failed/timed out, use null so background job re-parses
            parsedData: (parsedData && Object.keys(parsedData).length > 0) ? parsedData : null,
            skipConfirmation: true  // Skip deal_submitted template - instant receipt already sent above
          },
          status: 'pending',
          scheduledFor: new Date(),
          attempts: 0,
          maxAttempts: 3
        });
        console.log('✅ [BACKGROUND] Background job queued with parsed city/state - will run HelloData and send classification result');
      } else {
        console.log('⏸️ [STOPPED] Missing info request sent - waiting for broker reply (no background job)');
      }
      
      console.log('\n' + '='.repeat(80));
      console.log('🔄 [SMS-WEBHOOK] SUMMARY');
      console.log('='.repeat(80));
      console.log(`📱 SMS From: ${maskedPhone}`);
      console.log(`📝 Message SID: ${smsData.MessageSid}`);
      console.log(`📊 Background Job Queued: ${shouldQueueBackgroundJob ? 'YES' : 'NO'}`);
      console.log(`🎯 Next Step: ${shouldQueueBackgroundJob ? 'Background processor → UnifiedDealPipeline (handles missing info if needed)' : 'Message routed to conversation dashboard'}`);
      console.log('='.repeat(80));
      
      // Send immediate acknowledgment TwiML response (no actual message content)
      // Background job will send the actual SMS response via Twilio API
      const twilioResponse = `
<?xml version="1.0" encoding="UTF-8"?>
<Response>
</Response>
      `.trim();
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ [SMS-WEBHOOK] SMS acknowledged in ${processingTime}ms (processing in background)`);
      
      res.type('text/xml').send(twilioResponse);

    } catch (error) {
      console.error('❌ Error processing inbound SMS, sending emergency confirmation - all texts must work:', error);
      
      // Use ONLY outreach templates - NO hardcoded fallbacks allowed
      const { TemplateService } = await import('./templateService');
      let emergencyMessage = '';
      
      try {
        // Use deal_submitted template for emergency fallback
        let template = await TemplateService.getSMSTemplate('deal_submitted', {
          brokerName: 'there',
          address: 'your property'
        });
        
        if (template) {
          emergencyMessage = template;
        } else {
          console.error('❌ No SMS templates configured in outreach management - cannot send SMS');
          // Return success to avoid SMS delivery failures, but don't send any message
          return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
        }
      } catch (templateError) {
        console.error('❌ Failed to load SMS template - cannot send SMS:', templateError);
        // Return success to avoid SMS delivery failures, but don't send any message
        return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      }
      
      // BULLETPROOF: Always acknowledge SMS even when processing fails completely
      const emergencyResponse = `
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>
${emergencyMessage}
  </Message>
</Response>
      `.trim();
      
      // Always return success to ensure broker gets confirmation
      res.status(200).type('text/xml').send(emergencyResponse);
    }
  }

  /**
   * Parse incoming SMS from Twilio webhook format
   */
  private static parseTwilioSMS(body: any): TwilioInboundSMS | null {
    // 🚀 DEPLOYMENT MARKER: BUILD-10 deployed 2025-11-14 14:10 UTC
    console.log(`\n🚀🚀🚀 [DEPLOYMENT-VERIFICATION] SMS Parser BUILD-10 is LIVE (2025-11-14 14:10 UTC) 🚀🚀🚀\n`);
    try {
      return {
        From: body.From,
        To: body.To,
        Body: body.Body || '',
        FromCity: body.FromCity,
        FromState: body.FromState,
        FromCountry: body.FromCountry,
        MessageSid: body.MessageSid
      };
    } catch (error) {
      console.error('❌ Error parsing Twilio SMS:', error);
      return null;
    }
  }

  /**
   * Extract deal information from SMS text using AI
   */
  static async extractDealDataFromSMS(smsData: TwilioInboundSMS): Promise<ParsedSMSData> {
    const text = smsData.Body;
    const dealData: ParsedSMSData = {};

    try {
      // Extract phone number (use sender)
      dealData.contactPhone = smsData.From;
      
      // ROBUST SMS ADDRESS PARSER: Hybrid approach with geocode confirmation
      // (1) Canonicalize input, (2) Strict parse, (3) Geocode validation, (4) Fallback to AI
      console.log('\n🔍 [HYBRID-PARSER] Attempting deterministic address parsing...');
      const { parseOrFallback } = await import('./smsAddressParser.js');
      const parsedAddress = await parseOrFallback(text);
      
      console.log(`📊 [HYBRID-PARSER] Parse result:`, {
        parseMethod: parsedAddress?.parseMethod,
        validationStatus: parsedAddress?.validationStatus,
        fallbackReason: parsedAddress?.fallbackReason,
        street: parsedAddress?.street,
        city: parsedAddress?.city,
        state: parsedAddress?.state
      });
      
      // BUG FIX: Use deterministic parsing results if street/city/state are present,
      // regardless of geocode validation status (geocode may fail due to service issues)
      if (parsedAddress && parsedAddress.street && parsedAddress.city && parsedAddress.state) {
        const { sanitizeAddress } = await import('./inputSanitizer.js');
        
        dealData.address = sanitizeAddress(parsedAddress.street);
        dealData.city = parsedAddress.city;
        dealData.state = parsedAddress.state;
        dealData.zipCode = parsedAddress.zip;
        
        const statusLabel = parsedAddress.validationStatus === 'geocode_confirmed' ? 'geocode-validated' : 'geocode-unavailable';
        console.log(`✅ [BUG-FIX] Deterministic parse succeeded (${statusLabel}) - using parsed data, skipping AI`);
        console.log(`   Final data: street="${dealData.address}", city="${dealData.city}", state="${dealData.state}", zip="${dealData.zipCode}"`);
        return dealData;
      }
      
      // Log fallback reason for monitoring
      console.log(`⚠️ [HYBRID-PARSER] Falling back to AI parsing`);
      if (parsedAddress && parsedAddress.fallbackReason) {
        console.log(`   Reason: ${parsedAddress.fallbackReason}`);
      }
      
      // CRITICAL FIX (Bug 1): Preserve deterministic city/state for fallback merge
      // If deterministic parser found city/state, keep them even if geocode failed
      const deterministicCity = parsedAddress?.city;
      const deterministicState = parsedAddress?.state;
      const deterministicZip = parsedAddress?.zip;
      console.log(`💾 [PRESERVE] Saving deterministic parse results for fallback:`, {
        city: deterministicCity,
        state: deterministicState,
        zip: deterministicZip
      });
      
      // Use AI to extract property details from SMS
      console.log('🤖 Using AI to parse SMS property data...');
      console.log(`📱 [SMS-INPUT] Raw SMS text: "${text}"`);
      const { parsePropertyDataWithFallback } = await import('./aiEmailParser.js');
      const aiParsed = await parsePropertyDataWithFallback(text);
      
      // DEBUG: Track address transformation
      console.log(`\n🔍 [AI-RESULT] RAW AI RESPONSE:`);
      console.log(`   address field: "${aiParsed.address}"`);
      console.log(`   city field: "${aiParsed.city}"`);
      console.log(`   state field: "${aiParsed.state}"`);
      console.log(`   zip field: "${aiParsed.zip}"`);
      console.log(`🔍 [AI-PARSED-FULL] Complete AI result:`, JSON.stringify(aiParsed, null, 2));
      
      // CRITICAL DEBUG: Log the exact types and truthiness before emergency fix check
      console.log(`\n🔍 [EMERGENCY-FIX-DEBUG] Checking emergency fix conditions:`);
      console.log(`   aiParsed.address exists: ${!!aiParsed.address}`);
      console.log(`   aiParsed.city type: ${typeof aiParsed.city}, value: "${aiParsed.city}", truthy: ${!!aiParsed.city}`);
      console.log(`   aiParsed.state type: ${typeof aiParsed.state}, value: "${aiParsed.state}", truthy: ${!!aiParsed.state}`);
      console.log(`   Condition (!city && !state): ${!aiParsed.city && !aiParsed.state}`);
      
      // CRITICAL VALIDATION: Detect if AI concatenated address with city/state
      // ONLY trigger if city/state are missing AND address has EXACTLY 2 commas (guards against false positives)
      // BUG FIX: Check for EMPTY STRINGS too (AI sometimes returns "" instead of null/undefined)
      const cityMissing = !aiParsed.city || aiParsed.city.trim() === '';
      const stateMissing = !aiParsed.state || aiParsed.state.trim() === '';
      
      if (aiParsed.address && cityMissing && stateMissing) {
        const commaCount = (aiParsed.address.match(/,/g) || []).length;
        
        // Only handle simple case: "street, city, state" (exactly 2 commas)
        if (commaCount === 2) {
          console.error(`🚨 [AI-BUG-DETECTED] AI concatenated address: "${aiParsed.address}"`);
          console.error(`   City and state are null but found exactly 2 commas - attempting emergency split`);
          
          // Valid US state codes for validation
          const VALID_US_STATES = new Set([
            'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
            'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
            'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
            'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
            'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
          ]);
          
          // Split into exactly 3 parts: street, city, state (maybe with ZIP)
          const parts = aiParsed.address.split(',').map(p => p.trim());
          
          if (parts.length === 3) {
            const streetPart = parts[0];
            const cityPart = parts[1];
            const stateZipPart = parts[2];
            
            // Validate state in rightmost part
            const tokens = stateZipPart.split(/\s+/);
            const potentialState = tokens[0].toUpperCase();
            
            if (VALID_US_STATES.has(potentialState)) {
              // Valid state found - apply the fix
              aiParsed.address = streetPart;
              aiParsed.city = cityPart;
              aiParsed.state = potentialState;
              
              // Check for ZIP in remaining tokens
              if (tokens.length > 1 && /^\d{5}(-\d{4})?$/.test(tokens[1])) {
                aiParsed.zip = tokens[1];
              }
              
              console.log(`✅ [EMERGENCY-FIX] Split into: street="${aiParsed.address}", city="${aiParsed.city}", state="${aiParsed.state}"`);
            } else {
              console.warn(`   Invalid state code "${potentialState}" in rightmost part - skipping emergency fix`);
            }
          }
        } else if (commaCount > 0) {
          console.warn(`   Found ${commaCount} commas but city/state are null - might be suite/unit address or complex format. Skipping emergency fix to avoid corruption.`);
        }
      }
      
      // Map AI-parsed data to SMS deal data format
      // CRITICAL: Store ONLY street address in dealData.address
      // City, state, ZIP go in separate fields for formatFullAddress() to combine them
      const { sanitizeAddress } = await import('./inputSanitizer.js');
      const sanitized = aiParsed.address ? sanitizeAddress(aiParsed.address) : undefined;
      console.log(`🔍 [ADDRESS-DEBUG-2] After sanitizeAddress:`, sanitized);
      dealData.address = sanitized;
      dealData.price = aiParsed.askingPrice || undefined;
      dealData.acres = aiParsed.sizeAcres || undefined;
      
      // CRITICAL FIX (Bug 1): Prioritize deterministic city/state/ZIP over AI values
      // Architect identified: AI can provide incorrect values, deterministic parser is more reliable
      // Solution: Use deterministic values if present, only use AI values to fill gaps
      console.log(`\n🔧 [BUG1-FIX] Merging deterministic city/state with AI results:`);
      console.log(`   Deterministic city: "${deterministicCity}", AI city: "${aiParsed.city}"`);
      console.log(`   Deterministic state: "${deterministicState}", AI state: "${aiParsed.state}"`);
      console.log(`   Deterministic ZIP: "${deterministicZip}", AI ZIP: "${aiParsed.zip}"`);
      
      // PRIORITY: Deterministic values over AI values (deterministic parser is more accurate)
      const finalCity = (deterministicCity && deterministicCity.trim() !== '') ? deterministicCity : aiParsed.city;
      const finalState = (deterministicState && deterministicState.trim() !== '') ? deterministicState : aiParsed.state;
      const finalZip = (deterministicZip && deterministicZip.trim() !== '') ? deterministicZip : aiParsed.zip;
      
      console.log(`✅ [BUG1-FIX] Final merged values:`, {
        city: finalCity,
        state: finalState,
        zip: finalZip
      });
      
      // CRITICAL FIX: Extract city, state, and ZIP to SEPARATE fields for pipeline
      // These fields are needed for the unified pipeline to build complete addresses in database
      dealData.city = finalCity || undefined;
      dealData.state = finalState || undefined;
      dealData.zipCode = finalZip || undefined;
      
      console.log(`📍 [MUTATION-TRACE-1-RESULT] dealData after AI assignment:`, {
        city: dealData.city,
        state: dealData.state,
        zipCode: dealData.zipCode
      });
      
      // FALLBACK: If AI didn't extract city, try to extract it from the original SMS text
      // This is CRITICAL - without this, geocoding will fill in wrong city!
      console.log(`\n📍 [MUTATION-TRACE-2] Entering fallback extraction phase:`);
      console.log(`   dealData.city before fallback: "${dealData.city}"`);
      console.log(`   dealData.state before fallback: "${dealData.state}"`);
      console.log(`   dealData.zipCode before fallback: "${dealData.zipCode}"`);
      
      if (!dealData.city && smsData.Body) {
        const extractedCity = this.extractCityFromText(smsData.Body);
        if (extractedCity) {
          console.log(`📍 [MUTATION-TRACE-2] Fallback extracted city: "${extractedCity}"`);
          dealData.city = extractedCity;
          console.log(`📱 [FALLBACK] Extracted city: ${extractedCity} from SMS text`);
        }
      }
      
      // FALLBACK: If AI didn't extract state, try to extract it from the original SMS text
      if (!dealData.state && smsData.Body) {
        const extractedState = this.extractStateFromText(smsData.Body);
        if (extractedState) {
          console.log(`📍 [MUTATION-TRACE-2] Fallback extracted state: "${extractedState}"`);
          dealData.state = extractedState;
          console.log(`📱 [FALLBACK] Extracted state code: ${extractedState} from SMS text`);
        }
      }
      
      // FALLBACK: If AI didn't extract ZIP, try to extract it from the original SMS text
      if (!dealData.zipCode && smsData.Body) {
        const extractedZip = this.extractZipCodeFromText(smsData.Body);
        if (extractedZip) {
          console.log(`📍 [MUTATION-TRACE-2] Fallback extracted ZIP: "${extractedZip}"`);
          dealData.zipCode = extractedZip;
          console.log(`📱 [FALLBACK] Extracted ZIP code: ${extractedZip} from SMS text`);
        }
      }
      
      console.log(`📍 [MUTATION-TRACE-2-RESULT] dealData after fallback extraction:`, {
        city: dealData.city,
        state: dealData.state,
        zipCode: dealData.zipCode
      });
      
      dealData.productType = aiParsed.productType || undefined;
      dealData.zoning = aiParsed.zoning || undefined;
      dealData.description = aiParsed.brokerNotes || text.substring(0, 500);
      
      // Mask phone number for security logging
      const maskedPhone = dealData.contactPhone ? `***-***-${dealData.contactPhone.slice(-4)}` : 'none';
      
      console.log('\n📍 [MUTATION-TRACE-FINAL] Returning dealData from extractDealDataFromSMS:');
      console.log('✅ AI-extracted SMS deal data:', {
        address: dealData.address,
        city: dealData.city,
        state: dealData.state,
        zipCode: dealData.zipCode,
        price: dealData.price,
        acres: dealData.acres,
        contactPhone: maskedPhone,
        productType: dealData.productType
      });
      
      console.log(`📍 [MUTATION-TRACE-FINAL] CRITICAL CHECK - Are city/state populated?`);
      console.log(`   city: ${dealData.city ? `"${dealData.city}" ✅` : 'EMPTY/NULL ❌'}`);
      console.log(`   state: ${dealData.state ? `"${dealData.state}" ✅` : 'EMPTY/NULL ❌'}`);

      return dealData;

    } catch (error) {
      console.error('❌ Error extracting SMS deal data:', error);
      return dealData;
    }
  }

  /**
   * Extract city from text (address)
   * CRITICAL: Prevents geocoding from overwriting user-provided city with wrong location
   */
  private static extractCityFromText(text: string): string | null {
    if (!text) return null;
    
    // Valid US state codes for validation
    const VALID_US_STATES = new Set([
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
      'DC', 'PR', 'VI', 'GU', 'AS', 'MP'
    ]);
    
    // Pattern: Extract city between last comma and state code
    // Examples:
    // "423 N. MARTIN LUTHER KING JR A, SALISBURY, NC" → "SALISBURY"
    // "123 Main St, Charlotte, NC 28202" → "Charlotte"
    // "456 Oak Ave, Raleigh, NC" → "Raleigh"
    const cityPattern = /,\s*([^,]+),\s*([A-Z]{2})(?:\s+\d{5})?/i;
    const match = text.match(cityPattern);
    
    if (match) {
      const potentialCity = match[1].trim();
      const potentialState = match[2].toUpperCase();
      
      // Validate that the state code is valid
      if (VALID_US_STATES.has(potentialState)) {
        // Clean up city name (capitalize first letter of each word)
        const cleanCity = potentialCity
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        
        return cleanCity;
      }
    }
    
    return null;
  }

  /**
   * Extract state code from text (address)
   */
  private static extractStateFromText(text: string): string | null {
    if (!text) return null;
    
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
      /,\s*([A-Z]{2})(?:\s+\d{5})?(?:\s*$|,)/i,  // After comma with optional ZIP
      /\b([A-Z]{2})\s+\d{5}/i,                    // Before ZIP code
      /,\s*([A-Z]{2})\s*$/i                       // At end after comma
    ];
    
    for (const pattern of statePatterns) {
      const match = text.match(pattern);
      if (match && VALID_US_STATES.has(match[1].toUpperCase())) {
        return match[1].toUpperCase();
      }
    }
    
    return null;
  }

  /**
   * Extract ZIP code from text (address)
   */
  private static extractZipCodeFromText(text: string): string | null {
    if (!text) return null;
    
    // Match 5-digit ZIP code or ZIP+4 format at end of address or after state abbreviation
    const zipPatterns = [
      /\b[A-Z]{2}\s+(\d{5})(?:-\d{4})?\b/i,  // After state abbreviation (case-insensitive)
      /\b(\d{5})(?:-\d{4})?\s*$/             // At end of address
    ];
    
    for (const pattern of zipPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1]; // Return just the 5-digit ZIP
      }
    }
    
    return null;
  }
}