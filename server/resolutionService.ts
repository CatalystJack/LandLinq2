import { storage } from "./storage";
import { OpenAIService } from "./openaiService";
import { classifyDealByExactCriteria } from "./businessRules";
import { realPropertyDataService } from "./propertyDataService";
import type { Communication, Deal, Broker } from "@shared/schema";
import OpenAI from "openai";
import { apiCallTracker } from './apiCallTracker.js';

export interface ResponseAnalysis {
  isResponse: boolean;
  threadKey?: string;
  originalDealId?: string;
  extractedData: {
    address?: string;
    price?: number;
    acreage?: number;
    additionalInfo?: Record<string, any>;
  };
  resolvedFields: string[];
  confidence: number;
}

export interface ResolutionResult {
  resolved: boolean;
  dealUpdated: boolean;
  fieldsResolved: string[];
  updatedDeal?: Deal;
  errors?: string[];
}

export class ResolutionService {
  private static readonly openaiService = new OpenAIService();
  private static readonly openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  /**
   * Analyze an inbound message to determine if it's a response to an existing thread
   */
  static async analyzeInboundMessage(
    content: string, 
    fromEmail?: string, 
    fromPhone?: string,
    channel: 'email' | 'sms' = 'email'
  ): Promise<ResponseAnalysis> {
    try {
      // First, try to find existing threads for this broker
      let broker: Broker | undefined;
      
      if (fromEmail) {
        broker = await storage.getBrokerByEmail(fromEmail);
      } else if (fromPhone) {
        broker = await storage.getBrokerByPhone(fromPhone);
      }
      
      if (!broker) {
        // If no broker found, this is likely a new submission
        return {
          isResponse: false,
          extractedData: {},
          resolvedFields: [],
          confidence: 0
        };
      }
      
      // Look for active (unresolved) communications from this broker
      const activeCommunications = await this.getActiveCommunicationsForBroker(broker.id);
      
      if (activeCommunications.length === 0) {
        // No active threads, this is likely a new submission
        return {
          isResponse: false,
          extractedData: {},
          resolvedFields: [],
          confidence: 0
        };
      }
      
      // Use AI to analyze the content and determine if it's providing missing information
      const contentAnalysis = await this.analyzeContentForMissingData(content, activeCommunications);
      
      if (contentAnalysis.isResponse && contentAnalysis.threadKey) {
        // This is a response - extract the data
        const extractedData = await this.extractDataFromResponse(content);
        
        return {
          isResponse: true,
          threadKey: contentAnalysis.threadKey,
          originalDealId: contentAnalysis.dealId,
          extractedData,
          resolvedFields: contentAnalysis.resolvedFields,
          confidence: contentAnalysis.confidence
        };
      }
      
      return {
        isResponse: false,
        extractedData: {},
        resolvedFields: [],
        confidence: 0
      };
      
    } catch (error) {
      console.error('Error analyzing inbound message:', error);
      return {
        isResponse: false,
        extractedData: {},
        resolvedFields: [],
        confidence: 0
      };
    }
  }
  
