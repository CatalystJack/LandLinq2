// AI-Powered Email Parser using OpenAI GPT-5
// Replaces complex regex patterns with intelligent extraction

import OpenAI from "openai";
import { apiCallTracker } from './apiCallTracker.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ParsedPropertyData {
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  askingPrice: number | null;
  sizeAcres: number | null;
  unitCount: number | null;
  productType: string | null;
  zoning: string | null;
  hasEntitlements: boolean | null;
  sewerAvailable: boolean | null;
  propertyName: string | null;
  parcelId: string | null;
  squareFootage: number | null;
  parkingSpaces: number | null;
  stories: number | null;
  brokerNotes: string | null;
  dealRoomUrl: string | null; // External deal room link requiring login/agreement
}

/** The person/address which delivered the message to our intake mailbox. */
export interface RoutingSender {
  name: string | null;
  email: string | null;
}

/** The earliest identifiable author in a forwarded message chain. */
export interface OriginalLeadSource {
  name: string | null;
  email: string | null;
  phone?: string | null;
  company?: string | null;
  fromForwardedChain: boolean;
}

export interface EmailIntakeIdentities {
  routingSender: RoutingSender;
  originalLeadSource: OriginalLeadSource | null;
}

/**
 * Parse the outer sender independently from the source of a forwarded lead.
 * A nested forward has several `From:` headers; the last one is the oldest
 * message and is therefore the lead source.  This deliberately does not use
 * Reply-To, which is a routing instruction rather than provenance.
 */
