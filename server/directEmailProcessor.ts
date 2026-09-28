import express from 'express';
import { storage } from './storage';

// Direct Email Processing System
// This bypasses the need for external email services like SendGrid
export class DirectEmailProcessor {
  
  static async setupDirectEmailEndpoint(app: express.Application) {
    // Create a direct email processing endpoint
    app.post('/api/process-email-direct', async (req, res) => {
      try {
        const { from, subject, text, to } = req.body;
        
        console.log('📧 [DIRECT] Processing email directly:', { from, to, subject });
        
        // Validate required fields
        if (!from || !text) {
          return res.status(400).json({ 
            success: false, 
            error: 'Missing required email fields' 
          });
        }

        // Process through existing unified pipeline
        const { UnifiedDealPipeline } = await import('./unifiedDealPipeline');
        
        // Convert email to deal submission format
        const submissionData = {
          // Extract basic property info from text
          address: text.includes('Address:') 
            ? text.split('Address:')[1]?.split('\n')[0]?.trim() || 'Property from email'
            : 'Property from email',
          
          // Contact info from email
          contactName: from.split('@')[0] || 'Unknown',
          contactEmail: from,
          contactPhone: '',
          
          // Submission details
          submissionMethod: 'email' as const,
          source: `Email from ${from}`,
          originalData: { from, subject, text },
          additionalDetails: text
        };
        
        const result = await UnifiedDealPipeline.processDealSubmission(submissionData);

        if (result.success) {
          console.log(`✅ [DIRECT] Deal processed successfully: ${result.dealId}`);
          res.json({
            success: true,
            dealId: result.dealId,
            classification: result.classification
          });
        } else {
          console.log(`❌ [DIRECT] Failed to process email: ${result.error}`);
          res.status(400).json({
            success: false,
            error: result.error
          });
        }

      } catch (error) {
        console.error('❌ [DIRECT] Email processing error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    });

    console.log('✅ Direct email processing endpoint configured');
  }

  // Test the direct email processing
  static async testDirectProcessing() {
    try {
      const testEmail = {
        from: 'test@direct.com',
        to: 'deals@landlinq.ai',
        subject: 'Direct Processing Test',
        text: '4312 Tantilla Cir Charlotte, NC 28215'
      };

      console.log('🧪 Testing direct email processing...');
      
      const { UnifiedDealPipeline } = await import('./unifiedDealPipeline');
      
      // Convert test email to deal submission format
      const submissionData = {
        address: testEmail.text || 'Test Property',
        contactName: testEmail.from.split('@')[0] || 'Test',
        contactEmail: testEmail.from,
        contactPhone: '',
        submissionMethod: 'email' as const,
        source: `Test email from ${testEmail.from}`,
        originalData: testEmail,
        additionalDetails: testEmail.text
      };
      
      const result = await UnifiedDealPipeline.processDealSubmission(submissionData);

      if (result.success) {
        console.log('✅ Direct processing test PASSED');
        return true;
      } else {
        console.log('❌ Direct processing test FAILED:', result.error);
        return false;
      }
    } catch (error) {
      console.error('❌ Direct processing test ERROR:', error);
      return false;
    }
  }
}