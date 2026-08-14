import { storage } from "./storage";
import { TemplateService } from "./templateService";
import type { WeeklyReportData } from "./emailTemplates";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";

export async function generateWeeklyReportData(): Promise<WeeklyReportData> {
  // Get all deals for analysis
  const allDeals = await storage.getAllDeals();
  
  // Calculate date ranges
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  
  // Filter deals by date ranges
  const newDealsThisWeek = allDeals.filter(deal => {
    const dealDate = deal.createdAt ? new Date(deal.createdAt) : new Date();
    return dealDate >= lastWeekStart && dealDate <= weekEnd;
  });
  
  // Calculate deal status counts
  const pursuingDeals = allDeals.filter(d => d.classification === "green" || d.status === "approved").length;
  const reviewingDeals = allDeals.filter(d => d.status === "pending_review" || d.status === "under_review").length;
  const passedDeals = allDeals.filter(d => d.classification === "red" || d.status === "rejected" || d.status === "clear_no").length;
  
  // Get high priority deals (green classification)
  const highPriorityDeals = allDeals.filter(d => d.classification === "green");
  
  // Calculate broker performance (simplified)
  const brokerStats = new Map<string, { name: string; email: string; dealCount: number }>();
  
  for (const deal of newDealsThisWeek) {
    const brokerEmail = `broker-${deal.brokerId}@example.com`; // Placeholder since we don't have email in Deal
    const existing = brokerStats.get(brokerEmail);
    if (existing) {
      existing.dealCount++;
    } else {
      brokerStats.set(brokerEmail, {
        name: `Broker ${deal.brokerId.slice(-4)}`,
        email: brokerEmail,
        dealCount: 1
      });
    }
  }
  
  const topPerformingBrokers = Array.from(brokerStats.values())
    .sort((a, b) => b.dealCount - a.dealCount)
    .slice(0, 5);
  
  // Calculate market insights
  const dealsWithPrices = allDeals.filter(d => d.totalProjectCost && !isNaN(parseFloat(d.totalProjectCost)));
  const dealsWithAcreage = allDeals.filter(d => d.sizeAcres && !isNaN(parseFloat(d.sizeAcres)));
  const dealsWithZoning = allDeals.filter(d => d.zoning);
  
  const averageAskingPrice = dealsWithPrices.length > 0 
    ? dealsWithPrices.reduce((sum, d) => sum + parseFloat(d.totalProjectCost!), 0) / dealsWithPrices.length 
    : 0;
  
  const averageAcreage = dealsWithAcreage.length > 0
    ? Math.round((dealsWithAcreage.reduce((sum, d) => sum + parseFloat(d.sizeAcres!), 0) / dealsWithAcreage.length) * 10) / 10
    : 0;
  
  // Find most common zoning
  const zoningCounts = new Map<string, number>();
  dealsWithZoning.forEach(deal => {
    const zoning = deal.zoning!;
    zoningCounts.set(zoning, (zoningCounts.get(zoning) || 0) + 1);
  });
  
  const mostCommonZoning = zoningCounts.size > 0 
    ? Array.from(zoningCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
    : 'N/A';
  
  const sewerAvailabilityRate = allDeals.length > 0 
    ? (allDeals.filter(d => d.sewerAvailable).length / allDeals.length) * 100 
    : 0;
  
  // Generate upcoming actions
  const upcomingActions = [
    ...highPriorityDeals.slice(0, 3).map(deal => ({
      action: "Follow up on high-priority opportunity",
      dealAddress: deal.address,
      deadline: format(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), "MMM dd, yyyy") // 3 days from now
    })),
    ...reviewingDeals > 0 ? [{
      action: `Complete analysis on ${reviewingDeals} deal${reviewingDeals !== 1 ? 's' : ''} under review`,
      dealAddress: "Various properties",
      deadline: format(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), "MMM dd, yyyy") // 2 days from now
    }] : []
  ];
  
  return {
    weekStart: format(weekStart, "MMM dd, yyyy"),
    weekEnd: format(weekEnd, "MMM dd, yyyy"),
    totalDeals: allDeals.length,
    newDeals: newDealsThisWeek.length,
    pursuingDeals,
    reviewingDeals,
    passedDeals,
    topPerformingBrokers,
    highPriorityDeals,
    upcomingActions,
    marketInsights: {
      averageAskingPrice,
      averageAcreage,
      mostCommonZoning,
      sewerAvailabilityRate
    }
  };
}

export async function createWeeklyReport(): Promise<{ subject: string; html: string; text: string }> {
  const reportData = await generateWeeklyReportData();
  
  // Use template from outreach management instead of hardcoded template
  const template = await TemplateService.getEmailTemplate('weekly_report', {
    weekStart: reportData.weekStart,
    weekEnd: reportData.weekEnd,
    totalDeals: reportData.totalDeals.toString(),
    newDeals: reportData.newDeals.toString(),
    pursuingDeals: reportData.pursuingDeals.toString(),
    reviewingDeals: reportData.reviewingDeals.toString(),
    passedDeals: reportData.passedDeals.toString(),
    topBrokers: reportData.topPerformingBrokers.map(b => `${b.name}: ${b.dealCount} deals`).join(', '),
    averagePrice: reportData.marketInsights.averageAskingPrice.toLocaleString(),
    averageAcreage: reportData.marketInsights.averageAcreage.toString(),
    commonZoning: reportData.marketInsights.mostCommonZoning,
    sewerRate: reportData.marketInsights.sewerAvailabilityRate.toFixed(1)
  });
  
  if (template) {
    return {
      subject: template.subject,
      html: template.html, // templateService always returns properly formatted HTML with logo/blue line/footer
      text: template.content
    };
  }
  
  // Fallback if template not configured - should not be needed if outreach management is set up
  return {
    subject: `Weekly Deal Pipeline Report - ${reportData.weekStart} to ${reportData.weekEnd}`,
    html: `<h1>Weekly Report</h1><p>Total Deals: ${reportData.totalDeals}</p><p>[Template weekly_report not configured in outreach management]</p>`,
    text: `Weekly Report: ${reportData.totalDeals} total deals. [Template weekly_report not configured in outreach management]`
  };
}