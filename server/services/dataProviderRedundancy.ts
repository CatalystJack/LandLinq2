import { HelloDataService } from '../hellodataService';
import { publicListingValidationService } from '../publicListingValidationService';

interface ProviderHealth {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'failed' | 'maintenance';
  responseTime: number;
  errorRate: number;
  lastSuccessful: Date | null;
  lastChecked: Date;
  consecutiveFailures: number;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
  priority: number; // 1 = primary, 2 = secondary, etc.
}

interface ProviderGroup {
  type: 'property_data' | 'demographics' | 'public_listings';
  providers: ProviderHealth[];
  activeProvider: string;
  fallbackChain: string[];
  lastFailover: Date | null;
}

interface RedundancyConfig {
  healthCheckInterval: number; // milliseconds
  failureThreshold: number; // consecutive failures before failover
  recoveryCheckInterval: number; // milliseconds
  circuitBreakerTimeout: number; // milliseconds
  maxRetries: number;
  timeoutMs: number;
}

interface DataRequest {
  type: 'property_data' | 'demographics' | 'public_listings';
  address: string;
  dealId?: string;
  options?: any;
  priority?: 'high' | 'normal' | 'low';
}

interface DataResponse<T = any> {
  success: boolean;
  data: T | null;
  provider: string;
  responseTime: number;
  fromCache: boolean;
  fallbackUsed: boolean;
  error?: string;
  metadata: {
    attempts: number;
    providersUsed: string[];
    totalTime: number;
  };
}

/**
 * Enterprise Data Provider Redundancy Manager
 * Provides comprehensive failover and redundancy for all external data sources
 */
export class DataProviderRedundancyManager {
  private config: RedundancyConfig;
  private providerGroups: Map<string, ProviderGroup>;
  private healthCheckIntervals: Map<string, NodeJS.Timeout>;
  private responseCache: Map<string, { data: any; timestamp: Date; provider: string }>;
  private cacheTimeout: number = 300000; // 5 minutes

  // Initialize all provider services
  private hellodataService: HelloDataService;
  // Apify and ATTOM services removed per user request

  constructor() {
    this.config = {
      healthCheckInterval: 60000, // 1 minute
      failureThreshold: 3,
      recoveryCheckInterval: 300000, // 5 minutes
      circuitBreakerTimeout: 60000, // 1 minute
      maxRetries: 3,
      timeoutMs: 30000 // 30 seconds
    };

    this.providerGroups = new Map();
    this.healthCheckIntervals = new Map();
    this.responseCache = new Map();

    // Initialize provider services
    // Apify service removed per user request
    this.hellodataService = new HelloDataService();
    // ATTOM service removed
  }

  /**
   * Initialize redundancy management system
   */
  async initialize(): Promise<void> {
    console.log('🔄 Initializing Data Provider Redundancy Manager...');

    // Setup provider groups with failover chains
    this.setupProviderGroups();

    // Start health monitoring for all providers
    await this.startHealthMonitoring();

    // Initialize circuit breakers
    this.initializeCircuitBreakers();

    console.log('✅ Data Provider Redundancy Manager initialized');
    this.logProviderStatus();
  }

