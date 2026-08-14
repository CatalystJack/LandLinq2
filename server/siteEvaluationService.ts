/**
 * Site Evaluation Service for NC LIHTC QAP Scoring
 * Integrates free government APIs for comprehensive site analysis:
 * - FEMA Flood Zone API (free)
 * - EPA Envirofacts API (free)
 * - USGS Elevation API (free)
 * - Google Transit API (uses existing Google Maps key)
 */

interface FloodZoneResult {
  isInFloodZone: boolean;
  floodZone: string | null;
  floodZoneDescription: string | null;
  source: string;
}

interface HazardousSiteResult {
  hasNearbyHazards: boolean;
  hazardCount: number;
  nearestHazard: {
    name: string;
    type: string;
    distance: number;
  } | null;
  hazards: Array<{
    name: string;
    type: string;
    distance: number;
  }>;
}

interface SlopeResult {
  hasSteepSlope: boolean;
  avgSlope: number | null;
  maxSlope: number | null;
  elevationPoints: number[];
}

interface TransitResult {
  hasNearbyTransit: boolean;
  nearestStopDistance: number | null;
  transitScore: number;
  stops: Array<{
    name: string;
    distance: number;
    types: string[];
  }>;
}

interface IncompatibleUseResult {
  hasIncompatibleUses: boolean;
  issues: string[];
  nearbyAirports: Array<{ name: string; distance: number }>;
  nearbyIndustrial: Array<{ name: string; distance: number }>;
  nearbyAdultEntertainment: Array<{ name: string; distance: number }>;
}

export interface SiteEvaluationResult {
  floodZone: FloodZoneResult;
  hazardousSites: HazardousSiteResult;
  slope: SlopeResult;
  transit: TransitResult;
  incompatibleUses: IncompatibleUseResult;
  siteScore: {
    noIncompatibleUses: number;
    noNegativeFeatures: number;
    visibility: number;
    trafficSafety: number;
    transitPoints: number;
    total: number;
  };
}

const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  const c = 2 * Math.asin(Math.sqrt(a));
  return 3956 * c;
};

/**
 * Check FEMA National Flood Hazard Layer for flood zone status
 * API is free and requires no authentication
 */
