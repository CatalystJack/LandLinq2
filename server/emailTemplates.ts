import { Deal } from "@shared/schema";

export interface WeeklyReportData {
  weekStart: string;
  weekEnd: string;
  totalDeals: number;
  newDeals: number;
  pursuingDeals: number;
  reviewingDeals: number;
  passedDeals: number;
  topPerformingBrokers: Array<{
    name: string;
    email: string;
    dealCount: number;
  }>;
  highPriorityDeals: Deal[];
  upcomingActions: Array<{
    action: string;
    dealAddress: string;
    deadline: string;
  }>;
  marketInsights: {
    averageAskingPrice: number;
    averageAcreage: number;
    mostCommonZoning: string;
    sewerAvailabilityRate: number;
  };
}

export function generateWeeklyReportEmail(data: WeeklyReportData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Weekly Deal Pipeline Report - ${data.weekStart} to ${data.weekEnd}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 800px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #0A2B4A 0%, #4A90E2 100%); color: white; padding: 40px 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .header p { margin: 10px 0 0; font-size: 16px; opacity: 0.9; }
    .content { padding: 30px; }
    .section { margin-bottom: 40px; }
    .section-title { font-size: 20px; font-weight: 600; color: #0A2B4A; margin-bottom: 20px; border-bottom: 2px solid #4A90E2; padding-bottom: 8px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .stat-card { background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #4A90E2; }
    .stat-number { font-size: 28px; font-weight: 700; color: #0A2B4A; margin-bottom: 5px; }
    .stat-label { font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .deal-item { background: #f8fafc; padding: 15px; margin-bottom: 12px; border-radius: 6px; border-left: 4px solid #22c55e; }
    .deal-address { font-weight: 600; color: #0A2B4A; margin-bottom: 5px; }
    .deal-details { font-size: 14px; color: #64748b; }
    .broker-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
    .broker-name { font-weight: 500; color: #0A2B4A; }
    .broker-count { background: #4A90E2; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .action-item { background: #fef3c7; padding: 12px; margin-bottom: 10px; border-radius: 6px; border-left: 4px solid #f59e0b; }
    .action-text { font-weight: 500; color: #92400e; margin-bottom: 3px; }
    .action-deadline { font-size: 12px; color: #a16207; }
    .market-insights { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
    .insight-item { text-align: center; }
    .insight-value { font-size: 24px; font-weight: 700; color: #4A90E2; }
    .insight-label { font-size: 12px; color: #64748b; margin-top: 5px; }
    .footer { background: #0A2B4A; color: white; padding: 20px 30px; text-align: center; }
    .footer p { margin: 0; font-size: 14px; opacity: 0.8; }
    @media (max-width: 600px) {
      .stats-grid { grid-template-columns: 1fr 1fr; }
      .content { padding: 20px; }
      .header { padding: 30px 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Weekly Pipeline Report</h1>
      <p>Deal Analysis & Market Summary • ${data.weekStart} - ${data.weekEnd}</p>
    </div>

    <div class="content">
      <!-- Executive Summary -->
      <div class="section">
        <h2 class="section-title">Executive Summary</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">${data.totalDeals}</div>
            <div class="stat-label">Total Active Deals</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${data.newDeals}</div>
            <div class="stat-label">New This Week</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${data.pursuingDeals}</div>
            <div class="stat-label">Pursuing</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${data.reviewingDeals}</div>
            <div class="stat-label">Under Review</div>
          </div>
        </div>
      </div>

      <!-- High Priority Deals -->
      <div class="section">
        <h2 class="section-title">High Priority Opportunities</h2>
        ${data.highPriorityDeals.length === 0 ? 
          '<p style="color: #64748b; font-style: italic;">No high priority deals this week.</p>' :
          data.highPriorityDeals.slice(0, 5).map(deal => `
            <div class="deal-item">
              <div class="deal-address">${deal.address}</div>
              <div class="deal-details">
                ${deal.askingPrice ? `$${parseInt(deal.askingPrice).toLocaleString()}` : 'Price TBD'} • 
                ${deal.sizeAcres} acres • 
                ${deal.zoning || 'Zoning TBD'} • 
                Sewer: ${deal.sewerAvailable ? 'Available' : 'Not Available'}
              </div>
            </div>
          `).join('')
        }
      </div>

      <!-- Top Performing Brokers -->
      <div class="section">
        <h2 class="section-title">Top Contributing Brokers</h2>
        ${data.topPerformingBrokers.length === 0 ? 
          '<p style="color: #64748b; font-style: italic;">No broker activity this week.</p>' :
          data.topPerformingBrokers.map(broker => `
            <div class="broker-item">
              <div class="broker-name">${broker.name || broker.email}</div>
              <div class="broker-count">${broker.dealCount} deal${broker.dealCount !== 1 ? 's' : ''}</div>
            </div>
          `).join('')
        }
      </div>

      <!-- Market Insights -->
      <div class="section">
        <h2 class="section-title">Market Insights</h2>
        <div class="market-insights">
          <div class="insight-item">
            <div class="insight-value">$${Math.round(data.marketInsights.averageAskingPrice / 1000)}K</div>
            <div class="insight-label">Avg. Asking Price</div>
          </div>
          <div class="insight-item">
            <div class="insight-value">${data.marketInsights.averageAcreage}</div>
            <div class="insight-label">Avg. Acreage</div>
          </div>
          <div class="insight-item">
            <div class="insight-value">${data.marketInsights.mostCommonZoning}</div>
            <div class="insight-label">Top Zoning Type</div>
          </div>
          <div class="insight-item">
            <div class="insight-value">${Math.round(data.marketInsights.sewerAvailabilityRate)}%</div>
            <div class="insight-label">Sewer Available</div>
          </div>
        </div>
      </div>

      <!-- Upcoming Actions -->
      <div class="section">
        <h2 class="section-title">Week Ahead - Action Items</h2>
        ${data.upcomingActions.length === 0 ? 
          '<p style="color: #64748b; font-style: italic;">No scheduled actions for the upcoming week.</p>' :
          data.upcomingActions.map(action => `
            <div class="action-item">
              <div class="action-text">${action.action}</div>
              <div style="font-size: 14px; color: #92400e; margin-bottom: 3px;">${action.dealAddress}</div>
              <div class="action-deadline">Due: ${action.deadline}</div>
            </div>
          `).join('')
        }
      </div>
    </div>

    <div class="footer">
      <p>© ${new Date().getFullYear()} Catalyst Capital Partners • Automated Weekly Report</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
WEEKLY DEAL PIPELINE REPORT
${data.weekStart} - ${data.weekEnd}

EXECUTIVE SUMMARY
================
Total Active Deals: ${data.totalDeals}
New This Week: ${data.newDeals}
Pursuing: ${data.pursuingDeals}
Under Review: ${data.reviewingDeals}
Passed: ${data.passedDeals}

HIGH PRIORITY OPPORTUNITIES
===========================
${data.highPriorityDeals.length === 0 ? 
  'No high priority deals this week.' :
  data.highPriorityDeals.slice(0, 5).map(deal => 
    `• ${deal.address}\n  ${deal.askingPrice ? `$${parseInt(deal.askingPrice).toLocaleString()}` : 'Price TBD'} • ${deal.sizeAcres} acres • ${deal.zoning || 'Zoning TBD'} • Sewer: ${deal.sewerAvailable ? 'Available' : 'Not Available'}`
  ).join('\n\n')
}

TOP CONTRIBUTING BROKERS
========================
${data.topPerformingBrokers.length === 0 ? 
  'No broker activity this week.' :
  data.topPerformingBrokers.map(broker => 
    `• ${broker.name || broker.email}: ${broker.dealCount} deal${broker.dealCount !== 1 ? 's' : ''}`
  ).join('\n')
}

MARKET INSIGHTS
===============
Average Asking Price: $${Math.round(data.marketInsights.averageAskingPrice / 1000)}K
Average Acreage: ${data.marketInsights.averageAcreage}
Most Common Zoning: ${data.marketInsights.mostCommonZoning}
Sewer Availability Rate: ${Math.round(data.marketInsights.sewerAvailabilityRate)}%

WEEK AHEAD - ACTION ITEMS
=========================
${data.upcomingActions.length === 0 ? 
  'No scheduled actions for the upcoming week.' :
  data.upcomingActions.map(action => 
    `• ${action.action}\n  ${action.dealAddress} - Due: ${action.deadline}`
  ).join('\n\n')
}

---
© ${new Date().getFullYear()} Catalyst Capital Partners
Automated Weekly Report
  `;

  return { subject, html, text };
}