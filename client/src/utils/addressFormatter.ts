/**
 * Address Formatting Utilities
 * 
 * Constructs full addresses from separate database fields (address, city, state, zip)
 * following Option B architecture: separate fields + frontend construction
 */

interface AddressFields {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

/**
 * Formats a complete address from separate components
 * 
 * @param deal - Object containing address, city, state, and zip fields
 * @returns Formatted full address string (e.g., "2100 North Tryon Street, Charlotte, NC 28206")
 * 
 * @example
 * formatFullAddress({ address: "2100 North Tryon Street", city: "Charlotte", state: "NC", zip: "28206" })
 * // Returns: "2100 North Tryon Street, Charlotte, NC 28206"
 * 
 * @example
 * formatFullAddress({ address: "2100 North Tryon Street" })
 * // Returns: "2100 North Tryon Street"
 */
export function formatFullAddress(deal: AddressFields): string {
  const parts: string[] = [];
  
  // Add street address if available
  if (deal.address) {
    parts.push(deal.address);
  }
  
  // Build city/state/zip line with proper formatting
  // Format: "City, State ZIP" (comma after city, space between state and ZIP)
  if (deal.city || deal.state || deal.zip) {
    let locationLine = '';
    
    if (deal.city) {
      locationLine = deal.city;
      
      // Add comma after city if we have state or zip
      if (deal.state || deal.zip) {
        locationLine += ',';
      }
    }
    
    // Add state and/or ZIP (space-separated)
    const stateZipParts: string[] = [];
    if (deal.state) {
      stateZipParts.push(deal.state);
    }
    if (deal.zip) {
      stateZipParts.push(deal.zip);
    }
    
    if (stateZipParts.length > 0) {
      locationLine += (locationLine ? ' ' : '') + stateZipParts.join(' ');
    }
    
    parts.push(locationLine);
  }
  
  // Join all parts with comma and space
  const fullAddress = parts.join(', ');
  
  // Fallback if no address components available
  return fullAddress || 'No address';
}

/**
 * Returns just the city/state/zip portion of the address
 * 
 * @param deal - Object containing city, state, and zip fields
 * @returns City/state/ZIP string (e.g., "Charlotte, NC 28206")
 */
export function formatCityStateZip(deal: AddressFields): string {
  const parts: string[] = [];
  
  if (deal.city) {
    parts.push(deal.city);
  }
  
  if (deal.state) {
    parts.push(deal.state);
  }
  
  if (deal.zip) {
    parts.push(deal.zip);
  }
  
  return parts.join(' ') || '';
}
