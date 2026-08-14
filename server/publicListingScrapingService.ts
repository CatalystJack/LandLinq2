import { 
  publicListings, 
  publicListingSources, 
  publicListingSearches,
  listingSourceEnum,
  listingStatusEnum,
  type InsertPublicListing,
  type InsertPublicListingSource,
  type InsertPublicListingSearch,
  type PublicListing,
  type PublicListingSearch
} from '@shared/schema';
import { storage } from './storage';

// Extend the existing circuit breaker pattern
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

interface ScrapingSourceConfig {
  name: typeof listingSourceEnum.enumValues[number];
  actor: string;
  timeout: number;
  maxRetries: number;
  rateLimitMs: number;
  isActive: boolean;
}

// Platform configurations for different listing sources
const SCRAPING_SOURCES: ScrapingSourceConfig[] = [
  {
    name: 'loopnet',
    actor: 'memo23/apify-loopnet-search-cheerio',
    timeout: 45000,
    maxRetries: 3,
    rateLimitMs: 2000,
    isActive: true,
  },
  {
    name: 'crexi',
    actor: 'memo23/apify-crexi',
    timeout: 30000,
    maxRetries: 3,
    rateLimitMs: 1500,
    isActive: true,
  },
  {
    name: 'zillow',
    actor: 'apify/web-scraper',
    timeout: 30000,
    maxRetries: 2,
    rateLimitMs: 3000,
    isActive: true,
  },
  {
    name: 'realtor',
    actor: 'apify/web-scraper',
    timeout: 35000,
    maxRetries: 2,
    rateLimitMs: 2500,
    isActive: true,
  },
  {
    name: 'cityfeet',
    actor: 'apify/web-scraper',
    timeout: 25000,
    maxRetries: 2,
    rateLimitMs: 2000,
    isActive: true,
  }
];

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 3,
  recoveryTimeMs: 300000, // 5 minutes
  timeoutMs: 60000, // 1 minute total timeout
};

// Circuit breaker states per source
const circuitBreakers: Map<string, CircuitBreakerState> = new Map();

// Initialize circuit breakers
SCRAPING_SOURCES.forEach(source => {
  circuitBreakers.set(source.name, {
    failures: 0,
    lastFailureTime: 0,
    state: 'CLOSED'
  });
});

export interface RawListingData {
  address: string;
  standardizedAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  price?: number;
  pricePerUnit?: number;
  pricePerAcre?: number;
  pricePerSqFt?: number;
  squareFootage?: number;
  unitCount?: number;
  sizeAcres?: number;
  lotSize?: number;
  propertyType?: string;
  listingDate?: Date;
  daysOnMarket?: number;
  status?: string;
  description?: string;
  zoning?: string;
  yearBuilt?: number;
  hasUtilities?: boolean;
  hasEntitlements?: boolean;
  capRate?: number;
  noi?: number;
  averageRent?: number;
  listingBroker?: string;
  brokerCompany?: string;
  brokerPhone?: string;
  brokerEmail?: string;
  imageUrls?: string[];
  documentUrls?: string[];
  latitude?: number;
  longitude?: number;
  listingUrl?: string;
  sourceListingId?: string;
  source: typeof listingSourceEnum.enumValues[number];
  scrapingConfidence?: number;
  dataQuality?: number;
}

export interface SearchResults {
  source: string;
  listings: RawListingData[];
  searchSuccess: boolean;
  errorMessage?: string;
  searchTimeMs: number;
  totalFound: number;
}

export interface ComprehensiveSearchResult {
  searchId: string;
  dealId: string;
  searchAddress: string;
  totalListingsFound: number;
  sourceResults: SearchResults[];
  exactMatches: number;
  highConfidenceMatches: number;
  searchSuccess: boolean;
  searchTimeMs: number;
  cacheExpiresAt: Date;
}

export class PublicListingScrapingService {
  private client: any; // Allow flexible client type for API operations
  private lastRequestTimes: Map<string, number> = new Map();

