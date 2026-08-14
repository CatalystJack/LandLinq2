import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: import.meta.env.VITE_OPENAI_API_KEY });

export interface AIRecommendation {
  dealId: string;
  type: 'priority' | 'risk' | 'opportunity' | 'action';
  title: string;
  description: string;
  confidence: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  suggestedAction?: string;
}

export interface DealAnalysis {
  dealId: string;
  summary: string;
  riskFactors: string[];
  opportunities: string[];
  recommendedPriority: 'low' | 'medium' | 'high' | 'critical';
  estimatedReviewTime: number;
}

export async function generateDealRecommendations(deals: any[]): Promise<AIRecommendation[]> {
  if (!deals || deals.length === 0) return [];

  try {
    const dealSummary = deals.map(deal => ({
      id: deal.id,
      address: deal.address || 'Unknown',
      askingPrice: deal.askingPrice || 'Not specified',
      status: deal.status || 'pending',
      classification: deal.classification || 'unclassified',
      createdAt: deal.createdAt,
      sizeAcres: deal.sizeAcres || 'Unknown',
      zoning: deal.zoning || null
    }));

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an AI assistant for real estate deal analysis. Analyze the provided deals and generate actionable recommendations for analysts. Focus on priority deals, risk factors, opportunities, and urgent actions needed. Respond in JSON format."
        },
        {
          role: "user",
          content: `Analyze these real estate deals and provide recommendations: ${JSON.stringify(dealSummary)}. 
          
          Return a JSON array of recommendations with this format:
          {
            "recommendations": [
              {
                "dealId": "string",
                "type": "priority|risk|opportunity|action",
                "title": "string",
                "description": "string", 
                "confidence": 0-1,
                "urgency": "low|medium|high|critical",
                "suggestedAction": "string"
              }
            ]
          }`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return result.recommendations || [];
  } catch (error) {
    console.error('Error generating AI recommendations:', error);
    return [];
  }
}

export async function analyzeDeal(deal: any): Promise<DealAnalysis> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system", 
          content: "You are an expert real estate analyst. Analyze the provided deal data and provide a comprehensive analysis including risk factors, opportunities, and priority recommendations. Respond in JSON format."
        },
        {
          role: "user",
          content: `Analyze this real estate deal: ${JSON.stringify(deal)}
          
          Return JSON in this format:
          {
            "summary": "Brief analysis summary",
            "riskFactors": ["risk1", "risk2"],
            "opportunities": ["opportunity1", "opportunity2"], 
            "recommendedPriority": "low|medium|high|critical",
            "estimatedReviewTime": number_in_minutes
          }`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      dealId: deal.id,
      summary: result.summary || "Analysis unavailable",
      riskFactors: result.riskFactors || [],
      opportunities: result.opportunities || [],
      recommendedPriority: result.recommendedPriority || 'medium',
      estimatedReviewTime: result.estimatedReviewTime || 30
    };
  } catch (error) {
    console.error('Error analyzing deal:', error);
    return {
      dealId: deal.id,
      summary: "Analysis temporarily unavailable",
      riskFactors: [],
      opportunities: [],
      recommendedPriority: 'medium',
      estimatedReviewTime: 30
    };
  }
}

export async function generateRoutingRecommendation(deal: any, analysts: any[]): Promise<{
  recommendedAnalyst: string;
  reason: string;
  confidence: number;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an intelligent routing system for real estate deals. Analyze deal characteristics and analyst expertise to recommend the best analyst assignment."
        },
        {
          role: "user", 
          content: `Deal: ${JSON.stringify(deal)}
          Available analysts: ${JSON.stringify(analysts)}
          
          Return JSON:
          {
            "recommendedAnalyst": "analyst_email",
            "reason": "explanation",
            "confidence": 0-1
          }`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 500
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      recommendedAnalyst: result.recommendedAnalyst || (analysts[0]?.email || 'No analyst available'),
      reason: result.reason || 'Default assignment',
      confidence: result.confidence || 0.5
    };
  } catch (error) {
    console.error('Error generating routing recommendation:', error);
    return {
      recommendedAnalyst: analysts[0]?.email || 'No analyst available',
      reason: 'Error in routing analysis',
      confidence: 0.3
    };
  }
}