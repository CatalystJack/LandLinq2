import { storage } from './storage.js';

// Automated deal routing based on product type and location
export interface DealRouting {
  analyst: string;
  developer: string;
  partner: string;
}

// Dynamic team assignment using user profile productTypes and states
async function getTeamMembersByProductAndState(productType: string, state: string): Promise<{
  analysts: any[];
  developers: any[];
  partners: any[];
}> {
  try {
    // Get all users with their profiles
    const allUsers = await storage.getAllUsers();
    const catalystUsers = allUsers.filter(user => user.email.includes('@catalystcp.com'));
    
    const analysts = catalystUsers.filter(user => {
      // Only match if explicitly configured for this product type
      const hasProductType = user.productTypes && user.productTypes.length > 0 && user.productTypes.includes(productType);
      const isAnalyst = user.dealRole?.toLowerCase().includes('analyst');
      const isSeniorAnalyst = user.dealRole?.toLowerCase().includes('senior');
      
      // Senior analysts can work in all 50 states
      if (isSeniorAnalyst) {
        return hasProductType && isAnalyst;
      }
      
      // Junior/regular analysts need state match
      const hasState = user.states && user.states.length > 0 && user.states.includes(state);
      return hasProductType && hasState && isAnalyst;
    });
    
    const developers = catalystUsers.filter(user => {
      // Only match if explicitly configured for this product type
      const hasProductType = user.productTypes && user.productTypes.length > 0 && user.productTypes.includes(productType);
      const isDeveloper = user.dealRole?.toLowerCase().includes('development') || user.dealRole?.toLowerCase().includes('associate');
      
      // Steve Hillebrand is restricted to NC/SC only
      const isSteve = user.email.toLowerCase().includes('steve') || (user.firstName?.toLowerCase() === 'steve' && user.lastName?.toLowerCase().includes('hille'));
      if (isSteve) {
        const hasState = user.states && user.states.length > 0 && user.states.includes(state);
        return hasProductType && hasState && isDeveloper;
      }
      
      // All other regional developers can work in all 50 states
      return hasProductType && isDeveloper;
    });
    
    const partners = catalystUsers.filter(user => {
      // Only match if explicitly configured for this product type
      const hasProductType = user.productTypes && user.productTypes.length > 0 && user.productTypes.includes(productType);
      const isPartner = user.dealRole?.toLowerCase().includes('partner');
      
      // Managing partners can work in all 50 states
      return hasProductType && isPartner;
    });
    
    return { analysts, developers, partners };
  } catch (error) {
    console.error('Error getting team members by product and state:', error);
    // Fallback to original hardcoded logic if database fails
    return { analysts: [], developers: [], partners: [] };
  }
}

// Get the full name for a user
function getFullName(user: any): string {
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0];
}

function getStateFromMarket(market: string): string {
  const marketLower = market.toLowerCase();
  
  // State abbreviations
  if (marketLower.includes(' nc') || marketLower.includes('north carolina')) return 'NC';
  if (marketLower.includes(' sc') || marketLower.includes('south carolina')) return 'SC';
  if (marketLower.includes(' ga') || marketLower.includes('georgia')) return 'GA';
  if (marketLower.includes(' fl') || marketLower.includes('florida')) return 'FL';
  if (marketLower.includes(' tn') || marketLower.includes('tennessee')) return 'TN';
  if (marketLower.includes(' va') || marketLower.includes('virginia')) return 'VA';
  if (marketLower.includes(' tx') || marketLower.includes('texas')) return 'TX';
  if (marketLower.includes(' al') || marketLower.includes('alabama')) return 'AL';
  if (marketLower.includes(' ms') || marketLower.includes('mississippi')) return 'MS';
  if (marketLower.includes(' la') || marketLower.includes('louisiana')) return 'LA';
  if (marketLower.includes(' ok') || marketLower.includes('oklahoma')) return 'OK';
  if (marketLower.includes(' ar') || marketLower.includes('arkansas')) return 'AR';
  
  // Major cities
  if (marketLower.includes('charlotte') || marketLower.includes('raleigh') || 
      marketLower.includes('greensboro') || marketLower.includes('durham') || 
      marketLower.includes('winston-salem') || marketLower.includes('asheville') || 
      marketLower.includes('wilmington')) return 'NC';
      
  if (marketLower.includes('charleston') || marketLower.includes('columbia') || 
      marketLower.includes('greenville') || marketLower.includes('spartanburg')) return 'SC';
      
  if (marketLower.includes('atlanta') || marketLower.includes('savannah') || 
      marketLower.includes('augusta') || marketLower.includes('columbus')) return 'GA';
      
  if (marketLower.includes('miami') || marketLower.includes('tampa') || 
      marketLower.includes('orlando') || marketLower.includes('jacksonville')) return 'FL';
      
  if (marketLower.includes('nashville') || marketLower.includes('memphis') || 
      marketLower.includes('knoxville') || marketLower.includes('chattanooga')) return 'TN';
      
  if (marketLower.includes('houston') || marketLower.includes('dallas') || 
      marketLower.includes('austin') || marketLower.includes('san antonio')) return 'TX';
  
  return 'UNKNOWN';
}

