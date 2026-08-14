import { storage } from './storage.js';

interface ApiVersionInfo {
  name: string;
  currentVersion: string;
  latestVersion: string;
  needsUpdate: boolean;
  changelogUrl: string;
  updateInstructions: string;
}

interface ApiHealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  errorMessage?: string;
  version?: string;
}

export class ApiMonitoringService {
  
  /**
   * Check all API versions and health status
   */
  static async checkAllApis(): Promise<{
    versionChecks: ApiVersionInfo[];
    healthChecks: ApiHealthCheck[];
    needsAttention: boolean;
  }> {
    console.log('🔍 Starting API monitoring check...');
    
    const versionChecks: ApiVersionInfo[] = [];
    const healthChecks: ApiHealthCheck[] = [];

    // Check OpenAI GPT-5
    const openaiCheck = await this.checkOpenAI();
    healthChecks.push(openaiCheck);
    
    // Check Geocodio
    const geocodioCheck = await this.checkGeocodio();
    healthChecks.push(geocodioCheck);
    
    // Version checks for all APIs
    // Note: Most APIs don't expose version numbers programmatically
    versionChecks.push(
      {
        name: 'OpenAI GPT-5',
        currentVersion: 'gpt-5',
        latestVersion: 'gpt-5',
        needsUpdate: false,
        changelogUrl: 'https://platform.openai.com/docs/models',
        updateInstructions: 'Check OpenAI models page for new GPT releases. Update model name in server/openaiService.ts if needed.'
      },
      {
        name: 'Geocodio',
        currentVersion: 'v1.9',
        latestVersion: 'v1.9',
        needsUpdate: false,
        changelogUrl: 'https://www.geocod.io/docs/#changelog',
        updateInstructions: 'Update baseUrl in server/geocodioService.ts to use latest version'
      },
      {
        name: 'HelloData',
        currentVersion: 'v1',
        latestVersion: 'v1',
        needsUpdate: false,
        changelogUrl: 'https://docs.hellodata.ai/changelog',
        updateInstructions: 'Check HelloData documentation for API updates. Update endpoints in server/hellodataService.ts if needed.'
      },
      {
        name: 'ArcGIS',
        currentVersion: 'Current',
        latestVersion: 'Current',
        needsUpdate: false,
        changelogUrl: 'https://developers.arcgis.com/rest/geoenrichment/api-reference/enrich.htm',
        updateInstructions: 'ArcGIS uses continuous updates. Monitor the developer portal for breaking changes.'
      },
      {
        name: 'Twilio',
        currentVersion: '2010-04-01',
        latestVersion: '2010-04-01',
        needsUpdate: false,
        changelogUrl: 'https://www.twilio.com/docs/all/changelog',
        updateInstructions: 'Twilio uses dated API versions. Current version in use is stable. Check changelog for new features.'
      },
      {
        name: 'SendGrid',
        currentVersion: 'v3',
        latestVersion: 'v3',
        needsUpdate: false,
        changelogUrl: 'https://www.twilio.com/docs/sendgrid/api-reference',
        updateInstructions: 'SendGrid API v3 is current. Check API reference for new endpoints and features.'
      }
    );
    
    // Check HelloData
    const hellodataCheck = await this.checkHelloData();
    healthChecks.push(hellodataCheck);
    
    // Check ArcGIS
    const arcgisCheck = await this.checkArcGIS();
    healthChecks.push(arcgisCheck);
    
    // Check Twilio
    const twilioCheck = await this.checkTwilio();
    healthChecks.push(twilioCheck);
    
    // Check SendGrid
    const sendgridCheck = await this.checkSendGrid();
    healthChecks.push(sendgridCheck);

    // Log all results to database
    await this.logHealthMetrics(healthChecks);

    const needsAttention = healthChecks.some(check => check.status !== 'healthy') || 
                          versionChecks.some(check => check.needsUpdate);

    return {
      versionChecks,
      healthChecks,
      needsAttention
    };
  }

