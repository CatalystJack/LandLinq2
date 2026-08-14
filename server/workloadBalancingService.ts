import { db } from './db';
import {
  reviewQueue,
  reviewAssignments,
  reviewActions,
  users
} from '@shared/schema';
import { eq, desc, and, gte, lte, sql, count, avg } from 'drizzle-orm';

/**
 * Service for managing analyst workload distribution and review metrics
 */
export class WorkloadBalancingService {

  // Team members for assignment rotation (from analyst-dashboard.tsx)
  private static AVAILABLE_ANALYSTS = [
    { id: "austin-blondell", name: "Austin Blondell", email: "austin@landlinq.ai" },
    { id: "davis-hammond", name: "Davis Hammond", email: "davis@landlinq.ai" },
    { id: "steve-hillebrand", name: "Steve Hillebrand", email: "steve@landlinq.ai" },
    { id: "john-bell", name: "John Bell", email: "john@landlinq.ai" },
    { id: "mallie-colavita", name: "Mallie Colavita", email: "mallie@landlinq.ai" }
  ];

  /**
   * Get current workload statistics for all analysts
   */
  static async getWorkloadStatistics(): Promise<{
    analysts: Array<{
      id: string;
      name: string;
      email: string;
      activeReviews: number;
      completedToday: number;
      averageReviewTime: number; // minutes
      currentWorkload: 'light' | 'moderate' | 'heavy';
      pendingCritical: number;
      pendingHigh: number;
    }>;
    queueMetrics: {
      totalPending: number;
      unassigned: number;
      overdue: number;
      averageWaitTime: number; // hours
      throughputToday: number;
    };
    recommendations: string[];
  }> {
    try {
      console.log('📊 Calculating workload statistics for all analysts');
      
      const analysts = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Calculate metrics for each analyst
      for (const analyst of this.AVAILABLE_ANALYSTS) {
        const workloadData = await this.calculateAnalystWorkload(analyst.id, today);
        analysts.push({
          ...analyst,
          ...workloadData
        });
      }
      
      // Calculate overall queue metrics
      const queueMetrics = await this.calculateQueueMetrics(today);
      
      // Generate workload recommendations
      const recommendations = this.generateWorkloadRecommendations(analysts, queueMetrics);
      
      return {
        analysts,
        queueMetrics,
        recommendations
      };
      
    } catch (error) {
      console.error('❌ Error calculating workload statistics:', error);
      throw error;
    }
  }
  
