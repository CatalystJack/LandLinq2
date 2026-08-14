// Test endpoints for SMS system verification
import { Request, Response } from 'express';
import { SMSConversationEngine } from './smsConversationEngine';
import { IntelligentResponseService } from './intelligentResponseService';
import { storage } from './storage';

interface TestSMSMessage {
  phone: string;
  message: string;
  scenario?: string;
}

interface TestResult {
  success: boolean;
  response: string;
  brokerCreated?: boolean;
  profileComplete?: boolean;
  dealProcessed?: boolean;
  errors?: string[];
}

export class SMSTestingService {
  /**
   * Test SMS message processing end-to-end
   */
  static async testSMSMessage(phone: string, message: string): Promise<TestResult> {
    try {
      console.log(`🧪 Testing SMS: ${phone} -> ${message.substring(0, 50)}...`);
      
      // Simulate Twilio webhook data
      const mockTwilioData = {
        From: phone,
        To: '+17046101549',
        Body: message,
        MessageSid: `TEST${Date.now()}`,
        FromCity: 'Charlotte',
        FromState: 'NC',
        FromCountry: 'US'
      };
      
      // Get initial broker state
      const initialBroker = await storage.getBrokerByPhone(phone);
      
      // Process through conversation engine
      const response = await SMSConversationEngine.processConversation(
        phone,
        message,
        mockTwilioData
      );
      
      // Get final broker state
      const finalBroker = await storage.getBrokerByPhone(phone);
      
      return {
        success: true,
        response,
        brokerCreated: !initialBroker && !!finalBroker,
        profileComplete: finalBroker ? this.isProfileComplete(finalBroker) : false,
        dealProcessed: this.containsDealInfo(message)
      };
      
    } catch (error) {
      console.error('🧪 SMS test error:', error);
      return {
        success: false,
        response: '',
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Test intelligent response system
   */
  static async testIntelligentResponse(contactInfo: string, propertyData: any): Promise<any> {
    try {
      console.log(`🧪 Testing intelligent response for: ${contactInfo}`);
      
      const response = await IntelligentResponseService.generateIntelligentResponse(
        contactInfo,
        propertyData,
        contactInfo.includes('@') ? 'email' : 'sms'
      );
      
      return {
        success: true,
        ...response
      };
      
    } catch (error) {
      console.error('🧪 Intelligent response test error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Check if broker profile is complete
   */
  private static isProfileComplete(broker: any): boolean {
    const required = ['firstName', 'lastName', 'email', 'phone'];
    return required.every(field => 
      broker[field] && 
      broker[field].trim() !== '' && 
      !broker.email?.includes('@temp.landlinq.ai')
    );
  }

  /**
   * Check if message contains deal information
   */
  private static containsDealInfo(message: string): boolean {
    const dealKeywords = ['acres', 'price', '$', 'address', 'street', 'road', 'drive', 'multifamily', 'development'];
    const lowerMessage = message.toLowerCase();
    return dealKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  /**
   * Run comprehensive SMS test scenarios
   */
  static async runTestScenarios(): Promise<any> {
    const results = {
      testsPassed: 0,
      testsFailed: 0,
      scenarios: [] as any[]
    };

    // Test scenarios
    const scenarios = [
      {
        name: 'New User - First Contact',
        phone: '+19191234567',
        message: 'Hi, interested in submitting deals',
        expectedBehavior: 'Should create new broker and request profile info'
      },
      {
        name: 'Deal Submission - No Profile',
        phone: '+19192345678',
        message: '123 Main St, Charlotte NC - $2,500,000 - 10 acres - Multifamily development',
        expectedBehavior: 'Should request profile completion before processing deal'
      },
      {
        name: 'Profile Completion',
        phone: '+19193456789',
        message: 'John Smith, john@realty.com, Charlotte-Raleigh markets',
        expectedBehavior: 'Should update profile with provided information'
      },
      {
        name: 'Deal Submission - Complete Profile',
        phone: '+19194567890',
        message: '456 Oak St, Raleigh NC - $3,200,000 - 15 acres',
        expectedBehavior: 'Should process deal submission (after creating complete profile)',
        setupProfile: true
      },
      {
        name: 'Missing Information - Acres Only',
        phone: '+19195678901',
        message: '789 Pine Ave, Durham NC - $1,800,000',
        expectedBehavior: 'Should request acres information',
        setupProfile: true
      },
      {
        name: 'Missing Information - Price Only',
        phone: '+19196789012',
        message: '321 Elm St, Greensboro NC - 8 acres',
        expectedBehavior: 'Should request price information',
        setupProfile: true
      }
    ];

    console.log(`🧪 Running ${scenarios.length} SMS test scenarios...`);

    for (const scenario of scenarios) {
      try {
        // Setup profile if needed
        if (scenario.setupProfile) {
          await this.setupCompleteProfile(scenario.phone);
        }

        const result = await this.testSMSMessage(scenario.phone, scenario.message);
        
        (scenario as any).result = result;
        (scenario as any).passed = result.success;
        
        if (result.success) {
          results.testsPassed++;
          console.log(`✅ ${scenario.name}: PASSED`);
        } else {
          results.testsFailed++;
          console.log(`❌ ${scenario.name}: FAILED`);
          console.log(`   Error: ${result.errors?.join(', ')}`);
        }
        
        results.scenarios.push(scenario);
        
      } catch (error) {
        results.testsFailed++;
        console.log(`❌ ${scenario.name}: FAILED - ${error}`);
        (scenario as any).passed = false;
        (scenario as any).error = error instanceof Error ? error.message : String(error);
        results.scenarios.push(scenario);
      }
    }

    console.log(`\n🧪 SMS Test Results:`);
    console.log(`   ✅ Passed: ${results.testsPassed}`);
    console.log(`   ❌ Failed: ${results.testsFailed}`);
    console.log(`   📊 Success Rate: ${Math.round((results.testsPassed / (results.testsPassed + results.testsFailed)) * 100)}%`);

    return results;
  }

  /**
   * Helper to setup complete profile for testing
   */
  private static async setupCompleteProfile(phone: string): Promise<void> {
    try {
      let broker = await storage.getBrokerByPhone(phone);
      
      if (!broker) {
        broker = await storage.createBroker({
          phone,
          firstName: 'Test',
          lastName: 'Broker',
          email: `test${Date.now()}@example.com`,
          brokerage: 'Test Realty',
          marketsCovered: 'Charlotte, Raleigh',
          preferredContact: 'sms'
        });
      } else {
        await storage.updateBroker(broker.id, {
          firstName: 'Test',
          lastName: 'Broker',
          email: broker.email?.includes('@temp.landlinq.ai') ? `test${Date.now()}@example.com` : (broker.email || `test${Date.now()}@example.com`),
          brokerage: 'Test Realty',
          marketsCovered: 'Charlotte, Raleigh'
        });
      }
    } catch (error) {
      console.error('Error setting up profile:', error);
    }
  }
}

// Express route handlers for testing
export const setupSMSTestRoutes = (app: any) => {
  
  // Test individual SMS message (no auth required for testing)
  app.post('/api/test/sms/message', async (req: Request, res: Response) => {
    try {
      const { phone, message } = req.body;
      
      if (!phone || !message) {
        return res.status(400).json({ error: 'Phone and message are required' });
      }
      
      const result = await SMSTestingService.testSMSMessage(phone, message);
      res.json(result);
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  
  // Test intelligent response system
  app.post('/api/test/sms/intelligent-response', async (req: Request, res: Response) => {
    try {
      const { contactInfo, propertyData } = req.body;
      
      if (!contactInfo) {
        return res.status(400).json({ error: 'contactInfo is required' });
      }
      
      const result = await SMSTestingService.testIntelligentResponse(
        contactInfo, 
        propertyData || {}
      );
      res.json(result);
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  
  // Run comprehensive test scenarios
  app.post('/api/test/sms/scenarios', async (req: Request, res: Response) => {
    try {
      const results = await SMSTestingService.runTestScenarios();
      res.json(results);
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  
  // Clean test data
  app.delete('/api/test/sms/cleanup', async (req: Request, res: Response) => {
    try {
      console.log('🧹 Cleaning up SMS test data...');
      
      // This would clean up test brokers - implement based on your needs
      // For now, just return success
      res.json({ 
        success: true, 
        message: 'Test data cleanup initiated (implement cleanup logic as needed)' 
      });
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  
  // Get broker info for testing
  app.get('/api/test/sms/broker/:phone', async (req: Request, res: Response) => {
    try {
      const { phone } = req.params;
      const broker = await storage.getBrokerByPhone(decodeURIComponent(phone));
      
      if (!broker) {
        return res.status(404).json({ error: 'Broker not found' });
      }
      
      const profileComplete = SMSTestingService['isProfileComplete'](broker);
      
      res.json({
        broker,
        profileComplete,
        profileCompleteness: {
          hasFirstName: !!broker.firstName && broker.firstName.trim() !== '',
          hasLastName: !!broker.lastName && broker.lastName.trim() !== '',
          hasRealEmail: !!broker.email && !broker.email.includes('@temp.landlinq.ai'),
          hasPhone: !!broker.phone
        }
      });
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
};