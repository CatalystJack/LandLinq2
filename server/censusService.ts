/**
 * Census Bureau API Service
 * Fetches demographic data from the US Census Bureau ACS 5-year estimates
 */

export interface CensusDemographics {
  totalPopulation: number | null;
  medianIncome: number | null;
  medianAge: number | null;
  vacancyRate: number | null;
  renterRate: number | null;
  populationGrowth: number | null;
  tractId: string | null;
}

interface CensusApiResponse {
  data: string[][];
  error?: string;
}

const CENSUS_API_BASE = 'https://api.census.gov/data/2023/acs/acs5';
const CENSUS_API_KEY = process.env.CENSUS_API_KEY;

const ACS_VARIABLES = {
  totalPopulation: 'B01003_001E',
  medianIncome: 'B19013_001E',
  medianAge: 'B01002_001E',
  totalHousingUnits: 'B25001_001E',
  vacantUnits: 'B25002_003E',
  renterOccupied: 'B25003_003E',
  ownerOccupied: 'B25003_002E',
};

async function fetchCensusData(
  variables: string[],
  state: string,
  county: string,
  tract: string
): Promise<string[][] | null> {
  if (!CENSUS_API_KEY) {
    console.warn('⚠️ [CENSUS] No API key configured');
    return null;
  }

  const startTime = Date.now();
  const variableList = variables.join(',');
  const url = `${CENSUS_API_BASE}?get=${variableList}&for=tract:${tract}&in=state:${state}&in=county:${county}&key=${CENSUS_API_KEY}`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    const responseTime = Date.now() - startTime;
    const success = response.ok;

    console.log(`   [CENSUS] API call completed in ${responseTime}ms, status: ${response.status}`);

    if (!response.ok) {
      console.error(`❌ [CENSUS] API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data as string[][];
  } catch (error: any) {
    console.error('❌ [CENSUS] Fetch error:', error.message);
    return null;
  }
}

function parseFipsFromTract(tractGeoId: string): { state: string; county: string; tract: string } | null {
  const cleaned = tractGeoId.replace(/\D/g, '');
  if (cleaned.length < 11) {
    return null;
  }
  return {
    state: cleaned.substring(0, 2),
    county: cleaned.substring(2, 5),
    tract: cleaned.substring(5, 11),
  };
}

export async function getCensusDemographics(
  latitude: number,
  longitude: number
): Promise<CensusDemographics> {
  const emptyResult: CensusDemographics = {
    totalPopulation: null,
    medianIncome: null,
    medianAge: null,
    vacancyRate: null,
    renterRate: null,
    populationGrowth: null,
    tractId: null,
  };

  if (!CENSUS_API_KEY) {
    console.warn('⚠️ [CENSUS] No API key configured - skipping demographics fetch');
    return emptyResult;
  }

  console.log(`📊 [CENSUS] Fetching demographics for (${latitude}, ${longitude})`);

  try {
    const geocodioApiKey = process.env.GEOCODIO_API_KEY;
    if (!geocodioApiKey) {
      console.warn('⚠️ [CENSUS] No Geocodio API key - cannot determine census tract');
      return emptyResult;
    }

    const geocodioUrl = `https://api.geocod.io/v1.7/reverse?q=${latitude},${longitude}&fields=census&api_key=${geocodioApiKey}`;
    const geocodioResponse = await fetch(geocodioUrl, { signal: AbortSignal.timeout(10000) });
    
    if (!geocodioResponse.ok) {
      console.error(`❌ [CENSUS] Geocodio reverse geocode failed: ${geocodioResponse.status}`);
      return emptyResult;
    }

    const geocodioData = await geocodioResponse.json();
    const tractData = geocodioData?.results?.[0]?.fields?.census?.['2020']?.tract_code ||
                      geocodioData?.results?.[0]?.fields?.census?.tract_code;
    const stateCode = geocodioData?.results?.[0]?.fields?.census?.['2020']?.state_fips ||
                      geocodioData?.results?.[0]?.fields?.census?.state_fips;
    const countyCode = geocodioData?.results?.[0]?.fields?.census?.['2020']?.county_fips ||
                       geocodioData?.results?.[0]?.fields?.census?.county_fips;

    if (!stateCode || !countyCode || !tractData) {
      console.warn('⚠️ [CENSUS] Could not determine census tract from coordinates');
      return emptyResult;
    }

    console.log(`   📍 Census Tract: ${stateCode}${countyCode}${tractData}`);

    const variables = Object.values(ACS_VARIABLES);
    const data = await fetchCensusData(variables, stateCode, countyCode, tractData);

    if (!data || data.length < 2) {
      console.warn('⚠️ [CENSUS] No data returned for tract');
      return emptyResult;
    }

    const headers = data[0];
    const values = data[1];

    const getValue = (varName: string): number | null => {
      const idx = headers.indexOf(varName);
      if (idx === -1) return null;
      const val = parseFloat(values[idx]);
      return isNaN(val) || val < 0 ? null : val;
    };

    const totalPopulation = getValue(ACS_VARIABLES.totalPopulation);
    const medianIncome = getValue(ACS_VARIABLES.medianIncome);
    const medianAge = getValue(ACS_VARIABLES.medianAge);
    const totalHousing = getValue(ACS_VARIABLES.totalHousingUnits);
    const vacantUnits = getValue(ACS_VARIABLES.vacantUnits);
    const renterOccupied = getValue(ACS_VARIABLES.renterOccupied);
    const ownerOccupied = getValue(ACS_VARIABLES.ownerOccupied);

    let vacancyRate: number | null = null;
    if (totalHousing && vacantUnits !== null) {
      vacancyRate = Math.round((vacantUnits / totalHousing) * 10000) / 100;
    }

    let renterRate: number | null = null;
    const occupiedUnits = (renterOccupied || 0) + (ownerOccupied || 0);
    if (occupiedUnits > 0 && renterOccupied !== null) {
      renterRate = Math.round((renterOccupied / occupiedUnits) * 10000) / 100;
    }

    const result: CensusDemographics = {
      totalPopulation,
      medianIncome,
      medianAge: medianAge !== null ? Math.round(medianAge * 10) / 10 : null,
      vacancyRate,
      renterRate,
      populationGrowth: null,
      tractId: `${stateCode}${countyCode}${tractData}`,
    };

    console.log(`   ✅ [CENSUS] Demographics retrieved:`);
    console.log(`      Population: ${result.totalPopulation?.toLocaleString() || 'N/A'}`);
    console.log(`      Median Income: $${result.medianIncome?.toLocaleString() || 'N/A'}`);
    console.log(`      Median Age: ${result.medianAge || 'N/A'}`);
    console.log(`      Vacancy Rate: ${result.vacancyRate}%`);
    console.log(`      Renter Rate: ${result.renterRate}%`);

    return result;
  } catch (error: any) {
    console.error('❌ [CENSUS] Error fetching demographics:', error.message);
    return emptyResult;
  }
}

export async function enrichDealWithCensusDemographics(
  dealId: string,
  latitude: number,
  longitude: number
): Promise<CensusDemographics | null> {
  const demographics = await getCensusDemographics(latitude, longitude);
  
  if (!demographics.totalPopulation && !demographics.medianIncome) {
    console.log(`⚠️ [CENSUS] No demographic data available for deal ${dealId}`);
    return null;
  }

  console.log(`📊 [CENSUS] Enriched deal ${dealId} with census demographics`);
  return demographics;
}
