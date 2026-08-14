interface ClassificationJob {
  dealId: string;
  dealNumber: number | null;
  address: string;
  step: number;
  totalSteps: number;
  stepName: string;
  status: 'running' | 'completed' | 'failed';
  classification?: string;
  failureReason?: string;
  startedAt: number;
  dealType: 'land' | 'acquisition';
}

class ClassificationProgressTracker {
  private jobs: Map<string, ClassificationJob> = new Map();
  private readonly CLEANUP_DELAY = 5000;

  startJob(
    dealId: string, 
    dealNumber: number | null, 
    address: string, 
    dealType: 'land' | 'acquisition' = 'land',
    totalSteps: number = 6
  ): void {
    this.jobs.set(dealId, {
      dealId,
      dealNumber,
      address,
      step: 0,
      totalSteps,
      stepName: 'Starting classification...',
      status: 'running',
      startedAt: Date.now(),
      dealType,
    });
    console.log(`📊 [PROGRESS] Started tracking ${dealType} classification for deal ${dealNumber || dealId}`);
  }

  updateStep(dealId: string, step: number, stepName: string): void {
    const job = this.jobs.get(dealId);
    if (job && job.status === 'running') {
      job.step = step;
      job.stepName = stepName;
      console.log(`📊 [PROGRESS] Deal ${job.dealNumber || dealId}: Step ${step}/${job.totalSteps} - ${stepName}`);
    }
  }

  completeJob(dealId: string, classification: string): void {
    const job = this.jobs.get(dealId);
    if (job) {
      job.status = 'completed';
      job.classification = classification;
      job.step = job.totalSteps;
      job.stepName = 'Complete';
      console.log(`📊 [PROGRESS] Deal ${job.dealNumber || dealId}: Classification complete - ${classification.toUpperCase()}`);
      this.scheduleCleanup(dealId);
    }
  }

  failJob(dealId: string, reason?: string): void {
    const job = this.jobs.get(dealId);
    if (job) {
      job.status = 'failed';
      job.stepName = 'Failed';
      job.failureReason = reason;
      console.log(`📊 [PROGRESS] Deal ${job.dealNumber || dealId}: Classification failed${reason ? ` - ${reason}` : ''}`);
      this.scheduleCleanup(dealId);
    }
  }

  private scheduleCleanup(dealId: string): void {
    setTimeout(() => {
      this.jobs.delete(dealId);
    }, this.CLEANUP_DELAY);
  }

  getActiveJobs(): ClassificationJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => b.startedAt - a.startedAt);
  }

  hasActiveJob(dealId: string): boolean {
    return this.jobs.has(dealId);
  }
}

export const classificationProgressTracker = new ClassificationProgressTracker();
