import axios from 'axios';
import { apiCallTracker } from './apiCallTracker.js';

/**
 * ArcGIS Demographics Service
 * 
 * Fetches demographic data using ArcGIS GeoEnrichment API
 * following official documentation at:
 * https://developers.arcgis.com/rest/geoenrichment/
 * 
 * Variables follow naming convention: [VARIABLE]_[YEAR]
 * - _CY = Current Year
 * - _FY = 5-Year Forecast
 * - _PY = Prior Year
 */

interface ArcGISToken {
  access_token: string;
  expires_in: number;
  expires_at: number;
}

interface DemographicData {
  population55Plus5Mile: number | null;
  income75Plus55Plus: number | null;
}

let cachedToken: ArcGISToken | null = null;

/**
 * Get ArcGIS OAuth2 access token
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && Date.now() < cachedToken.expires_at) {
    console.log('🔑 [ARCGIS] Using cached access token');
    return cachedToken.access_token;
  }

  const clientId = process.env.ARCGIS_CLIENT_ID;
  const clientSecret = process.env.ARCGIS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('ArcGIS credentials not configured. Please set ARCGIS_CLIENT_ID and ARCGIS_CLIENT_SECRET');
  }

  console.log('🔑 [ARCGIS] Requesting new access token...');

  try {
    const response = await axios.post(
      'https://www.arcgis.com/sharing/rest/oauth2/token',
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, expires_in } = response.data;
    
    cachedToken = {
      access_token,
      expires_in,
      expires_at: Date.now() + (expires_in * 1000) - 60000 // Refresh 1 min before expiry
    };

    console.log(`✅ [ARCGIS] Access token obtained, expires in ${expires_in} seconds`);
    return access_token;

  } catch (error: any) {
    console.error('❌ [ARCGIS] Failed to get access token:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with ArcGIS API');
  }
}

/**
 * Fetch demographic data for a specific address
 * Uses ArcGIS GeoEnrichment API with 5-mile buffer
 * 
 * Target Demographics:
 * - Population 55+ within 5 miles
 * - Households with $75k+ income
 */
