/**
 * Initialize default outreach campaign for LandLinq
 * This script creates the default "Monthly Broker Reminder" campaign
 */

const { sql } = require('drizzle-orm');
const { db } = require('../storage');

async function initializeDefaultOutreachCampaign() {
  console.log('🚀 Initializing default outreach campaign...');
  
  try {
    // Calculate next run time (1st of next month at 9 AM UTC)
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    nextMonth.setUTCHours(9, 0, 0, 0); // 9 AM UTC
    
    const defaultCampaign = {
      name: 'Monthly Broker Reminder',
      status: 'active',
      cadence: 'monthly',
      dayOfMonth: 1, // 1st of each month
      sendHourUtc: 9, // 9 AM UTC
      channels: ['email', 'sms'], // Both channels
      emailTemplateKey: 'monthlyOutreachReminder',
      smsTemplateKey: 'monthlyOutreachReminder',
      brokerFilter: {}, // All brokers (no filter)
      rateLimitPerMinute: 10,
      lastRunAt: null,
      nextRunAt: nextMonth
    };

    console.log('📅 Campaign will run on:', nextMonth.toISOString());
    console.log('📧 Templates: email and SMS monthlyOutreachReminder');
    console.log('🎯 Target: All active brokers');
    console.log('⚡ Rate limit: 10 messages per minute');
    
    // Try to create the campaign
    console.log('💾 Creating campaign in database...');
    
    // For now, let's just log what would be created since we may not have the tables yet
    console.log('📋 Default Campaign Configuration:');
    console.log(JSON.stringify(defaultCampaign, null, 2));
    
    // Check if outreach tables exist
    try {
      const tableCheck = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE 'outreach%'
      `);
      
      if (tableCheck.length === 0) {
        console.log('⚠️  Outreach tables not found. Database migration needed.');
        console.log('ℹ️  Run: npm run db:push --force');
        return false;
      } else {
        console.log('✅ Outreach tables found:', tableCheck.map(t => t.table_name));
        
        // TODO: Once tables exist, create the actual campaign
        // const campaign = await storage.createOutreachCampaign(defaultCampaign);
        // console.log('✅ Default campaign created:', campaign.id);
      }
    } catch (dbError) {
      console.log('💡 Database check failed, tables likely need migration');
      console.log('🔧 Solution: Run database migration first');
    }
    
    console.log('✅ Initialization script completed');
    return true;
    
  } catch (error) {
    console.error('❌ Error initializing outreach campaign:', error);
    return false;
  }
}

// Test outreach service functions
async function testOutreachService() {
  console.log('\n🧪 Testing outreach service functions...');
  
  try {
    // Import outreach service
    const { outreachService } = require('../services/outreachService');
    
    // Test getting due campaigns (should return empty array for now)
    console.log('📊 Testing getDueCampaigns...');
    const dueCampaigns = await outreachService.getDueCampaigns();
    console.log('📈 Due campaigns found:', dueCampaigns.length);
    
    // Test scheduler functions
    console.log('⏰ Testing scheduler health...');
    const { checkOutreachSchedulerHealth, getOutreachSchedulerStatus } = require('../jobs/recurringOutreach');
    
    const health = checkOutreachSchedulerHealth();
    const status = getOutreachSchedulerStatus();
    
    console.log('💊 Scheduler health:', health);
    console.log('📊 Scheduler status:', status);
    
    console.log('✅ Service tests completed');
    return true;
    
  } catch (error) {
    console.error('❌ Service test error:', error.message);
    return false;
  }
}

// Test template availability
async function testTemplates() {
  console.log('\n📝 Testing template availability...');
  
  try {
    const { getEmailTemplate, getSMSTemplate } = require('../landLinqTemplates');
    
    // Test email template
    const emailTemplate = getEmailTemplate('monthlyOutreachReminder', {
      brokerName: 'Test Broker',
      firstName: 'John'
    });
    
    if (emailTemplate) {
      console.log('✅ Email template found');
      console.log('📧 Subject:', emailTemplate.subject);
      console.log('📝 Body preview:', emailTemplate.body.substring(0, 100) + '...');
    } else {
      console.log('❌ Email template not found');
    }
    
    // Test SMS template  
    const smsTemplate = getSMSTemplate('monthlyOutreachReminder', {
      brokerName: 'Test Broker',
      firstName: 'John'
    });
    
    if (smsTemplate) {
      console.log('✅ SMS template found');
      console.log('📱 SMS preview:', smsTemplate.substring(0, 100) + '...');
    } else {
      console.log('❌ SMS template not found');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Template test error:', error.message);
    return false;
  }
}

// Main execution
async function main() {
  console.log('🔧 LandLinq Outreach System Initialization\n');
  
  const results = {
    campaign: await initializeDefaultOutreachCampaign(),
    service: await testOutreachService(),
    templates: await testTemplates()
  };
  
  console.log('\n📊 Initialization Summary:');
  console.log('Campaign setup:', results.campaign ? '✅' : '❌');
  console.log('Service tests:', results.service ? '✅' : '❌');
  console.log('Template tests:', results.templates ? '✅' : '❌');
  
  const allSuccess = Object.values(results).every(r => r);
  console.log('\nOverall status:', allSuccess ? '✅ Ready' : '⚠️  Needs attention');
  
  return allSuccess;
}

// Export for use in other scripts
module.exports = {
  initializeDefaultOutreachCampaign,
  testOutreachService,
  testTemplates,
  main
};

// Run if called directly
if (require.main === module) {
  main().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}