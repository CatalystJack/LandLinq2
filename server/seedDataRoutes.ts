import { Router } from 'express';
import { db } from './db.js';
import { acquisitionMarkets } from '@shared/schema.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Response } from 'express';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Get the correct path for seed data files (works in both dev and production)
function getSeedDataPath(filename: string): string {
  // In production, files are in dist/ but we need to access server/data/
  // Use process.cwd() to get project root, then navigate to server/data/
  return join(process.cwd(), 'server', 'data', filename);
}

// Middleware to check for SUPER_ADMIN role
const isSuperAdmin = (req: any, res: Response, next: Function) => {
  const user = req.user;
  const userRole = user?.role || user?.claims?.role;
  
  if (userRole !== 'SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Access denied - Super Admin access required'
    });
  }
  
  next();
};

// Middleware to check for ADMIN or SUPER_ADMIN role (for less sensitive operations)
const isAdmin = (req: any, res: Response, next: Function) => {
  const user = req.user;
  const userRole = user?.role || user?.claims?.role;
  
  if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Access denied - Admin access required'
    });
  }
  
  next();
};

export const seedRouter = Router();

/**
 * POST /api/seed/rejection-reasons
 * Bulk import rejection reasons from JSON file
 * SUPER_ADMIN ONLY
 */
seedRouter.post('/rejection-reasons', isSuperAdmin, async (req, res) => {
  try {
    console.log('📥 Starting bulk import of rejection reasons...');
    
    // Read the seed file
    const seedFilePath = getSeedDataPath('rejection-reasons-seed.json');
    const seedData = JSON.parse(readFileSync(seedFilePath, 'utf-8'));
    
    console.log(`📋 Found ${seedData.length} rejection reasons to import`);
    
    // Get existing business settings
    const { storage } = await import('./storage.js');
    const settings = await storage.getBusinessSettings();
    
    console.log('✅ Business settings found, updating rejection reasons...');
    await storage.updateBusinessSettings({
      rejectionReasons: seedData
    });
    
    console.log(`✅ Successfully imported ${seedData.length} rejection reasons`);
    
    res.json({
      success: true,
      message: `Imported ${seedData.length} rejection reasons`,
      count: seedData.length
    });
    
  } catch (error: any) {
    console.error('❌ Error importing rejection reasons:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import rejection reasons',
      details: error.message
    });
  }
});

/**
 * POST /api/seed/msa-markets
 * Bulk import MSA markets from JSON file
 * ADMIN or SUPER_ADMIN
 */
seedRouter.post('/msa-markets', isAdmin, async (req, res) => {
  try {
    console.log('📥 Starting bulk import of MSA markets...');
    
    // Read the seed file
    const seedFilePath = getSeedDataPath('msa-markets-seed.json');
    const seedData = JSON.parse(readFileSync(seedFilePath, 'utf-8'));
    
    console.log(`📋 Found ${seedData.length} MSA markets to import`);
    
    // Insert all markets
    let imported = 0;
    let skipped = 0;
    
    for (const market of seedData) {
      try {
        await db.insert(acquisitionMarkets).values({
          msaName: market.msaName,
          county: market.county,
          state: market.state,
          productTypes: market.productTypes,
          isActive: true,
          notes: market.notes || null,
          fullCountyName: `${market.county} County, ${market.state}`,
          cityNote: market.cityNote || null
        });
        imported++;
      } catch (err: any) {
        // Skip duplicates
        if (err.code === '23505') { // Unique constraint violation
          console.log(`⚠️ Skipping duplicate: ${market.county}, ${market.state}`);
          skipped++;
        } else {
          throw err;
        }
      }
    }
    
    console.log(`✅ Import complete: ${imported} imported, ${skipped} skipped (duplicates)`);
    
    res.json({
      success: true,
      message: `Imported ${imported} MSA markets (${skipped} duplicates skipped)`,
      imported,
      skipped,
      total: seedData.length
    });
    
  } catch (error: any) {
    console.error('❌ Error importing MSA markets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import MSA markets',
      details: error.message
    });
  }
});

/**
 * POST /api/seed/all
 * Import both rejection reasons and MSA markets
 * SUPER_ADMIN ONLY
 */
seedRouter.post('/all', isSuperAdmin, async (req, res) => {
  try {
    console.log('📥 Starting full data seed (rejection reasons + MSA markets)...');
    
    const results = {
      rejectionReasons: { success: false, count: 0, error: null as any },
      msaMarkets: { success: false, imported: 0, skipped: 0, error: null as any }
    };
    
    // Import rejection reasons
    try {
      const seedFilePath = join(__dirname, 'data', 'rejection-reasons-seed.json');
      const reasonsData = JSON.parse(readFileSync(seedFilePath, 'utf-8'));
      
      const { storage } = await import('./storage.js');
      await storage.getBusinessSettings();
      
      await storage.updateBusinessSettings({
        rejectionReasons: reasonsData
      });
      
      results.rejectionReasons.success = true;
      results.rejectionReasons.count = reasonsData.length;
    } catch (err: any) {
      console.error('❌ Failed to import rejection reasons:', err);
      results.rejectionReasons.error = err.message;
    }
    
    // Import MSA markets
    try {
      const seedFilePath = join(__dirname, 'data', 'msa-markets-seed.json');
      const marketsData = JSON.parse(readFileSync(seedFilePath, 'utf-8'));
      
      let imported = 0;
      let skipped = 0;
      
      for (const market of marketsData) {
        try {
          await db.insert(acquisitionMarkets).values({
            msaName: market.msaName,
            county: market.county,
            state: market.state,
            productTypes: market.productTypes,
            isActive: true,
            notes: market.notes || null,
            fullCountyName: `${market.county} County, ${market.state}`,
            cityNote: market.cityNote || null
          });
          imported++;
        } catch (err: any) {
          if (err.code === '23505') {
            skipped++;
          } else {
            throw err;
          }
        }
      }
      
      results.msaMarkets.success = true;
      results.msaMarkets.imported = imported;
      results.msaMarkets.skipped = skipped;
    } catch (err: any) {
      console.error('❌ Failed to import MSA markets:', err);
      results.msaMarkets.error = err.message;
    }
    
    console.log('✅ Full seed complete:', results);
    
    const allSuccess = results.rejectionReasons.success && results.msaMarkets.success;
    
    res.status(allSuccess ? 200 : 207).json({
      success: allSuccess,
      message: allSuccess ? 'All data imported successfully' : 'Some imports failed',
      results
    });
    
  } catch (error: any) {
    console.error('❌ Error in full seed operation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete full seed',
      details: error.message
    });
  }
});

/**
 * GET /api/seed/status
 * Check what data already exists
 * SUPER_ADMIN ONLY
 */
seedRouter.get('/status', isSuperAdmin, async (req, res) => {
  try {
    const { storage } = await import('./storage.js');
    const settings = await storage.getBusinessSettings();
    
    const markets = await db.select().from(acquisitionMarkets);
    
    res.json({
      success: true,
      status: {
        rejectionReasons: {
          exists: !!settings?.rejectionReasons,
          count: Array.isArray(settings?.rejectionReasons) ? settings.rejectionReasons.length : 0
        },
        msaMarkets: {
          exists: markets.length > 0,
          count: markets.length
        }
      }
    });
    
  } catch (error: any) {
    console.error('❌ Error checking seed status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check seed status'
    });
  }
});
