#!/usr/bin/env tsx

import { databaseManager } from '../server/database/manager';

/**
 * LandLinq Database CLI
 * Command-line interface for database management operations
 */

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const commandArgs = args.slice(1);

  if (!command) {
    printUsage();
    process.exit(1);
  }

  try {
    console.log('🚀 LandLinq Database CLI');
    console.log('=' .repeat(50));
    
    // Initialize database manager
    await databaseManager.initialize();
    
    switch (command) {
      case 'health':
        await showHealth();
        break;
        
      case 'migrate':
        await databaseManager.runCommand('migrate');
        break;
        
      case 'rollback':
        await databaseManager.runCommand('rollback', commandArgs);
        break;
        
      case 'backup':
        await databaseManager.runCommand('backup', commandArgs);
        break;
        
      case 'restore':
        await databaseManager.runCommand('restore', commandArgs);
        break;
        
      case 'archive':
        await databaseManager.runCommand('archive', commandArgs);
        break;
        
      case 'optimize':
        await databaseManager.runCommand('optimize');
        break;
        
      case 'maintenance':
        await runMaintenance(commandArgs);
        break;
        
      case 'report':
        await generateReport();
        break;
        
      case 'recovery':
        await databaseManager.runCommand('recovery');
        break;
        
      default:
        console.error(`❌ Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
    
    await databaseManager.shutdown();
    console.log('✅ Database CLI completed successfully');
    
  } catch (error) {
    console.error('❌ Database CLI failed:', error);
    await databaseManager.shutdown();
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
🛠️  LandLinq Database CLI - Comprehensive Database Management

USAGE:
  npm run db:cli <command> [options]

COMMANDS:
  health              Show comprehensive database health status
  migrate             Apply all pending migrations
  rollback [steps]    Rollback last N migrations (default: 1)
  backup [type]       Create backup (full|schema|data)
  restore <id>        Restore from backup ID
  archive [table]     Archive old records (all tables or specific table)
  optimize            Create optimal indexes and analyze performance
  maintenance         Run full maintenance cycle
  report              Generate comprehensive database report
  recovery            Run emergency recovery procedures

OPTIONS:
  --dry-run           Show what would be done without making changes
  --drop              Drop existing data during restore
  --force             Force operation even with warnings

EXAMPLES:
  npm run db:cli health                    # Check database health
  npm run db:cli backup schema             # Create schema-only backup
  npm run db:cli archive deals --dry-run   # Preview deal archiving
  npm run db:cli maintenance               # Run full maintenance
  npm run db:cli restore backup_123 --drop # Restore with clean slate

For more information, visit: https://docs.landlinq.com/database
`);
}

async function showHealth() {
  const health = await databaseManager.getHealthStatus();
  
  console.log('📊 DATABASE HEALTH STATUS');
  console.log('=' .repeat(50));
  
  // Overall status with color coding
  const statusSymbol = health.overall === 'healthy' ? '✅' : 
                      health.overall === 'degraded' ? '⚠️' : '🚨';
  console.log(`${statusSymbol} Overall Status: ${health.overall.toUpperCase()}`);
  console.log();
  
  // Component breakdown
  console.log('🔧 COMPONENT STATUS:');
  Object.entries(health.components).forEach(([component, status]) => {
    const symbol = status === 'healthy' ? '✅' : status === 'degraded' ? '⚠️' : '❌';
    console.log(`  ${symbol} ${component.charAt(0).toUpperCase() + component.slice(1)}: ${status}`);
  });
  console.log();
  
  // Key metrics
  console.log('📊 KEY METRICS:');
  console.log(`  • Total Queries: ${health.metrics.totalQueries.toLocaleString()}`);
  console.log(`  • Avg Response Time: ${health.metrics.avgResponseTime}ms`);
  console.log(`  • Error Rate: ${(health.metrics.errorRate * 100).toFixed(2)}%`);
  console.log(`  • Storage Used: ${health.metrics.storageUsed}`);
  console.log(`  • Last Backup: ${health.metrics.lastBackup?.toLocaleDateString() || 'None'}`);
  console.log(`  • Pending Migrations: ${health.metrics.pendingMigrations}`);
  console.log(`  • Records to Archive: ${health.metrics.pendingArchives.toLocaleString()}`);
  console.log();
  
  // Recommendations
  if (health.recommendations.length > 0) {
    console.log('💡 RECOMMENDATIONS:');
    health.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
  } else {
    console.log('✅ No recommendations - database is performing optimally');
  }
}

async function runMaintenance(args: string[]) {
  const options = {
    migrations: !args.includes('--skip-migrations'),
    backup: !args.includes('--skip-backup'),
    indexOptimization: !args.includes('--skip-indexes'),
    archiving: !args.includes('--skip-archiving'),
    analyze: !args.includes('--skip-analyze')
  };
  
  console.log('🔧 RUNNING COMPREHENSIVE MAINTENANCE');
  console.log('=' .repeat(50));
  
  const results = await databaseManager.runMaintenance(options);
  
  console.log();
  console.log('📊 MAINTENANCE RESULTS:');
  console.log(`  • Migrations Applied: ${results.migrationsApplied}`);
  console.log(`  • Backup Created: ${results.backupCreated ? 'Yes' : 'No'}`);
  console.log(`  • Indexes Optimized: ${results.indexesOptimized}`);
  console.log(`  • Records Archived: ${results.recordsArchived.toLocaleString()}`);
  console.log(`  • Tables Analyzed: ${results.tablesAnalyzed}`);
}

async function generateReport() {
  console.log('📋 GENERATING COMPREHENSIVE DATABASE REPORT');
  console.log('=' .repeat(50));
  
  const report = await databaseManager.generateReport();
  
  // Health summary
  console.log('🏥 HEALTH SUMMARY:');
  console.log(`  Overall: ${report.health.overall}`);
  console.log();
  
  // Performance summary
  console.log('⚡ PERFORMANCE SUMMARY:');
  console.log(`  Slow Queries: ${report.performance.slowQueries.length}`);
  console.log(`  Index Efficiency: ${report.performance.indexUsage.length} tables analyzed`);
  console.log(`  Recommendations: ${report.performance.recommendations.length}`);
  console.log();
  
  // Storage summary
  console.log('💾 STORAGE SUMMARY:');
  console.log(`  Total Size: ${report.storage.totalSize}`);
  report.storage.tableStats.forEach((table: any) => {
    console.log(`    ${table.tableName}: ${table.rowCount.toLocaleString()} rows (${table.size})`);
  });
  console.log();
  
  // Compliance summary
  console.log('📋 COMPLIANCE SUMMARY:');
  console.log(`  Compliant Tables: ${report.compliance.summary.compliantTables}/${report.compliance.tables.length}`);
  console.log(`  Total Records: ${report.compliance.summary.totalRecords.toLocaleString()}`);
  
  // Maintenance summary
  console.log();
  console.log('🔧 MAINTENANCE SUMMARY:');
  console.log(`  Next Scheduled: ${report.maintenance.nextScheduled.toLocaleDateString()}`);
  if (report.maintenance.recommendedActions.length > 0) {
    console.log('  Recommended Actions:');
    report.maintenance.recommendedActions.forEach((action, i) => {
      console.log(`    ${i + 1}. ${action}`);
    });
  }
}

// Run CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}