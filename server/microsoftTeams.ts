// Microsoft Teams Integration for High-Priority Deal Notifications

interface TeamsWebhookMessage {
  text: string;
  title?: string;
  themeColor?: string;
  sections?: Array<{
    activityTitle?: string;
    activitySubtitle?: string;
    activityImage?: string;
    facts?: Array<{ name: string; value: string }>;
    markdown?: boolean;
  }>;
  potentialAction?: Array<{
    "@type": string;
    name: string;
    targets: Array<{ os: string; uri: string }>;
  }>;
}

export class MicrosoftTeamsService {
  private webhookUrls: { [email: string]: string } = {};

  // Set up webhook URLs for team members
  setWebhookUrl(email: string, webhookUrl: string) {
    this.webhookUrls[email] = webhookUrl;
  }

  async sendHighPriorityDealNotification(deal: any, analysisResult: any): Promise<void> {
    // DISABLED: High-priority deals now go to daily digest ONLY per user requirements
    // Individual notifications disabled - all high-priority deals included in 6 AM daily digest
    console.log(`📧 High-priority deal ${deal.address} will be included in daily digest (individual notifications disabled)`);
    return;

    // OLD CODE: Individual notifications to all team members (DISABLED)
    /*
    // Only send for green (high-priority) deals
    if (analysisResult.classification !== 'green') {
      return;
    }

    const teamEmails = [
      'aj@catalystcp.com',
      'austin@catalystcp.com', 
      'davis@catalystcp.com',
      'brian@catalystcp.com',
      'steve@catalystcp.com',
      'mallie@catalystcp.com'
    ];

    const message: TeamsWebhookMessage = {
      title: "🚨 HIGH-PRIORITY DEAL ALERT",
      themeColor: "28a745", // Green color
      text: `A high-priority land deal has been submitted and needs immediate attention!`,
      sections: [
        {
          activityTitle: `New Deal: ${deal.address}`,
          activitySubtitle: `From ${deal.firstName} ${deal.lastName} (${deal.email})`,
          facts: [
            { name: "📍 Location", value: deal.address },
            { name: "📏 Size", value: `${deal.sizeAcres} acres` },
            { name: "💰 Price", value: `$${parseFloat(deal.askingPrice || 0).toLocaleString()}` },
            { name: "🏗️ Zoning", value: deal.zoning || 'Not specified' },
            { name: "🚰 Sewer", value: deal.sewerAvailable ? 'Available' : 'Not available' },
            { name: "🤖 AI Score", value: `${analysisResult.score}/100` },
            { name: "Contact", value: deal.phone || 'Not provided' }
          ],
          markdown: true
        },
        {
          activityTitle: "AI Analysis",
          activitySubtitle: analysisResult.reasoning,
          markdown: true
        }
      ],
      potentialAction: [
        {
          "@type": "OpenUri",
          name: "View Deal in LandLinq",
          targets: [
            {
              os: "default",
              uri: `https://landlinq.ai/analyst-dashboard`
            }
          ]
        }
      ]
    };

    // Send to each team member's webhook URL
    for (const email of teamEmails) {
      const webhookUrl = this.webhookUrls[email];
      if (webhookUrl) {
        try {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(message)
          });

          if (!response.ok) {
            console.error(`Failed to send Teams notification to ${email}:`, response.statusText);
          } else {
            console.log(`High-priority deal notification sent to ${email} via Teams`);
          }
        } catch (error) {
          console.error(`Error sending Teams notification to ${email}:`, error);
        }
      } else {
        console.log(`No Teams webhook configured for ${email}`);
      }
    }
    */
  }

  async sendWeeklyReport(reportData: any): Promise<void> {
    const teamEmails = [
      'aj@catalystcp.com',
      'austin@catalystcp.com', 
      'davis@catalystcp.com',
      'brian@catalystcp.com',
      'steve@catalystcp.com',
      'mallie@catalystcp.com'
    ];

    const message: TeamsWebhookMessage = {
      title: "📊 LandLinq Weekly Report",
      themeColor: "3b82f6", // Blue color
      text: `Here's your weekly LandLinq activity summary:`,
      sections: [
        {
          activityTitle: "Deal Activity This Week",
          facts: [
            { name: "📝 New Deals", value: reportData.newDealsCount.toString() },
            { name: "✅ Approved", value: reportData.approvedCount.toString() },
            { name: "❌ Rejected", value: reportData.rejectedCount.toString() },
            { name: "⏳ Under Review", value: reportData.pendingCount.toString() },
            { name: "💰 Total Deal Value", value: `$${reportData.totalValue.toLocaleString()}` },
            { name: "👥 Active Brokers", value: reportData.activeBrokersCount.toString() }
          ],
          markdown: true
        }
      ],
      potentialAction: [
        {
          "@type": "OpenUri",
          name: "View Full Report",
          targets: [
            {
              os: "default", 
              uri: `https://landlinq.ai/analyst-dashboard`
            }
          ]
        }
      ]
    };

    // Send weekly report to team
    for (const email of teamEmails) {
      const webhookUrl = this.webhookUrls[email];
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(message)
          });
          console.log(`Weekly report sent to ${email} via Teams`);
        } catch (error) {
          console.error(`Error sending weekly report to ${email}:`, error);
        }
      }
    }
  }
}

export const teamsService = new MicrosoftTeamsService();