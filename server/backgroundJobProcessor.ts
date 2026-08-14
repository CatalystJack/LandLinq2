/**
 * Background Job Processor
 * Processes queued jobs asynchronously to prevent webhook timeouts
 * 
 * SAFEGUARDS (Dec 9, 2025):
 * 1. Startup Recovery - Recovers stuck jobs from previous server crashes
 * 2. Processing Recovery - Resets jobs stuck in "processing" state
 * 3. Stuck Job Monitor - Sends alerts if jobs are pending too long (5+ minutes)
 * 4. Heartbeat Logging - Logs every 60 seconds to confirm processor is running
 */

import { db } from './db';
import { backgroundJobs, type BackgroundJob } from '../shared/schema';
import { eq, and, lte, sql, or, gt } from 'drizzle-orm';
import { storage } from './storage';

class BackgroundJobProcessor {
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private monitorInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat: Date = new Date();

  /**
   * Start the background job processor
   * Polls for pending jobs and processes them
   */
  async start() {
    if (this.processingInterval) {
      console.log('⚠️ [JOB-PROCESSOR] Already running');
      return;
    }

    console.log('🚀 [JOB-PROCESSOR] Starting background job processor with enhanced safeguards...');
    
    // SAFEGUARD 1: Recover any stuck jobs from previous server crashes
    await this.recoverStuckJobs();
    
    // SAFEGUARD 2: Process any pending jobs immediately on startup
    await this.processStartupRecovery();
    
    // Process jobs every 2 seconds
    this.processingInterval = setInterval(async () => {
      await this.processNextJob();
    }, 2000);

    // SAFEGUARD 3: Monitor for stuck jobs every 5 minutes
    this.monitorInterval = setInterval(async () => {
      await this.monitorStuckJobs();
    }, 5 * 60 * 1000); // 5 minutes

    // SAFEGUARD 4: Heartbeat logging every 60 seconds
    this.heartbeatInterval = setInterval(() => {
      this.lastHeartbeat = new Date();
      console.log(`💓 [JOB-PROCESSOR] Heartbeat - Processor running at ${this.lastHeartbeat.toISOString()}`);
    }, 60 * 1000); // 60 seconds

    // Process one immediately on start
    this.processNextJob();
    
    console.log('✅ [JOB-PROCESSOR] All safeguards active - processor fully operational');
  }

  /**
   * Recover jobs that were stuck in "processing" state when server crashed
   * These jobs never completed because the server died mid-processing
   */
  private async recoverStuckJobs(): Promise<void> {
    try {
      console.log('🔧 [JOB-PROCESSOR] Checking for stuck jobs from previous server crash...');
      
      // Find jobs stuck in "processing" state (server crashed while processing)
      const stuckJobs = await db
        .select()
        .from(backgroundJobs)
        .where(eq(backgroundJobs.status, 'processing'));
      
      if (stuckJobs.length === 0) {
        console.log('✅ [JOB-PROCESSOR] No stuck jobs found - clean startup');
        return;
      }

      console.log(`⚠️ [JOB-PROCESSOR] Found ${stuckJobs.length} stuck jobs from previous crash - recovering...`);
      
      // Reset stuck jobs to pending so they get reprocessed
      for (const job of stuckJobs) {
        await db
          .update(backgroundJobs)
          .set({
            status: 'pending',
            scheduledFor: new Date(), // Process immediately
            error: 'Recovered from server crash - will retry',
            updatedAt: new Date()
          })
          .where(eq(backgroundJobs.id, job.id));
        
        console.log(`🔄 [JOB-PROCESSOR] Recovered stuck job ${job.id} (${job.jobType})`);
      }
      
      console.log(`✅ [JOB-PROCESSOR] Recovered ${stuckJobs.length} stuck jobs`);
    } catch (error) {
      console.error('❌ [JOB-PROCESSOR] Error recovering stuck jobs:', error);
    }
  }

  /**
   * Process any pending jobs immediately on startup
   * Ensures jobs created while server was down get processed
   */
  private async processStartupRecovery(): Promise<void> {
    try {
      console.log('🔍 [JOB-PROCESSOR] Checking for pending jobs from downtime...');
      
      // Count pending jobs
      const pendingJobs = await db
        .select()
        .from(backgroundJobs)
        .where(eq(backgroundJobs.status, 'pending'));
      
      if (pendingJobs.length === 0) {
        console.log('✅ [JOB-PROCESSOR] No pending jobs - nothing to recover');
        return;
      }

      console.log(`📋 [JOB-PROCESSOR] Found ${pendingJobs.length} pending jobs - processing all immediately...`);
      
      // Process each pending job now (don't wait for interval)
      for (let i = 0; i < Math.min(pendingJobs.length, 10); i++) {
        // Process up to 10 jobs synchronously on startup
        await this.processNextJob();
      }
      
      console.log(`✅ [JOB-PROCESSOR] Startup recovery complete`);
    } catch (error) {
      console.error('❌ [JOB-PROCESSOR] Error in startup recovery:', error);
    }
  }

  /**
   * Monitor for jobs that have been pending too long (stuck)
   * Sends admin notification if jobs are stuck for more than 5 minutes
   */
  private async monitorStuckJobs(): Promise<void> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      // Find jobs that have been pending for more than 5 minutes
      const stuckJobs = await db
        .select()
        .from(backgroundJobs)
        .where(
          and(
            or(
              eq(backgroundJobs.status, 'pending'),
              eq(backgroundJobs.status, 'processing')
            ),
            lte(backgroundJobs.createdAt, fiveMinutesAgo)
          )
        );
      
      if (stuckJobs.length === 0) {
        return; // All good
      }

      console.warn(`⚠️ [JOB-PROCESSOR] WARNING: ${stuckJobs.length} jobs stuck for 5+ minutes!`);
      
      for (const job of stuckJobs) {
        const stuckMinutes = Math.round((Date.now() - new Date(job.createdAt || new Date()).getTime()) / 60000);
        console.warn(`⚠️ [JOB-PROCESSOR] Stuck job: ${job.id} (${job.jobType}) - pending for ${stuckMinutes} minutes`);
        
        // If job has been processing for more than 10 minutes, it's definitely stuck
        if (job.status === 'processing' && stuckMinutes > 10) {
          console.error(`🚨 [JOB-PROCESSOR] CRITICAL: Job ${job.id} stuck in processing for ${stuckMinutes}min - resetting to pending`);
          
          await db
            .update(backgroundJobs)
            .set({
              status: 'pending',
              scheduledFor: new Date(),
              error: `Auto-reset: Was stuck in processing for ${stuckMinutes} minutes`,
              updatedAt: new Date()
            })
            .where(eq(backgroundJobs.id, job.id));
        }
      }
      
