/**
 * Microsoft Teams integration service for LandLinq
 * Sends notifications to Teams channels for internal team communication
 */

interface TeamsNotification {
  title: string;
  text: string;
  dealId?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  type: 'deal_submission' | 'deal_approval' | 'team_assignment' | 'commission' | 'system' | 'alert';
  address?: string;
  broker?: string;
  analyst?: string;
  value?: string;
}

class TeamsService {
  private webhookUrl: string | undefined;

  constructor() {
    this.webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  }

  /**
   * Send a notification to the configured Teams channel
   */
  async sendNotification(notification: TeamsNotification): Promise<boolean> {
    try {
      if (!this.webhookUrl) {
        console.log(`🟡 Teams webhook not configured - notification skipped: ${notification.title}`);
        return false;
      }

      const message = this.createTeamsMessage(notification);
      
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });

      if (response.ok) {
        console.log(`🔔 Teams notification sent: ${notification.title}`);
        return true;
      } else {
        console.error(`❌ Teams API error: ${response.status} ${response.statusText}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to send Teams notification:', error);
      return false;
    }
  }

  /**
   * Create Teams MessageCard format
   */
  private createTeamsMessage(notification: TeamsNotification) {
    const color = this.getPriorityColor(notification.priority);
    const icon = this.getTypeIcon(notification.type);

    return {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      "themeColor": color,
      "summary": notification.title,
      "sections": [{
        "activityTitle": `${icon} ${notification.title}`,
        "activitySubtitle": "LandLinq Platform",
        "activityImage": "https://via.placeholder.com/64x64/0A2B4A/FFFFFF?text=LL",
        "facts": this.createFacts(notification),
        "markdown": true,
        "text": notification.text
      }],
      "potentialAction": this.createActions(notification)
    };
  }

  /**
   * Create facts array for Teams message
   */
  private createFacts(notification: TeamsNotification) {
    const facts = [
      { "name": "Priority", "value": notification.priority.toUpperCase() },
      { "name": "Type", "value": notification.type.replace('_', ' ').toUpperCase() },
      { "name": "Time", "value": new Date().toLocaleString() }
    ];

    if (notification.address) {
      facts.push({ "name": "Property", "value": notification.address });
    }

    if (notification.broker) {
      facts.push({ "name": "Broker", "value": notification.broker });
    }

    if (notification.analyst) {
      facts.push({ "name": "Assigned To", "value": notification.analyst });
    }

    if (notification.value) {
      facts.push({ "name": "Value", "value": notification.value });
    }

    return facts;
  }

  /**
   * Create action buttons for Teams message
   */
  private createActions(notification: TeamsNotification) {
    const actions = [{
      "@type": "OpenUri",
      "name": "Open LandLinq Platform",
      "targets": [{
        "os": "default",
        "uri": "https://landlinq.ai"
      }]
    }];

    if (notification.dealId) {
      actions.unshift({
        "@type": "OpenUri",
        "name": "View Deal Details",
        "targets": [{
          "os": "default",
          "uri": `https://landlinq.ai/admin?deal=${notification.dealId}`
        }]
      });
    }

    return actions;
  }

  /**
   * Get color based on priority
   */
  private getPriorityColor(priority: string): string {
    switch (priority) {
      case 'urgent': return 'FF0000'; // Red
      case 'high': return 'FFA500';   // Gold/Amber (was Orange)
      case 'medium': return '0A2B4A'; // Navy (brand color)
      case 'low': return '6B7280';    // Gray
      default: return '0A2B4A';       // Default to brand color
    }
  }

  /**
   * Get icon based on notification type
   */
  private getTypeIcon(type: string): string {
    switch (type) {
      case 'deal_submission': return '📝';
      case 'deal_approval': return '✅';
      case 'team_assignment': return '👥';
      case 'commission': return '💰';
      case 'alert': return '🚨';
      case 'system': return '⚙️';
      default: return '📋';
    }
  }

  /**
   * Convenience methods for specific notification types
   */
  async notifyNewDeal(dealId: string, address: string, broker: string, classification: string): Promise<boolean> {
    const priority = classification === 'green' ? 'high' : classification === 'yellow' ? 'medium' : 'low';
    
    return this.sendNotification({
      title: `New ${classification.toUpperCase()} Deal Submitted`,
      text: `**${broker}** submitted a new deal that has been classified as **${classification.toUpperCase()}** priority.\n\n**Property:** ${address}\n\nThe deal has been automatically routed to the appropriate team for review.`,
      dealId,
      priority: priority as any,
      type: 'deal_submission',
      address,
      broker
    });
  }

  async notifyDealApproval(dealId: string, address: string, analyst: string): Promise<boolean> {
    return this.sendNotification({
      title: 'Deal Approved for Acquisition',
      text: `**${address}** has been approved and is moving forward in the acquisition pipeline.\n\n**Analyst:** ${analyst}\n\nNext steps: Due diligence and contract preparation.`,
      dealId,
      priority: 'high',
      type: 'deal_approval',
      address,
      analyst
    });
  }

  async notifyTeamAssignment(dealId: string, address: string, analyst: string, developer: string, partner: string): Promise<boolean> {
    return this.sendNotification({
      title: 'New Deal Team Assignment',
      text: `A new deal has been assigned to the team for evaluation.\n\n**Property:** ${address}\n**Analyst:** ${analyst}\n**Developer:** ${developer}\n**Partner:** ${partner}`,
      dealId,
      priority: 'medium',
      type: 'team_assignment',
      address,
      analyst
    });
  }

  async notifyCommissionMilestone(broker: string, milestone: string, amount: string): Promise<boolean> {
    return this.sendNotification({
      title: 'Commission Milestone Reached',
      text: `**${broker}** has reached a commission milestone!\n\n**Milestone:** ${milestone}\n**Amount:** ${amount}`,
      priority: 'medium',
      type: 'commission',
      broker,
      value: amount
    });
  }

  async notifySystemAlert(title: string, message: string, priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'): Promise<boolean> {
    return this.sendNotification({
      title,
      text: message,
      priority,
      type: 'system'
    });
  }
}

export const teamsService = new TeamsService();
export default teamsService;