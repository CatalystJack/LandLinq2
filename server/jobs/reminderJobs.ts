import cron from 'node-cron';
import { followUpService } from '../followUpService';

/**
 * Scheduled job to process reminder follow-ups for incomplete deal submissions
 */
export class ReminderJobs {
  private static reminderJobStarted = false;

  /**
   * Start the reminder job scheduler
   */
  static startReminderJobs(): void {
    if (this.reminderJobStarted) {
      console.log('⏰ Reminder jobs already started, skipping...');
      return;
    }

    console.log('🚀 Starting reminder job scheduler...');

    // Process reminder follow-ups every 4 hours
    // Schedule: 0 */4 * * * = At minute 0 past every 4th hour
    cron.schedule('0 */4 * * *', async () => {
      try {
        console.log('⏰ Running scheduled reminder follow-up job...');
        await followUpService.processReminderFollowUps();
        console.log('✅ Reminder follow-up job completed successfully');
      } catch (error) {
        console.error('❌ Error in reminder follow-up job:', error);
      }
    }, {
      timezone: 'America/New_York' // EST/EDT timezone for business hours relevance
    });

    // Additional job to run during business hours (9 AM - 5 PM EST)
    // Schedule: 0 9-17/2 * * 1-5 = Every 2 hours from 9 AM to 5 PM, Monday to Friday
    cron.schedule('0 9-17/2 * * 1-5', async () => {
      try {
        console.log('⏰ Running business hours reminder follow-up job...');
        await followUpService.processReminderFollowUps();
        console.log('✅ Business hours reminder job completed successfully');
      } catch (error) {
        console.error('❌ Error in business hours reminder job:', error);
      }
    }, {
      timezone: 'America/New_York'
    });

    this.reminderJobStarted = true;
    console.log('✅ Reminder job scheduler started successfully');
    console.log('📋 Scheduled jobs:');
    console.log('   • Every 4 hours: General reminder processing');
    console.log('   • Every 2 hours (9AM-5PM, Mon-Fri EST): Business hours processing');
  }

  /**
   * Stop all reminder jobs (for testing or shutdown)
   */
  static stopReminderJobs(): void {
    cron.getTasks().forEach((task) => {
      task.destroy();
    });
    this.reminderJobStarted = false;
    console.log('⏹️ All reminder jobs stopped');
  }

  /**
   * Run a manual reminder job execution (for testing)
   */
  static async runManualReminderJob(): Promise<void> {
    console.log('🔄 Running manual reminder follow-up job...');
    try {
      await followUpService.processReminderFollowUps();
      console.log('✅ Manual reminder job completed successfully');
    } catch (error) {
      console.error('❌ Error in manual reminder job:', error);
      throw error;
    }
  }

  /**
   * Get status of reminder jobs
   */
  static getReminderJobStatus(): { 
    isRunning: boolean; 
    activeJobs: number; 
    nextRuns: string[] 
  } {
    const tasks = cron.getTasks();
    const nextRuns: string[] = [];
    
    tasks.forEach((task, name) => {
      try {
        // Note: node-cron doesn't expose next run time directly
        // This is a placeholder for job status
        nextRuns.push(`Job ${name}: Active`);
      } catch (error) {
        nextRuns.push(`Job ${name}: Error`);
      }
    });

    return {
      isRunning: this.reminderJobStarted,
      activeJobs: tasks.size,
      nextRuns
    };
  }
}

export const reminderJobs = ReminderJobs;