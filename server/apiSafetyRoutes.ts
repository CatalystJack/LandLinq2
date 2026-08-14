/**
 * API Safety Guard Admin Routes
 * SUPER_ADMIN only endpoints to control API cost protection
 */

import { Router } from 'express';
import { apiSafetyGuards } from './apiSafetyGuards.js';
import type { Response } from 'express';

const router = Router();

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

/**
 * GET /api/safety/stats
 * Get current API safety statistics
 */
router.get('/stats', isSuperAdmin, async (req, res) => {
  try {
    const stats = apiSafetyGuards.getApiStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error getting API safety stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get safety stats' });
  }
});

/**
 * POST /api/safety/kill-switch
 * Toggle kill switch for an API
 * Body: { apiName: string, enabled: boolean }
 */
router.post('/kill-switch', isSuperAdmin, async (req, res) => {
  try {
    const { apiName, enabled } = req.body;
    
    if (!apiName) {
      return res.status(400).json({ success: false, error: 'apiName is required' });
    }
    
    apiSafetyGuards.setKillSwitch(apiName, enabled);
    
    res.json({ 
      success: true, 
      message: `${apiName} ${enabled ? 'disabled' : 'enabled'}`,
      killSwitches: apiSafetyGuards.getKillSwitches()
    });
  } catch (error) {
    console.error('Error toggling kill switch:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle kill switch' });
  }
});

/**
 * POST /api/safety/reset-circuit/:apiName
 * Manually reset a circuit breaker
 */
router.post('/reset-circuit/:apiName', isSuperAdmin, async (req, res) => {
  try {
    const { apiName } = req.params;
    apiSafetyGuards.resetCircuitBreaker(apiName);
    
    res.json({ 
      success: true, 
      message: `Circuit breaker for ${apiName} has been reset`
    });
  } catch (error) {
    console.error('Error resetting circuit breaker:', error);
    res.status(500).json({ success: false, error: 'Failed to reset circuit breaker' });
  }
});

/**
 * GET /api/safety/kill-switches
 * Get all kill switch states
 */
router.get('/kill-switches', isSuperAdmin, async (req, res) => {
  try {
    const killSwitches = apiSafetyGuards.getKillSwitches();
    res.json({ success: true, killSwitches });
  } catch (error) {
    console.error('Error getting kill switches:', error);
    res.status(500).json({ success: false, error: 'Failed to get kill switches' });
  }
});

export default router;
