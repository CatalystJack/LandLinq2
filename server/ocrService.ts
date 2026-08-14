// OCR Service using OpenAI Vision API
// Extracts text from images (PNG, JPG, etc.) for deal data parsing

import OpenAI from "openai";
import { apiCallTracker } from './apiCallTracker.js';

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface OCRResult {
  extractedText: string;
  propertyDetails: {
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    fullAddress?: string;
    price?: string;
    acreage?: string;
    units?: string;
    propertyType?: string;
    location?: string;
    description?: string;
  };
  confidence: string;
  rawResponse: string;
}

/**
 * Extract text and property details from an image using OpenAI Vision
 */
export async function extractTextFromImage(base64Image: string, filename: string): Promise<OCRResult> {
  let startTime = Date.now();
  try {
    console.log(`🔍 Running OCR on image: ${filename}`);
    
    startTime = Date.now();
    const visionResponse = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are analyzing a real estate property flyer or document. Extract ALL visible text and identify key property details.

CRITICAL ADDRESS EXTRACTION RULES:
1. **STREET NUMBERS ARE CRITICAL** - Read them VERY CAREFULLY, especially in marketing headers/titles
2. Common OCR errors to AVOID:
   - "1360" misread as "1308" (watch for 0 vs 8)
   - "1801" misread as "1801" (watch for similar-looking digits)
3. If you see a prominent property address at the TOP of the image (marketing header), that is usually the PRIMARY address to extract
4. Double-check all street numbers - they must be EXACT
5. Extract the complete address including ZIP CODE

Please provide:
1. ALL text you can read from the image (complete transcription)
2. Property details with COMPLETE ADDRESS including ZIP CODE
3. Verify street numbers are read correctly (not misread due to font styling)

Respond in JSON format:
{
  "extractedText": "complete transcription of all visible text",
  "propertyDetails": {
    "address": "street address with EXACT street number (e.g., 1360 B's Barbeque Rd)",
    "city": "city name",
    "state": "state (TN, GA, NC, etc.)",
    "zipCode": "5-digit ZIP code if visible",
    "fullAddress": "complete address: street, city, state ZIP",
    "price": "asking price if visible",
    "acreage": "land size if visible",
    "units": "number of units/lots if visible",
    "propertyType": "type of property (apartments, townhomes, lots, etc.)",
    "description": "any marketing description or highlights"
  },
  "confidence": "high/medium/low",
  "streetNumberVerification": "confirm the exact street number you read (e.g., '1360')"
}`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 4096,
    });
    const responseTime = Date.now() - startTime;
    apiCallTracker.logCall('OpenAI', 'extractTextFromImage', true, responseTime);

    const rawResponse = visionResponse.choices[0].message.content || '';
    
    if (!rawResponse) {
      throw new Error('Empty response from OpenAI Vision');
    }
    
    const parsed = JSON.parse(rawResponse);
    
    console.log(`✅ OCR completed for ${filename}`);
    console.log(`   Extracted text length: ${parsed.extractedText?.length || 0} characters`);
    console.log(`   Confidence: ${parsed.confidence}`);
    
    // Log street number verification to catch OCR errors
    if (parsed.streetNumberVerification) {
      console.log(`   ✓ Street Number Verified: ${parsed.streetNumberVerification}`);
    }
    if (parsed.propertyDetails?.address) {
      console.log(`   📍 Extracted Address: ${parsed.propertyDetails.address}`);
    }
    if (parsed.propertyDetails?.fullAddress) {
      console.log(`   📍 Full Address: ${parsed.propertyDetails.fullAddress}`);
    }
    
    return {
      extractedText: parsed.extractedText || '',
      propertyDetails: parsed.propertyDetails || {},
      confidence: parsed.confidence || 'unknown',
      rawResponse
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    apiCallTracker.logCall('OpenAI', 'extractTextFromImage', false, responseTime, {
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    console.error(`❌ OCR failed for ${filename}:`, error);
    throw error;
  }
}

/**
 * Process image buffer and return OCR results
 */
export async function processImageAttachment(buffer: Buffer, filename: string): Promise<OCRResult> {
  const base64Image = buffer.toString('base64');
  return extractTextFromImage(base64Image, filename);
}

/**
 * Extract text from PDF using OCR (for scanned or image-based PDFs)
 * Uses AI to clean up garbled text from pdf-parse
 */
export async function extractTextFromPDFWithOCR(pdfBuffer: Buffer, filename: string): Promise<string> {
  let startTime = Date.now();
  try {
    console.log(`🔄 Using AI to clean garbled PDF text: ${filename}`);
    
    // Get raw (possibly garbled) text from pdf-parse
    const pdfParse = (await import('pdf-parse')).default;
    const pdfData = await pdfParse(pdfBuffer);
    const rawText = pdfData.text || '';
    
    console.log(`📝 Sending ${rawText.length} chars of raw PDF text to AI for cleaning...`);
    
    // Use OpenAI to clean up and extract structured data from garbled PDF text
    startTime = Date.now();
    const cleaningResponse = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "user",
          content: `You are analyzing poorly formatted or garbled text extracted from a real estate PDF document. Clean it up and extract property information.

Raw text from PDF (may have encoding errors):
${rawText.substring(0, 4000)}

Extract these details if present:
- Property address (street, city, state, ZIP code)
- Asking price
- Acreage/lot size  
- Property type (multifamily, townhome, lot, etc.)
- Number of units
- Any other relevant property details

Respond with clean, well-formatted text containing all extracted property information. If the text is completely unreadable (just random symbols), respond with exactly: "UNREADABLE"`,
        },
      ],
      max_completion_tokens: 2000,
    });
    const responseTime = Date.now() - startTime;
    apiCallTracker.logCall('OpenAI', 'cleanPDFText', true, responseTime);

    const cleanedText = cleaningResponse.choices[0].message.content || '';
    
    if (cleanedText === 'UNREADABLE' || cleanedText.includes('UNREADABLE')) {
      console.log('⚠️ PDF text is unreadable - may need manual review');
      return '';
    }
    
    console.log(`✅ AI cleaned/extracted ${cleanedText.length} characters from PDF`);
    return cleanedText;
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    apiCallTracker.logCall('OpenAI', 'cleanPDFText', false, responseTime, {
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    console.error(`❌ PDF OCR failed for ${filename}:`, error);
    throw error;
  }
}
