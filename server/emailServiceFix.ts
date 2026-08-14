// Email Service Fix - Routes emails to comprehensive EmailInboundService
import { DirectEmailProcessor } from './directEmailProcessor';

export class EmailServiceFix {
  
  static async implementFix(app: any) {
    console.log('🔧 Implementing email service fix...');
    
    // 1. Set up direct email processing
    await DirectEmailProcessor.setupDirectEmailEndpoint(app);
    
    // System is now configured for email processing
    console.log('✅ Email service fix implemented successfully');
    console.log('📧 System can now process emails directly');
    return true;
  }

  // Enhanced webhook endpoint to handle any email format - USING COMPREHENSIVE PARSER
  static async enhanceWebhookEndpoint(app: any) {
    console.log('🔧 Enhancing webhook endpoint for comprehensive email parsing...');
    
    // Use EmailInboundService for proper parsing instead of simplified handler
    const { EmailInboundService } = await import('./emailInboundService');
    
    app.post("/api/webhooks/email", async (req: any, res: any) => {
      console.log("📧 [WEBHOOK] Email received - using comprehensive parser");
      console.log("📧 [WEBHOOK] Request body keys:", Object.keys(req.body));
      console.log("📧 [WEBHOOK] Content-Type:", req.get('Content-Type'));
      
      try {
        // Use the comprehensive EmailInboundService to handle the email
        return await EmailInboundService.handleInboundEmail(req, res);
      } catch (error) {
        console.error('❌ Webhook processing error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error processing email'
        });
      }
    });

    console.log('✅ Enhanced webhook endpoint configured');
  }
}