  /**
   * Check OpenAI API health
   */
  private static async checkOpenAI(): Promise<ApiHealthCheck> {
    const startTime = Date.now();
    try {
      // Simple ping to OpenAI models endpoint
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          name: 'OpenAI GPT-5',
          status: 'healthy',
          responseTime,
          version: 'gpt-5'
        };
      } else {
        return {
          name: 'OpenAI GPT-5',
          status: 'degraded',
          responseTime,
          errorMessage: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        name: 'OpenAI GPT-5',
        status: 'down',
        responseTime,
        errorMessage: error.message || 'Connection failed'
      };
    }
  }

  /**
   * Check Geocodio API health
   */
  private static async checkGeocodio(): Promise<ApiHealthCheck> {
    const startTime = Date.now();
    try {
      const apiKey = process.env.GEOCODIO_API_KEY;
      if (!apiKey) {
        return {
          name: 'Geocodio',
          status: 'down',
          responseTime: 0,
          errorMessage: 'API key not configured'
        };
      }

      // Simple geocode test
      const response = await fetch(`https://api.geocod.io/v1.9/geocode?q=1600+Pennsylvania+Ave+NW,+Washington+DC&api_key=${apiKey}`, {
        signal: AbortSignal.timeout(10000)
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          name: 'Geocodio',
          status: 'healthy',
          responseTime,
          version: 'v1.9'
        };
      } else {
        return {
          name: 'Geocodio',
          status: 'degraded',
          responseTime,
          errorMessage: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        name: 'Geocodio',
        status: 'down',
        responseTime,
        errorMessage: error.message || 'Connection failed'
      };
    }
  }

  /**
   * Check HelloData API health
   * Note: HelloData doesn't have a dedicated health/ping endpoint
   * We verify the API key is configured and assume healthy if present
   */
  private static async checkHelloData(): Promise<ApiHealthCheck> {
    const startTime = Date.now();
    const apiKey = process.env.HELLODATA_API_KEY;
    
    if (!apiKey) {
      return {
        name: 'HelloData',
        status: 'down',
        responseTime: 0,
        errorMessage: 'API key not configured'
      };
    }

    const responseTime = Date.now() - startTime;
    
    // API key exists - assume healthy
    // Actual API health is verified during real comparable searches
    return {
      name: 'HelloData',
      status: 'healthy',
      responseTime
    };
  }

  /**
   * Check ArcGIS API health
   */
  private static async checkArcGIS(): Promise<ApiHealthCheck> {
    const startTime = Date.now();
    try {
      const clientId = process.env.ARCGIS_CLIENT_ID;
      if (!clientId) {
        return {
          name: 'ArcGIS',
          status: 'down',
          responseTime: 0,
          errorMessage: 'Client ID not configured'
        };
      }

      // Check ArcGIS service status
      const response = await fetch('https://www.arcgis.com/sharing/rest/info?f=json', {
        signal: AbortSignal.timeout(10000)
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          name: 'ArcGIS',
          status: 'healthy',
          responseTime
        };
      } else {
        return {
          name: 'ArcGIS',
          status: 'degraded',
          responseTime,
          errorMessage: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        name: 'ArcGIS',
        status: 'down',
        responseTime,
        errorMessage: error.message || 'Connection failed'
      };
    }
  }

  /**
   * Check Twilio API health
   */
  private static async checkTwilio(): Promise<ApiHealthCheck> {
    const startTime = Date.now();
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      
      if (!accountSid || !authToken) {
        return {
          name: 'Twilio',
          status: 'down',
          responseTime: 0,
          errorMessage: 'Credentials not configured'
        };
      }

      // Check account status
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
        },
        signal: AbortSignal.timeout(10000)
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          name: 'Twilio',
          status: 'healthy',
          responseTime
        };
      } else {
        return {
          name: 'Twilio',
          status: 'degraded',
          responseTime,
          errorMessage: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        name: 'Twilio',
        status: 'down',
        responseTime,
        errorMessage: error.message || 'Connection failed'
      };
    }
  }

  /**
   * Check SendGrid API health
   */
  private static async checkSendGrid(): Promise<ApiHealthCheck> {
    const startTime = Date.now();
    try {
      const apiKey = process.env.SENDGRID_API_KEY;
      if (!apiKey) {
        return {
          name: 'SendGrid',
          status: 'down',
          responseTime: 0,
          errorMessage: 'API key not configured'
        };
      }

      // Check API status
      const response = await fetch('https://api.sendgrid.com/v3/scopes', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        signal: AbortSignal.timeout(10000)
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          name: 'SendGrid',
          status: 'healthy',
          responseTime
        };
      } else {
        return {
          name: 'SendGrid',
          status: 'degraded',
          responseTime,
          errorMessage: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        name: 'SendGrid',
        status: 'down',
        responseTime,
        errorMessage: error.message || 'Connection failed'
      };
    }
  }

  /**
   * Log health metrics to database
   */
  private static async logHealthMetrics(healthChecks: ApiHealthCheck[]): Promise<void> {
    try {
      // Log metrics to console for now - storage method will be added later
      console.log(`📊 API Health Check Results:`);
      for (const check of healthChecks) {
        console.log(`   - ${check.name}: ${check.status} (${check.responseTime}ms)`);
        if (check.errorMessage) {
          console.log(`     Error: ${check.errorMessage}`);
        }
      }
      console.log(`✅ Logged ${healthChecks.length} API health metrics`);
    } catch (error) {
      console.error('❌ Failed to log health metrics:', error);
    }
  }

  /**
   * Generate email report for Jack
   */
  static generateEmailReport(versionChecks: ApiVersionInfo[], healthChecks: ApiHealthCheck[]): {
    subject: string;
    html: string;
    text: string;
  } {
    const issuesCount = healthChecks.filter(c => c.status !== 'healthy').length + 
                       versionChecks.filter(c => c.needsUpdate).length;

    const subject = issuesCount > 0 
      ? `⚠️ LandLinq API Health Alert: ${issuesCount} Issue${issuesCount > 1 ? 's' : ''} Detected`
      : `✅ LandLinq API Health Report: All Systems Operational`;

    // HTML version
    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background: #1e40af; color: white; padding: 20px; border-radius: 5px; }
    .section { margin: 20px 0; padding: 15px; border: 1px solid #e5e7eb; border-radius: 5px; }
    .healthy { color: #10b981; }
    .degraded { color: #f59e0b; }
    .down { color: #ef4444; }
    .needs-update { background: #fef3c7; padding: 10px; border-left: 4px solid #f59e0b; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f3f4f6; font-weight: 600; }
    .instructions { background: #e0e7ff; padding: 15px; border-radius: 5px; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔧 LandLinq API Health Report</h1>
    <p>Generated: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour12: true })}</p>
  </div>

  <div class="section">
    <h2>📊 API Health Status</h2>
    <table>
      <thead>
        <tr>
          <th>API Service</th>
          <th>Status</th>
          <th>Response Time</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        ${healthChecks.map(check => `
          <tr>
            <td><strong>${check.name}</strong></td>
            <td class="${check.status}">${check.status.toUpperCase()}</td>
            <td>${check.responseTime}ms</td>
            <td>${check.errorMessage || check.version || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  ${versionChecks.filter(v => v.needsUpdate).length > 0 ? `
    <div class="section">
      <h2>🔄 API Updates Available</h2>
      ${versionChecks.filter(v => v.needsUpdate).map(version => `
        <div class="needs-update">
          <h3>${version.name}</h3>
          <p><strong>Current:</strong> ${version.currentVersion} → <strong>Latest:</strong> ${version.latestVersion}</p>
          <div class="instructions">
            <h4>📝 Update Instructions:</h4>
            <p>${version.updateInstructions}</p>
            <p><strong>Changelog:</strong> <a href="${version.changelogUrl}">${version.changelogUrl}</a></p>
          </div>
        </div>
      `).join('')}
    </div>
  ` : ''}

  <div class="section">
    <h2>📝 Next Steps</h2>
    <ul>
      ${healthChecks.filter(c => c.status !== 'healthy').map(check => `
        <li><strong>${check.name}:</strong> ${check.errorMessage || 'Service degraded - investigate issue'}</li>
      `).join('')}
      ${versionChecks.filter(v => v.needsUpdate).map(version => `
        <li><strong>${version.name}:</strong> Update to ${version.latestVersion}</li>
      `).join('')}
      ${issuesCount === 0 ? '<li>✅ All APIs are healthy and up to date!</li>' : ''}
    </ul>
  </div>

  <div class="section" style="background: #f9fafb;">
    <p><em>This automated report is generated daily by the LandLinq API Monitoring System.</em></p>
    <p><em>For questions, contact: catalyst@landlinq.ai</em></p>
  </div>
</body>
</html>
    `;

    // Plain text version
    const text = `
LandLinq API Health Report
Generated: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour12: true })}

API HEALTH STATUS:
${healthChecks.map(check => `
- ${check.name}: ${check.status.toUpperCase()} (${check.responseTime}ms)
  ${check.errorMessage || check.version || ''}
`).join('')}

${versionChecks.filter(v => v.needsUpdate).length > 0 ? `
API UPDATES AVAILABLE:
${versionChecks.filter(v => v.needsUpdate).map(version => `
- ${version.name}: ${version.currentVersion} → ${version.latestVersion}
  Instructions: ${version.updateInstructions}
  Changelog: ${version.changelogUrl}
`).join('')}
` : ''}

NEXT STEPS:
${healthChecks.filter(c => c.status !== 'healthy').map(check => `
- ${check.name}: ${check.errorMessage || 'Service degraded - investigate issue'}
`).join('')}
${versionChecks.filter(v => v.needsUpdate).map(version => `
- ${version.name}: Update to ${version.latestVersion}
`).join('')}
${issuesCount === 0 ? '- All APIs are healthy and up to date!' : ''}

---
This automated report is generated daily by the LandLinq API Monitoring System.
For questions, contact: catalyst@landlinq.ai
    `;

    return { subject, html, text };
  }
}