  /**
   * Calculate detailed workload metrics for a specific analyst
   */
  private static async calculateAnalystWorkload(analystId: string, todayStart: Date): Promise<{
    activeReviews: number;
    completedToday: number;
    averageReviewTime: number;
    currentWorkload: 'light' | 'moderate' | 'heavy';
    pendingCritical: number;
    pendingHigh: number;
  }> {
    try {
      // Active reviews (assigned but not completed)
      const activeReviewsResult = await db
        .select({ count: count() })
        .from(reviewQueue)
        .where(and(
          eq(reviewQueue.assignedAnalyst, analystId),
          sql`status IN ('assigned', 'in_review', 'needs_more_info')`
        ));
      
      const activeReviews = activeReviewsResult[0]?.count || 0;
      
      // Reviews completed today
      const completedTodayResult = await db
        .select({ count: count() })
        .from(reviewQueue)
        .where(and(
          eq(reviewQueue.assignedAnalyst, analystId),
          sql`status IN ('approved', 'rejected', 'completed')`,
          gte(reviewQueue.reviewCompletedAt, todayStart)
        ));
      
      const completedToday = completedTodayResult[0]?.count || 0;
      
      // Average review time from completed reviews in last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const avgTimeResult = await db
        .select({
          avgTime: avg(sql`EXTRACT(EPOCH FROM (review_completed_at - review_started_at)) / 60`)
        })
        .from(reviewQueue)
        .where(and(
          eq(reviewQueue.assignedAnalyst, analystId),
          sql`status IN ('approved', 'rejected', 'completed')`,
          gte(reviewQueue.reviewCompletedAt, sevenDaysAgo),
          sql`review_started_at IS NOT NULL AND review_completed_at IS NOT NULL`
        ));
      
      const averageReviewTime = Math.round(parseFloat(avgTimeResult[0]?.avgTime?.toString() || '0'));
      
      // Count pending critical and high priority reviews
      const criticalResult = await db
        .select({ count: count() })
        .from(reviewQueue)
        .where(and(
          eq(reviewQueue.assignedAnalyst, analystId),
          eq(reviewQueue.priority, 'critical'),
          sql`status IN ('assigned', 'in_review', 'needs_more_info')`
        ));
      
      const highResult = await db
        .select({ count: count() })
        .from(reviewQueue)
        .where(and(
          eq(reviewQueue.assignedAnalyst, analystId),
          eq(reviewQueue.priority, 'high'),
          sql`status IN ('assigned', 'in_review', 'needs_more_info')`
        ));
      
      const pendingCritical = criticalResult[0]?.count || 0;
      const pendingHigh = highResult[0]?.count || 0;
      
      // Determine workload level
      let currentWorkload: 'light' | 'moderate' | 'heavy' = 'light';
      if (activeReviews >= 15 || pendingCritical >= 3) {
        currentWorkload = 'heavy';
      } else if (activeReviews >= 8 || pendingCritical >= 1) {
        currentWorkload = 'moderate';
      }
      
      return {
        activeReviews,
        completedToday,
        averageReviewTime,
        currentWorkload,
        pendingCritical,
        pendingHigh
      };
      
    } catch (error) {
      console.error(`❌ Error calculating workload for analyst ${analystId}:`, error);
      return {
        activeReviews: 0,
        completedToday: 0,
        averageReviewTime: 0,
        currentWorkload: 'light',
        pendingCritical: 0,
        pendingHigh: 0
      };
    }
  }
  
  /**
   * Calculate overall queue metrics
   */
  private static async calculateQueueMetrics(todayStart: Date): Promise<{
    totalPending: number;
    unassigned: number;
    overdue: number;
    averageWaitTime: number;
    throughputToday: number;
  }> {
    try {
      // Total pending reviews
      const totalPendingResult = await db
        .select({ count: count() })
        .from(reviewQueue)
        .where(sql`status IN ('pending_review', 'assigned', 'in_review', 'needs_more_info')`);
      
      const totalPending = totalPendingResult[0]?.count || 0;
      
      // Unassigned reviews
      const unassignedResult = await db
        .select({ count: count() })
        .from(reviewQueue)
        .where(and(
          eq(reviewQueue.status, 'pending_review'),
          sql`assigned_analyst IS NULL`
        ));
      
      const unassigned = unassignedResult[0]?.count || 0;
      
      // Overdue reviews (assigned more than 24 hours ago for critical, 48 hours for others)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dayBeforeYesterday = new Date(Date.now() - 48 * 60 * 60 * 1000);
      
      const overdueResult = await db
        .select({ count: count() })
        .from(reviewQueue)
        .where(and(
          sql`status IN ('assigned', 'in_review', 'needs_more_info')`,
          sql`
            (priority = 'critical' AND assigned_at < ${yesterday}) OR
            (priority != 'critical' AND assigned_at < ${dayBeforeYesterday})
          `
        ));
      
      const overdue = overdueResult[0]?.count || 0;
      
      // Average wait time for reviews assigned today
      const avgWaitResult = await db
        .select({
          avgWait: avg(sql`EXTRACT(EPOCH FROM (assigned_at - flagged_at)) / 3600`)
        })
        .from(reviewQueue)
        .where(and(
          gte(reviewQueue.assignedAt, todayStart),
          sql`assigned_at IS NOT NULL`
        ));
      
      const avgWaitValue = parseFloat(avgWaitResult[0]?.avgWait?.toString() || '0');
      const averageWaitTime = Math.round(avgWaitValue * 10) / 10;
      
      // Total reviews completed today (throughput)
      const throughputResult = await db
        .select({ count: count() })
        .from(reviewQueue)
        .where(and(
          sql`status IN ('approved', 'rejected', 'completed')`,
          gte(reviewQueue.reviewCompletedAt, todayStart)
        ));
      
      const throughputToday = throughputResult[0]?.count || 0;
      
      return {
        totalPending,
        unassigned,
        overdue,
        averageWaitTime,
        throughputToday
      };
      
    } catch (error) {
      console.error('❌ Error calculating queue metrics:', error);
      return {
        totalPending: 0,
        unassigned: 0,
        overdue: 0,
        averageWaitTime: 0,
        throughputToday: 0
      };
    }
  }
  
