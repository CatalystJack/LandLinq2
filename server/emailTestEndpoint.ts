// Email Test Endpoint - Direct test of email functionality
import { sendNotificationEmail } from './emailService';

export class EmailTestEndpoint {
  
  static setupTestEndpoint(app: any) {
    console.log('🧪 Setting up email test endpoint');
    
    // Test endpoint to verify email functionality
    app.post('/api/test-email', async (req: any, res: any) => {
      try {
        console.log('🧪 Testing email functionality...');
        
        const testEmail = req.body.email || 'test@example.com';
        
        const result = await sendNotificationEmail({
          to: testEmail,
          subject: 'LandLinq Email Test - System Check',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #0A2B4A; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">✅ Email System Working!</h1>
              </div>
              <div style="padding: 30px;">
                <h2>Email Test Successful</h2>
                <p>This email confirms that the LandLinq notification system is working correctly.</p>
                <p><strong>Test Time:</strong> ${new Date().toISOString()}</p>
                <p><strong>System:</strong> LandLinq Deal Processing</p>
              </div>
            </div>
          `,
          type: 'status_update',
          priority: 'medium'
        });
        
        if (result) {
          console.log('✅ Email test successful');
          res.json({
            success: true,
            message: 'Email sent successfully',
            timestamp: new Date().toISOString()
          });
        } else {
          console.log('❌ Email test failed');
          res.status(500).json({
            success: false,
            message: 'Email failed to send'
          });
        }
        
      } catch (error) {
        console.error('❌ Email test endpoint error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    console.log('✅ Email test endpoint configured at POST /api/test-email');
  }
}