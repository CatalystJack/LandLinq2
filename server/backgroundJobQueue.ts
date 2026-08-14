import { EventEmitter } from 'events';
import { storage } from './storage';

export interface BackgroundJob {
  id: string;
  type: 'deal_enrichment' | 'deal_classification' | 'send_notifications';
  payload: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  processedAt?: Date;
  retryCount: number;
  maxRetries: number;
  error?: string;
}

class BackgroundJobQueue extends EventEmitter {
  private jobs: Map<string, BackgroundJob> = new Map();
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startProcessing();
  }

  /**
   * Add a job to the queue
   */
  async addJob(type: BackgroundJob['type'], payload: any, maxRetries = 3): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: BackgroundJob = {
      id: jobId,
      type,
      payload,
      status: 'pending',
      createdAt: new Date(),
      retryCount: 0,
      maxRetries
    };

    this.jobs.set(jobId, job);
    console.log(`📋 Queued background job: ${type} (ID: ${jobId})`);
    
    // Emit event to wake up processor if it's idle
    this.emit('jobAdded', job);
    
    return jobId;
  }

  /**
   * Start processing jobs
   */
  private startProcessing() {
    // Process jobs every 2 seconds
    this.processingInterval = setInterval(() => {
      this.processNextJob();
    }, 2000);

    // Also process immediately when new jobs are added
    this.on('jobAdded', () => {
      if (!this.isProcessing) {
        setTimeout(() => this.processNextJob(), 100);
      }
    });
  }

  /**
   * Process the next pending job
   */
  private async processNextJob() {
    if (this.isProcessing) return;

    const pendingJob = Array.from(this.jobs.values())
      .find(job => job.status === 'pending');

    if (!pendingJob) return;

    this.isProcessing = true;
    
    try {
      console.log(`🔄 Processing background job: ${pendingJob.type} (ID: ${pendingJob.id})`);
      
      // Update job status to processing
      pendingJob.status = 'processing';
      pendingJob.processedAt = new Date();
      
      // Process the job based on type
      await this.executeJob(pendingJob);
      
      // Mark as completed
      pendingJob.status = 'completed';
      console.log(`✅ Completed background job: ${pendingJob.type} (ID: ${pendingJob.id})`);
      
    } catch (error) {
      console.error(`❌ Background job failed: ${pendingJob.type} (ID: ${pendingJob.id})`, error);
      
      pendingJob.retryCount++;
      pendingJob.error = error instanceof Error ? error.message : 'Unknown error';
      
      if (pendingJob.retryCount < pendingJob.maxRetries) {
        pendingJob.status = 'pending';
        console.log(`🔄 Retrying job ${pendingJob.id} (attempt ${pendingJob.retryCount + 1}/${pendingJob.maxRetries})`);
      } else {
        pendingJob.status = 'failed';
        console.error(`💀 Job ${pendingJob.id} failed permanently after ${pendingJob.retryCount} retries`);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute a specific job based on its type
   */
  private async executeJob(job: BackgroundJob) {
    switch (job.type) {
      case 'deal_enrichment':
        await this.processDealEnrichment(job.payload);
        break;
      
      case 'deal_classification':
        await this.processDealClassification(job.payload);
        break;
      
      case 'send_notifications':
        console.log(`📧 Processing notifications: Broker notifications ONLY - team notifications disabled per user rule`);
        await this.processSendNotifications(job.payload);
        break;
      
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  }

  /**
   * Process deal enrichment (API calls, data population)
   */
  private async processDealEnrichment(payload: any) {
    const { dealId, submissionData } = payload;
    
    try {
      console.log(`🔍 Starting enrichment for deal ${dealId}`);
      
      // Get the deal record
      const deal = await storage.getDealById(dealId);
      if (!deal) {
        throw new Error(`Deal ${dealId} not found`);
      }

      // Import the UnifiedDealPipeline for enrichment
      const { UnifiedDealPipeline } = await import('./unifiedDealPipeline');
      
      // Run API enrichment
      const enrichedData = await UnifiedDealPipeline.enrichDealWithAPIs(deal);
      
      // Update deal with enriched data
      if (enrichedData && Object.keys(enrichedData).length > 0) {
        await storage.updateDeal(dealId, {
          ...enrichedData,
          classification: 'unclassified', // Set classification for manual review
          status: 'pending_review', // Set status for pipeline tracking
          updatedAt: new Date() // Use existing updatedAt field
        });
        console.log(`✅ Deal ${dealId} enriched with ${Object.keys(enrichedData).length} API fields`);
        
        // Queue classification job
        await this.addJob('deal_classification', { dealId, enrichedData, submissionData });
      } else {
        // No enrichment data, still move to classification
        await storage.updateDeal(dealId, {
          classification: 'unclassified', // Set classification for manual review
          status: 'pending_review', // Set status for pipeline tracking
          updatedAt: new Date() // Use existing updatedAt field
        });
        await this.addJob('deal_classification', { dealId, enrichedData: {}, submissionData });
      }
      
    } catch (error) {
      console.error(`❌ Enrichment failed for deal ${dealId}:`, error);
      
      // Update deal status to indicate enrichment failed
      await storage.updateDeal(dealId, {
        classification: 'unclassified', // Set classification for manual review
        status: 'pending_review', // Set status for pipeline tracking
        brokerNotes: (error instanceof Error ? error.message : 'Enrichment failed'),
        updatedAt: new Date() // Use existing updatedAt field
      });
      
      // Still try classification with whatever data we have
      await this.addJob('deal_classification', { dealId, enrichedData: {}, submissionData });
    }
  }

  /**
   * Process deal classification (AI analysis)
   */
  private async processDealClassification(payload: any) {
    const { dealId, enrichedData, submissionData } = payload;
    
    try {
      console.log(`🤖 Starting classification for deal ${dealId}`);
      
      // Get the updated deal record
      const deal = await storage.getDealById(dealId);
      if (!deal) {
        throw new Error(`Deal ${dealId} not found`);
      }

      // Run HelloData comparable search and auto-classification
      console.log(`🤖 Running auto-classification with HelloData API for deal ${dealId}`);
      
      // Import unified pipeline for classification
      const { UnifiedDealPipeline } = await import('./unifiedDealPipeline');
      
      // Run comparable search and classification
      const classificationResult = await UnifiedDealPipeline.runComparableSearchAndClassify(deal);
      
      console.log(`📊 Classification result:`, {
        classification: classificationResult.classification,
        status: classificationResult.status,
        reasoning: classificationResult.reasoning,
        qctStatus: classificationResult.qctStatus,
        comparableCount: classificationResult.comparableCount
      });
      
      // Update deal with classification results
      const classificationUpdates: any = {
        classification: classificationResult.classification,
        status: classificationResult.status,
        rejectionReason: classificationResult.reasoning || null,
        qctStatus: classificationResult.qctStatus || 'N/A',
        ozStatus: (classificationResult as any).ozStatus || 'N/A',
        censusTractFips: classificationResult.censusTractFips || null,
        comparableCount: classificationResult.comparableCount || 0,
        comparableNotes: classificationResult.comparableNotes || null,
        aiExplanatoryNotes: classificationResult.aiExplanatoryNotes || null,
        assignedAnalyst: classificationResult.assignedAnalyst || null,
        updatedAt: new Date()
      };
      
      await storage.updateDeal(dealId, classificationUpdates);
      
      // Queue notification sending
      await this.addJob('send_notifications', { 
        dealId, 
        classification: {
          classification: classificationResult.classification,
          status: classificationResult.status,
          reasoning: classificationResult.reasoning,
          assignedAnalyst: classificationResult.assignedAnalyst,
          qctStatus: classificationResult.qctStatus,
          comparableCount: classificationResult.comparableCount
        }, 
        submissionData 
      });
      
    } catch (error) {
      console.error(`❌ Classification failed for deal ${dealId}:`, error);
      
      // Update with fallback classification
      await storage.updateDeal(dealId, {
        classification: 'red' as any, // Default to red if classification fails
        aiReasoning: 'Classification failed - manual review required',
        brokerNotes: error instanceof Error ? error.message : 'Classification failed',
        updatedAt: new Date() // Use existing updatedAt field
      });
      
      // Still send notifications
      await this.addJob('send_notifications', { 
        dealId, 
        classification: { 
          classification: 'red', 
          score: 0, 
          reasons: ['Classification failed - manual review required']
        }, 
        submissionData 
      });
    }
  }

  /**
   * Process sending notifications
   */
  private async processSendNotifications(payload: any) {
    const { dealId, classification, submissionData } = payload;
    
    try {
      console.log(`📧 Starting notifications for deal ${dealId}`);
      
      // Get the final deal record
      const deal = await storage.getDealById(dealId);
      if (!deal) {
        throw new Error(`Deal ${dealId} not found`);
      }

      // Import notification services
      const { UnifiedDealPipeline } = await import('./unifiedDealPipeline');
      
      // DISABLED: No automatic classification - all deals require manual review
      const adaptAutoClassificationResult = (autoResult: any) => {
        // NEVER auto-classify - all deals are unclassified requiring manual review
        return {
          recommendation: 'pending_review', // Always requires manual review
          confidence: autoResult.score ? autoResult.score / 100 : 0.5,
          reasoning: autoResult.reasons ? autoResult.reasons.join('; ') : 'Automated classification',
          teamAssignment: autoResult.automaticAssignment || {
            analyst: 'Austin Blondell',
            developer: 'Steve Hillebrand',
            partner: 'AJ Klenk'
          },
          developmentType: autoResult.suggestedDevelopmentType || 'Unknown'
        };
      };
      
      const adaptedClassification = adaptAutoClassificationResult(classification);
      
      // NOTE: Only broker notifications sent immediately - team notifications go to 6 AM digest only
      console.log(`📧 Deal ${dealId}: Broker notification sent immediately, team notification queued for 6 AM digest per user rule`);
      
      // Mark deal as requiring manual review (NO automatic classification)
      await storage.updateDeal(dealId, {
        status: 'pending_review', // ALWAYS requires manual analyst review
        classification: 'unclassified', // NEVER auto-classify
        updatedAt: new Date() // Use existing updatedAt field
      });
      
      console.log(`✅ All notifications sent for deal ${dealId}`);
      
    } catch (error) {
      console.error(`❌ Notification sending failed for deal ${dealId}:`, error);
      
      // Update deal with error but don't fail the whole process
      await storage.updateDeal(dealId, {
        brokerNotes: error instanceof Error ? error.message : 'Notification failed',
        updatedAt: new Date() // Use existing updatedAt field
      });
    }
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): BackgroundJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    const jobs = Array.from(this.jobs.values());
    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length
    };
  }

  /**
   * Cleanup old jobs (keep last 1000)
   */
  cleanup() {
    const jobs = Array.from(this.jobs.entries())
      .sort(([,a], [,b]) => b.createdAt.getTime() - a.createdAt.getTime());
    
    if (jobs.length > 1000) {
      const toDelete = jobs.slice(1000);
      toDelete.forEach(([jobId]) => {
        this.jobs.delete(jobId);
      });
      console.log(`🧹 Cleaned up ${toDelete.length} old background jobs`);
    }
  }

  /**
   * Stop processing (for graceful shutdown)
   */
  stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }
}

// Export singleton instance
export const backgroundJobQueue = new BackgroundJobQueue();

// Cleanup old jobs every hour
setInterval(() => {
  backgroundJobQueue.cleanup();
}, 60 * 60 * 1000);