  /**
   * Generate workload recommendations based on current metrics
   */
  private static generateWorkloadRecommendations(
    analysts: any[], 
    queueMetrics: any
  ): string[] {
    const recommendations: string[] = [];
    
    // Check for overloaded analysts
    const heavyWorkloadAnalysts = analysts.filter(a => a.currentWorkload === 'heavy');
    if (heavyWorkloadAnalysts.length > 0) {
      recommendations.push(
        `High workload detected for ${heavyWorkloadAnalysts.map(a => a.name).join(', ')}. Consider redistributing reviews.`
      );
    }
    
    // Check for unassigned reviews
    if (queueMetrics.unassigned > 5) {
      recommendations.push(`${queueMetrics.unassigned} unassigned reviews need assignment.`);
    }
    
    // Check for overdue reviews
    if (queueMetrics.overdue > 0) {
      recommendations.push(`${queueMetrics.overdue} reviews are overdue and need immediate attention.`);
    }
    
    // Check for critical reviews needing priority
    const criticalBacklog = analysts.reduce((sum, a) => sum + a.pendingCritical, 0);
    if (criticalBacklog > 3) {
      recommendations.push(`${criticalBacklog} critical priority reviews need immediate assignment.`);
    }
    
    // Check for low throughput
    if (queueMetrics.throughputToday < 10 && queueMetrics.totalPending > 20) {
      recommendations.push('Low review throughput detected. Consider adding more analyst capacity.');
    }
    
    // Performance insights
    const fastAnalysts = analysts.filter(a => a.averageReviewTime > 0 && a.averageReviewTime < 30);
    if (fastAnalysts.length > 0) {
      recommendations.push(
        `Efficient analysts: ${fastAnalysts.map(a => `${a.name} (${a.averageReviewTime}min avg)`).join(', ')}`
      );
    }
    
    return recommendations;
  }
  