export async function fetchDemographics(
  address: string,
  lat?: number,
  lng?: number
): Promise<DemographicData> {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('📊 [ARCGIS] DEMOGRAPHICS FETCH STARTING');
    console.log('='.repeat(80));
    
    const token = await getAccessToken();
    console.log(`🔑 [ARCGIS] Token obtained`);

    // Use coordinates if available, otherwise use address
    const studyArea = lat && lng 
      ? JSON.stringify([{ geometry: { x: lng, y: lat } }])
      : JSON.stringify([{ address: { text: address } }]);

    console.log(`📍 [ARCGIS] Input: ${address}`);
    console.log(`   Coordinates: ${lat && lng ? `${lat}, ${lng}` : 'Using address geocoding'}`);
    
    // Request specific analysis variables following ArcGIS naming conventions
    // Using standard variable names from Age and Income data collections
    const requestParams = {
      studyAreas: studyArea,
      studyAreasOptions: JSON.stringify({
        areaType: 'RingBuffer',
        bufferUnits: 'esriMiles',
        bufferRadii: [5] // 5-mile radius
      }),
      // Request specific analysis variables instead of data collections
      analysisVariables: JSON.stringify([
        'TOTPOP_CY',      // Total Population Current Year
        'MEDAGE_CY',      // Median Age Current Year
        'TOTHH_CY',       // Total Households Current Year
        'MEDHINC_CY',     // Median Household Income Current Year
        'AVGHINC_CY',     // Average Household Income Current Year
        // Age variables - specific age brackets
        'AGE55_CY',       // Population Age 55-59
        'AGE60_CY',       // Population Age 60-64
        'AGE65_CY',       // Population Age 65-69
        'AGE70_CY',       // Population Age 70-74
        'AGE75_CY',       // Population Age 75-79
        'AGE80_CY',       // Population Age 80-84
        'AGE85_CY',       // Population Age 85+
        // Income brackets - $75k and above
        'HINC75_CY',      // Households Income $75k-$99k
        'HINC100_CY',     // Households Income $100k-$124k
        'HINC125_CY',     // Households Income $125k-$149k
        'HINC150_CY',     // Households Income $150k-$199k
        'HINC200_CY',     // Households Income $200k+
      ]),
      returnGeometry: 'false',
      f: 'json',
      token
    };
    
    console.log(`📤 [ARCGIS] Requesting demographics...`);
    console.log(`   Buffer: 5 miles`);
    console.log(`   Variables: Age brackets (55+), Income brackets ($75k+)`);

    const startTime = Date.now();
    let response;
    
    try {
      response = await axios.post(
        'https://geoenrich.arcgis.com/arcgis/rest/services/World/geoenrichmentserver/GeoEnrichment/enrich',
        new URLSearchParams(requestParams),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 15000
        }
      );
      
      const responseTime = Date.now() - startTime;
      apiCallTracker.logCall('ArcGIS', 'GeoEnrichment/enrich', true, responseTime);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      apiCallTracker.logCall('ArcGIS', 'GeoEnrichment/enrich', false, responseTime, {
        errorMessage: error.message
      });
      throw error;
    }
    
    console.log(`📥 [ARCGIS] Response received (${Date.now() - startTime}ms)`);

    const result = response.data;
    
    // DEBUG: Log full response structure to diagnose null demographics
    console.log('🔍 [ARCGIS-DEBUG] Full response structure:');
    console.log(JSON.stringify(result, null, 2));
    
    // Check for API errors
    if (result.error) {
      console.error(`❌ [ARCGIS] API Error:`, result.error);
      throw new Error(`ArcGIS API Error: ${result.error.message || 'Unknown error'}`);
    }
    
    if (!result.results || result.results.length === 0) {
      console.log('⚠️ [ARCGIS] No results in response');
      console.log('   Response keys:', Object.keys(result));
      return {
        population55Plus5Mile: null,
        income75Plus55Plus: null
      };
    }

    // Extract features from response
    const features = result.results[0]?.value?.FeatureSet;
    console.log('🔍 [ARCGIS-DEBUG] FeatureSet path check:');
    console.log('   results[0] exists:', !!result.results[0]);
    console.log('   results[0].value exists:', !!result.results[0]?.value);
    console.log('   FeatureSet exists:', !!features);
    
    if (!features || features.length === 0) {
      console.log('⚠️ [ARCGIS] No features in FeatureSet');
      return {
        population55Plus5Mile: null,
        income75Plus55Plus: null
      };
    }

    // FIX Dec 15, 2025: ArcGIS returns FeatureSet[0].features[0].attributes, NOT FeatureSet[0].attributes
    // Each FeatureSet contains a "features" array with the actual attribute data
    const featureData = features[0]?.features;
    if (!featureData || featureData.length === 0) {
      console.log('⚠️ [ARCGIS] No features array inside FeatureSet[0]');
      console.log('   FeatureSet[0] keys:', Object.keys(features[0] || {}));
      return {
        population55Plus5Mile: null,
        income75Plus55Plus: null
      };
    }
    
    const attributes = featureData[0]?.attributes || {};
    
    console.log(`📊 [ARCGIS] Attributes received: ${Object.keys(attributes).length} fields`);
    
    // Log all available demographic fields for debugging
    const relevantFields = Object.keys(attributes).filter(key => 
      key.includes('AGE') || key.includes('HINC') || key.includes('POP') || key.includes('INC')
    );
    
    if (relevantFields.length > 0) {
      console.log(`🔍 [ARCGIS] Available demographic fields:`);
      relevantFields.forEach(field => {
        console.log(`   ${field}: ${attributes[field]}`);
      });
    }
    
    // Calculate Population 55+ by summing age brackets
    const population55Plus = (
      (attributes.AGE55_CY || 0) +
      (attributes.AGE60_CY || 0) +
      (attributes.AGE65_CY || 0) +
      (attributes.AGE70_CY || 0) +
      (attributes.AGE75_CY || 0) +
      (attributes.AGE80_CY || 0) +
      (attributes.AGE85_CY || 0)
    );

    // Calculate Households with $75k+ income by summing income brackets
    const income75Plus = (
      (attributes.HINC75_CY || 0) +
      (attributes.HINC100_CY || 0) +
      (attributes.HINC125_CY || 0) +
      (attributes.HINC150_CY || 0) +
      (attributes.HINC200_CY || 0)
    );

    const finalData = {
      population55Plus5Mile: population55Plus > 0 ? population55Plus : null,
      income75Plus55Plus: income75Plus > 0 ? income75Plus : null
    };

    console.log(`✅ [ARCGIS] Demographics extracted:`);
    console.log(`   Population 55+: ${finalData.population55Plus5Mile?.toLocaleString() || 'N/A'}`);
    console.log(`   Households $75k+: ${finalData.income75Plus55Plus?.toLocaleString() || 'N/A'}`);
    console.log('='.repeat(80) + '\n');

    return finalData;

  } catch (error: any) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ [ARCGIS] ERROR');
    console.error('='.repeat(80));
    console.error('Error type:', error.name);
    console.error('Error message:', error.message);
    
    if (error.response) {
      console.error('HTTP Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    
    console.error('='.repeat(80) + '\n');
    
    // Return null values on error rather than failing the entire process
    return {
      population55Plus5Mile: null,
      income75Plus55Plus: null
    };
  }
}

/**
 * Test ArcGIS connection and credentials
 */
export async function testArcGISConnection(): Promise<boolean> {
  try {
    const token = await getAccessToken();
    console.log('✅ [ARCGIS] Connection test successful');
    return true;
  } catch (error) {
    console.error('❌ [ARCGIS] Connection test failed:', error);
    return false;
  }
}