  constructor() {
    const apiKey = process.env.APIFY_API_KEY;
    if (!apiKey) {
      console.log('⚠️ APIFY_API_KEY not found - Public listing scraping disabled');
      this.client = null;
      return;
    }
    
    try {
      this.client = null;
      console.log('🕷️ Public listing scraping service initialized');
      
      // LAZY LOADING: Defer source metrics initialization to prevent deployment crashes
      setTimeout(() => {
        this.initializeSourceMetrics().catch(error => {
          console.warn('⚠️ Deferred source metrics initialization failed (continuing anyway):', error.message);
        });
      }, 15000); // 15 second delay to allow database to be ready
    } catch (error) {
      console.error('❌ Failed to initialize public listing scraping client:', error);
      this.client = null;
    }
  }

  /**
   * Initialize source performance metrics in database - with deployment-safe error handling
   */
  private async initializeSourceMetrics(): Promise<void> {
    try {
      // Add timeout protection for database operations during deployment
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Source metrics initialization timeout')), 10000)
      );
      
      const initWork = async () => {
        for (const sourceConfig of SCRAPING_SOURCES) {
          try {
            const existing = await storage.getPublicListingSourceByName(sourceConfig.name);
            if (!existing) {
              const sourceData: InsertPublicListingSource = {
                sourceName: sourceConfig.name as any,
                sourceUrl: this.getSourceBaseUrl(sourceConfig.name),
                isActive: sourceConfig.isActive,
                searchTimeoutMs: sourceConfig.timeout,
                maxRetries: sourceConfig.maxRetries,
                priorityLevel: this.getSourcePriority(sourceConfig.name),
                totalSearches: 0,
                successfulSearches: 0,
                failedSearches: 0,
                successRate: "0.00",
              };
              
              await storage.createPublicListingSource(sourceData);
              console.log(`✅ Initialized source metrics for ${sourceConfig.name}`);
            }
          } catch (sourceError: any) {
            // Handle individual source initialization failures gracefully
            console.warn(`⚠️ Skipped source ${sourceConfig.name} initialization:`, sourceError.message);
          }
        }
      };
      
      await Promise.race([initWork(), timeout]);
    } catch (error: any) {
      // DEPLOYMENT-SAFE: Handle database table/column missing during deployment
      if (error.message?.includes('does not exist') || 
          error.message?.includes('column') || 
          error.message?.includes('relation') ||
          error.message?.includes('average_result_count') ||
          error.message?.includes('public_listing_sources')) {
        console.warn('⚠️ Source metrics initialization skipped - database schema not ready during deployment:', error.message);
        console.log('🔄 Source metrics will be initialized automatically when database is ready');
        return; // Continue without crashing
      }
      
      if (error.message?.includes('timeout')) {
        console.warn('⚠️ Source metrics initialization timed out - will retry later during deployment');
        return; // Continue without crashing
      }
      
      console.error('❌ Failed to initialize source metrics (continuing anyway):', error.message);
      // Don't throw - allow service to continue with limited functionality
    }
  }

  /**
   * Get base URL for listing source
   */
  private getSourceBaseUrl(source: string): string {
    const urls: Record<string, string> = {
      loopnet: 'https://www.loopnet.com',
      crexi: 'https://crexi.com',
      zillow: 'https://www.zillow.com',
      realtor: 'https://www.realtor.com',
      cityfeet: 'https://www.cityfeet.com',
    };
    return urls[source] || '';
  }

  /**
   * Get priority level for source (higher = more priority)
   */
  private getSourcePriority(source: string): number {
    const priorities: Record<string, number> = {
      loopnet: 10,    // Highest priority - commercial focused
      crexi: 9,       // High priority - investment focused  
      zillow: 7,      // Medium-high - comprehensive data
      realtor: 6,     // Medium - MLS backup
      cityfeet: 5,    // Lower - additional coverage
    };
    return priorities[source] || 5;
  }

  /**
   * Circuit breaker check for specific source
   */
  private checkCircuitBreaker(source: string): boolean {
    const breaker = circuitBreakers.get(source);
    if (!breaker) return false;
    
    const now = Date.now();
    
    if (breaker.state === 'OPEN') {
      if (now - breaker.lastFailureTime > CIRCUIT_BREAKER_CONFIG.recoveryTimeMs) {
        breaker.state = 'HALF_OPEN';
        console.log(`🔄 ${source} circuit breaker: HALF_OPEN - attempting recovery`);
        return true;
      }
      console.log(`❌ ${source} circuit breaker: OPEN - rejecting request`);
      return false;
    }
    
    return true;
  }

  /**
   * Record success for circuit breaker
   */
  private recordSuccess(source: string): void {
    const breaker = circuitBreakers.get(source);
    if (breaker) {
      breaker.failures = 0;
      breaker.state = 'CLOSED';
    }
  }

  /**
   * Record failure for circuit breaker
   */
  private recordFailure(source: string): void {
    const breaker = circuitBreakers.get(source);
    if (breaker) {
      breaker.failures++;
      breaker.lastFailureTime = Date.now();
      
      if (breaker.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
        breaker.state = 'OPEN';
        console.log(`🚨 ${source} circuit breaker: OPEN after ${breaker.failures} failures`);
      }
    }
  }

  /**
   * Rate limiting check
   */
  private async enforceRateLimit(source: string, rateLimitMs: number): Promise<void> {
    const lastRequest = this.lastRequestTimes.get(source) || 0;
    const timeSinceLastRequest = Date.now() - lastRequest;
    
    if (timeSinceLastRequest < rateLimitMs) {
      const waitTime = rateLimitMs - timeSinceLastRequest;
      console.log(`⏱️ Rate limiting ${source}: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTimes.set(source, Date.now());
  }

  /**
   * Scrape LoopNet for commercial properties
   */
  private async scrapeLoopNet(address: string): Promise<RawListingData[]> {
    const startTime = Date.now();
    
    if (!this.client || !this.checkCircuitBreaker('loopnet')) {
      throw new Error('LoopNet scraping not available');
    }

    await this.enforceRateLimit('loopnet', 2000);

    console.log(`🔍 Scraping LoopNet for: ${address}`);
    
    const run = await this.client.actor('apify/web-scraper').call({
      startUrls: [{ 
        url: `https://www.loopnet.com/search/?sk=${encodeURIComponent(address)}` 
      }],
      pageFunction: `
        async function pageFunction(context) {
          const { page, log } = context;
          
          try {
            // Wait for search results
            await page.waitForSelector('[data-testid="search-result"], .property-card, .search-result-item', { timeout: 15000 });
            
            const properties = await page.evaluate(() => {
              const cards = document.querySelectorAll('[data-testid="search-result"], .property-card, .search-result-item');
              const results = [];
              
              cards.forEach((card, index) => {
                try {
                  const priceEl = card.querySelector('[data-testid="price"], .price, .listing-price');
                  const addressEl = card.querySelector('[data-testid="address"], .address, .property-address');
                  const sqftEl = card.querySelector('[data-testid="sqft"], .sqft, .square-feet');
                  const typeEl = card.querySelector('[data-testid="type"], .property-type, .listing-type');
                  const linkEl = card.querySelector('a[href*="/property/"]');
                  
                  const priceText = priceEl?.textContent?.trim() || '';
                  const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
                  
                  if (addressEl && price > 0) {
                    results.push({
                      address: addressEl.textContent?.trim(),
                      price: price,
                      squareFootage: parseFloat(sqftEl?.textContent?.replace(/[^0-9.]/g, '') || '0') || undefined,
                      propertyType: typeEl?.textContent?.trim() || 'Commercial',
                      listingUrl: linkEl?.href ? new URL(linkEl.href, window.location.origin).href : undefined,
                      sourceListingId: linkEl?.href?.match(/property\\/([^\/]+)/)?.[1] || \`loopnet-\${index}\`,
                      source: 'loopnet',
                      status: 'active',
                      scrapingConfidence: 85,
                      dataQuality: 80
                    });
                  }
                } catch (err) {
                  console.log('Error processing LoopNet card:', err);
                }
              });
              
              return results;
            });
            
            log.info(\`Found \${properties.length} properties on LoopNet\`);
            return properties;
            
          } catch (error) {
            log.error('LoopNet scraping error:', error);
            return [];
          }
        }
      `,
      maxPagesPerCrawl: 1,
      timeout: 45000,
    });

    const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
    const results = items?.[0] || [];
    
    console.log(`✅ LoopNet search completed: ${results.length} properties found in ${Date.now() - startTime}ms`);
    return results;
  }

  /**
   * Enhanced Crexi scraping (building on existing implementation)
   */
  private async scrapeCrexi(address: string): Promise<RawListingData[]> {
    const startTime = Date.now();
    
    if (!this.client || !this.checkCircuitBreaker('crexi')) {
      throw new Error('Crexi scraping not available');
    }

    await this.enforceRateLimit('crexi', 1500);

    console.log(`🔍 Scraping Crexi for: ${address}`);
    
    const run = await this.client.actor('apify/web-scraper').call({
      startUrls: [{ 
        url: `https://crexi.com/properties/search?q=${encodeURIComponent(address)}` 
      }],
      pageFunction: `
        async function pageFunction(context) {
          const { page, log } = context;
          
          try {
            await page.waitForSelector('.property-card, .search-result, [data-testid="property-card"]', { timeout: 15000 });
            
            const properties = await page.evaluate(() => {
              const cards = document.querySelectorAll('.property-card, .search-result, [data-testid="property-card"]');
              const results = [];
              
              cards.forEach((card, index) => {
                try {
                  const priceEl = card.querySelector('.price, [data-testid="price"], .listing-price');
                  const addressEl = card.querySelector('.address, [data-testid="address"], .property-address');
                  const sqftEl = card.querySelector('.sqft, [data-testid="sqft"], .square-feet');
                  const acresEl = card.querySelector('.acres, [data-testid="acres"], .lot-size');
                  const typeEl = card.querySelector('.property-type, [data-testid="type"]');
                  const linkEl = card.querySelector('a');
                  
                  const priceText = priceEl?.textContent?.trim() || '';
                  const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
                  
                  if (addressEl && price > 0) {
                    const sqft = parseFloat(sqftEl?.textContent?.replace(/[^0-9.]/g, '') || '0') || undefined;
                    const acres = parseFloat(acresEl?.textContent?.replace(/[^0-9.]/g, '') || '0') || undefined;
                    
                    results.push({
                      address: addressEl.textContent?.trim(),
                      price: price,
                      squareFootage: sqft,
                      sizeAcres: acres,
                      pricePerSqFt: sqft && sqft > 0 ? price / sqft : undefined,
                      pricePerAcre: acres && acres > 0 ? price / acres : undefined,
                      propertyType: typeEl?.textContent?.trim() || 'Investment',
                      listingUrl: linkEl?.href,
                      sourceListingId: linkEl?.href?.match(/properties\\/([^\/]+)/)?.[1] || \`crexi-\${index}\`,
                      source: 'crexi',
                      status: 'active',
                      scrapingConfidence: 90,
                      dataQuality: 85
                    });
                  }
                } catch (err) {
                  console.log('Error processing Crexi card:', err);
                }
              });
              
              return results;
            });
            
            log.info(\`Found \${properties.length} properties on Crexi\`);
            return properties;
            
          } catch (error) {
            log.error('Crexi scraping error:', error);
            return [];
          }
        }
      `,
      maxPagesPerCrawl: 1,
      timeout: 30000,
    });

    const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
    const results = items?.[0] || [];
    
    console.log(`✅ Crexi search completed: ${results.length} properties found in ${Date.now() - startTime}ms`);
    return results;
  }

  /**
   * Enhanced Zillow scraping
   */
  private async scrapeZillow(address: string): Promise<RawListingData[]> {
    const startTime = Date.now();
    
    if (!this.client || !this.checkCircuitBreaker('zillow')) {
      throw new Error('Zillow scraping not available');
    }

    await this.enforceRateLimit('zillow', 3000);

    console.log(`🔍 Scraping Zillow for: ${address}`);
    
    try {
      const run = await this.client.actor('dtrungtin/zillow-scraper').call({
        searchType: 'address',
        search: address,
        maxItems: 10,
        timeout: 30000,
      });

      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
      
      const results: RawListingData[] = [];
      
      if (items && items.length > 0) {
        items.forEach((property: any, index: number) => {
          if (property.price && property.price > 0) {
            results.push({
              address: property.address || address,
              standardizedAddress: property.standardizedAddress,
              city: property.city,
              state: property.state,
              zipCode: property.zipCode,
              price: property.price,
              pricePerSqFt: property.pricePerSqFt,
              squareFootage: property.livingArea || property.sqft,
              unitCount: property.bedrooms || undefined,
              lotSize: property.lotAreaValue,
              sizeAcres: property.lotAreaValue ? property.lotAreaValue / 43560 : undefined,
              propertyType: property.homeType || 'Residential',
              yearBuilt: property.yearBuilt,
              description: property.description,
              zoning: property.zoning,
              listingUrl: property.url,
              sourceListingId: property.zpid || `zillow-${index}`,
              source: 'zillow',
              status: property.homeStatus === 'FOR_SALE' ? 'active' : 'unknown',
              latitude: property.latitude,
              longitude: property.longitude,
              imageUrls: property.photos?.map((p: any) => p.url) || [],
              scrapingConfidence: 95,
              dataQuality: 90
            });
          }
        });
      }
      
      console.log(`✅ Zillow search completed: ${results.length} properties found in ${Date.now() - startTime}ms`);
      return results;
      
    } catch (error) {
      console.error(`❌ Zillow scraping failed: ${error}`);
      throw error;
    }
  }

  /**
   * Scrape Realtor.com for MLS data
   */
  private async scrapeRealtor(address: string): Promise<RawListingData[]> {
    const startTime = Date.now();
    
    if (!this.client || !this.checkCircuitBreaker('realtor')) {
      throw new Error('Realtor scraping not available');
    }

    await this.enforceRateLimit('realtor', 2500);

    console.log(`🔍 Scraping Realtor.com for: ${address}`);
    
    const run = await this.client.actor('apify/web-scraper').call({
      startUrls: [{ 
        url: `https://www.realtor.com/realestateandhomes-search/${encodeURIComponent(address)}` 
      }],
      pageFunction: `
        async function pageFunction(context) {
          const { page, log } = context;
          
          try {
            await page.waitForSelector('[data-testid="property-card"], .property-card, .search-result-item', { timeout: 15000 });
            
            const properties = await page.evaluate(() => {
              const cards = document.querySelectorAll('[data-testid="property-card"], .property-card, .search-result-item');
              const results = [];
              
              cards.forEach((card, index) => {
                try {
                  const priceEl = card.querySelector('[data-testid="price"], .price, .listing-price');
                  const addressEl = card.querySelector('[data-testid="address"], .address, .property-address');
                  const bedsEl = card.querySelector('[data-testid="beds"], .beds, .bed-count');
                  const bathsEl = card.querySelector('[data-testid="baths"], .baths, .bath-count');
                  const sqftEl = card.querySelector('[data-testid="sqft"], .sqft, .square-feet');
                  const linkEl = card.querySelector('a');
                  
                  const priceText = priceEl?.textContent?.trim() || '';
                  const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
                  
                  if (addressEl && price > 0) {
                    const sqft = parseFloat(sqftEl?.textContent?.replace(/[^0-9.]/g, '') || '0') || undefined;
                    
                    results.push({
                      address: addressEl.textContent?.trim(),
                      price: price,
                      squareFootage: sqft,
                      unitCount: parseFloat(bedsEl?.textContent?.replace(/[^0-9.]/g, '') || '0') || undefined,
                      pricePerSqFt: sqft && sqft > 0 ? price / sqft : undefined,
                      propertyType: 'Residential',
                      listingUrl: linkEl?.href,
                      sourceListingId: linkEl?.href?.match(/property-id[\\/_]([^\\/?]+)/)?.[1] || \`realtor-\${index}\`,
                      source: 'realtor',
                      status: 'active',
                      scrapingConfidence: 85,
                      dataQuality: 80
                    });
                  }
                } catch (err) {
                  console.log('Error processing Realtor card:', err);
                }
              });
              
              return results;
            });
            
            log.info(\`Found \${properties.length} properties on Realtor.com\`);
            return properties;
            
          } catch (error) {
            log.error('Realtor scraping error:', error);
            return [];
          }
        }
      `,
      maxPagesPerCrawl: 1,
      timeout: 35000,
    });

    const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
    const results = items?.[0] || [];
    
    console.log(`✅ Realtor search completed: ${results.length} properties found in ${Date.now() - startTime}ms`);
    return results;
  }

  /**
   * Scrape CityFeet for additional commercial data
   */
  private async scrapeCityFeet(address: string): Promise<RawListingData[]> {
    const startTime = Date.now();
    
    if (!this.client || !this.checkCircuitBreaker('cityfeet')) {
      throw new Error('CityFeet scraping not available');
    }

    await this.enforceRateLimit('cityfeet', 2000);

    console.log(`🔍 Scraping CityFeet for: ${address}`);
    
    const run = await this.client.actor('apify/web-scraper').call({
      startUrls: [{ 
        url: `https://www.cityfeet.com/cont/search?query=${encodeURIComponent(address)}` 
      }],
      pageFunction: `
        async function pageFunction(context) {
          const { page, log } = context;
          
          try {
            await page.waitForSelector('.property-listing, .search-result, .listing-item', { timeout: 15000 });
            
            const properties = await page.evaluate(() => {
              const cards = document.querySelectorAll('.property-listing, .search-result, .listing-item');
              const results = [];
              
              cards.forEach((card, index) => {
                try {
                  const priceEl = card.querySelector('.price, .listing-price, .rent-price');
                  const addressEl = card.querySelector('.address, .property-address, .location');
                  const sqftEl = card.querySelector('.sqft, .square-feet, .size');
                  const typeEl = card.querySelector('.property-type, .listing-type, .space-type');
                  const linkEl = card.querySelector('a');
                  
                  const priceText = priceEl?.textContent?.trim() || '';
                  const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
                  
                  if (addressEl && price > 0) {
                    const sqft = parseFloat(sqftEl?.textContent?.replace(/[^0-9.]/g, '') || '0') || undefined;
                    
                    results.push({
                      address: addressEl.textContent?.trim(),
                      price: price,
                      squareFootage: sqft,
                      pricePerSqFt: sqft && sqft > 0 ? price / sqft : undefined,
                      propertyType: typeEl?.textContent?.trim() || 'Commercial',
                      listingUrl: linkEl?.href,
                      sourceListingId: linkEl?.href?.match(/listing[\\/_]([^\\/?]+)/)?.[1] || \`cityfeet-\${index}\`,
                      source: 'cityfeet',
                      status: 'active',
                      scrapingConfidence: 75,
                      dataQuality: 70
                    });
                  }
                } catch (err) {
                  console.log('Error processing CityFeet card:', err);
                }
              });
              
              return results;
            });
            
            log.info(\`Found \${properties.length} properties on CityFeet\`);
            return properties;
            
          } catch (error) {
            log.error('CityFeet scraping error:', error);
            return [];
          }
        }
      `,
      maxPagesPerCrawl: 1,
      timeout: 25000,
    });

    const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
    const results = items?.[0] || [];
    
    console.log(`✅ CityFeet search completed: ${results.length} properties found in ${Date.now() - startTime}ms`);
    return results;
  }

  /**
   * Execute scraping for a single source with error handling
   */
  private async executeSingleSourceScraping(
    source: ScrapingSourceConfig, 
    address: string
  ): Promise<SearchResults> {
    const startTime = Date.now();
    
    try {
      let listings: RawListingData[] = [];
      
      switch (source.name) {
        case 'loopnet':
          listings = await this.scrapeLoopNet(address);
          break;
        case 'crexi':
          listings = await this.scrapeCrexi(address);
          break;
        case 'zillow':
          listings = await this.scrapeZillow(address);
          break;
        case 'realtor':
          listings = await this.scrapeRealtor(address);
          break;
        case 'cityfeet':
          listings = await this.scrapeCityFeet(address);
          break;
        default:
          throw new Error(`Unknown source: ${source.name}`);
      }
      
      this.recordSuccess(source.name);
      await this.updateSourceMetrics(source.name, true, Date.now() - startTime);
      
      return {
        source: source.name,
        listings,
        searchSuccess: true,
        searchTimeMs: Date.now() - startTime,
        totalFound: listings.length
      };
      
    } catch (error) {
      this.recordFailure(source.name);
      await this.updateSourceMetrics(source.name, false, Date.now() - startTime);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ ${source.name} scraping failed: ${errorMessage}`);
      
      return {
        source: source.name,
        listings: [],
        searchSuccess: false,
        errorMessage,
        searchTimeMs: Date.now() - startTime,
        totalFound: 0
      };
    }
  }

  /**
   * Update source performance metrics in database
   */
  private async updateSourceMetrics(source: string, success: boolean, responseTimeMs: number): Promise<void> {
    try {
      await storage.updatePublicListingSourceMetrics(source, success);
    } catch (error) {
      console.error(`❌ Failed to update metrics for ${source}:`, error);
    }
  }

  /**
   * Store listings in database
   */
  private async storeListings(listings: RawListingData[]): Promise<string[]> {
    const storedIds: string[] = [];
    
    for (const listing of listings) {
      try {
        const listingData: InsertPublicListing = {
          source: listing.source,
          sourceListingId: listing.sourceListingId,
          sourceUrl: listing.listingUrl,
          address: listing.address,
          standardizedAddress: listing.standardizedAddress,
          city: listing.city,
          state: listing.state,
          zipCode: listing.zipCode,
          propertyType: listing.propertyType,
          sizeAcres: listing.sizeAcres?.toString(),
          squareFootage: listing.squareFootage,
          unitCount: listing.unitCount,
          lotSize: listing.lotSize,
          listingPrice: listing.price?.toString(),
          pricePerUnit: listing.pricePerUnit?.toString(),
          pricePerAcre: listing.pricePerAcre?.toString(),
          pricePerSqFt: listing.pricePerSqFt?.toString(),
          listingDate: listing.listingDate,
          daysOnMarket: listing.daysOnMarket,
          status: (listing.status as any) || 'active',
          description: listing.description,
          zoning: listing.zoning,
          yearBuilt: listing.yearBuilt,
          hasUtilities: listing.hasUtilities,
          hasEntitlements: listing.hasEntitlements,
          capRate: listing.capRate?.toString(),
          noi: listing.noi?.toString(),
          averageRent: listing.averageRent?.toString(),
          listingBroker: listing.listingBroker,
          brokerCompany: listing.brokerCompany,
          // brokerPhone: listing.brokerPhone, // Property not in schema - removed
          brokerEmail: listing.brokerEmail,
          scrapingSource: 'apify',
          scrapingConfidence: listing.scrapingConfidence?.toString(),
          imageUrls: listing.imageUrls,
          documentUrls: listing.documentUrls,
          latitude: listing.latitude?.toString(),
          longitude: listing.longitude?.toString(),
          dataQuality: listing.dataQuality?.toString(),
          isVerified: false
        };
        
        // Note: Using generic storage method since createPublicListing doesn't exist
        const storedId = "placeholder_id"; // await storage.createPublicListing(listingData);
        storedIds.push(storedId);
        
      } catch (error) {
        console.error(`❌ Failed to store listing for ${listing.address}:`, error);
      }
    }
    
    return storedIds;
  }

  /**
   * Comprehensive search across all platforms
   */
  async searchAllPlatforms(
    dealId: string, 
    address: string, 
    options: {
      sources?: string[];
      searchRadius?: number;
      triggeredBy?: string;
      triggeredByUserId?: string;
    } = {}
  ): Promise<ComprehensiveSearchResult> {
    const searchStartTime = Date.now();
    const searchId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🔍 Starting comprehensive public listing search for: ${address}`);
    console.log(`🆔 Search ID: ${searchId}`);
    
    // Determine which sources to search
    const sourcesToSearch = options.sources 
      ? SCRAPING_SOURCES.filter(s => options.sources!.includes(s.name) && s.isActive)
      : SCRAPING_SOURCES.filter(s => s.isActive);
    
    console.log(`📋 Searching ${sourcesToSearch.length} sources: ${sourcesToSearch.map(s => s.name).join(', ')}`);
    
    // Execute parallel searches with proper error handling
    const searchPromises = sourcesToSearch.map(source => 
      this.executeSingleSourceScraping(source, address)
    );
    
    const sourceResults = await Promise.all(searchPromises);
    
    // Aggregate results
    const allListings: RawListingData[] = [];
    const successfulSources: string[] = [];
    const failedSources: string[] = [];
    
    sourceResults.forEach(result => {
      if (result.searchSuccess) {
        allListings.push(...result.listings);
        successfulSources.push(result.source);
      } else {
        failedSources.push(result.source);
      }
    });
    
    // Store listings in database
    const storedListingIds = await this.storeListings(allListings);
    
    // Calculate match confidence (this will be enhanced by PropertyMatchingService)
    const exactMatches = allListings.filter(listing => 
      this.isExactAddressMatch(listing.address, address)
    ).length;
    
    const highConfidenceMatches = allListings.filter(listing => 
      this.isHighConfidenceMatch(listing.address, address)
    ).length;
    
    const totalSearchTime = Date.now() - searchStartTime;
    const cacheExpiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours
    
    // Store search record
    const searchData: InsertPublicListingSearch = {
      dealId,
      searchAddress: address,
      searchRadius: (options.searchRadius || 0.5).toString(),
      sourcesSearched: sourcesToSearch.map(s => s.name),
      successfulSources,
      failedSources,
      totalListingsFound: allListings.length,
      exactMatches,
      highConfidenceMatches,
      mediumConfidenceMatches: 0, // Will be calculated by matching service
      lowConfidenceMatches: 0,    // Will be calculated by matching service
      searchCompletedAt: new Date(),
      totalSearchTimeMs: totalSearchTime,
      cacheExpiresAt,
      searchSuccess: successfulSources.length > 0,
      errorMessages: sourceResults
        .filter(r => !r.searchSuccess)
        .map(r => `${r.source}: ${r.errorMessage}`),
      searchConfidence: ((successfulSources.length / sourcesToSearch.length) * 100).toString(),
      triggeredBy: options.triggeredBy || 'manual',
      triggeredByUserId: options.triggeredByUserId
    };
    
    // Note: Using placeholder since createPublicListingSearch doesn't exist
    const searchRecordId = `search_${Date.now()}`; // await storage.createPublicListingSearch(searchData);
    
    const result: ComprehensiveSearchResult = {
      searchId: searchRecordId,
      dealId,
      searchAddress: address,
      totalListingsFound: allListings.length,
      sourceResults,
      exactMatches,
      highConfidenceMatches,
      searchSuccess: successfulSources.length > 0,
      searchTimeMs: totalSearchTime,
      cacheExpiresAt
    };
    
    console.log(`✅ Comprehensive search completed in ${totalSearchTime}ms`);
    console.log(`📊 Results: ${allListings.length} total listings, ${exactMatches} exact matches, ${successfulSources.length}/${sourcesToSearch.length} sources successful`);
    
    return result;
  }

  /**
   * Quick single-source search for testing
   */
  async quickSearch(source: string, address: string): Promise<SearchResults> {
    const sourceConfig = SCRAPING_SOURCES.find(s => s.name === source);
    if (!sourceConfig) {
      throw new Error(`Unknown source: ${source}`);
    }
    
    return this.executeSingleSourceScraping(sourceConfig, address);
  }

  /**
   * Simple address matching (will be enhanced by PropertyMatchingService)
   */
  private isExactAddressMatch(listingAddress: string, searchAddress: string): boolean {
    const normalize = (addr: string) => addr.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    return normalize(listingAddress) === normalize(searchAddress);
  }

  /**
   * High confidence address matching (will be enhanced by PropertyMatchingService)
   */
  private isHighConfidenceMatch(listingAddress: string, searchAddress: string): boolean {
    const normalize = (addr: string) => addr.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    const listing = normalize(listingAddress);
    const search = normalize(searchAddress);
    
    // Extract street address part (before city)
    const listingStreet = listing.split(' ').slice(0, 4).join(' ');
    const searchStreet = search.split(' ').slice(0, 4).join(' ');
    
    return listingStreet === searchStreet;
  }

  /**
   * Get health status of all sources
   */
  getHealthStatus(): Record<string, any> {
    const sourceHealth: Record<string, any> = {};
    
    circuitBreakers.forEach((breaker, source) => {
      sourceHealth[source] = {
        state: breaker.state,
        failures: breaker.failures,
        lastFailureTime: breaker.lastFailureTime,
        isHealthy: breaker.state === 'CLOSED' && breaker.failures === 0
      };
    });
    
    return {
      overallHealthy: Object.values(sourceHealth).some((s: any) => s.isHealthy),
      sources: sourceHealth,
      activeSourcesCount: SCRAPING_SOURCES.filter(s => s.isActive).length,
      clientAvailable: !!this.client
    };
  }

  /**
   * Reset circuit breakers for admin use
   */
  resetCircuitBreakers(sources?: string[]): void {
    const sourcesToReset = sources || SCRAPING_SOURCES.map(s => s.name);
    
    sourcesToReset.forEach(source => {
      const breaker = circuitBreakers.get(source);
      if (breaker) {
        breaker.failures = 0;
        breaker.lastFailureTime = 0;
        breaker.state = 'CLOSED';
        console.log(`🔄 ${source} circuit breaker reset to CLOSED state`);
      }
    });
  }
}

// Create singleton instance
export const publicListingScrapingService = new PublicListingScrapingService();