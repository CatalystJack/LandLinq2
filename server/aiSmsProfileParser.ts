// AI-Powered SMS Profile Parser using OpenAI GPT-5
// Intelligently extracts broker profile information from any SMS format

import OpenAI from "openai";
import { apiCallTracker } from './apiCallTracker.js';

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ParsedProfileData {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  markets: string[] | null;
  confidence: 'high' | 'medium' | 'low';
  notes: string | null;
}

/**
 * Parse SMS broker response using GPT-5 to extract profile information
 * Handles any format: single field, all-in-one, natural language
 */
export async function parseProfileDataWithAI(
  message: string,
  expectedField?: 'name' | 'email' | 'markets' | 'all'
): Promise<ParsedProfileData> {
  const startTime = Date.now();
  
  try {
    console.log(`🤖 Using AI to parse profile data (expected: ${expectedField || 'any'})`);
    console.log(`📝 Message: ${message.substring(0, 200)}`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: `You are an expert data extraction specialist focused on parsing broker profile information from SMS messages. Your role is to accurately extract name, email, and market information from natural language responses, handling various formats with high precision.`
        },
        {
          role: "user",
          content: `Extract broker profile information from this SMS message.

CONTEXT: We asked the broker for ${expectedField || 'profile information'} and they responded with:
"${message}"

EXTRACTION RULES:

NAME EXTRACTION:
✅ VALID FORMATS:
  - "John Smith" → firstName: "John", lastName: "Smith"
  - "Smith, John" → firstName: "John", lastName: "Smith"
  - "My name is John Smith" → firstName: "John", lastName: "Smith"
  - "John" → firstName: "John", lastName: null (single name is okay)
  - "Dr. John Smith Jr." → firstName: "John", lastName: "Smith Jr."
  - "Mary-Beth Johnson" → firstName: "Mary-Beth", lastName: "Johnson"
❌ DO NOT EXTRACT AS NAME:
  - Street addresses (e.g., "123 Main St")
  - City names alone (e.g., "Charlotte")
  - Email addresses
  - Phone numbers
  - Property types

EMAIL EXTRACTION:
✅ VALID FORMATS:
  - "john@example.com" → email: "john@example.com"
  - "My email is john@realty.com" → email: "john@realty.com"
  - "Email: john.smith@company.com" → email: "john.smith@company.com"
  - "jsmith@gmail.com" → email: "jsmith@gmail.com"
❌ DO NOT EXTRACT AS EMAIL:
  - Names (e.g., "John Smith")
  - Addresses
  - Invalid formats (missing @ or .)

MARKETS EXTRACTION:
✅ VALID FORMATS:
  - "Charlotte NC, Atlanta GA" → markets: ["Charlotte NC", "Atlanta GA"]
  - "Charlotte" → markets: ["Charlotte"]
  - "Charlotte, Raleigh, Greensboro" → markets: ["Charlotte", "Raleigh", "Greensboro"]
  - "I work in Charlotte and Atlanta" → markets: ["Charlotte", "Atlanta"]
  - "North Carolina markets" → markets: ["North Carolina"]
  - "Charlotte NC metro area" → markets: ["Charlotte NC"]
❌ DO NOT EXTRACT AS MARKETS:
  - Names (e.g., "John Smith")
  - Email addresses
  - Property addresses

ALL-IN-ONE RESPONSES (when broker sends multiple fields):
✅ "John Smith, john@realty.com, Charlotte NC"
   → firstName: "John", lastName: "Smith", email: "john@realty.com", markets: ["Charlotte NC"]
✅ "My name is Jack Miller, email jack@example.com, I cover Charlotte and Asheville"
   → firstName: "Jack", lastName: "Miller", email: "jack@example.com", markets: ["Charlotte", "Asheville"]

CONFIDENCE SCORING:
- high: Clear, unambiguous extraction (e.g., "John Smith" for name)
- medium: Reasonable extraction with minor ambiguity (e.g., "Smith" - single name)
- low: Uncertain extraction or may need clarification

NOTES:
- Add helpful notes if extraction is uncertain or if additional clarification may be needed
- Example: "Single name provided, may want to confirm last name"
- Example: "Email format looks valid but unusual domain"

Respond in JSON format with these exact fields (use null if not found):
{
  "firstName": "first name only",
  "lastName": "last name only", 
  "email": "valid email address",
  "markets": ["market1", "market2"],
  "confidence": "high|medium|low",
  "notes": "any relevant notes or null"
}`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 500,
    });

    const result = response.choices[0].message.content;
    if (!result) {
      throw new Error('Empty response from OpenAI');
    }

    const responseTime = Date.now() - startTime;
    apiCallTracker.logCall('OpenAI', 'parseProfileData', true, responseTime);

    const parsed = JSON.parse(result) as ParsedProfileData;
    
    console.log('✅ AI profile parsing complete:');
    console.log(`   Name: ${parsed.firstName || ''} ${parsed.lastName || ''}`);
    console.log(`   Email: ${parsed.email || 'N/A'}`);
    console.log(`   Markets: ${parsed.markets?.join(', ') || 'N/A'}`);
    console.log(`   Confidence: ${parsed.confidence}`);
    if (parsed.notes) {
      console.log(`   Notes: ${parsed.notes}`);
    }
    
    return parsed;
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    apiCallTracker.logCall('OpenAI', 'parseProfileData', false, responseTime, {
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    
    console.error('❌ AI profile parsing failed:', error);
    
    // Fallback to basic parsing
    return {
      firstName: null,
      lastName: null,
      email: null,
      markets: null,
      confidence: 'low',
      notes: 'AI parsing failed, used fallback'
    };
  }
}

/**
 * Quick check if a message contains profile information
 */
export function looksLikeProfileData(message: string): boolean {
  const text = message.toLowerCase();
  
  // Check for profile-related keywords
  const profileKeywords = [
    'name', 'email', 'market', 'serve', 'cover', 'area',
    '@', '.com', '.net', '.org', // Email indicators
  ];
  
  return profileKeywords.some(keyword => text.includes(keyword));
}

/**
 * Validate extracted profile data
 */
export function validateProfileData(parsed: ParsedProfileData): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Validate email format if provided
  if (parsed.email) {
    if (!parsed.email.includes('@') || !parsed.email.includes('.')) {
      errors.push('Email format appears invalid');
    }
  }
  
  // Validate name if provided
  if (parsed.firstName && parsed.firstName.length < 2) {
    errors.push('First name seems too short');
  }
  
  // Validate markets if provided
  if (parsed.markets && parsed.markets.length === 0) {
    errors.push('Markets array is empty');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