// Fallback assignment when no dynamic match found
function getFallbackTeam(): DealRouting {
  return {
    analyst: 'Austin Blondell',
    developer: 'Steve Hillebrand', 
    partner: 'AJ Klenk'
  };
}

// Get developer based on state - Steve for NC/SC, John everywhere else
function getDeveloperByState(state: string): string {
  if (state === 'NC' || state === 'SC') {
    return 'Steve Hillebrand';
  }
  return 'John Bell';
}

export async function getAutomaticRouting(productTypes: string[], market: string): Promise<DealRouting> {
  console.log(`🎯 Routing deal with product types: ${productTypes?.join(', ')} in market: ${market}`);
  
  // PRIORITY 1: ASSIGN BY DEVELOPMENT TYPE FIRST
  
  // Check for Conventional Apartments
  const hasApartments = productTypes?.some(type => 
    type?.toLowerCase().includes('apartment') || type?.toLowerCase().includes('conventional')
  );
  
  if (hasApartments) {
    console.log('📍 Assigned by development type: Conventional Apartments');
    const state = getStateFromMarket(market);
    const team = await getTeamMembersByProductAndState('Conventional Apartments', state);
    
    console.log(`📋 Conventional Apartments team for ${state}: Analysts: ${team.analysts.length}, Developers: ${team.developers.length}, Partners: ${team.partners.length}`);
    if (team.analysts.length === 0 && team.developers.length === 0 && team.partners.length === 0) {
      console.log('⚠️ No team members configured for Conventional Apartments in ' + state + ' - using fallback');
    }
    
    // Conventional Apartments: Austin / Steve (NC/SC) or John (elsewhere) / AJ Klenk
    return {
      analyst: team.analysts.length > 0 ? getFullName(team.analysts[0]) : 'Austin Blondell',
      developer: team.developers.length > 0 ? getFullName(team.developers[0]) : getDeveloperByState(state),
      partner: team.partners.length > 0 ? getFullName(team.partners[0]) : 'AJ Klenk'
    };
  }
  
  // Check for BTR (Build to Rent)
  const hasBTR = productTypes?.some(type => 
    type?.toLowerCase().includes('btr') || type?.toLowerCase().includes('build to rent') || type?.toLowerCase().includes('build-to-rent')
  );
  
  if (hasBTR) {
    console.log('📍 Assigned by development type: BTR');
    const state = getStateFromMarket(market);
    const team = await getTeamMembersByProductAndState('BTR', state);
    
    console.log(`📋 BTR team for ${state}: Analysts: ${team.analysts.length}, Developers: ${team.developers.length}, Partners: ${team.partners.length}`);
    if (team.analysts.length === 0 && team.developers.length === 0 && team.partners.length === 0) {
      console.log('⚠️ No team members configured for BTR in ' + state + ' - using fallback');
    }
    
    // BTR: Austin / Steve (NC/SC) or John (elsewhere) / Brian Ford
    return {
      analyst: team.analysts.length > 0 ? getFullName(team.analysts[0]) : 'Austin Blondell',
      developer: team.developers.length > 0 ? getFullName(team.developers[0]) : getDeveloperByState(state),
      partner: team.partners.length > 0 ? getFullName(team.partners[0]) : 'Brian Ford'
    };
  }
  
  // Check for Active Adult
  const hasActiveAdult = productTypes?.some(type => 
    type?.toLowerCase().includes('active adult') || type?.toLowerCase().includes('55+') || type?.toLowerCase().includes('senior')
  );
  
  if (hasActiveAdult) {
    console.log('📍 Assigned by development type: Active Adult');
    const state = getStateFromMarket(market);
    const team = await getTeamMembersByProductAndState('Active Adult', state);
    
    console.log(`📋 Active Adult team for ${state}: Analysts: ${team.analysts.length}, Developers: ${team.developers.length}, Partners: ${team.partners.length}`);
    if (team.analysts.length === 0 && team.developers.length === 0 && team.partners.length === 0) {
      console.log('⚠️ No team members configured for Active Adult in ' + state + ' - using fallback');
    }
    
    // Active Adult: Austin / John Bell (always) / AJ Klenk
    return {
      analyst: team.analysts.length > 0 ? getFullName(team.analysts[0]) : 'Austin Blondell',
      developer: team.developers.length > 0 ? getFullName(team.developers[0]) : 'John Bell',
      partner: team.partners.length > 0 ? getFullName(team.partners[0]) : 'AJ Klenk'
    };
  }
  
  // Check for lot development
  const hasLots = productTypes?.some(type => 
    type?.toLowerCase().includes('lot') || type?.toLowerCase().includes('subdivision') || type?.toLowerCase().includes('development')
  );
  
  if (hasLots) {
    console.log('📍 Assigned by development type: Lot Development');
    const state = getStateFromMarket(market);
    const team = await getTeamMembersByProductAndState('Lot Development', state);
    
    console.log(`📋 Lot Development team for ${state}: Analysts: ${team.analysts.length}, Developers: ${team.developers.length}, Partners: ${team.partners.length}`);
    if (team.analysts.length === 0 && team.developers.length === 0 && team.partners.length === 0) {
      console.log('⚠️ No team members configured for Lot Development in ' + state + ' - using fallback');
    }
    
    return {
      analyst: team.analysts.length > 0 ? getFullName(team.analysts[0]) : 'Austin Blondell',
      developer: team.developers.length > 0 ? getFullName(team.developers[0]) : 'Mallie Colavita',
      partner: team.partners.length > 0 ? getFullName(team.partners[0]) : 'Brian Ford'
    };
  }
  
  // Check for Affordable Housing - uses SAME team as Conventional Apartments
  const hasAffordable = productTypes?.some(type => 
    type?.toLowerCase().includes('affordable')
  );
  
  if (hasAffordable) {
    console.log('📍 Assigned by development type: Affordable Housing (using Conventional Apartments team)');
    const state = getStateFromMarket(market);
    // Use Conventional Apartments team configuration for Affordable Housing
    const team = await getTeamMembersByProductAndState('Conventional Apartments', state);
    
    console.log(`📋 Affordable Housing team for ${state} (same as Conventional): Analysts: ${team.analysts.length}, Developers: ${team.developers.length}, Partners: ${team.partners.length}`);
    if (team.analysts.length === 0 && team.developers.length === 0 && team.partners.length === 0) {
      console.log('⚠️ No team members configured for Conventional Apartments in ' + state + ' - using fallback');
    }
    
    // Affordable Housing uses exact same assignments as Conventional Apartments:
    // - Steve in NC/SC, John everywhere else
    // - AJ Klenk always added as partner
    return {
      analyst: team.analysts.length > 0 ? getFullName(team.analysts[0]) : 'Austin Blondell',
      developer: team.developers.length > 0 ? getFullName(team.developers[0]) : getDeveloperByState(state),
      partner: team.partners.length > 0 ? getFullName(team.partners[0]) : 'AJ Klenk'
    };
  }
  
  // PRIORITY 2: IF DEVELOPMENT TYPE IS UNCLEAR, ASSIGN BY GEOGRAPHY
  console.log('🌍 Development type unclear, assigning by geography');
  const state = getStateFromMarket(market);
  console.log(`📍 Detected state: ${state} for market: ${market}`);
  
  if (state !== 'UNKNOWN') {
    // Find team members configured for this state (any product type they're configured for)
    const allUsers = await storage.getAllUsers();
    const catalystUsers = allUsers.filter(user => user.email.includes('@catalystcp.com'));
    
    const stateAnalysts = catalystUsers.filter(user => {
      const isAnalyst = user.dealRole?.toLowerCase().includes('analyst');
      const isSeniorAnalyst = user.dealRole?.toLowerCase().includes('senior');
      
      // Senior analysts work in all states
      if (isSeniorAnalyst && isAnalyst) return true;
      
      // Junior/regular analysts need state match
      const hasState = user.states && user.states.length > 0 && user.states.includes(state);
      return hasState && isAnalyst;
    });
    
    const stateDevelopers = catalystUsers.filter(user => {
      const isDeveloper = user.dealRole?.toLowerCase().includes('development') || user.dealRole?.toLowerCase().includes('associate');
      
      // Steve Hillebrand is restricted to NC/SC only
      const isSteve = user.email.toLowerCase().includes('steve') || (user.firstName?.toLowerCase() === 'steve' && user.lastName?.toLowerCase().includes('hille'));
      if (isSteve) {
        const hasState = user.states && user.states.length > 0 && user.states.includes(state);
        return hasState && isDeveloper;
      }
      
      // All other regional developers work in all states
      return isDeveloper;
    });
    
    const statePartners = catalystUsers.filter(user => {
      const isPartner = user.dealRole?.toLowerCase().includes('partner');
      // Managing partners work in all states
      return isPartner;
    });
    
    if (stateAnalysts.length > 0 || stateDevelopers.length > 0 || statePartners.length > 0) {
      const routing = {
        analyst: stateAnalysts.length > 0 ? getFullName(stateAnalysts[0]) : 'Austin Blondell',
        developer: stateDevelopers.length > 0 ? getFullName(stateDevelopers[0]) : 'Steve Hillebrand', 
        partner: statePartners.length > 0 ? getFullName(statePartners[0]) : 'AJ Klenk'
      };
      console.log(`🗺️ Dynamic geographic assignment: ${JSON.stringify(routing)}`);
      return routing;
    } else {
      console.log(`⚠️ No team members configured for state ${state} - using fallback`);
    }
  }
  
  // FALLBACK: Default team assignment
  console.log('⚠️ Using fallback assignment - no configured team members found');
  return getFallbackTeam();
}

export function formatRoutingAssignments(routing: DealRouting): string {
  const assignments = [];
  if (routing.analyst) assignments.push(`Analyst: ${routing.analyst}`);
  if (routing.developer) assignments.push(`Developer: ${routing.developer}`);
  if (routing.partner) assignments.push(`Partner: ${routing.partner}`);
  
  return assignments.join(' | ');
}