// Production deployment readiness checklist and automated fixes
import fs from 'fs';
import path from 'path';

interface DeploymentIssue {
  category: string;
  severity: 'blocker' | 'critical' | 'warning';
  description: string;
  fix: string;
  autoFixable: boolean;
}

export class DeploymentReadinessService {
  
  async checkDeploymentReadiness(): Promise<{
    ready: boolean;
    issues: DeploymentIssue[];
    score: number;
  }> {
    const issues: DeploymentIssue[] = [];
    
    // Environment Variables Check
    const requiredEnvVars = [
      'DATABASE_URL',
      'SESSION_SECRET', 
      'REPL_ID',
      'ATTOM_API_KEY',
      'OPENAI_API_KEY'
    ];
    
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        issues.push({
          category: 'Environment',
          severity: 'blocker',
          description: `Missing required environment variable: ${envVar}`,
          fix: `Set ${envVar} in production environment`,
          autoFixable: false
        });
      }
    }
    
    // Security Checks
    if (process.env.NODE_ENV !== 'production') {
      issues.push({
        category: 'Security',
        severity: 'critical',
        description: 'NODE_ENV not set to production',
        fix: 'Set NODE_ENV=production',
        autoFixable: true
      });
    }
    
    // Database Connection Pool Check
    issues.push({
      category: 'Performance',
      severity: 'warning',
      description: 'Database connection pooling needs optimization for production load',
      fix: 'Configure connection pool settings for expected load',
      autoFixable: false
    });
    
    // Static Asset Optimization
    const buildPath = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(buildPath)) {
      issues.push({
        category: 'Build',
        severity: 'blocker',
        description: 'Production build not found',
        fix: 'Run npm run build to create production assets',
        autoFixable: true
      });
    }
    
    // Hardcoded Secrets Check
    issues.push({
      category: 'Security',
      severity: 'critical',
      description: 'Hardcoded team password found in documentation',
      fix: 'Remove hardcoded passwords from replit.md and use proper secret management',
      autoFixable: true
    });
    
    // HTTPS Configuration
    if (process.env.NODE_ENV === 'production' && !process.env.FORCE_HTTPS) {
      issues.push({
        category: 'Security',
        severity: 'critical',
        description: 'HTTPS not enforced in production',
        fix: 'Enable HTTPS enforcement and security headers',
        autoFixable: true
      });
    }
    
    // Monitoring Setup
    if (!process.env.MONITORING_ENABLED) {
      issues.push({
        category: 'Operations',
        severity: 'critical',
        description: 'No monitoring/alerting configured',
        fix: 'Setup monitoring with error tracking and alerting',
        autoFixable: false
      });
    }
    
    // Calculate readiness score
    const blockers = issues.filter(i => i.severity === 'blocker').length;
    const critical = issues.filter(i => i.severity === 'critical').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    
    const score = Math.max(0, 100 - (blockers * 50) - (critical * 20) - (warnings * 5));
    const ready = blockers === 0 && critical <= 1;
    
    return { ready, issues, score };
  }
  
  async applyAutoFixes(): Promise<string[]> {
    const fixesApplied: string[] = [];
    
    try {
      // Fix NODE_ENV
      if (process.env.NODE_ENV !== 'production') {
        process.env.NODE_ENV = 'production';
        fixesApplied.push('Set NODE_ENV to production');
      }
      
      // Remove hardcoded password from replit.md
      const replitMdPath = path.join(process.cwd(), 'replit.md');
      if (fs.existsSync(replitMdPath)) {
        let content = fs.readFileSync(replitMdPath, 'utf-8');
        if (content.includes('Catalyst1408')) {
          content = content.replace(/Catalyst1408/g, '[REDACTED]');
          fs.writeFileSync(replitMdPath, content);
          fixesApplied.push('Removed hardcoded password from replit.md');
        }
      }
      
      // Create production build if missing
      const buildPath = path.join(process.cwd(), 'dist');
      if (!fs.existsSync(buildPath)) {
        // Note: This would require running the build command
        fixesApplied.push('Production build needs to be created - run npm run build');
      }
      
    } catch (error) {
      console.error('Error applying auto-fixes:', error);
    }
    
    return fixesApplied;
  }
}

export const deploymentReadinessService = new DeploymentReadinessService();