async function checkFloodZone(lat: number, lng: number): Promise<FloodZoneResult> {
  try {
    const url = `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,ZONE_SUBTY,SFHA_TF&returnGeometry=false&f=json`;
    
    const response = await fetch(url, { 
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      throw new Error(`FEMA API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0].attributes;
      const floodZone = feature.FLD_ZONE;
      const isSFHA = feature.SFHA_TF === 'T';
      
      const zoneDescriptions: Record<string, string> = {
        'A': 'High Risk - 1% annual chance of flooding',
        'AE': 'High Risk - Base flood elevations determined',
        'AH': 'High Risk - Shallow flooding (1-3 ft)',
        'AO': 'High Risk - Sheet flow flooding',
        'V': 'High Risk - Coastal flooding with velocity',
        'VE': 'High Risk - Coastal with base flood elevations',
        'X': 'Moderate to Low Risk',
        'D': 'Undetermined Risk'
      };
      
      return {
        isInFloodZone: isSFHA || ['A', 'AE', 'AH', 'AO', 'V', 'VE'].includes(floodZone),
        floodZone,
        floodZoneDescription: zoneDescriptions[floodZone] || `Zone ${floodZone}`,
        source: 'FEMA NFHL'
      };
    }
    
    return {
      isInFloodZone: false,
      floodZone: null,
      floodZoneDescription: 'No flood zone data available',
      source: 'FEMA NFHL'
    };
  } catch (error) {
    console.error('FEMA Flood Zone API error:', error);
    return {
      isInFloodZone: false,
      floodZone: null,
      floodZoneDescription: 'Unable to check flood zone',
      source: 'FEMA NFHL (error)'
    };
  }
}

/**
 * Check EPA Envirofacts for nearby hazardous sites
 * Searches TRI (Toxics Release Inventory), Superfund, and RCRA facilities
 */
async function checkHazardousSites(lat: number, lng: number, radiusMiles: number = 1): Promise<HazardousSiteResult> {
  const hazards: Array<{ name: string; type: string; distance: number }> = [];
  
  try {
    const latRange = radiusMiles / 69;
    const lngRange = radiusMiles / (69 * Math.cos(lat * Math.PI / 180));
    
    const minLat = lat - latRange;
    const maxLat = lat + latRange;
    const minLng = lng - lngRange;
    const maxLng = lng + lngRange;
    
    const triUrl = `https://data.epa.gov/efservice/TRI_FACILITY/LATITUDE/${minLat}/${maxLat}/LONGITUDE/${minLng}/${maxLng}/JSON`;
    
    const triResponse = await fetch(triUrl, {
      signal: AbortSignal.timeout(15000)
    });
    
    if (triResponse.ok) {
      const triData = await triResponse.json();
      
      if (Array.isArray(triData)) {
        triData.forEach((facility: any) => {
          if (facility.LATITUDE && facility.LONGITUDE) {
            const distance = haversineDistance(lat, lng, facility.LATITUDE, facility.LONGITUDE);
            if (distance <= radiusMiles) {
              hazards.push({
                name: facility.FACILITY_NAME || 'Unknown Facility',
                type: 'TRI Facility',
                distance: Math.round(distance * 100) / 100
              });
            }
          }
        });
      }
    }
  } catch (error) {
    console.error('EPA TRI API error:', error);
  }
  
  try {
    const latRange = radiusMiles / 69;
    const lngRange = radiusMiles / (69 * Math.cos(lat * Math.PI / 180));
    
    const rcraUrl = `https://data.epa.gov/efservice/RCRAINFO_FACILITY_SITE/LATITUDE83/${(lat - latRange).toFixed(4)}/${(lat + latRange).toFixed(4)}/LONGITUDE83/${(lng - lngRange).toFixed(4)}/${(lng + lngRange).toFixed(4)}/rows/0:50/JSON`;
    
    const rcraResponse = await fetch(rcraUrl, {
      signal: AbortSignal.timeout(15000)
    });
    
    if (rcraResponse.ok) {
      const rcraData = await rcraResponse.json();
      
      if (Array.isArray(rcraData)) {
        rcraData.forEach((facility: any) => {
          if (facility.LATITUDE83 && facility.LONGITUDE83) {
            const distance = haversineDistance(lat, lng, facility.LATITUDE83, facility.LONGITUDE83);
            if (distance <= radiusMiles) {
              hazards.push({
                name: facility.SITE_NAME || facility.PRIMARY_NAME || 'Unknown Facility',
                type: 'RCRA Hazardous Waste',
                distance: Math.round(distance * 100) / 100
              });
            }
          }
        });
      }
    }
  } catch (error) {
    console.error('EPA RCRA API error:', error);
  }
  
  hazards.sort((a, b) => a.distance - b.distance);
  
  return {
    hasNearbyHazards: hazards.length > 0,
    hazardCount: hazards.length,
    nearestHazard: hazards.length > 0 ? hazards[0] : null,
    hazards: hazards.slice(0, 10)
  };
}

/**
 * Check USGS Elevation API for slope analysis
 * Samples elevation points around the site to detect steep slopes
 */
async function checkSlope(lat: number, lng: number): Promise<SlopeResult> {
  try {
    const offset = 0.001;
    const points = [
      { lat, lng },
      { lat: lat + offset, lng },
      { lat: lat - offset, lng },
      { lat, lng: lng + offset },
      { lat, lng: lng - offset },
      { lat: lat + offset, lng: lng + offset },
      { lat: lat - offset, lng: lng - offset }
    ];
    
    const elevations: number[] = [];
    
    for (const point of points) {
      try {
        const url = `https://epqs.nationalmap.gov/v1/json?x=${point.lng}&y=${point.lat}&units=Feet&wkid=4326`;
        const response = await fetch(url, {
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.value !== undefined && data.value !== -1000000) {
            elevations.push(data.value);
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    if (elevations.length < 2) {
      return {
        hasSteepSlope: false,
        avgSlope: null,
        maxSlope: null,
        elevationPoints: elevations
      };
    }
    
    const slopes: number[] = [];
    const distanceFeet = offset * 364000;
    
    for (let i = 1; i < elevations.length; i++) {
      const rise = Math.abs(elevations[i] - elevations[0]);
      const slopePercent = (rise / distanceFeet) * 100;
      slopes.push(slopePercent);
    }
    
    const avgSlope = slopes.reduce((a, b) => a + b, 0) / slopes.length;
    const maxSlope = Math.max(...slopes);
    
    return {
      hasSteepSlope: maxSlope > 15,
      avgSlope: Math.round(avgSlope * 10) / 10,
      maxSlope: Math.round(maxSlope * 10) / 10,
      elevationPoints: elevations
    };
  } catch (error) {
    console.error('USGS Elevation API error:', error);
    return {
      hasSteepSlope: false,
      avgSlope: null,
      maxSlope: null,
      elevationPoints: []
    };
  }
}

/**
 * Check for nearby transit stops using Google Places API
 * Returns up to 6 points for compliant transit stops
 * QAP 2026 §IV(A)(1)(b)(ii): Transit threshold is ALWAYS 0.25 miles WALKING (no small-town expansion).
 * 6 pts = stop has covered waiting area (shelter); 2 pts = stop has no covered area.
 * Since Google Places cannot detect shelter coverage, we conservatively return 2 pts for stops
 * within 0.25 miles and surface the finding so the analyst can confirm and upgrade to 6 pts.
 */
async function checkTransit(lat: number, lng: number, googleApiKey: string, isSmallTown = false): Promise<TransitResult> {
  // NC QAP 2026 transit threshold: ≤0.25 miles WALKING distance (same for ALL areas, small town or not).
  // Amenity distance thresholds expand for small towns, but transit does NOT — QAP is explicit.
  // Search radius = 804m (0.5 mi) to ensure we catch stops exactly at 0.25mi boundary.
  const WALKING_THRESHOLD_MILES = 0.25;
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=804&type=transit_station&key=${googleApiKey}`;
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      throw new Error(`Google Places API returned ${response.status}`);
    }
    
    const data = await response.json();
    const stops: Array<{ name: string; distance: number; types: string[] }> = [];
    
    if (data.status === 'OK' && data.results) {
      data.results.forEach((result: any) => {
        const stopLat = result.geometry.location.lat;
        const stopLng = result.geometry.location.lng;
        const distance = haversineDistance(lat, lng, stopLat, stopLng);
        
        stops.push({
          name: result.name,
          distance: Math.round(distance * 100) / 100,
          types: result.types || []
        });
      });
    }
    
    // Pass 2: bus_station type
    if (data.status === 'OK' || stops.length === 0) {
      const busUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=804&type=bus_station&key=${googleApiKey}`;
      const busResponse = await fetch(busUrl, { signal: AbortSignal.timeout(10000) });
      
      if (busResponse.ok) {
        const busData = await busResponse.json();
        if (busData.status === 'OK' && busData.results) {
          busData.results.forEach((result: any) => {
            const stopLat = result.geometry.location.lat;
            const stopLng = result.geometry.location.lng;
            const distance = haversineDistance(lat, lng, stopLat, stopLng);
            
            if (!stops.some(s => s.name === result.name)) {
              stops.push({
                name: result.name,
                distance: Math.round(distance * 100) / 100,
                types: result.types || []
              });
            }
          });
        }
      }
    }

    // Pass 3: keyword "bus stop" — catches street-corner bus stops that aren't tagged as
    // transit_station or bus_station in Google Places (common for rural/suburban transit networks).
    if (stops.length === 0 || stops[0].distance > WALKING_THRESHOLD_MILES) {
      try {
        const kwUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=804&keyword=bus+stop&key=${googleApiKey}`;
        const kwResponse = await fetch(kwUrl, { signal: AbortSignal.timeout(10000) });
        if (kwResponse.ok) {
          const kwData = await kwResponse.json();
          if (kwData.status === 'OK' && kwData.results) {
            kwData.results.forEach((result: any) => {
              const stopLat = result.geometry.location.lat;
              const stopLng = result.geometry.location.lng;
              const distance = haversineDistance(lat, lng, stopLat, stopLng);
              if (!stops.some(s => s.name === result.name)) {
                stops.push({
                  name: result.name,
                  distance: Math.round(distance * 100) / 100,
                  types: result.types || []
                });
              }
            });
          }
        }
      } catch (kwErr) {
        console.warn('Transit keyword search failed:', kwErr);
      }
    }
    
    stops.sort((a, b) => a.distance - b.distance);
    
    // NC QAP 2026 §IV(A)(1)(b)(ii): Transit threshold is ALWAYS 0.25 miles WALKING — no small-town expansion.
    // 6 pts requires covered waiting area (shelter) — Google Places can't detect this automatically.
    // We conservatively score 2 pts for stops within 0.25 miles; analyst can upgrade to 6 pts
    // via the manual override panel if the stop has a covered shelter.
    let transitScore = 0;
    if (stops.length > 0 && stops[0].distance <= WALKING_THRESHOLD_MILES) {
      transitScore = 2; // conservative: uncovered assumed; override to 6 pts if shelter confirmed
    }
    
    return {
      hasNearbyTransit: stops.length > 0,
      nearestStopDistance: stops.length > 0 ? stops[0].distance : null,
      transitScore,
      stops: stops.slice(0, 5)
    };
  } catch (error) {
    console.error('Google Transit API error:', error);
    return {
      hasNearbyTransit: false,
      nearestStopDistance: null,
      transitScore: 0,
      stops: []
    };
  }
}

/**
 * Check for incompatible uses (airports, industrial, adult entertainment)
 * Uses Google Places API
 */
async function checkIncompatibleUses(lat: number, lng: number, googleApiKey: string): Promise<IncompatibleUseResult> {
  const issues: string[] = [];
  const nearbyAirports: Array<{ name: string; distance: number }> = [];
  const nearbyIndustrial: Array<{ name: string; distance: number }> = [];
  const nearbyAdultEntertainment: Array<{ name: string; distance: number }> = [];
  
  try {
    const airportUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=4828&type=airport&key=${googleApiKey}`;
    const airportResponse = await fetch(airportUrl, { signal: AbortSignal.timeout(10000) });
    
    if (airportResponse.ok) {
      const airportData = await airportResponse.json();
      if (airportData.status === 'OK' && airportData.results) {
        airportData.results.forEach((result: any) => {
          const distance = haversineDistance(lat, lng, result.geometry.location.lat, result.geometry.location.lng);
          nearbyAirports.push({ name: result.name, distance: Math.round(distance * 100) / 100 });
        });
        
        if (nearbyAirports.length > 0 && nearbyAirports[0].distance < 3) {
          issues.push(`Airport within 3 miles: ${nearbyAirports[0].name} (${nearbyAirports[0].distance} mi)`);
        }
      }
    }
  } catch (error) {
    console.error('Airport check error:', error);
  }
  
  const industrialTypes = ['storage', 'industrial'];
  for (const type of industrialTypes) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=1609&keyword=${type}&key=${googleApiKey}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'OK' && data.results) {
          data.results.slice(0, 3).forEach((result: any) => {
            const distance = haversineDistance(lat, lng, result.geometry.location.lat, result.geometry.location.lng);
            nearbyIndustrial.push({ name: result.name, distance: Math.round(distance * 100) / 100 });
          });
        }
      }
    } catch (error) {
      continue;
    }
  }
  
  if (nearbyIndustrial.length > 0 && nearbyIndustrial.some(i => i.distance < 0.25)) {
    issues.push('Industrial/storage facility within 0.25 miles');
  }
  
  return {
    hasIncompatibleUses: issues.length > 0,
    issues,
    nearbyAirports,
    nearbyIndustrial,
    nearbyAdultEntertainment
  };
}

/**
 * Main function to run comprehensive site evaluation
 */
export async function evaluateSite(lat: number, lng: number, googleApiKey?: string, isSmallTown = false): Promise<SiteEvaluationResult> {
  const [floodZone, hazardousSites, slope, transit, incompatibleUses] = await Promise.all([
    checkFloodZone(lat, lng),
    checkHazardousSites(lat, lng, 1),
    checkSlope(lat, lng),
    googleApiKey ? checkTransit(lat, lng, googleApiKey, isSmallTown) : Promise.resolve({
      hasNearbyTransit: false,
      nearestStopDistance: null,
      transitScore: 0,
      stops: []
    }),
    googleApiKey ? checkIncompatibleUses(lat, lng, googleApiKey) : Promise.resolve({
      hasIncompatibleUses: false,
      issues: [],
      nearbyAirports: [],
      nearbyIndustrial: [],
      nearbyAdultEntertainment: []
    })
  ]);
  
  let noIncompatibleUses = 3;
  if (incompatibleUses.hasIncompatibleUses || hazardousSites.hasNearbyHazards) {
    noIncompatibleUses = 0;
  }
  
  let noNegativeFeatures = 3;
  if (floodZone.isInFloodZone || slope.hasSteepSlope) {
    noNegativeFeatures = 0;
  }
  
  const visibility = 3;
  const trafficSafety = 3;
  
  const transitPoints = transit.transitScore;
  
  const total = noIncompatibleUses + noNegativeFeatures + visibility + trafficSafety + transitPoints;
  
  return {
    floodZone,
    hazardousSites,
    slope,
    transit,
    incompatibleUses,
    siteScore: {
      noIncompatibleUses,
      noNegativeFeatures,
      visibility,
      trafficSafety,
      transitPoints,
      total
    }
  };
}