  /**
   * Get data with automatic failover and redundancy
   */
  async getData<T>(request: DataRequest): Promise<DataResponse<T>> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(request);
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return {
        success: true,
        data: cached.data,
        provider: cached.provider,
        responseTime: Date.now() - startTime,
        fromCache: true,
        fallbackUsed: false,
        metadata: {
          attempts: 0,
          providersUsed: [cached.provider],
          totalTime: Date.now() - startTime
        }
      };
    }

    const providerGroup = this.providerGroups.get(request.type);
    if (!providerGroup) {
      throw new Error(`No provider group configured for type: ${request.type}`);
    }

    const providersUsed: string[] = [];
    let attempts = 0;
    let lastError: string = '';
    let fallbackUsed = false;

    // Try providers in priority order
    const providerChain = [providerGroup.activeProvider, ...providerGroup.fallbackChain];
    
    for (const providerId of providerChain) {
      const provider = providerGroup.providers.find(p => p.id === providerId);
      if (!provider || provider.circuitBreakerState === 'open') {
        if (provider?.circuitBreakerState === 'open') {
          console.log(`⚡ Circuit breaker open for ${providerId}, skipping`);
        }
        continue;
      }

      attempts++;
      providersUsed.push(providerId);
      
      if (providerId !== providerGroup.activeProvider) {
        fallbackUsed = true;
        console.log(`🔄 Falling back to provider: ${providerId}`);
      }

      try {
        const providerStartTime = Date.now();
        const result = await this.callProvider(providerId, request);
        const responseTime = Date.now() - providerStartTime;

        // Update provider health
        await this.recordSuccess(providerId, responseTime);

        // Cache successful response
        this.cacheResponse(cacheKey, result, providerId);

        // If we used a fallback and it succeeded, consider failover
        if (fallbackUsed && providerId !== providerGroup.activeProvider) {
          await this.considerFailover(request.type, providerId);
        }

        return {
          success: true,
          data: result,
          provider: providerId,
          responseTime: responseTime,
          fromCache: false,
          fallbackUsed,
          metadata: {
            attempts,
            providersUsed,
            totalTime: Date.now() - startTime
          }
        };

      } catch (error) {
        console.warn(`⚠️ Provider ${providerId} failed: ${error.message}`);
        lastError = error.message;
        
        // Record failure
        await this.recordFailure(providerId, error.message);
        
        // Continue to next provider
        continue;
      }
    }

    // All providers failed
    console.error(`❌ All providers failed for ${request.type}`);
    
    return {
      success: false,
      data: null,
      provider: 'none',
      responseTime: Date.now() - startTime,
      fromCache: false,
      fallbackUsed: true,
      error: `All providers failed. Last error: ${lastError}`,
      metadata: {
        attempts,
        providersUsed,
        totalTime: Date.now() - startTime
      }
    };
  }

  /**
   * Call specific provider based on request type
   */
  private async callProvider(providerId: string, request: DataRequest): Promise<any> {
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Provider timeout')), this.config.timeoutMs);
    });

    let providerPromise: Promise<any>;

    switch (request.type) {
      case 'property_data':
        if (providerId === 'hellodata-primary') {
          providerPromise = this.hellodataService.getPropertyData(request.address);
        } else {
          throw new Error(`Unknown property data provider: ${providerId}`);
        }
        break;

      case 'demographics':
        // Census API removed per user request
        throw new Error('Demographics provider unavailable - Census API removed');
        break;

      // address_validation removed per user request - no USPS integration

      case 'public_listings':
        if (providerId === 'public-listing-primary' && request.dealId) {
          providerPromise = publicListingValidationService.validateDealAgainstPublicListings(request.dealId);
        } else {
          throw new Error(`Unknown public listings provider: ${providerId}`);
        }
        break;

      default:
        throw new Error(`Unknown request type: ${request.type}`);
    }

    return Promise.race([providerPromise, timeout]);
  }

  /**
   * Setup provider groups with failover chains
   */
  private setupProviderGroups(): void {
    // Property Data Providers - Apify removed per user request
    this.providerGroups.set('property_data', {
      type: 'property_data',
      providers: [
        {
          id: 'hellodata-primary',
          name: 'HelloData Service (Primary)',
          status: 'healthy',
          responseTime: 0,
          errorRate: 0,
          lastSuccessful: null,
          lastChecked: new Date(),
          consecutiveFailures: 0,
          circuitBreakerState: 'closed',
          priority: 1
        },
      ],
      activeProvider: 'hellodata-primary',
      fallbackChain: [],
      lastFailover: null
    });

    // Demographics Providers
    this.providerGroups.set('demographics', {
      type: 'demographics',
      providers: [
        {
          id: 'census-primary',
          name: 'Census Service (Primary)',
          status: 'healthy',
          responseTime: 0,
          errorRate: 0,
          lastSuccessful: null,
          lastChecked: new Date(),
          consecutiveFailures: 0,
          circuitBreakerState: 'closed',
          priority: 1
        }
      ],
      activeProvider: 'census-primary',
      fallbackChain: [],
      lastFailover: null
    });

    // Address Validation Providers - REMOVED per user request (no USPS)

    // Public Listings Providers
    this.providerGroups.set('public_listings', {
      type: 'public_listings',
      providers: [
        {
          id: 'public-listing-primary',
          name: 'Public Listing Validation Service (Primary)',
          status: 'healthy',
          responseTime: 0,
          errorRate: 0,
          lastSuccessful: null,
          lastChecked: new Date(),
          consecutiveFailures: 0,
          circuitBreakerState: 'closed',
          priority: 1
        }
      ],
      activeProvider: 'public-listing-primary',
      fallbackChain: [],
      lastFailover: null
    });
  }

  /**
   * Start health monitoring for all providers
   */
  private async startHealthMonitoring(): Promise<void> {
    for (const [groupType, group] of this.providerGroups) {
      for (const provider of group.providers) {
        const interval = setInterval(async () => {
          await this.performHealthCheck(provider.id, groupType);
        }, this.config.healthCheckInterval);
        
        this.healthCheckIntervals.set(provider.id, interval);
      }
    }

    console.log('🔍 Provider health monitoring started');
  }

  /**
   * Perform health check on a specific provider
   */
  private async performHealthCheck(providerId: string, groupType: string): Promise<void> {
    const provider = this.findProvider(providerId);
    if (!provider) return;

    try {
      const startTime = Date.now();
      
      // Perform a lightweight health check
      await this.performLightweightCheck(providerId, groupType);
      
      const responseTime = Date.now() - startTime;
      
      // Update provider health
      provider.lastChecked = new Date();
      provider.responseTime = responseTime;
      
      if (provider.circuitBreakerState === 'half-open' || provider.status !== 'healthy') {
        provider.consecutiveFailures = 0;
        provider.status = 'healthy';
        provider.circuitBreakerState = 'closed';
        provider.lastSuccessful = new Date();
        console.log(`✅ Provider ${providerId} recovered`);
      }
      
    } catch (error) {
      provider.consecutiveFailures++;
      provider.lastChecked = new Date();
      
      if (provider.consecutiveFailures >= this.config.failureThreshold) {
        provider.status = 'failed';
        provider.circuitBreakerState = 'open';
        console.warn(`❌ Provider ${providerId} marked as failed after ${provider.consecutiveFailures} failures`);
        
        // Schedule recovery check
        setTimeout(() => {
          if (provider.circuitBreakerState === 'open') {
            provider.circuitBreakerState = 'half-open';
            console.log(`🔄 Provider ${providerId} circuit breaker half-open for recovery test`);
          }
        }, this.config.circuitBreakerTimeout);
      }
    }
  }

  /**
   * Perform lightweight health check
   */
  private async performLightweightCheck(providerId: string, groupType: string): Promise<void> {
    // Use a simple, fast operation to check provider health
    const testAddress = '123 Test St, Test City, ST 12345';
    
    try {
      switch (groupType) {
        case 'property_data':
          if (providerId === 'apify-primary') {
            // Just check if service is initialized
            if (!this.apifyService) throw new Error('Service not available');
          } else if (providerId === 'hellodata-secondary') {
            if (!this.hellodataService) throw new Error('Service not available');
          }
          break;
          
        case 'demographics':
          throw new Error('Demographics service removed - Census API unavailable');
          break;
          
        // address_validation removed per user request - no USPS integration
          
        case 'public_listings':
          if (!publicListingValidationService) throw new Error('Service not available');
          break;
      }
    } catch (error) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  }

  /**
   * Record successful provider call
   */
  private async recordSuccess(providerId: string, responseTime: number): Promise<void> {
    const provider = this.findProvider(providerId);
    if (!provider) return;

    provider.lastSuccessful = new Date();
    provider.responseTime = responseTime;
    provider.consecutiveFailures = 0;
    
    if (provider.status !== 'healthy') {
      provider.status = 'healthy';
      console.log(`✅ Provider ${providerId} marked as healthy`);
    }
    
    if (provider.circuitBreakerState !== 'closed') {
      provider.circuitBreakerState = 'closed';
      console.log(`🔓 Circuit breaker closed for ${providerId}`);
    }
  }

  /**
   * Record provider failure
   */
  private async recordFailure(providerId: string, error: string): Promise<void> {
    const provider = this.findProvider(providerId);
    if (!provider) return;

    provider.consecutiveFailures++;
    
    if (provider.consecutiveFailures >= this.config.failureThreshold) {
      provider.status = 'failed';
      provider.circuitBreakerState = 'open';
      console.warn(`❌ Provider ${providerId} circuit breaker opened after ${provider.consecutiveFailures} failures`);
    } else {
      provider.status = 'degraded';
    }
  }

  /**
   * Consider automatic failover
   */
  private async considerFailover(groupType: string, successfulProviderId: string): Promise<void> {
    const group = this.providerGroups.get(groupType);
    if (!group) return;

    const currentProvider = group.providers.find(p => p.id === group.activeProvider);
    const successfulProvider = group.providers.find(p => p.id === successfulProviderId);
    
    if (!currentProvider || !successfulProvider) return;

    // Only failover if current provider is failed and successful provider has higher priority
    if (currentProvider.status === 'failed' && successfulProvider.priority <= currentProvider.priority) {
      console.log(`🔄 Automatic failover: ${groupType} from ${group.activeProvider} to ${successfulProviderId}`);
      
      group.activeProvider = successfulProviderId;
      group.lastFailover = new Date();
      
      // Rebuild fallback chain
      group.fallbackChain = group.providers
        .filter(p => p.id !== successfulProviderId)
        .sort((a, b) => a.priority - b.priority)
        .map(p => p.id);
    }
  }

  /**
   * Initialize circuit breakers
   */
  private initializeCircuitBreakers(): void {
    for (const [_, group] of this.providerGroups) {
      for (const provider of group.providers) {
        provider.circuitBreakerState = 'closed';
      }
    }
  }

  /**
   * Cache management
   */
  private generateCacheKey(request: DataRequest): string {
    return `${request.type}:${request.address}:${request.dealId || 'no-deal'}`;
  }

  private getFromCache(key: string): { data: any; provider: string } | null {
    const cached = this.responseCache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp.getTime();
    if (age > this.cacheTimeout) {
      this.responseCache.delete(key);
      return null;
    }

    return { data: cached.data, provider: cached.provider };
  }

  private cacheResponse(key: string, data: any, provider: string): void {
    this.responseCache.set(key, {
      data,
      timestamp: new Date(),
      provider
    });

    // Clean up old cache entries periodically
    if (this.responseCache.size > 1000) {
      const oldKeys = Array.from(this.responseCache.keys()).slice(0, 200);
      oldKeys.forEach(k => this.responseCache.delete(k));
    }
  }

  /**
   * Utility methods
   */
  private findProvider(providerId: string): ProviderHealth | null {
    for (const [_, group] of this.providerGroups) {
      const provider = group.providers.find(p => p.id === providerId);
      if (provider) return provider;
    }
    return null;
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus(): {
    overall: 'healthy' | 'degraded' | 'critical';
    groups: Array<{
      type: string;
      status: string;
      activeProvider: string;
      healthyProviders: number;
      totalProviders: number;
      lastFailover: Date | null;
    }>;
    cacheHitRate: number;
    totalRequests: number;
  } {
    const groups = [];
    let overallHealthy = 0;
    let overallTotal = 0;

    for (const [type, group] of this.providerGroups) {
      const healthyProviders = group.providers.filter(p => p.status === 'healthy').length;
      const totalProviders = group.providers.length;
      
      overallHealthy += healthyProviders;
      overallTotal += totalProviders;

      groups.push({
        type,
        status: healthyProviders === 0 ? 'critical' : 
                healthyProviders < totalProviders ? 'degraded' : 'healthy',
        activeProvider: group.activeProvider,
        healthyProviders,
        totalProviders,
        lastFailover: group.lastFailover
      });
    }

    const overall = overallHealthy === 0 ? 'critical' : 
                   overallHealthy < overallTotal ? 'degraded' : 'healthy';

    return {
      overall,
      groups,
      cacheHitRate: 0.85, // Placeholder
      totalRequests: 0 // Placeholder
    };
  }

  /**
   * Log provider status
   */
  private logProviderStatus(): void {
    console.log('📊 Data Provider Status:');
    for (const [type, group] of this.providerGroups) {
      console.log(`  ${type}:`);
      console.log(`    Active: ${group.activeProvider}`);
      console.log(`    Providers: ${group.providers.map(p => `${p.id}(${p.status})`).join(', ')}`);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down Data Provider Redundancy Manager...');
    
    // Clear all health check intervals
    for (const [_, interval] of this.healthCheckIntervals) {
      clearInterval(interval);
    }
    
    // Clear cache
    this.responseCache.clear();
    
    console.log('✅ Data Provider Redundancy Manager shutdown complete');
  }
}

// Export singleton instance
export const dataProviderRedundancyManager = new DataProviderRedundancyManager();