import { Router } from 'express';
import { db } from './db.js';
import { acquisitionMarkets } from '@shared/schema.js';
import { MSAMatchingService } from './msaMatchingService.js';
import { eq, sql, isNull } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { geocodioService } from './geocodioService.js';

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

export const msaRouter = Router();

/**
 * GET /api/msa/markets
 * Get all active acquisition markets
 */
msaRouter.get('/markets', async (req, res) => {
  try {
    const markets = await db
      .select()
      .from(acquisitionMarkets)
      .where(eq(acquisitionMarkets.isActive, true))
      .orderBy(acquisitionMarkets.msaName, acquisitionMarkets.county);
    
    console.log(`✅ MSA Markets Retrieved: ${markets.length} active markets (REAL count from database)`);
    res.json({ success: true, markets });
  } catch (error) {
    console.error('❌ Error fetching acquisition markets:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch acquisition markets' 
    });
  }
});

/**
 * GET /api/msa/markets/by-product-type
 * Get markets grouped by product type
 */
msaRouter.get('/markets/by-product-type', async (req, res) => {
  try {
    console.log('📊 MSA Markets by Product Type - Grouping markets (Active Adult, BTR, Lot Development)');
    const marketsByProductType = await MSAMatchingService.getAllMarketsByProductType();
    
    console.log('✅ MSA Product Type Grouping Complete');
    res.json({ success: true, marketsByProductType });
  } catch (error) {
    console.error('❌ Error fetching markets by product type:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch markets by product type' 
    });
  }
});

/**
 * GET /api/msa/markets/:msaName
 * Get all counties in a specific MSA
 */
msaRouter.get('/markets/:msaName', async (req, res) => {
  try {
    const { msaName } = req.params;
    const markets = await MSAMatchingService.getMarketsByMSA(msaName);
    
    res.json({ success: true, markets });
  } catch (error) {
    console.error('Error fetching MSA markets:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch MSA markets' 
    });
  }
});

/**
 * POST /api/msa/match
 * Match a county/state to acquisition markets
 * Body: { county: string, state: string, productTypes?: string[] }
 */
msaRouter.post('/match', async (req, res) => {
  try {
    const { county, state, productTypes } = req.body;
    
    if (!county || !state) {
      console.log('⚠️ MSA Match Request - Missing county or state');
      return res.status(400).json({ 
        success: false, 
        error: 'County and state are required' 
      });
    }
    
    console.log(`🔍 MSA Matching - County: ${county}, State: ${state}, Product Types: ${productTypes?.join(', ') || 'all'}`);
    const matchResult = await MSAMatchingService.matchCountyToMarket(
      county,
      state,
      productTypes
    );
    console.log(`✅ MSA Match Result - In Target Market: ${matchResult.inTargetMarket}, MSA: ${matchResult.msaName || 'N/A'}`);
    
    res.json({ success: true, ...matchResult });
  } catch (error) {
    console.error('Error matching county to market:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to match county to market' 
    });
  }
});

/**
 * GET /api/msa/stats
 * Get market statistics
 */
msaRouter.get('/stats', async (req, res) => {
  try {
    const allMarkets = await db
      .select()
      .from(acquisitionMarkets)
      .where(eq(acquisitionMarkets.isActive, true));
    
    const stats = {
      totalMarkets: allMarkets.length,
      totalMSAs: new Set(allMarkets.map(m => m.msaName)).size,
      totalCounties: new Set(allMarkets.map(m => `${m.county}, ${m.state}`)).size,
      byProductType: {} as Record<string, number>
    };
    
    allMarkets.forEach(market => {
      market.productTypes?.forEach(productType => {
        stats.byProductType[productType] = (stats.byProductType[productType] || 0) + 1;
      });
    });
    
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching MSA stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch MSA stats' 
    });
  }
});

// =============== SUPER ADMIN ONLY ROUTES ===============

/**
 * GET /api/msa/admin/all
 * Get ALL acquisition markets (including inactive) - SUPER ADMIN ONLY
 */
msaRouter.get('/admin/all', isSuperAdmin, async (req, res) => {
  try {
    const markets = await db
      .select()
      .from(acquisitionMarkets)
      .orderBy(acquisitionMarkets.msaName, acquisitionMarkets.county);
    
    res.json({ success: true, markets });
  } catch (error) {
    console.error('Error fetching all acquisition markets:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch acquisition markets' 
    });
  }
});