      // Send admin notification about stuck jobs
      await this.notifyAdminOfStuckJobs(stuckJobs);
      
    } catch (error) {
      console.error('❌ [JOB-PROCESSOR] Error monitoring stuck jobs:', error);
    }
  }

  /**
   * Send admin notification about stuck jobs
   */
  private async notifyAdminOfStuckJobs(stuckJobs: BackgroundJob[]): Promise<void> {
    try {
      const { sendNotificationEmail } = await import('./emailService');
      
      const jobDetails = stuckJobs.map(job => {
        const payload = job.payload as any;
        const stuckMinutes = Math.round((Date.now() - new Date(job.createdAt || new Date()).getTime()) / 60000);
        return `- Job ${job.id} (${job.jobType}): ${payload?.contactEmail || 'unknown'} - stuck for ${stuckMinutes}min`;
      }).join('\n');

      await sendNotificationEmail({
        to: 'jake@catalyst-cp.com',
        subject: `🚨 LandLinq Alert: ${stuckJobs.length} Background Jobs Stuck`,
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2 style="color: #dc2626;">⚠️ Stuck Jobs Detected</h2>
            <p>The following jobs have been pending for more than 5 minutes:</p>
            <pre style="background: #f1f5f9; padding: 15px; border-radius: 8px;">${jobDetails}</pre>
            <p>The system is attempting to auto-recover. If emails are not processing, please check the server logs.</p>
            <p style="color: #64748b; font-size: 14px;">- LandLinq Monitoring System</p>
          </div>
        `,
        text: `Stuck Jobs Detected:\n${jobDetails}`,
        type: 'system_alert',
        priority: 'high'
      } as any);
      
      console.log('📧 [JOB-PROCESSOR] Admin notified of stuck jobs');
    } catch (error) {
      console.error('❌ [JOB-PROCESSOR] Failed to notify admin of stuck jobs:', error);
    }
  }

  /**
   * Stop the background job processor
   */
  stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    console.log('🛑 [JOB-PROCESSOR] Stopped all intervals');
  }

  /**
   * Process the next pending job
   */
  private async processNextJob() {
    if (this.isProcessing) {
      return; // Already processing a job
    }

    try {
      this.isProcessing = true;

      // Find next pending job that's ready to process
      const [job] = await db
        .select()
        .from(backgroundJobs)
        .where(
          and(
            eq(backgroundJobs.status, 'pending'),
            lte(backgroundJobs.scheduledFor, new Date())
          )
        )
        .orderBy(backgroundJobs.createdAt)
        .limit(1);

      if (!job) {
        return; // No jobs to process
      }

      console.log(`🔄 [JOB-PROCESSOR] Processing job ${job.id} (type: ${job.jobType})`);

      // Mark as processing
      await db
        .update(backgroundJobs)
        .set({
          status: 'processing',
          startedAt: new Date(),
          attempts: sql`${backgroundJobs.attempts} + 1`,
        })
        .where(eq(backgroundJobs.id, job.id));

      // Process the job based on type
      try {
        let result: any = null;

        switch (job.jobType) {
          case 'process_email':
            result = await this.processEmailJob(job);
            break;
          
          case 'process_sms':
            result = await this.processSmsJob(job);
            break;

          case 'reclassify_deal':
            result = await this.processReclassifyDealJob(job);
            break;

          case 'quick_deal_enrichment':
            result = await this.processQuickDealEnrichmentJob(job);
            break;

          default:
            throw new Error(`Unknown job type: ${job.jobType}`);
        }

        // Mark as completed
        await db
          .update(backgroundJobs)
          .set({
            status: 'completed',
            result,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(backgroundJobs.id, job.id));

        console.log(`✅ [JOB-PROCESSOR] Job ${job.id} completed successfully`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ [JOB-PROCESSOR] Job ${job.id} failed:`, errorMessage);

        // Check if we should retry
        const currentAttempts = (job.attempts || 0) + 1;
        const shouldRetry = currentAttempts < (job.maxAttempts || 3);

        if (shouldRetry) {
          // Mark as pending for retry
          await db
            .update(backgroundJobs)
            .set({
              status: 'pending',
              error: errorMessage,
              scheduledFor: new Date(Date.now() + 60000), // Retry in 1 minute
              updatedAt: new Date(),
            })
            .where(eq(backgroundJobs.id, job.id));

          console.log(`🔄 [JOB-PROCESSOR] Job ${job.id} will retry (attempt ${currentAttempts}/${job.maxAttempts})`);
        } else {
          // Mark as failed (max attempts reached)
          await db
            .update(backgroundJobs)
            .set({
              status: 'failed',
              error: errorMessage,
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(backgroundJobs.id, job.id));

          console.error(`💀 [JOB-PROCESSOR] Job ${job.id} failed permanently after ${currentAttempts} attempts`);

          // Send admin notification for failed job
          await this.notifyAdminOfFailedJob(job, errorMessage);
        }
      }

    } catch (error) {
      console.error('❌ [JOB-PROCESSOR] Error in job processor:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process an email job - handles full email processing pipeline
   */
  private async processEmailJob(job: BackgroundJob): Promise<any> {
    const payload = job.payload as any;
    const { storage } = await import('./storage');
    const { EmailInboundService } = await import('./emailInboundService');
    const { IntelligentResponseService } = await import('./intelligentResponseService');

    console.log('\n' + '='.repeat(80));
    console.log(`📧 [JOB-PROCESSOR] PROCESSING EMAIL BACKGROUND JOB`);
    console.log('='.repeat(80));
    console.log(`📧 Email From: ${payload.contactEmail}`);
    console.log(`🔑 Email Hash: ${payload.emailHash}`);
    console.log(`⏭️ skipConfirmation Flag: ${payload.skipConfirmation ? 'TRUE - Skip duplicate confirmation' : 'FALSE - Will send confirmation'}`);
    console.log(`🎯 Job ID: ${job.id}`);
    console.log('='.repeat(80));

    try {
      // Generate intelligent response
      const responseData = await IntelligentResponseService.generateIntelligentResponse(
        payload.contactEmail,
        payload.dealData,
        'email'
      );

      // Create deal from properly parsed email data
      let deal;
      let dealCreatedSuccessfully = false;
      
      try {
        console.log(`🔄 [JOB-PROCESSOR] Calling createDealFromEmail with skipConfirmation=${payload.skipConfirmation}...`);
        
        deal = await EmailInboundService.createDealFromEmail(
          payload.emailData, 
          payload.dealData, 
          responseData.missingInfo,
          payload.skipConfirmation  // Pass flag to skip duplicate confirmation
        );
        
        if (deal && deal.address && deal.address !== 'Emergency email submission' && deal.address !== 'Property Submission') {
          dealCreatedSuccessfully = true;
          console.log(`✅ [JOB-PROCESSOR] Deal created from email - ID: ${deal.id} Address: ${deal.address}`);
          
          // Mark email as processed in database (permanent deduplication)
          await storage.markEmailProcessed({
            emailHash: payload.emailHash,
            dealId: deal.id,
            from: payload.emailData.from,
            subject: payload.emailData.subject || ''
          });
          console.log(`🔒 [JOB-PROCESSOR] Email marked as processed in database`);
          
          // CRITICAL FIX: Link the original communication to this deal
          // The communication was created in routes.ts with relatedDealId=null
          // We need to UPDATE it with the new dealId for "View Original Email" to work
          const { db } = await import('./db');
          const { communications, brokers } = await import('@shared/schema');
          const { eq, and, or, isNull, desc, sql } = await import('drizzle-orm');
          
          let linkedCommunication = false;
          
          // METHOD 1: Link via communicationId from payload
          if (payload.communicationId) {
            try {
              // CRITICAL FIX (Dec 2, 2025): Also update rawText with full content
              // For emails with PDF attachments, the original rawText might be empty
              // We need to include the email body + subject + any extracted PDF content
              let fullContent = payload.originalEmailContent || '';
              
              // Add email subject to content if not already included
              if (payload.originalSubject && !fullContent.includes(payload.originalSubject)) {
                fullContent = `Subject: ${payload.originalSubject}\n\n${fullContent}`;
              }
              
              // Build a comprehensive content from email data
              if ((!fullContent || fullContent.trim().length < 20) && payload.emailData) {
                const parts = [];
                if (payload.emailData.subject) parts.push(`Subject: ${payload.emailData.subject}`);
                if (payload.emailData.from) parts.push(`From: ${payload.emailData.from}`);
                if (payload.emailData.text) parts.push(`\n${payload.emailData.text}`);
                if (payload.emailData.html && !payload.emailData.text) {
                  // Extract text from HTML if no plain text
                  const htmlText = payload.emailData.html
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                  if (htmlText) parts.push(`\n${htmlText}`);
                }
                if (payload.emailData.attachments?.length) {
                  parts.push(`\nAttachments: ${payload.emailData.attachments.map((a: any) => a.filename).join(', ')}`);
                }
                fullContent = parts.join('\n');
              }
              
              // Only update rawText if we have content AND existing rawText is empty/minimal
              const updateData: any = { 
                relatedDealId: deal.id,
                status: 'resolved'
              };
              
              // Check if we should update rawText (only if current is empty and we have content)
              if (fullContent && fullContent.trim().length > 20) {
                // First check if current rawText is empty
                const currentComm = await db.select({ rawText: communications.rawText })
                  .from(communications)
                  .where(eq(communications.id, payload.communicationId))
                  .limit(1);
                
                if (currentComm.length > 0 && (!currentComm[0].rawText || currentComm[0].rawText.trim().length < 20)) {
                  updateData.rawText = fullContent;
                  console.log(`📧 [JOB-PROCESSOR] Updating communication rawText (${fullContent.length} chars)`);
                }
              }
              
              await db.update(communications)
                .set(updateData)
                .where(eq(communications.id, payload.communicationId));
              
              console.log(`✅ [JOB-PROCESSOR] Linked original communication ${payload.communicationId} to deal ${deal.id}`);
              linkedCommunication = true;
            } catch (linkError) {
              console.error(`⚠️ [JOB-PROCESSOR] Failed to link communication via communicationId:`, linkError);
            }
          }
          
          // METHOD 2: Link via providerMessageId from payload or emailData
          if (!linkedCommunication) {
            const providerMsgId = payload.providerMessageId || payload.emailData?.providerMessageId;
            if (providerMsgId) {
              try {
                console.log(`🔍 [JOB-PROCESSOR] Trying to link via providerMessageId: ${providerMsgId}`);
                const result = await db.update(communications)
                  .set({ 
                    relatedDealId: deal.id,
                    status: 'resolved'
                  })
                  .where(eq(communications.providerMessageId, providerMsgId))
                  .returning({ id: communications.id });
                
                if (result.length > 0) {
                  console.log(`✅ [JOB-PROCESSOR] Linked communication via providerMessageId: ${result[0].id}`);
                  linkedCommunication = true;
                } else {
                  console.log(`⚠️ [JOB-PROCESSOR] No communication found with providerMessageId: ${providerMsgId}`);
                }
              } catch (linkError) {
                console.error(`⚠️ [JOB-PROCESSOR] Failed to link via providerMessageId:`, linkError);
              }
            }
          }
          
          // METHOD 3: Fallback - Find unlinked inbound email from same broker within 10 minutes
          if (!linkedCommunication && deal.brokerId) {
            try {
              console.log(`🔍 [JOB-PROCESSOR] Trying fallback: unlinked email from broker ${deal.brokerId}`);
              const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
              
              const fallbackComm = await db.select()
                .from(communications)
                .where(
                  and(
                    eq(communications.brokerId, deal.brokerId),
                    eq(communications.channel, 'email'),
                    eq(communications.direction, 'inbound'),
                    isNull(communications.relatedDealId),
                    sql`${communications.createdAt} > ${tenMinutesAgo}`
                  )
                )
                .orderBy(desc(communications.createdAt))
                .limit(1);
              
              if (fallbackComm.length > 0) {
                await db.update(communications)
                  .set({ 
                    relatedDealId: deal.id,
                    status: 'resolved'
                  })
                  .where(eq(communications.id, fallbackComm[0].id));
                
                console.log(`✅ [JOB-PROCESSOR] Linked communication via fallback: ${fallbackComm[0].id}`);
                linkedCommunication = true;
              } else {
                console.log(`⚠️ [JOB-PROCESSOR] No unlinked inbound email found for broker within 10 minutes`);
              }
            } catch (linkError) {
              console.error(`⚠️ [JOB-PROCESSOR] Failed fallback link:`, linkError);
            }
          }
          
          if (!linkedCommunication) {
            console.log(`⚠️ [JOB-PROCESSOR] Could not link communication to deal ${deal.id} using any method`);
            
            // CRITICAL FIX (Nov 29, 2025): Create communication from backup content if none exists
            // This ensures we NEVER lose the original email content
            if (payload.originalEmailContent && payload.originalEmailContent.length > 0) {
              console.log(`🔧 [JOB-PROCESSOR] Creating communication from backup content (${payload.originalEmailContent.length} chars)`);
              try {
                const backupComm = await db.insert(communications)
                  .values({
                    id: `backup_${deal.id}_${Date.now()}`,
                    brokerId: deal.brokerId,
                    email: payload.contactEmail || payload.emailData?.from,
                    phone: null,
                    channel: 'email',
                    direction: 'inbound',
                    rawText: payload.originalEmailContent,
                    subject: payload.originalSubject || payload.emailData?.subject || 'No Subject',
                    relatedDealId: deal.id,
                    status: 'resolved',
                    providerMessageId: payload.providerMessageId || `backup_${Date.now()}`,
                    createdAt: new Date()
                  })
                  .returning();
                  
                if (backupComm.length > 0) {
                  console.log(`✅ [JOB-PROCESSOR] Created backup communication ${backupComm[0].id} with original content`);
                  linkedCommunication = true;
                }
              } catch (backupError) {
                console.error(`❌ [JOB-PROCESSOR] Failed to create backup communication:`, backupError);
              }
            } else {
              console.log(`⚠️ [JOB-PROCESSOR] No backup email content available in payload`);
            }
          }
        }
      } catch (error) {
        console.error('❌ [JOB-PROCESSOR] Deal creation failed:', error);
        throw error;
      }
      
      // If deal creation failed, notify team
      if (!dealCreatedSuccessfully) {
        console.error('❌ [JOB-PROCESSOR] Email could not be parsed into valid deal');
        await EmailInboundService.notifyTeamOfFailedParse(payload.emailData, payload.contactEmail);
        throw new Error('Failed to create deal from email');
      }

      // Notify team about new deal
      await EmailInboundService.notifyTeamOfNewDeal(deal);
      
      // Forward to external webhooks
      await EmailInboundService.forwardToExternalWebhooks(payload.emailData, deal);
      
      // REMOVED: Follow-up service call moved to unified pipeline to ensure correct message order
      // The unified pipeline handles follow-ups AFTER confirmation to prevent out-of-order messages
      // (Confirmation must be sent BEFORE missing info request)
      
      return {
        dealId: deal.id,
        classification: deal.classification || 'unclassified',
        status: 'success',
      };
      
    } catch (error) {
      console.error('❌ [JOB-PROCESSOR] Failed to process email deal:', error);
      throw error; // Re-throw to trigger retry logic
    }
  }

  /**
   * Process an SMS job
   */
  private async processSmsJob(job: BackgroundJob): Promise<any> {
    const { SMSConversationEngine } = await import('./smsConversationEngine');
    const { sendSMS } = await import('./smsService');
    const payload = job.payload as any;

    const maskedPhone = payload.from ? `***-***-${payload.from.slice(-4)}` : 'unknown';
    
    console.log('\n' + '='.repeat(80));
    console.log(`📱 [JOB-PROCESSOR] PROCESSING SMS BACKGROUND JOB`);
    console.log('='.repeat(80));
    console.log(`📱 SMS From: ${maskedPhone}`);
    console.log(`📝 Message Preview: "${payload.message.substring(0, 50)}${payload.message.length > 50 ? '...' : ''}"`);
    console.log(`⏭️ skipConfirmation Flag: ${payload.skipConfirmation ? 'TRUE - Skip duplicate confirmation' : 'FALSE - Will send confirmation'}`);
    console.log(`🎯 Job ID: ${job.id}`);
    // CRITICAL FIX: Log parsed data to verify city/state are preserved
    if (payload.parsedData) {
      console.log(`📊 [PARSED-DATA] Extracted address components:`, {
        address: payload.parsedData.address,
        city: payload.parsedData.city,
        state: payload.parsedData.state,
        zipCode: payload.parsedData.zipCode
      });
    } else {
      console.log(`⚠️ [PARSED-DATA] No parsed data in payload - will need to re-parse`);
    }
    console.log('='.repeat(80));

    console.log(`🔄 [JOB-PROCESSOR] Calling SMS conversation engine with skipConfirmation=${payload.skipConfirmation}...`);
    
    // CRITICAL FIX: Pass parsedData to preserve user-submitted city/state
    // Process through conversation engine - now returns structured data
    const result = await SMSConversationEngine.processConversation(
      payload.from,
      payload.message,
      payload.metadata,
      payload.skipConfirmation,  // Pass flag to skip duplicate confirmation
      payload.parsedData || null  // CRITICAL: Pass parsed city/state data
    );

    // Extract message from structured response
    const response = result.message;

    // CRITICAL: Log structured response for observability
    console.log(`📊 [JOB-PROCESSOR] SMS conversation engine result:`, {
      hasMessage: !!response,
      messagePreview: response ? response.substring(0, 100) : 'NO MESSAGE',
      dealId: result.dealId,
      skipConfirmation: result.skipConfirmation,
      success: result.success,
      metadata: result.metadata
    });
    
    // ARCHITECT IMPROVEMENT: Instead of brittle text matching, verify deal creation by checking database
    // Get all deals for this broker and find the most recent one created in the last minute
    const { storage } = await import('./storage');
    const broker = await storage.getBrokerByPhone(payload.from);
    let dealCreated = false;
    let createdDealId: string | null = null;
    
    if (broker) {
      const brokerDeals = await storage.getDealsByBrokerId(broker.id);
      const oneMinuteAgo = new Date(Date.now() - 60000); // 60 seconds ago
      
      const recentDeal = brokerDeals.find((deal: any) => 
        deal.createdAt && new Date(deal.createdAt) > oneMinuteAgo
      );
      
      if (recentDeal) {
        dealCreated = true;
        createdDealId = recentDeal.id;
        console.log(`✅ [JOB-PROCESSOR] VERIFIED: Deal created successfully (ID: ${createdDealId}, Number: ${recentDeal.dealNumber})`);
        
        if (payload.skipConfirmation) {
          console.log(`⏭️ [JOB-PROCESSOR] skipConfirmation=true - deal created but no SMS sent (instant ack already sent)`);
        }
      } else {
        console.error(`❌ [JOB-PROCESSOR] CRITICAL: No recent deal found for broker ${broker.id} in last 60 seconds`);
        console.error(`❌ [JOB-PROCESSOR] This indicates a silent deal creation failure`);
      }
    } else {
      console.error(`❌ [JOB-PROCESSOR] CRITICAL: Broker not found for phone ${maskedPhone}`);
    }

    // CRITICAL FIX: Check result.skipConfirmation (not payload) before sending SMS
    // If skipConfirmation=true, instant acknowledgment was already sent - don't send duplicate
    if (result.skipConfirmation) {
      console.log(`⏭️ [JOB-PROCESSOR] SKIPPING SMS: result.skipConfirmation=true (instant ack already sent)`);
    } else if (response && response.trim()) {
      console.log(`📱 [JOB-PROCESSOR] Sending SMS response to ${maskedPhone}`);
      
      try {
        const smsResult = await sendSMS({
          to: payload.from,
          message: response
        });
        
        if (smsResult.success && smsResult.delivered) {
          console.log(`✅ [JOB-PROCESSOR] SMS sent successfully to ${maskedPhone} (SID: ${smsResult.sid})`);
        } else if (smsResult.success && !smsResult.delivered) {
          console.log(`⏭️ [JOB-PROCESSOR] SMS not delivered to ${maskedPhone} - ${smsResult.reason || smsResult.mode}`);
        } else {
          console.error(`❌ [JOB-PROCESSOR] Failed to send SMS to ${maskedPhone} - ${smsResult.error}`);
          throw new Error(`SMS failed: ${smsResult.error}`); // Trigger retry for actual failures
        }
      } catch (smsError) {
        console.error(`❌ [JOB-PROCESSOR] Error sending SMS:`, smsError);
        throw smsError; // Re-throw to trigger retry
      }
    }

    // Return structured metadata for observability
    return {
      response,
      processedAt: new Date().toISOString(),
      smsSent: result.skipConfirmation ? false : (response && response.trim() ? true : false),
      dealCreated: dealCreated,
      dealId: createdDealId,
      skipConfirmation: result.skipConfirmation, // Use result, not payload
      metadata: {
        brokerPhone: maskedPhone,
        hasResponse: !!response,
        responseLength: response?.length || 0
      }
    };
  }

  /**
   * Process a reclassify_deal job - re-run classification after missing info is provided
   * This job is queued when a broker provides missing info (city/state/zip) via SMS reply
   */
  private async processReclassifyDealJob(job: BackgroundJob): Promise<any> {
    const payload = job.payload as { dealId: string; reason: string };
    
    console.log(`\n` + '='.repeat(80));
    console.log(`🔄 [RECLASSIFY-JOB] Re-classifying deal: ${payload.dealId}`);
    console.log(`📝 [RECLASSIFY-JOB] Reason: ${payload.reason}`);
    console.log('='.repeat(80));
    
    try {
      // Get the deal with fresh data
      // CRITICAL: Use getDealById to ensure we have the latest data after SMS fallback updates
      let freshDeal = await storage.getDealById(payload.dealId);
      if (!freshDeal) {
        throw new Error(`Deal not found: ${payload.dealId}`);
      }
      
      console.log(`📍 [RECLASSIFY-JOB] Deal #${freshDeal.dealNumber}: ${freshDeal.address}`);
      console.log(`📍 [RECLASSIFY-JOB] City: ${freshDeal.city}, State: ${freshDeal.state}, ZIP: ${freshDeal.zip}`);
      
      // Get broker for notification
      const broker = freshDeal.brokerId ? await storage.getBrokerById(freshDeal.brokerId) : null;
      
      // Update deal with fresh geocoding if needed
      // Skip geocoding for synthetic addresses that cannot be meaningfully geocoded
      const reclassifyAddressIsNonGeocodable = 
        (freshDeal.address || '').startsWith('Parcel ID:') ||
        (freshDeal.address || '').startsWith('Coordinates:');
      if (!freshDeal.latitude || !freshDeal.longitude) {
        if (reclassifyAddressIsNonGeocodable) {
          console.log(`⏭️ [RECLASSIFY-JOB] Skipping geocoding — synthetic address (${freshDeal.address?.split(':')[0]}), cannot geocode`);
        } else {
          try {
            const { GeocodioService } = await import('./geocodioService');
            const geocodio = new GeocodioService();
            
            const fullAddress = [freshDeal.address, freshDeal.city, freshDeal.state, freshDeal.zip]
              .filter(p => p && p.trim())
              .join(', ');
            
            const geocodeResult = await geocodio.geocodeAddress(fullAddress);
            
            if (geocodeResult.success && geocodeResult.lat && geocodeResult.lng) {
              console.log(`📍 [RECLASSIFY-JOB] Geocoded: ${geocodeResult.lat}, ${geocodeResult.lng}`);
              await storage.updateDeal(freshDeal.id, {
                latitude: String(geocodeResult.lat),
                longitude: String(geocodeResult.lng)
              });
              // Reload after geocoding update
              freshDeal = await storage.getDealById(payload.dealId) || freshDeal;
            }
          } catch (geocodeErr) {
            console.error(`⚠️ [RECLASSIFY-JOB] Geocoding failed:`, geocodeErr);
          }
        }
      }
      
      console.log(`📍 [RECLASSIFY-JOB] Final data: City=${freshDeal.city}, State=${freshDeal.state}, ZIP=${freshDeal.zip}`);
      
      // Re-run MSA matching and classification with FRESH deal data
      console.log(`🔄 [RECLASSIFY-JOB] Running classification...`);
      const { classifyDealByExactCriteria } = await import('./businessRules');
      const classification = await classifyDealByExactCriteria(freshDeal);
      
      const reasoningText = classification.reasoning?.join('; ') || 'Re-classified after missing info provided';
      console.log(`📊 [RECLASSIFY-JOB] New classification: ${classification.classification}`);
      console.log(`📊 [RECLASSIFY-JOB] Reasoning: ${reasoningText}`);
      
      // Update deal with new classification
      await storage.updateDeal(freshDeal.id, {
        classification: classification.classification,
        analystNotes: reasoningText,
        updatedAt: new Date()
      });
      
      console.log(`✅ [RECLASSIFY-JOB] Deal #${freshDeal.dealNumber} re-classified as: ${classification.classification}`);
      
      // Send classification notification to broker
      if (broker && (broker.phone || broker.email)) {
        try {
          // Use the same notification path as other classification notifications
          const { sendSMS } = await import('./smsService');
          const { TemplateService } = await import('./templateService');
          
          if (broker.phone && broker.smsOptIn !== false) {
            const classResult = classification.classification as string;
            const templateName = classResult === 'high_priority' ? 'status_pursuing' : 
              classResult === 'clear_no' ? 'status_rejected' : 'status_under_review';
            const rejectionText = classification.shortRejectionReason || reasoningText || '';
            const template = await TemplateService.getSMSTemplate(
              templateName,
              { 
                address: freshDeal.address, 
                propertyAddress: freshDeal.address,
                rejectionReason: rejectionText,
                declineReason: rejectionText
              }
            );
            if (template) {
              await sendSMS({ to: broker.phone, message: template, brokerOverride: broker });
              console.log(`✅ [RECLASSIFY-JOB] Classification SMS sent to broker`);
            }
          }
        } catch (notifyErr) {
          console.error(`⚠️ [RECLASSIFY-JOB] Failed to send notification:`, notifyErr);
        }
      }
      
      return {
        success: true,
        dealId: freshDeal.id,
        dealNumber: freshDeal.dealNumber,
        newClassification: classification.classification,
        reasoning: reasoningText,
        processedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ [RECLASSIFY-JOB] Error:`, error);
      throw error;
    }
  }

  /**
   * Process a quick_deal_enrichment job - run HelloData/MSA classification in background
   * This job is queued when a deal is created via Quick Deal form
   * PERFORMANCE: Allows instant deal creation with background enrichment
   */
  private async processQuickDealEnrichmentJob(job: BackgroundJob): Promise<any> {
    const payload = job.payload as { dealId: string };
    
    console.log(`\n` + '='.repeat(80));
    console.log(`⚡ [QUICK-DEAL-ENRICHMENT] Processing deal: ${payload.dealId}`);
    console.log('='.repeat(80));
    
    try {
      // Get the deal
      let deal = await storage.getDealById(payload.dealId);
      if (!deal) {
        throw new Error(`Deal not found: ${payload.dealId}`);
      }
      
      console.log(`📍 [QUICK-DEAL-ENRICHMENT] Deal #${deal.dealNumber}: ${deal.address}`);
      console.log(`📍 [QUICK-DEAL-ENRICHMENT] Location: ${deal.city}, ${deal.state} ${deal.zip}`);
      
      // STEP 1: GEOCODING - Get coordinates if missing (CRITICAL for census data)
      let geocodeUpdates: any = {};
      // Skip geocoding for synthetic addresses that cannot be meaningfully geocoded:
      // - "Parcel ID: XXX" — a county APN, not a real street address
      // - "Coordinates: lat, lng" — already has coordinates baked into the address string
      const isNonGeocodableAddress =
        (deal.address || '').startsWith('Parcel ID:') ||
        (deal.address || '').startsWith('Coordinates:');
      if (!deal.latitude || !deal.longitude) {
        if (isNonGeocodableAddress && (deal.address || '').startsWith('Parcel ID:')) {
          // Attempt to resolve parcel ID → real address + coordinates via Regrid APN lookup
          console.log(`🏠 [QUICK-DEAL-ENRICHMENT] Attempting Regrid APN lookup for: ${deal.address}`);
          try {
            const { regridService } = await import('./regridService');
            // Extract parcel number and optional state from "Parcel ID: 2103401008 GA"
            const raw = (deal.address || '').replace(/^Parcel ID:\s*/i, '').trim();
            // State is typically a 2-letter code at the end
            const stateMatch = raw.match(/\b([A-Z]{2})\s*$/);
            const stateFromAddress = stateMatch ? stateMatch[1] : (deal.state || undefined);
            const parcelnumb = raw.replace(/\s+[A-Z]{2}\s*$/, '').trim();
            const apnResult = await regridService.searchParcelByAPN(parcelnumb, stateFromAddress);
            if (apnResult.success && apnResult.parcelData) {
              const pd = apnResult.parcelData;
              const resolvedAddress = [pd.address, pd.scity, pd.state2, pd.szip].filter(Boolean).join(', ');
              console.log(`✅ [QUICK-DEAL-ENRICHMENT] Regrid resolved parcel to: ${resolvedAddress} (${pd.ll_latitude}, ${pd.ll_longitude})`);
              if (resolvedAddress) geocodeUpdates.address = resolvedAddress;
              if (pd.scity) geocodeUpdates.city = pd.scity;
              if (pd.state2) geocodeUpdates.state = pd.state2;
              if (pd.szip) geocodeUpdates.zip = pd.szip;
              if (pd.county) geocodeUpdates.county = pd.county;
              if (pd.ll_latitude) geocodeUpdates.latitude = String(pd.ll_latitude);
              if (pd.ll_longitude) geocodeUpdates.longitude = String(pd.ll_longitude);
            } else {
              console.log(`⏭️ [QUICK-DEAL-ENRICHMENT] Regrid APN lookup returned no result: ${apnResult.error || 'no match'}`);
            }
          } catch (apnErr) {
            console.error(`❌ [QUICK-DEAL-ENRICHMENT] Regrid APN lookup error:`, apnErr);
          }
        } else if (isNonGeocodableAddress) {
          console.log(`⏭️ [QUICK-DEAL-ENRICHMENT] Skipping geocoding — synthetic address (${(deal.address || '').split(':')[0]}:), cannot geocode`);
        } else
        try {
          const { geocodingService } = await import('./geocodingService');
          const geocodeResult = await geocodingService.enrichWithZipCode({ 
            address: deal.address || '', 
            zip: deal.zip || undefined,
            city: deal.city || undefined,
            state: deal.state || undefined
          });
          
          if (geocodeResult && (geocodeResult.latitude || geocodeResult.longitude)) {
            console.log(`✅ [QUICK-DEAL-ENRICHMENT] Geocoded: ${geocodeResult.latitude}, ${geocodeResult.longitude}`);
            if (geocodeResult.latitude != null) geocodeUpdates.latitude = String(geocodeResult.latitude);
            if (geocodeResult.longitude != null) geocodeUpdates.longitude = String(geocodeResult.longitude);
            if (!deal.city && geocodeResult.city) geocodeUpdates.city = geocodeResult.city;
            if (!deal.state && geocodeResult.state) geocodeUpdates.state = geocodeResult.state;
            if (!deal.zip && geocodeResult.zip) geocodeUpdates.zip = geocodeResult.zip;
            if (!deal.county && geocodeResult.county) geocodeUpdates.county = geocodeResult.county;
            
            // Update deal in database with geocoded data
            await storage.updateDeal(deal.id, geocodeUpdates);
            deal = { ...deal, ...geocodeUpdates } as any; // Update local reference
          } else {
            console.log(`⚠️ [QUICK-DEAL-ENRICHMENT] Geocoding returned no coordinates`);
          }
        } catch (geoError) {
          console.error(`❌ [QUICK-DEAL-ENRICHMENT] Geocoding failed:`, geoError);
        }
      } else {
        console.log(`✅ [QUICK-DEAL-ENRICHMENT] Coordinates already exist: ${deal.latitude}, ${deal.longitude}`);
      }
      
      // STEP 2: CENSUS DATA - Fetch demographics if we have coordinates
      let censusUpdates: any = {};
      const lat = parseFloat(String(deal?.latitude || ''));
      const lng = parseFloat(String(deal?.longitude || ''));
      
      if (!isNaN(lat) && !isNaN(lng)) {
        console.log(`🏛️ [QUICK-DEAL-ENRICHMENT] Fetching census demographics for ${lat}, ${lng}...`);
        try {
          const { getCensusDemographics } = await import('./censusService');
          const censusData = await getCensusDemographics(lat, lng);
          
          if (censusData && (censusData.totalPopulation || censusData.medianIncome)) {
            console.log(`✅ [QUICK-DEAL-ENRICHMENT] Census data: pop=${censusData.totalPopulation}, income=${censusData.medianIncome}`);
            if (censusData.totalPopulation) censusUpdates.censusTotalPopulation = censusData.totalPopulation;
            if (censusData.medianIncome) censusUpdates.censusMedianIncome = censusData.medianIncome;
            if (censusData.medianAge) censusUpdates.censusMedianAge = censusData.medianAge;
            if (censusData.vacancyRate != null) censusUpdates.censusVacancyRate = String(censusData.vacancyRate);
            if (censusData.renterRate != null) censusUpdates.censusRenterRate = String(censusData.renterRate);
            if (censusData.tractId) censusUpdates.censusTractId = censusData.tractId;
          } else {
            console.log(`⚠️ [QUICK-DEAL-ENRICHMENT] Census returned no demographic data`);
          }
        } catch (censusError) {
          console.error(`❌ [QUICK-DEAL-ENRICHMENT] Census fetch failed:`, censusError);
        }
      } else {
        console.log(`⚠️ [QUICK-DEAL-ENRICHMENT] No valid coordinates for census lookup`);
      }
      
      // Import UnifiedDealPipeline for classification
      const { UnifiedDealPipeline } = await import('./unifiedDealPipeline');
      
      // Run the comparable search and classification
      console.log(`🔄 [QUICK-DEAL-ENRICHMENT] Running HelloData classification...`);
      const classificationResult = await UnifiedDealPipeline.runComparableSearchAndClassify(deal);
      console.log(`✅ [QUICK-DEAL-ENRICHMENT] Classification complete: ${classificationResult.classification}`);
      
      // Update the deal with classification results AND census data
      const classificationUpdates: any = {
        ...censusUpdates, // Include census data in update
        classification: classificationResult.classification,
        status: classificationResult.status,
        aiReasoning: classificationResult.reasoning,
        qctStatus: classificationResult.qctStatus,
        censusTractFips: classificationResult.censusTractFips,
        // Save geocoded coordinates if classification resolved them for rural/non-standard addresses
        ...(classificationResult.geocodedLat && classificationResult.geocodedLng && !deal.latitude ? {
          latitude: String(classificationResult.geocodedLat),
          longitude: String(classificationResult.geocodedLng),
        } : {}),
        // DDA (Difficult Development Area) — 30% LIHTC basis boost
        ddaStatus: classificationResult.ddaStatus || 'N/A',
        ddaAreaName: classificationResult.ddaAreaName || null,
        ddaVlil: classificationResult.ddaVlil || null,
        ddaLihtcMaxRent: classificationResult.ddaLihtcMaxRent || null,
        ddaFmr: classificationResult.ddaFmr || null,
        // Novogradac GoZone enrichment
        ozEligible: classificationResult.ozEligible || 'N/A',
        nmtcStatus: classificationResult.nmtcStatus || 'N/A',
        nmtcProjectId: classificationResult.nmtcProjectId || null,
        nmtcAmount: classificationResult.nmtcAmount || null,
        nmtcPurpose: classificationResult.nmtcPurpose || null,
        lihtcNearbyJson: classificationResult.lihtcNearbyJson || null,
        comparableCount: classificationResult.comparableCount,
        comparableNotes: classificationResult.comparableNotes,
        aiExplanatoryNotes: classificationResult.aiExplanatoryNotes || null,
        topRentPSF: classificationResult.topRentPSF ?? null,
        avgRentPSF: classificationResult.avgRentPSF ?? null,
        topRentPerUnit: classificationResult.topRentPerUnit ?? null,
        avgRentPerUnit: classificationResult.avgRentPerUnit ?? null,
        rejectionReason: classificationResult.shortRejectionReason || null,
        updatedAt: new Date(),
      };
      
      // Store comparable data if found
      if (classificationResult.comparableData) {
        classificationUpdates.comparableData = classificationResult.comparableData;
      }
      
      await storage.updateDeal(deal!.id, classificationUpdates);
      
      console.log(`✅ [QUICK-DEAL-ENRICHMENT] Deal #${deal!.dealNumber} enriched: ${classificationResult.classification}`);
      
      // Send broker notification after classification (if broker has contact info)
      // FIX (Jan 15, 2026): Quick Add deals should notify brokers when classification completes
      try {
        const broker = deal!.brokerId ? await storage.getBrokerById(deal!.brokerId) : null;
        
        // Skip notification for manual broker (no real contact info)
        const isManualBroker = broker?.email === 'manual@catalystcp.com';
        
        if (broker && !isManualBroker && (broker.email || broker.phone)) {
          console.log(`📧 [QUICK-DEAL-ENRICHMENT] Sending classification notification to broker...`);
          
          const { TemplateService } = await import('./templateService');
          const { sendNotificationEmail } = await import('./emailService');
          const { sendSMS } = await import('./smsService');
          
          // Get the freshly updated deal
          const freshDeal = await storage.getDealById(deal!.id);
          if (!freshDeal) throw new Error('Deal not found after update');
          
          // Map classification to event type
          const eventType = classificationResult.classification === 'green' 
            ? 'status_pursuing' 
            : classificationResult.classification === 'red'
              ? 'status_rejected'
              : 'status_under_review';
          
          // Send email notification if broker has email
          console.log(`📧 [QUICK-DEAL-ENRICHMENT] Checking email notification: email=${broker.email}, isTempEmail=${broker.email?.includes('@temp.landlinq.ai')}`);
          if (broker.email && !broker.email.includes('@temp.landlinq.ai')) {
            const emailTemplate = await TemplateService.getEmailTemplate(eventType, {
              brokerName: `${broker.firstName || ''} ${broker.lastName || ''}`.trim() || 'Broker',
              address: freshDeal.address,
              propertyAddress: freshDeal.address,
              declineReason: classificationResult.shortRejectionReason || '',
            });
            
            if (emailTemplate) {
              // CRITICAL: Pass sendgridTemplateId for dynamic templates
              console.log(`📧 [QUICK-DEAL-ENRICHMENT] Sending ${eventType} email to ${broker.email}...`);
              await sendNotificationEmail({
                to: broker.email,
                subject: emailTemplate.subject,
                html: emailTemplate.html,
                type: eventType,
                sendgridTemplateId: emailTemplate.sendgridTemplateId,
                sendgridDynamicData: emailTemplate.sendgridDynamicData,
              });
              const templateMode = emailTemplate.sendgridTemplateId ? `SendGrid (${emailTemplate.sendgridTemplateId})` : 'Outreach Tab';
              console.log(`✅ [QUICK-DEAL-ENRICHMENT] Classification email sent via ${templateMode} to broker: ${broker.email}`);

              // Log to communications table so analysts can audit notification history
              try {
                const plainText = ((emailTemplate as any).content || emailTemplate.subject || '')
                  .replace(/<[^>]*>/g, '')
                  .replace(/&nbsp;/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
                await storage.createCommunication({
                  brokerId: broker.id,
                  relatedDealId: freshDeal.id,
                  channel: "email",
                  direction: "outbound",
                  rawText: plainText,
                  subject: emailTemplate.subject,
                  message: plainText,
                  recipientEmail: broker.email,
                  status: "resolved"
                });
                console.log(`✅ [QUICK-DEAL-ENRICHMENT] Communication record created for ${eventType} → ${broker.email}`);
              } catch (logErr) {
                console.warn(`⚠️ [QUICK-DEAL-ENRICHMENT] Could not log communication record:`, logErr);
              }
            } else {
              console.error(`❌ [QUICK-DEAL-ENRICHMENT] No Outreach Management template found for event "${eventType}" — email not sent. Add this template in Outreach Management.`);
            }
          } else {
            console.log(`ℹ️ [QUICK-DEAL-ENRICHMENT] Skipping email - no valid email address (email=${broker.email || 'none'})`);
          }
          
          // Send SMS notification if broker has phone and hasn't opted out
          console.log(`📱 [QUICK-DEAL-ENRICHMENT] Checking SMS: phone=${broker.phone || 'none'}, smsOptIn=${broker.smsOptIn}, eventType=${eventType}`);
          if (broker.phone && broker.smsOptIn !== false) {
            const rejectionReasonText = (classificationResult as any).shortRejectionReason || '';
            const smsTemplate = await TemplateService.getSMSTemplate(eventType, { 
              address: freshDeal.address, 
              propertyAddress: freshDeal.address, 
              declineReason: rejectionReasonText,
              rejectionReason: rejectionReasonText // Support both variable names
            });
            if (smsTemplate) {
              await sendSMS({ to: broker.phone, message: smsTemplate, brokerOverride: broker });
              console.log(`✅ [QUICK-DEAL-ENRICHMENT] Classification SMS sent to broker: ${broker.phone}`);
            } else {
              console.warn(`⚠️ [QUICK-DEAL-ENRICHMENT] No SMS template found for event "${eventType}" - SMS not sent`);
            }
          } else {
            console.log(`⏭️ [QUICK-DEAL-ENRICHMENT] SMS skipped - phone: ${broker.phone ? 'YES' : 'NO'}, opted in: ${broker.smsOptIn !== false ? 'YES' : 'NO'}`);
          }
        } else {
          console.log(`ℹ️ [QUICK-DEAL-ENRICHMENT] No broker notification sent - ${isManualBroker ? 'manual broker' : 'no contact info'}`);
        }
      } catch (notifyErr) {
        console.error(`⚠️ [QUICK-DEAL-ENRICHMENT] Failed to send broker notification:`, notifyErr);
        // Don't fail the job if notification fails
      }
      
      return {
        success: true,
        dealId: deal.id,
        dealNumber: deal.dealNumber,
        classification: classificationResult.classification,
        status: classificationResult.status,
        comparableCount: classificationResult.comparableCount,
        processedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ [QUICK-DEAL-ENRICHMENT] Error:`, error);
      throw error;
    }
  }

  /**
   * Send admin notification for failed job
   */
  private async notifyAdminOfFailedJob(job: BackgroundJob, errorMessage: string) {
    try {
      const { sendNotificationEmail } = await import('./emailService');
      const { TemplateService } = await import('./templateService');

      const template = await TemplateService.getEmailTemplate('admin_job_failure', {
        jobId: job.id,
        jobType: job.jobType,
        error: errorMessage,
        attempts: String(job.attempts || 0),
        payload: JSON.stringify(job.payload, null, 2).substring(0, 500),
      });

      if (template) {
        await sendNotificationEmail({
          to: 'jack@catalystcp.com',
          subject: `⚠️ Background Job Failed: ${job.jobType}`,
          html: template.html,
          type: 'admin_job_failure',
        });
      }
    } catch (error) {
      console.error('❌ [JOB-PROCESSOR] Failed to send admin notification:', error);
    }
  }
}

// Export class and singleton instance
export { BackgroundJobProcessor };
export const backgroundJobProcessor = new BackgroundJobProcessor();