export function parseForwardedChainIdentities(
  routingSender: string | RoutingSender | null | undefined,
  body: string | null | undefined,
): EmailIntakeIdentities {
  const parseMailbox = (value: string | null | undefined): RoutingSender => {
    const input = String(value || '').trim();
    const angle = /^(.*?)\s*<\s*([^<>\s@]+@[^<>\s@]+)\s*>/.exec(input);
    const mailto = /^(.*?)\s*\[mailto:\s*([^\]\s@]+@[^\]\s@]+)\]/i.exec(input);
    const plain = /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i.exec(input);
    const match = angle || mailto;
    return {
      name: match?.[1].replace(/^from:\s*/i, '').replace(/["']/g, '').trim() || null,
      email: (match?.[2] || plain?.[1] || '').trim().toLowerCase() || null,
    };
  };
  const outer = typeof routingSender === 'string' ? parseMailbox(routingSender) : {
    name: routingSender?.name?.trim() || null,
    email: routingSender?.email?.trim().toLowerCase() || null,
  };
  const headers = Array.from(String(body || '').matchAll(
    /(?:^|\n)\s*From:\s*(?:"?([^<\n"]*)"?\s*)?(?:<\s*)?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})(?:\s*>|\s*\])?/gim,
  ));
  const oldest = headers.length ? headers[headers.length - 1] : null;
  return {
    routingSender: outer,
    originalLeadSource: oldest
      ? { name: oldest[1]?.replace(/["']/g, '').trim() || null, email: oldest[2].toLowerCase(), fromForwardedChain: true }
      : null,
  };
}

/**
 * Parse email/PDF text using OpenAI to extract property details
 * This replaces hundreds of lines of fragile regex patterns
 */
export async function parsePropertyDataWithAI(text: string): Promise<ParsedPropertyData> {
  const startTime = Date.now();
  
  try {
    console.log('🤖 Using AI to parse property data from text...');
    console.log(`📝 Text length: ${text.length} characters`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an expert real estate data extraction specialist with 15+ years of experience analyzing property submissions. Your role is to accurately extract ONLY valid property details from emails and documents, filtering out noise, metadata, and irrelevant information. You think carefully about each field before extracting to ensure data quality and consistency."
        },
        {
          role: "user",
          content: `Analyze this real estate property submission and extract ONLY VALID property details.

CRITICAL ADDRESS RULES - SEPARATION IS MANDATORY:
⚡ **MOST IMPORTANT RULE**: ALWAYS extract address components SEPARATELY:
  - address field: STREET ADDRESS ONLY (e.g., "816 HOWELL MILL ROAD" or "123 Main Street")
  - city field: CITY NAME ONLY (e.g., "WAYNESVILLE" or "Charlotte")
  - state field: STATE CODE ONLY (e.g., "NC" or "FL")
  - zip field: ZIP CODE ONLY (e.g., "28786" or "28203")

⚡ **CRITICAL FOR SMS**: Even if the input is a single line like "816 HOWELL MILL ROAD, WAYNESVILLE, NC", you MUST split it into:
  - address: "816 HOWELL MILL ROAD"
  - city: "WAYNESVILLE"
  - state: "NC"
  - zip: null

🚨 **ABSOLUTELY FORBIDDEN**: NEVER put "816 HOWELL MILL ROAD, WAYNESVILLE, NC" in the address field!
🚨 **ONLY STREET ADDRESS**: The address field must ONLY contain the street address WITHOUT city, state, or ZIP!
🚨 **SEPARATION IS MANDATORY**: You MUST use separate fields for city and state. This is NON-NEGOTIABLE!

🚨 **PDF ATTACHMENT PRIORITY** - CRITICAL:
When you see "PDF CONTENT FROM" in the text, the address from that PDF section is AUTHORITATIVE:
- PDF attachments contain the actual property details being submitted
- Email subject lines are just labels, NOT property addresses
- ALWAYS extract the property address from PDF content, not from email subject

❌ **NEVER USE THESE AS ADDRESSES** - They are email subject lines, NOT property addresses:
- "Deal Submission", "Property Submission", "Land Submission"
- "FW:", "RE:", "Fwd:" (email forwards/replies)
- Single words without street numbers (e.g., just "Submission" or just "Property")
- Any text that doesn't contain: [street number] + [street name] + [street suffix]

DO NOT extract addresses from:
- Email headers, message IDs, or tracking codes (e.g., "6 C1u61um1q8tas8rd" is NOT an address)
- Random alphanumeric strings that happen to end with "rd", "st", "est", etc.
- Email signatures, footers, or office addresses
- SendGrid metadata or system-generated content
- Email subject lines (e.g., "Deal Submission" is NOT an address!)
- Address MUST have: street number + street name + valid suffix (Street, Avenue, Road, etc.)

MULTI-PARCEL ASSEMBLAGE HANDLING:
- If multiple addresses are listed (e.g., "0 West Trinity Lane, 0 Day Street, 2608 Old Buena Vista Road")
- Extract the PRIMARY or FIRST mentioned address
- Note "Multi-parcel assemblage" in additionalNotes with all addresses listed
- Do not try to combine multiple addresses into one field

CRITICAL ZONING RULES - Extract ONLY actual zoning codes:
✅ VALID ZONING: R-4, R-2, MF, MF-1, C-1, PUD, RM-2, etc. (city/county land use designations)
❌ NOT ZONING - DO NOT EXTRACT AS ZONING:
  - "OZ" or "Opportunity Zone" (federal tax program)
  - "QCT" or "Qualified Census Tract" (HUD designation)
  - "fully approved" or "entitled" (approval status, not zoning)
  - "architecturally completed" (construction status)
If you see OZ or QCT, note in additionalNotes but leave zoning null unless actual zoning code is present.

CRITICAL PRICING RULES - Extract ONLY the LAND PURCHASE PRICE FOR THIS PROPERTY:
✅ VALID ASKING PRICE (must be for THIS property being offered):
  - "Asking price $2.5M"
  - "List price $1,500,000"
  - "Offer price $X"
  - "Purchase price for this site: $X"

❌ NOT ASKING PRICE - DO NOT EXTRACT:
  - Comparable sales data: "Key Sale Comps", "Recent Sales", "869 West Trinity sold for $X"
  - Ground lease rental amounts: "$7.25M initial rent", "6% of land value annual rent"
  - Per-unit or per-lot comparable pricing: "$35,790 per unit", "$95,000 per lot"
  - Per-unit development pricing: "$65,000 per unit"
  - Construction costs, projected costs, development budgets
  - Demographic data: "Average household income $109,000"
  
GROUND LEASE DETECTION:
- If you see "ground lease", "land lease", "lease opportunity", "annual rent", or "NNN lease"
- This is NOT a property sale - it's a rental arrangement
- DO NOT extract any rental amounts as asking price
- Note "Ground lease opportunity" in additionalNotes
- Leave askingPrice as null

Only extract askingPrice if it explicitly states the sale/purchase price for THIS specific property being offered.

UNIT COUNT RULES:
- Extract from "±123 units", "~675 units", "730 units (fully approved)"
- Use the number without symbols (123, 675, 730)

CONTACT INFO RULES:
- Prioritize the email sender or first person mentioned
- Look for Managing Director, Sales Director, or similar primary contact roles

CRITICAL CITY/STATE RULES - NO PLACEHOLDERS ALLOWED:
⚠️ **NEVER GENERATE PLACEHOLDER CITY/STATE VALUES** - This is CRITICAL!
- If city/state are NOT explicitly mentioned in the email, return null for those fields
- **FORBIDDEN PLACEHOLDER VALUES**: "Deal", "Property", "Submit", "Submission", "Site", "SU", "PR" (from words, not states), or ANY made-up city/state
- Valid state codes ONLY: AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA, ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, SD, TN, TX, UT, VT, VA, WA, WV, WI, WY, DC
- **BAD EXAMPLE**: "48 Swannanoa rd" → DO NOT add fake "Deal, SU" - return street address ONLY with city/state as null
- **GOOD EXAMPLE**: "48 Swannanoa Road" → Return address="48 Swannanoa Road", city=null, state=null (they weren't provided)
- **GOOD EXAMPLE**: "48 Swannanoa Road, Asheville, NC" → Return full address with city/state (they were explicit)
- If you're not 100% certain about city/state, return null - DO NOT GUESS OR INFER

IMPORTANT EXTRACTION GUIDELINES:
1. Property address: Extract ONLY street (number + name + suffix) - DO NOT include city, state, or ZIP in address field
2. Land purchase/asking price ONLY (not per-unit or per-lot pricing)
3. Acreage in acres
4. Property type (Multifamily, BTR, Active Adult, Lot Development, etc.)
5. ACTUAL zoning codes only (R-4, MF, etc.) - NOT tax designations
6. Unit count (extract number from ±123, ~675, etc.)
7. Parcel ID/APN if mentioned
8. Entitlements or sewer if explicitly mentioned
9. Property name/title
10. Square footage, parking, stories if mentioned

🚨 CRITICAL - NEVER CORRECT TYPOS OR SPELLING IN ADDRESSES:
- If the email says "FERMONT DR", extract "FERMONT DR" - DO NOT change it to "Fremont Dr"
- If the email says "WAHEELA DRIVE", extract "WAHEELA DRIVE" - DO NOT change it to "Walhalla Drive"
- Preserve the EXACT spelling as written in the source text, even if it appears to be a typo
- AI typo corrections cause geocoding to find the wrong location!

**CRITICAL ADDRESS EXTRACTION EXAMPLES - FOLLOW THESE EXACTLY:**

⚡ SMS Example (HIGHEST PRIORITY - this is what you'll see most often):
Input: "816 HOWELL MILL ROAD, WAYNESVILLE, NC"
→ address: "816 HOWELL MILL ROAD"
→ city: "WAYNESVILLE"
→ state: "NC"
→ zip: null
**NOTE**: Do NOT put the full "816 HOWELL MILL ROAD, WAYNESVILLE, NC" in the address field!

Example 1: Input: "202 RALEIGH ST., WILMINGTON, NC"
→ address: "202 RALEIGH ST"
→ city: "WILMINGTON"  
→ state: "NC"
→ zip: null

Example 2: Input: "123 Main Street, Charlotte, NC 28203"
→ address: "123 Main Street"
→ city: "Charlotte"
→ state: "NC"
→ zip: "28203"

Example 3: Input: "423 N. MARTIN LUTHER KING JR A, SALISBURY, NC"
→ address: "423 N. MARTIN LUTHER KING JR A"
→ city: "SALISBURY"
→ state: "NC"
→ zip: null

Example 4: Input: "1500 E JOHN SIMS PKWY, NICEVILLE, FL 32578"
→ address: "1500 E JOHN SIMS PKWY"
→ city: "NICEVILLE"
→ state: "FL"
→ zip: "32578"

Example 5: Input: "48 Swannanoa Road" (no city/state in text)
→ address: "48 Swannanoa Road"
→ city: null
→ state: null
→ zip: null

⚡ CRITICAL - ADDRESSES WITHOUT COMMAS (Common in emails):
Many addresses don't use commas between components. You MUST still split them!

Example 6: Input: "1216 fremont dr wingate nc 28174" (NO COMMAS)
→ address: "1216 fremont dr"
→ city: "wingate"
→ state: "nc"
→ zip: "28174"
**NOTE**: Even without commas, extract city/state/ZIP as separate fields!

Example 7: Input: "500 main st charlotte nc" (NO COMMAS, no ZIP)
→ address: "500 main st"
→ city: "charlotte"
→ state: "nc"
→ zip: null

Example 8: Input: "123 Oak Drive Atlanta GA 30303" (NO COMMAS)
→ address: "123 Oak Drive"
→ city: "Atlanta"
→ state: "GA"
→ zip: "30303"

**PATTERN FOR COMMA-LESS ADDRESSES**:
When you see: [street number] [street name] [street suffix] [city name] [state code] [optional ZIP]
Split it as: address = street portion, city = word before state code, state = 2-letter code, zip = 5 digits

**CRITICAL**: Extract address components SEPARATELY - street address in address field, city/state/ZIP in separate fields. NEVER concatenate them!
**IMPORTANT**: Long street names (e.g., MARTIN LUTHER KING, JOHN SIMS PKWY) are VALID - extract city/state from AFTER the comma!

If the text contains ONLY email metadata, tracking codes, or no real property info, return ALL fields as null.

TEXT TO ANALYZE:
${text.substring(0, 8000)}

Respond in JSON format with these exact fields (use null if not found):
{
  "address": "street address ONLY (number + name + suffix, e.g., '202 RALEIGH ST' or '123 Main Street') - DO NOT include city/state/ZIP",
  "city": "city name in separate field",
  "state": "two-letter state code in separate field",
  "zip": "ZIP code in separate field",
  "askingPrice": numeric value in dollars (LAND PURCHASE PRICE ONLY),
  "sizeAcres": numeric value in acres,
  "unitCount": numeric count,
  "productType": "one of: Conventional Apartments, Active Adult, BTR, Affordable, Lot Development, Student Housing, Senior Living, or other type",
  "zoning": "ACTUAL zoning code only (R-4, MF, etc.) - NOT OZ or QCT",
  "hasEntitlements": true/false/null,
  "sewerAvailable": true/false/null,
  "propertyName": "property name or title (e.g., 'The Northmarq Development', 'Lakeside Estates')",
  "parcelId": "parcel ID or APN",
  "squareFootage": numeric value,
  "parkingSpaces": numeric count,
  "stories": numeric count,
  "brokerNotes": "ONLY include concise broker-written comments about the property (max 200 words). EXCLUDE: OCR data, file paths, URLs, base64 strings, technical metadata, SendGrid headers, email signatures, and system-generated content. Include OZ/QCT status if mentioned. If no genuine broker notes exist, return null.",
  "dealRoomUrl": "URL to external deal room, investor room, or virtual data room (e.g., Northmarq, CBRE, JLL deal rooms). These often require login/CA. Extract full URL if found, null otherwise."
}`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2000,
    });

    const result = response.choices[0].message.content;
    if (!result) {
      throw new Error('Empty response from OpenAI');
    }

    const responseTime = Date.now() - startTime;
    apiCallTracker.logCall('OpenAI', 'parsePropertyData', true, responseTime);

    const parsed = JSON.parse(result) as ParsedPropertyData;
    
    console.log('✅ AI parsing complete:');
    console.log(`   Address: ${parsed.address || 'N/A'}`);
    console.log(`   City/State/ZIP: ${parsed.city || 'N/A'}, ${parsed.state || 'N/A'} ${parsed.zip || 'N/A'}`);
    console.log(`   Price: ${parsed.askingPrice ? '$' + parsed.askingPrice.toLocaleString() : 'N/A'}`);
    console.log(`   Acres: ${parsed.sizeAcres || 'N/A'}`);
    console.log(`   Product Type: ${parsed.productType || 'N/A'}`);
    console.log(`   Units: ${parsed.unitCount || 'N/A'}`);
    
    return parsed;
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    apiCallTracker.logCall('OpenAI', 'parsePropertyData', false, responseTime, {
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    
    console.error('❌ AI parsing failed:', error);
    throw error;
  }
}

/**
 * Parse property data with fallback to regex if AI fails
 */
export async function parsePropertyDataWithFallback(text: string): Promise<ParsedPropertyData> {
  try {
    // Try AI first
    return await parsePropertyDataWithAI(text);
  } catch (aiError: any) {
    console.error('❌ [CRITICAL] AI parsing failed - this may cause data corruption!');
    console.error('   Error details:', aiError.message || aiError);
    console.error('   Text length:', text.length, 'characters');
    console.warn('⚠️ Falling back to basic regex extraction (limited accuracy)');
    
    // Basic fallback extraction (minimal regex)
    const addressMatch = text.match(/(?:address|location|property):?\s*([^\n]{1,150})/i);
    const priceMatch = text.match(/\$\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/i);
    const acreageMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:acre|acres|ac)\b/i);
    const zipMatch = text.match(/\b(\d{5}(?:-\d{4})?)\b/);
    
    // Enhanced city/state extraction for SMS-style addresses
    // Pattern: "street address, CITY, STATE" or "street address, CITY, STATE ZIP"
    let city = null;
    let state = null;
    const fullText = addressMatch ? addressMatch[1] : text;
    
    // Valid US state codes
    const VALID_US_STATES = new Set([
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
      'DC', 'PR', 'VI', 'GU', 'AS', 'MP'
    ]);
    
    // Try to extract: "123 Street, CITY, STATE" or "123 Street, CITY, STATE ZIP"
    const cityStateMatch = fullText.match(/,\s*([^,]+),\s*([A-Z]{2})(?:\s+\d{5})?/i);
    if (cityStateMatch) {
      const potentialCity = cityStateMatch[1].trim();
      const potentialState = cityStateMatch[2].toUpperCase();
      if (VALID_US_STATES.has(potentialState)) {
        city = potentialCity;
        state = potentialState;
      }
    }
    
    // Extract deal room URLs from text (Northmarq, CBRE, etc.)
    const dealRoomUrlMatch = text.match(/https?:\/\/[^\s<>\"]+(?:dealroom|investorroom|property|deal|offering|virtual-deal-room)[^\s<>\"]*/i);
    
    const fallbackResult = {
      address: addressMatch ? addressMatch[1].trim() : null,
      city,
      state,
      zip: zipMatch ? zipMatch[1] : null,
      askingPrice: priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null,
      sizeAcres: acreageMatch ? parseFloat(acreageMatch[1]) : null,
      unitCount: null,
      productType: null,
      zoning: null,
      hasEntitlements: null,
      sewerAvailable: null,
      propertyName: null,
      parcelId: null,
      squareFootage: null,
      parkingSpaces: null,
      stories: null,
      brokerNotes: 'Extracted using fallback parsing due to AI error',
      dealRoomUrl: dealRoomUrlMatch ? dealRoomUrlMatch[0] : null,
    };
    
    console.log('⚠️ Fallback extraction result:', {
      address: fallbackResult.address || 'NONE',
      price: fallbackResult.askingPrice || 'NONE',
      acres: fallbackResult.sizeAcres || 'NONE'
    });
    
    return fallbackResult;
  }
}