/**
 * POST /api/msa/admin/create
 * Create a new acquisition market - SUPER ADMIN ONLY
 * Body: { msaName, county, state, fullCountyName?, cityNote?, productTypes, isActive?, notes? }
 */
msaRouter.post('/admin/create', isSuperAdmin, async (req, res) => {
  try {
    const { msaName, county, state, fullCountyName, cityNote, productTypes, isActive, notes } = req.body;
    
    if (!msaName || !county || !state || !productTypes || !Array.isArray(productTypes)) {
      return res.status(400).json({ 
        success: false, 
        error: 'msaName, county, state, and productTypes (array) are required' 
      });
    }
    
    const [newMarket] = await db
      .insert(acquisitionMarkets)
      .values({
        msaName,
        county,
        state,
        fullCountyName,
        cityNote,
        productTypes,
        isActive: isActive !== undefined ? isActive : true,
        notes
      })
      .returning();
    
    res.json({ success: true, market: newMarket });
  } catch (error) {
    console.error('Error creating acquisition market:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create acquisition market' 
    });
  }
});

/**
 * PATCH /api/msa/admin/update/:id
 * Update an acquisition market - SUPER ADMIN ONLY
 * Body: { msaName?, county?, state?, fullCountyName?, cityNote?, productTypes?, isActive?, notes? }
 */
msaRouter.patch('/admin/update/:id', isSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No update data provided' 
      });
    }
    
    const [updatedMarket] = await db
      .update(acquisitionMarkets)
      .set({
        ...updateData,
        updatedAt: new Date()
      })
      .where(eq(acquisitionMarkets.id, id))
      .returning();
    
    if (!updatedMarket) {
      return res.status(404).json({ 
        success: false, 
        error: 'Market not found' 
      });
    }
    
    res.json({ success: true, market: updatedMarket });
  } catch (error) {
    console.error('Error updating acquisition market:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update acquisition market' 
    });
  }
});

/**
 * DELETE /api/msa/admin/delete/:id
 * Delete an acquisition market - SUPER ADMIN ONLY
 */
msaRouter.delete('/admin/delete/:id', isSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [deletedMarket] = await db
      .delete(acquisitionMarkets)
      .where(eq(acquisitionMarkets.id, id))
      .returning();
    
    if (!deletedMarket) {
      return res.status(404).json({ 
        success: false, 
        error: 'Market not found' 
      });
    }
    
    res.json({ success: true, message: 'Market deleted successfully' });
  } catch (error) {
    console.error('Error deleting acquisition market:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete acquisition market' 
    });
  }
});

/**
 * POST /api/msa/admin/geocode-markets
 * Geocode all MSA markets without coordinates - SUPER ADMIN ONLY
 */
msaRouter.post('/admin/geocode-markets', isSuperAdmin, async (req, res) => {
  try {
    console.log('🗺️ Starting MSA Market Geocoding...');
    
    // Get markets without coordinates
    const marketsToGeocode = await db
      .select()
      .from(acquisitionMarkets)
      .where(sql`latitude IS NULL OR longitude IS NULL`);
    
    console.log(`📍 Found ${marketsToGeocode.length} markets to geocode`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const market of marketsToGeocode) {
      try {
        // Construct geocoding query
        const query = `${market.county} County, ${market.state}`;
        console.log(`  🔍 Geocoding: ${query}`);
        
        const result = await geocodioService.geocodeAddress(query);
        
        if (result.success && result.lat && result.lng) {
          // Update market with coordinates
          await db
            .update(acquisitionMarkets)
            .set({
              latitude: result.lat.toString(),
              longitude: result.lng.toString()
            })
            .where(eq(acquisitionMarkets.id, market.id));
          
          successCount++;
          console.log(`  ✅ ${market.county}, ${market.state}: ${result.lat}, ${result.lng}`);
        } else {
          errorCount++;
          console.log(`  ❌ Failed to geocode ${query}`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        errorCount++;
        console.error(`  ❌ Error geocoding ${market.county}, ${market.state}:`, err);
      }
    }
    
    console.log(`\n🎉 Geocoding complete: ${successCount} success, ${errorCount} errors`);
    
    res.json({
      success: true,
      message: `Geocoded ${successCount} markets`,
      stats: {
        total: marketsToGeocode.length,
        success: successCount,
        errors: errorCount
      }
    });
  } catch (error) {
    console.error('Error geocoding markets:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to geocode markets' 
    });
  }
});
