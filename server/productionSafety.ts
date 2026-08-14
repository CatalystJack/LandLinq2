/**
 * Production Safety and Critical Environment Variable Management
 */

// Required Environment Variables for Production
export const REQUIRED_ENV_VARS = {
  // Database Configuration
  DATABASE_URL: {
    description: 'PostgreSQL database connection string',
    required: true,
    production: true,
    example: 'postgresql://username:password@host:5432/database'
  },
  
  // Session Management
  SESSION_SECRET: {
    description: 'Secret key for session encryption and signing',
    required: true,
    production: true,
    example: 'your-super-secret-key-for-sessions'
  },
  
  // AI Services
  OPENAI_API_KEY: {
    description: 'OpenAI API key for AI analysis and processing',
    required: true,
    production: true,
    example: 'sk-proj-...'
  },
  
  // Email Services
  SENDGRID_API_KEY: {
    description: 'SendGrid API key for email notifications',
    required: true,
    production: true,
    example: 'SG.xxx'
  },
  
  // SMS Services
  TWILIO_ACCOUNT_SID: {
    description: 'Twilio Account SID for SMS functionality',
    required: true,
    production: true,
    example: 'ACxxx'
  },
  
  TWILIO_AUTH_TOKEN: {
    description: 'Twilio Auth Token for SMS authentication',
    required: true,
    production: true,
    example: 'your-auth-token'
  },
  
  TWILIO_PHONE_NUMBER: {
    description: 'Twilio phone number for SMS (704) 610-1549',
    required: true,
    production: true,
    example: '+17046101549'
  },
  
  // Property Data APIs
  ATTOM_API_KEY: {
    description: 'ATTOM Data API key for property information',
    required: false,
    production: true,
    example: 'your-attom-api-key'
  },
  
  HELLODATA_API_KEY: {
    description: 'HelloData API key for market analysis',
    required: false,
    production: true,
    example: 'your-hellodata-api-key'
  },
  
  // Production Environment Indicators
  NODE_ENV: {
    description: 'Node.js environment (production, development, test)',
    required: false,
    production: true,
    example: 'production'
  },
  
  REPLIT_DEPLOYMENT: {
    description: 'Indicates if running in Replit deployment (set to "1" automatically)',
    required: false,
    production: false,
    example: '1'
  }
} as const;

/**
 * Validate all required environment variables
 */
export function validateEnvironmentVariables(): {
  valid: boolean;
  missing: string[];
  warnings: string[];
  summary: string;
} {
  const missing: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT === '1';
  
  // Check required variables
  Object.entries(REQUIRED_ENV_VARS).forEach(([key, config]) => {
    const value = process.env[key];
    
    if (config.required && !value) {
      missing.push(`${key}: ${config.description}`);
    }
    
    if (config.production && isProduction && !value) {
      warnings.push(`${key}: Recommended for production - ${config.description}`);
    }
  });
  
  const valid = missing.length === 0;
  const summary = valid 
    ? `✅ All ${Object.keys(REQUIRED_ENV_VARS).length} environment variables are properly configured`
    : `❌ ${missing.length} required environment variables are missing`;
    
  return { valid, missing, warnings, summary };
}

/**
 * Generate environment variable documentation
 */
export function generateEnvironmentDocumentation(): string {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT === '1';
  
  let docs = `# Environment Variables Configuration\n\n`;
  docs += `**Environment**: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}\n`;
  docs += `**Last Validated**: ${new Date().toISOString()}\n\n`;
  
  docs += `## Required Variables (Production Critical)\n\n`;
  
  Object.entries(REQUIRED_ENV_VARS).forEach(([key, config]) => {
    const status = process.env[key] ? '✅' : '❌';
    const required = config.required ? '**REQUIRED**' : 'Optional';
    
    docs += `### ${key} ${status}\n`;
    docs += `- **Status**: ${required}\n`;
    docs += `- **Description**: ${config.description}\n`;
    docs += `- **Production**: ${config.production ? 'Required' : 'Optional'}\n`;
    docs += `- **Example**: \`${config.example}\`\n`;
    docs += `- **Current**: ${process.env[key] ? 'Configured' : 'Missing'}\n\n`;
  });
  
  return docs;
}

/**
 * Production safety check - validates critical systems
 */
export async function runProductionSafetyCheck(): Promise<{
  overall: 'SAFE' | 'WARNING' | 'CRITICAL';
  checks: Array<{
    name: string;
    status: 'PASS' | 'WARN' | 'FAIL';
    message: string;
  }>;
  recommendations: string[];
}> {
  const checks: Array<{
    name: string;
    status: 'PASS' | 'WARN' | 'FAIL';
    message: string;
  }> = [];
  const recommendations: string[] = [];
  
  // Environment Variables Check
  const envValidation = validateEnvironmentVariables();
  checks.push({
    name: 'Environment Variables',
    status: envValidation.valid ? 'PASS' : 'FAIL',
    message: envValidation.summary
  });
  
  if (!envValidation.valid) {
    recommendations.push('Configure missing environment variables immediately');
  }
  
  // Database Backup Check
  try {
    // Import backup manager to check backup status
    const { backupManager } = await import('./database/manager');
    const backups = await backupManager.listBackups();
    const recentBackups = backups.filter(b => {
      const age = Date.now() - b.createdAt.getTime();
      return age < 24 * 60 * 60 * 1000; // Less than 24 hours
    });
    
    checks.push({
      name: 'Database Backups',
      status: recentBackups.length > 0 ? 'PASS' : 'WARN',
      message: `${recentBackups.length} backups in last 24 hours, ${backups.length} total backups`
    });
    
    if (recentBackups.length === 0) {
      recommendations.push('No recent database backups found - verify backup scheduling');
    }
    
  } catch (error) {
    checks.push({
      name: 'Database Backups',
      status: 'FAIL',
      message: 'Unable to verify backup status'
    });
    recommendations.push('Database backup system needs verification');
  }
  
  // Critical Services Check
  const criticalServices = ['DATABASE_URL', 'SENDGRID_API_KEY', 'TWILIO_ACCOUNT_SID'];
  const missingCritical = criticalServices.filter(service => !process.env[service]);
  
  checks.push({
    name: 'Critical Services',
    status: missingCritical.length === 0 ? 'PASS' : 'FAIL',
    message: missingCritical.length === 0 ? 'All critical services configured' : `Missing: ${missingCritical.join(', ')}`
  });
  
  // Overall Status
  const failCount = checks.filter(c => c.status === 'FAIL').length;
  const warnCount = checks.filter(c => c.status === 'WARN').length;
  
  let overall: 'SAFE' | 'WARNING' | 'CRITICAL';
  if (failCount > 0) {
    overall = 'CRITICAL';
  } else if (warnCount > 0) {
    overall = 'WARNING';
  } else {
    overall = 'SAFE';
  }
  
  return { overall, checks, recommendations };
}

/**
 * Monitor and alert on production safety issues
 */
export function setupProductionSafetyMonitoring(): void {
  // Run safety check every hour in production
  if (process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT === '1') {
    setInterval(async () => {
      try {
        const safetyCheck = await runProductionSafetyCheck();
        
        if (safetyCheck.overall === 'CRITICAL') {
          console.error('🚨 CRITICAL PRODUCTION SAFETY ISSUE:', safetyCheck);
          // Could send alert email here
        } else if (safetyCheck.overall === 'WARNING') {
          console.warn('⚠️ Production safety warning:', safetyCheck);
        }
      } catch (error) {
        console.error('❌ Production safety check failed:', error);
      }
    }, 60 * 60 * 1000); // Every hour
  }
}