  /**
   * Auto-assign reviews using round-robin with workload balancing
   */
  static async autoAssignReviews(): Promise<{
    assigned: number;
    errors: number;
    assignments: Array<{ reviewId: string; analystName: string; priority: string }>;
  }> {
    console.log('🔄 Starting auto-assignment of unassigned reviews');
    
    try {
      // Get unassigned reviews ordered by priority and age
      const unassignedReviews = await db
        .select()
        .from(reviewQueue)
        .where(and(
          eq(reviewQueue.status, 'pending_review'),
          sql`assigned_analyst IS NULL`
        ))
        .orderBy(
          sql`CASE 
            WHEN priority = 'critical' THEN 1
            WHEN priority = 'high' THEN 2  
            WHEN priority = 'medium' THEN 3
            ELSE 4
          END`,
          reviewQueue.flaggedAt
        );
      
      if (unassignedReviews.length === 0) {
        console.log('✅ No unassigned reviews found');
        return { assigned: 0, errors: 0, assignments: [] };
      }
      
      // Get current workload for each analyst
      const workloadStats = await this.getWorkloadStatistics();
      
      // Filter available analysts (exclude those with heavy workload for non-critical reviews)
      const availableAnalysts = workloadStats.analysts.filter(analyst => 
        analyst.currentWorkload !== 'heavy' || analyst.pendingCritical === 0
      );
      
      if (availableAnalysts.length === 0) {
        console.log('⚠️ All analysts at capacity - critical reviews only');
        // For critical reviews, still assign to least loaded analyst
        const leastLoaded = workloadStats.analysts.sort((a, b) => a.activeReviews - b.activeReviews)[0];
        availableAnalysts.push(leastLoaded);
      }
      
      let assigned = 0;
      let errors = 0;
      const assignments: Array<{ reviewId: string; analystName: string; priority: string }> = [];
      let currentAnalystIndex = 0;
      
      for (const review of unassignedReviews) {
        try {
          // For critical reviews, assign to analyst with least critical reviews
          let selectedAnalyst;
          if (review.priority === 'critical') {
            selectedAnalyst = availableAnalysts.sort((a, b) => a.pendingCritical - b.pendingCritical)[0];
          } else {
            // Round-robin for non-critical reviews
            selectedAnalyst = availableAnalysts[currentAnalystIndex % availableAnalysts.length];
            currentAnalystIndex++;
          }
          
          // Assign the review
          await db.update(reviewQueue)
            .set({
              status: 'assigned',
              assignedAnalyst: selectedAnalyst.id,
              assignedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(reviewQueue.id, review.id));
          
          // Create assignment record
          await db.insert(reviewAssignments).values({
            reviewQueueId: review.id,
            dealId: review.dealId,
            analystId: selectedAnalyst.id,
            analystEmail: selectedAnalyst.email,
            assignedBy: 'system',
            assignmentMethod: 'auto_balanced',
            estimatedTimeMinutes: review.priority === 'critical' ? 45 : 30
          });
          
          // Log the assignment
          await db.insert(reviewActions).values({
            reviewQueueId: review.id,
            dealId: review.dealId,
            actionType: 'auto_assigned',
            analystId: 'system',
            analystName: 'Auto Assignment System',
            notes: `Auto-assigned to ${selectedAnalyst.name} using workload balancing`,
            timeSpentMinutes: 0
          });
          
          assignments.push({
            reviewId: review.id,
            analystName: selectedAnalyst.name,
            priority: review.priority || 'medium'
          });
          
          assigned++;
          console.log(`✅ Assigned review ${review.id} (${review.priority}) to ${selectedAnalyst.name}`);
          
        } catch (error) {
          console.error(`❌ Error assigning review ${review.id}:`, error);
          errors++;
        }
      }
      
      console.log(`🎯 Auto-assignment complete: ${assigned} assigned, ${errors} errors`);
      
      return { assigned, errors, assignments };
      
    } catch (error) {
      console.error('❌ Error in auto-assignment:', error);
      throw error;
    }
  }
  
  /**
   * Get analyst performance metrics for dashboard
   */
  static async getAnalystPerformanceMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    overall: {
      totalReviews: number;
      averageReviewTime: number;
      accuracy: number; // percentage
      throughput: number; // reviews per day
    };
    byAnalyst: Array<{
      id: string;
      name: string;
      reviewsCompleted: number;
      averageTime: number;
      accuracy: number;
      specialtyAreas: string[];
    }>;
    trends: {
      daily: Array<{ date: string; completed: number; avgTime: number }>;
      topPerformers: string[];
      improvementAreas: string[];
    };
  }> {
    // Implementation for detailed performance analytics
    // This would analyze review completion times, accuracy rates, etc.
    console.log('📈 Calculating analyst performance metrics');
    
    // Placeholder implementation - would calculate real metrics
    return {
      overall: {
        totalReviews: 150,
        averageReviewTime: 25,
        accuracy: 94.5,
        throughput: 8.2
      },
      byAnalyst: this.AVAILABLE_ANALYSTS.map(analyst => ({
        id: analyst.id,
        name: analyst.name,
        reviewsCompleted: Math.floor(Math.random() * 50) + 20,
        averageTime: Math.floor(Math.random() * 20) + 15,
        accuracy: Math.floor(Math.random() * 10) + 90,
        specialtyAreas: ['Address Validation', 'Demographic Analysis']
      })),
      trends: {
        daily: [],
        topPerformers: ['Austin Blondell', 'Davis Hammond'],
        improvementAreas: ['Complex property analysis', 'Source validation']
      }
    };
  }
}

// Export singleton instance
export const workloadBalancingService = WorkloadBalancingService;