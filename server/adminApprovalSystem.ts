import { storage } from "./storage";
import { emailService } from "./emailService";

export class AdminApprovalSystem {
  // Get pending broker approvals
  async getPendingBrokerApprovals() {
    try {
      const brokers = await storage.getAllBrokers();
      return brokers.filter(broker => !broker.isActive);
    } catch (error) {
      console.error("Error fetching pending approvals:", error);
      return [];
    }
  }

  // Approve broker
  async approveBroker(brokerId: string, approvedBy: string): Promise<boolean> {
    try {
      const broker = await storage.getBrokerById(brokerId);
      if (!broker) {
        throw new Error("Broker not found");
      }

      // Update broker status
      await storage.updateBroker(brokerId, { 
        isActive: true
      });

      // Send approval email
      await this.sendBrokerApprovalEmail(broker);

      console.log(`Broker ${broker.email} approved by ${approvedBy}`);
      return true;
    } catch (error) {
      console.error("Error approving broker:", error);
      return false;
    }
  }

  // Reject broker
  async rejectBroker(brokerId: string, rejectedBy: string, reason?: string): Promise<boolean> {
    try {
      const broker = await storage.getBrokerById(brokerId);
      if (!broker) {
        throw new Error("Broker not found");
      }

      // Update broker with rejection info
      await storage.updateBroker(brokerId, {
        isActive: false
      });

      // Send rejection email
      await this.sendBrokerRejectionEmail(broker, reason);

      console.log(`Broker ${broker.email} rejected by ${rejectedBy}`);
      return true;
    } catch (error) {
      console.error("Error rejecting broker:", error);
      return false;
    }
  }

  // Send broker approval email
  private async sendBrokerApprovalEmail(broker: any): Promise<void> {
    const subject = "Welcome to LandLinq - Your Account Has Been Approved!";
    
    // Use centralized email template
    await emailService.sendBrokerApprovalEmail(broker);

    // Log the communication
    await storage.createCommunication({
      brokerId: broker.id,
      channel: "email",
      direction: "outbound",
      rawText: "Broker approval email sent with HTML template",
      subject,
      message: "Broker approval email sent with HTML template",
      recipientEmail: broker.email,
      status: "sent" // Broker approval, not a follow-up for missing info
    });
  }

  // Send broker rejection email
  private async sendBrokerRejectionEmail(broker: any, reason?: string): Promise<void> {
    const subject = "LandLinq Account Application Update";
    
    // Use centralized email template
    await emailService.sendBrokerRejectionEmail(broker, reason);

    // Log the communication
    await storage.createCommunication({
      brokerId: broker.id,
      channel: "email",
      direction: "outbound",
      rawText: "Broker rejection email sent with HTML template",
      subject,
      message: "Broker rejection email sent with HTML template",
      recipientEmail: broker.email,
      status: "sent" // Broker rejection, not a follow-up for missing info
    });
  }

  // Get admin dashboard stats
  async getAdminStats() {
    try {
      const [allBrokers, allDeals] = await Promise.all([
        storage.getAllBrokers(),
        storage.getAllDeals()
      ]);

      const pendingApprovals = allBrokers.filter(b => !b.isActive).length;
      const activeBrokers = allBrokers.filter(b => b.isActive).length;
      
      const thisMonth = new Date();
      thisMonth.setDate(1);
      const thisMonthDeals = allDeals.filter(d => 
        d.createdAt && new Date(d.createdAt) >= thisMonth
      ).length;

      return {
        totalBrokers: allBrokers.length,
        activeBrokers,
        pendingApprovals,
        totalDeals: allDeals.length,
        thisMonthDeals,
        highPriorityDeals: allDeals.filter(d => d.classification === 'green').length,
        approvalRate: allBrokers.length > 0 ? (activeBrokers / allBrokers.length * 100).toFixed(1) : 0
      };
    } catch (error) {
      console.error("Error getting admin stats:", error);
      return {
        totalBrokers: 0,
        activeBrokers: 0,
        pendingApprovals: 0,
        totalDeals: 0,
        thisMonthDeals: 0,
        highPriorityDeals: 0,
        approvalRate: 0
      };
    }
  }
}

export const adminApprovalSystem = new AdminApprovalSystem();