  /**
   * Process a response and update the associated deal and communication thread
   */
  static async processResponse(
    analysis: ResponseAnalysis,
    communicationData: {
      brokerId: string;
      content: string;
      channel: 'email' | 'sms';
      providerMessageId?: string;
    }
  ): Promise<ResolutionResult> {
    const errors: string[] = [];
    
    console.log(`\n🔧 [RESOLUTION-SERVICE] processResponse called`);
    console.log(`   Input analysis:`, {
      isResponse: analysis.isResponse,
      threadKey: analysis.threadKey,
      originalDealId: analysis.originalDealId,
      extractedDataKeys: Object.keys(analysis.extractedData),
      resolvedFields: analysis.resolvedFields,
      confidence: analysis.confidence
    });
    console.log(`   Communication data:`, {
      brokerId: communicationData.brokerId,
      channel: communicationData.channel,
      contentPreview: communicationData.content.substring(0, 100)
    });
    
    try {
      if (!analysis.isResponse || !analysis.threadKey || !analysis.originalDealId) {
        console.log(`❌ [RESOLUTION-SERVICE] Validation FAILED - returning resolved=false`);
        console.log(`   Reason: ${!analysis.isResponse ? 'Not a response' : !analysis.threadKey ? 'No threadKey' : 'No originalDealId'}`);
        return {
          resolved: false,
          dealUpdated: false,
          fieldsResolved: [],
          errors: ['Message is not a valid response to an existing thread']
        };
      }
      
      console.log(`✅ [RESOLUTION-SERVICE] Validation passed - this IS a response to deal ${analysis.originalDealId}`);
      
      // Get the original deal
      const originalDeal = await storage.getDealById(analysis.originalDealId);
      if (!originalDeal) {
        return {
          resolved: false,
          dealUpdated: false,
          fieldsResolved: [],
          errors: ['Original deal not found']
        };
      }
      
      // Create the response communication record
      const responseCommunication = await storage.createCommunication({
        brokerId: communicationData.brokerId,
        relatedDealId: analysis.originalDealId,
        threadKey: analysis.threadKey,
        channel: communicationData.channel,
        direction: 'inbound',
        rawText: communicationData.content,
        parsedJson: analysis.extractedData,
        status: 'resolved',
        resolved: true,
        resolvedAt: new Date(),
        resolvedFields: analysis.resolvedFields,
        providerMessageId: communicationData.providerMessageId
      });
      
      // Update the deal with new information
      const dealUpdates: Partial<Deal> = {};
      let fieldsUpdated: string[] = [];
      
      // Update address if provided and missing
      if (analysis.extractedData.address && !originalDeal.address) {
        dealUpdates.address = analysis.extractedData.address;
        fieldsUpdated.push('address');
      }
      
      // Update price if provided
      if (analysis.extractedData.price) {
        if (!originalDeal.askingPrice) {
          dealUpdates.askingPrice = analysis.extractedData.price.toString();
          fieldsUpdated.push('askingPrice');
        }
      }
      
      // Update acreage if provided
      if (analysis.extractedData.acreage) {
        if (!originalDeal.sizeAcres) {
          dealUpdates.sizeAcres = analysis.extractedData.acreage.toString();
          fieldsUpdated.push('sizeAcres');
        }
      }
      
      // Update any additional extracted information
      if (analysis.extractedData.additionalInfo) {
        Object.entries(analysis.extractedData.additionalInfo).forEach(([key, value]) => {
          if (value && !(originalDeal as any)[key]) {
            (dealUpdates as any)[key] = value;
            fieldsUpdated.push(key);
          }
        });
      }
      
      // Update deal status based on completeness
      const hasAllRequired = this.checkDealCompleteness(originalDeal, dealUpdates);
      if (hasAllRequired) {
        dealUpdates.validationStatus = 'active';
        if (originalDeal.validationStatus === 'insufficient_data') {
          dealUpdates.status = 'pending_review';
        }
      }
      
      // Apply updates to deal
      let updatedDeal: Deal | undefined;
      if (Object.keys(dealUpdates).length > 0) {
        updatedDeal = await storage.updateDeal(analysis.originalDealId, dealUpdates);
        
        // If deal is now complete, trigger enrichment and classification
        if (hasAllRequired && updatedDeal) {
          await this.triggerDealEnrichment(updatedDeal);
        }
      }
      
      // Mark all related unresolved communications in this thread as resolved
      await this.resolveThreadCommunications(analysis.threadKey, analysis.resolvedFields);
      
      return {
        resolved: true,
        dealUpdated: Object.keys(dealUpdates).length > 0,
        fieldsResolved: analysis.resolvedFields,
        updatedDeal: updatedDeal || originalDeal,
        errors: errors.length > 0 ? errors : undefined
      };
      
    } catch (error) {
      console.error('Error processing response:', error);
      errors.push(`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        resolved: false,
        dealUpdated: false,
        fieldsResolved: [],
        errors
      };
    }
  }
  
  /**
   * Get active (unresolved) communications for a broker
   * ROBUST VERSION: Finds ANY unresolved communications, not just those with missingFields
   */
  private static async getActiveCommunicationsForBroker(brokerId: string): Promise<Communication[]> {
    const allCommunications = await storage.getCommunicationsByBrokerId(brokerId);
    
    // CRITICAL FIX: Be VERY lenient about what counts as "active"
    // This catches replies even if missingFields wasn't set properly
    const activeCommunications = allCommunications.filter(comm => 
      !comm.resolved && 
      comm.status !== 'resolved' &&
      comm.threadKey &&
      comm.relatedDealId  // Must have a related deal
    ).sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA; // Most recent first
    });
    
    // If we found active communications, return them
    if (activeCommunications.length > 0) {
      console.log(`✅ Found ${activeCommunications.length} active communication(s) for broker ${brokerId}`);
      return activeCommunications;
    }
    
    // FALLBACK: If no active communications found, look for RECENT deals with missing info
    // This catches cases where the communication record wasn't created properly
    console.log(`⚠️ No active communications found, checking recent deals for broker ${brokerId}...`);
    const recentDeals = await storage.getDealsByBrokerId(brokerId);
    
    // Find deals from last 7 days with missing address/ZIP/state
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const incompleteDeal = recentDeals.find(deal => {
      const dealTime = deal.createdAt ? new Date(deal.createdAt).getTime() : 0;
      const isRecent = dealTime > sevenDaysAgo;
      const isMissingInfo = !deal.zip || !deal.state || !deal.address;
      return isRecent && isMissingInfo;
    });
    
    if (incompleteDeal) {
      console.log(`✅ FALLBACK: Found recent incomplete deal ${incompleteDeal.id} - creating synthetic communication record`);
      // Create a synthetic communication object for AI analysis
      return [{
        id: 'synthetic',
        brokerId,
        relatedDealId: incompleteDeal.id,
        threadKey: `deal-${incompleteDeal.id}-broker-${brokerId}`,
        channel: 'email',
        direction: 'outbound' as const,
        status: 'followup_sent',
        resolved: false,
        missingFields: ['ZIP code', 'state', 'address'].filter(field => {
          if (field === 'ZIP code') return !incompleteDeal.zip;
          if (field === 'state') return !incompleteDeal.state;
          if (field === 'address') return !incompleteDeal.address;
          return false;
        }),
        rawText: `Follow-up for missing information: ${incompleteDeal.address || 'address'}`,
        createdAt: incompleteDeal.createdAt || new Date()
      } as Communication];
    }
    
    console.log(`❌ No active communications or recent incomplete deals found for broker ${brokerId}`);
    return [];
  }
  
  /**
   * Use AI to analyze content and determine if it's responding to missing data requests
   */
  private static async analyzeContentForMissingData(
    content: string, 
    activeCommunications: Communication[]
  ): Promise<{
    isResponse: boolean;
    threadKey?: string;
    dealId?: string;
    resolvedFields: string[];
    confidence: number;
  }> {
    let startTime = Date.now();
    try {
      // Create context about what information was requested
      const threadsContext = activeCommunications.map(comm => ({
        threadKey: comm.threadKey,
        dealId: comm.relatedDealId,
        missingFields: comm.missingFields || [],
        sentAt: comm.createdAt,
        content: comm.rawText
      }));
      
      const prompt = `
        Analyze this message to determine if it's providing information that was previously requested.
        
        Message content: "${content}"
        
        Active information requests:
        ${threadsContext.map(ctx => `
        Thread ${ctx.threadKey} (Deal ${ctx.dealId}):
        - Missing fields: ${ctx.missingFields?.join(', ') || 'unknown'}
        - Sent: ${ctx.sentAt}
        `).join('\n')}
        
        IMPORTANT: Even if the message is VERY SHORT (like just "85 ACRES" or "$5M"), if it contains data that matches a missing field, mark it as isResponse: true.
        
        Determine:
        1. Is this message providing specific information that addresses any of the missing fields?
        2. Which thread is it responding to? (Use the most recent thread)
        3. Which specific fields are being provided?
        4. Confidence level (0-100)
        
        Look for:
        - Price information: dollar amounts ($), "asking price", "price is", numbers followed by "million", "M", "k"
        - Acreage information: numbers followed by "acres", "acre", "ac", "acreage" - Examples: "85 ACRES", "50 acres", "12.5 ac"
        - Address information: street addresses, city/state/zip combinations
        
        Field Mapping:
        - If missing "price" or "acreage" → look for corresponding data types above
        - Use the MOST RECENT thread if multiple exist
        
        Respond in JSON format:
        {
          "isResponse": boolean,
          "threadKey": "thread_key_if_responding",
          "dealId": "deal_id_if_responding", 
          "resolvedFields": ["acreage" or "price" or "address"],
          "confidence": number_0_to_100
        }
      `;
      
      startTime = Date.now();
      const response = await this.openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        // Note: GPT-5 only supports default temperature of 1, custom values not allowed
        max_completion_tokens: 500
      });
      const responseTime = Date.now() - startTime;
      apiCallTracker.logCall('OpenAI', 'matchThread', true, responseTime);
      
      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        isResponse: result.isResponse || false,
        threadKey: result.threadKey,
        dealId: result.dealId,
        resolvedFields: result.resolvedFields || [],
        confidence: result.confidence || 0
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      apiCallTracker.logCall('OpenAI', 'matchThread', false, responseTime, {
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      console.error('Error analyzing content with AI:', error);
      return {
        isResponse: false,
        resolvedFields: [],
        confidence: 0
      };
    }
  }
  
  /**
   * Extract structured data from response content
   */
  private static async extractDataFromResponse(content: string): Promise<{
    address?: string;
    price?: number;
    acreage?: number;
    additionalInfo?: Record<string, any>;
  }> {
    let startTime = Date.now();
    try {
      const prompt = `
        Extract structured property data from this message:
        "${content}"
        
        Extract any of the following information if present:
        - Property address (full address)
        - Price/asking price (dollar amount)
        - Acreage/size (numeric value in acres)
        - Any other property details
        
        Respond in JSON format:
        {
          "address": "full_address_if_found",
          "price": numeric_value_without_commas,
          "acreage": numeric_value,
          "additionalInfo": {
            "key": "value for any other details"
          }
        }
        
        Return null for any fields not found. For price, extract only the numeric value.
      `;
      
      startTime = Date.now();
      const response = await this.openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        // Note: GPT-5 only supports default temperature of 1, custom values not allowed
        max_completion_tokens: 500
      });
      const responseTime = Date.now() - startTime;
      apiCallTracker.logCall('OpenAI', 'extractMissingInfo', true, responseTime);
      
      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      // Clean up the extracted data
      const extractedData: any = {};
      
      if (result.address && typeof result.address === 'string') {
        extractedData.address = result.address.trim();
      }
      
      if (result.price && !isNaN(Number(result.price))) {
        extractedData.price = Number(result.price);
      }
      
      if (result.acreage && !isNaN(Number(result.acreage))) {
        extractedData.acreage = Number(result.acreage);
      }
      
      if (result.additionalInfo && typeof result.additionalInfo === 'object') {
        extractedData.additionalInfo = result.additionalInfo;
      }
      
      return extractedData;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      apiCallTracker.logCall('OpenAI', 'extractMissingInfo', false, responseTime, {
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      console.error('Error extracting data from response:', error);
      return {};
    }
  }
  
  /**
   * Check if a deal has all required information for processing
   */
  private static checkDealCompleteness(originalDeal: Deal, updates: Partial<Deal>): boolean {
    const mergedDeal = { ...originalDeal, ...updates };
    
    // Check for required fields
    const hasAddress = !!(mergedDeal.address);
    const hasPrice = !!(mergedDeal.askingPrice);
    const hasAcreage = !!(mergedDeal.sizeAcres);
    
    return hasAddress && hasPrice && hasAcreage;
  }
  
  /**
   * Trigger deal enrichment and classification for complete deals
   */
  private static async triggerDealEnrichment(deal: Deal): Promise<void> {
    try {
      // Trigger property data enrichment
      if (deal.address) {
        // ATTOM service removed
        
        try {
          const coordinates = await realPropertyDataService.geocodeAddress(deal.address);
          if (coordinates) {
            await realPropertyDataService.getZoningData(deal.address, coordinates);
            await realPropertyDataService.getOwnershipData(deal.address, coordinates);
          }
        } catch (error) {
          console.error('Error enriching with RealProperty data:', error);
        }
      }
      
      // Trigger classification update
      const classification = await classifyDealByExactCriteria(deal);
      if (classification) {
        await storage.updateDeal(deal.id, {
          classification: classification.classification,
          aiAnalysisData: {
            reasoning: classification.reasoning,
            conditionsMet: classification.conditionsMet,
            conditionsNotMet: classification.conditionsNotMet,
            insufficientData: classification.insufficientData,
            dataQuality: classification.dataQuality,
            suggestedDevelopmentType: classification.suggestedDevelopmentType
          }
        });
      }
      
      console.log(`Deal ${deal.id} enrichment and classification triggered`);
    } catch (error) {
      console.error('Error triggering deal enrichment:', error);
    }
  }
  
  /**
   * Mark all communications in a thread as resolved
   */
  private static async resolveThreadCommunications(threadKey: string, resolvedFields: string[]): Promise<void> {
    try {
      const threadCommunications = await storage.getCommunicationsByThreadKey(threadKey);
      
      for (const comm of threadCommunications) {
        if (!comm.resolved) {
          await storage.updateCommunication(comm.id, {
            resolved: true,
            resolvedAt: new Date(),
            resolvedFields: resolvedFields,
            status: 'resolved'
          });
        }
      }
    } catch (error) {
      console.error('Error resolving thread communications:', error);
    }
  }
  
  /**
   * Check if a communication thread is resolved
   */
  static async isThreadResolved(threadKey: string): Promise<boolean> {
    try {
      const threadCommunications = await storage.getCommunicationsByThreadKey(threadKey);
      
      // A thread is resolved if any communication in the thread is marked as resolved
      return threadCommunications.some(comm => comm.resolved);
    } catch (error) {
      console.error('Error checking thread resolution status:', error);
      return false;
    }
  }
  
  /**
   * Get resolution status for a deal's communications
   */
  static async getDealCommunicationStatus(dealId: string): Promise<{
    hasActiveThreads: boolean;
    resolvedThreads: string[];
    activeThreads: string[];
    totalThreads: number;
  }> {
    try {
      const dealCommunications = await storage.getCommunicationsByDealId(dealId);
      
      const threadMap = new Map<string, { resolved: boolean; communications: Communication[] }>();
      
      dealCommunications.forEach(comm => {
        if (comm.threadKey) {
          if (!threadMap.has(comm.threadKey)) {
            threadMap.set(comm.threadKey, { resolved: false, communications: [] });
          }
          threadMap.get(comm.threadKey)!.communications.push(comm);
          if (comm.resolved) {
            threadMap.get(comm.threadKey)!.resolved = true;
          }
        }
      });
      
      const resolvedThreads: string[] = [];
      const activeThreads: string[] = [];
      
      threadMap.forEach((data, threadKey) => {
        if (data.resolved) {
          resolvedThreads.push(threadKey);
        } else {
          activeThreads.push(threadKey);
        }
      });
      
      return {
        hasActiveThreads: activeThreads.length > 0,
        resolvedThreads,
        activeThreads,
        totalThreads: threadMap.size
      };
    } catch (error) {
      console.error('Error getting deal communication status:', error);
      return {
        hasActiveThreads: false,
        resolvedThreads: [],
        activeThreads: [],
        totalThreads: 0
      };
    }
  }
}