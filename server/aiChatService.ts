import OpenAI from "openai";
import { storage } from "./storage";
import { apiCallTracker } from './apiCallTracker';
import type { Deal, Broker } from "../shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ChatContext {
  dealsReferenced: number;
  brokersReferenced: number;
  compsReferenced: number;
}

interface ChatResponse {
  response: string;
  context: ChatContext;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

class AIChatService {
  private async getDealsContext(query: string): Promise<{ summary: string; count: number }> {
    try {
      const deals = await storage.getAllDeals();
      
      const relevantDeals = deals.slice(0, 50);
      
      if (relevantDeals.length === 0) {
        return { summary: "No deals found in the system.", count: 0 };
      }

      const dealSummaries = relevantDeals.map((d: Deal) => {
        const price = d.askingPrice ? `$${Number(d.askingPrice).toLocaleString()}` : 'N/A';
        const acres = d.sizeAcres || 'N/A';
        const units = d.unitCount || 'N/A';
        const classification = d.classification || 'unclassified';
        const msa = d.msaName || 'Unknown MSA';
        const productTypes = Array.isArray(d.productTypes) ? d.productTypes.join(', ') : 'N/A';
        const topRent = d.topRentPSF ? `$${d.topRentPSF}/sqft` : 'N/A';
        const yearBuilt = d.yearBuilt || 'N/A';
        const rejectionReason = d.rejectionReason || '';
        
        return `Deal #${d.dealNumber}: ${d.address || 'Unknown'}, ${d.city || ''} ${d.state || ''} | Classification: ${classification.toUpperCase()} | MSA: ${msa} | Price: ${price} | Acres: ${acres} | Units: ${units} | Products: ${productTypes} | Top Rent: ${topRent} | Year Built: ${yearBuilt}${rejectionReason ? ` | Rejection: ${rejectionReason}` : ''}`;
      });

      const classificationCounts = relevantDeals.reduce((acc: Record<string, number>, d: Deal) => {
        const c = d.classification || 'unclassified';
        acc[c] = (acc[c] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const summary = `
DEALS DATABASE (${deals.length} total deals):
Classification breakdown: ${Object.entries(classificationCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}

Recent deals:
${dealSummaries.join('\n')}
      `.trim();

      return { summary, count: relevantDeals.length };
    } catch (error) {
      console.error('Error fetching deals context:', error);
      return { summary: "Unable to fetch deals data.", count: 0 };
    }
  }

  private async getBrokersContext(): Promise<{ summary: string; count: number }> {
    try {
      const brokers = await storage.getAllBrokers();
      
      if (brokers.length === 0) {
        return { summary: "No brokers found in the system.", count: 0 };
      }

      const activeBrokers = brokers.slice(0, 30);
      
      const brokerSummaries = activeBrokers.map((b: Broker) => {
        const name = [b.firstName, b.lastName].filter(Boolean).join(' ') || 'Unknown';
        const email = b.email || 'N/A';
        const phone = b.phone ? `...${b.phone.slice(-4)}` : 'N/A';
        const markets = Array.isArray(b.marketsCovered) ? b.marketsCovered.join(', ') : 'N/A';
        const smsOptIn = b.smsOptIn ? 'Yes' : 'No';
        
        return `${name} | Email: ${email} | Phone: ${phone} | Markets: ${markets} | SMS: ${smsOptIn}`;
      });

      const summary = `
BROKERS DATABASE (${brokers.length} total brokers):
${brokerSummaries.join('\n')}
      `.trim();

      return { summary, count: activeBrokers.length };
    } catch (error) {
      console.error('Error fetching brokers context:', error);
      return { summary: "Unable to fetch brokers data.", count: 0 };
    }
  }

  private async getMarketContext(): Promise<string> {
    return "Market data available through deal MSA assignments.";
  }

  private async getComparablesContext(): Promise<{ summary: string; count: number }> {
    try {
      const deals = await storage.getAllDeals();
      const dealsWithComps = deals.filter((d: Deal) => d.comparablesJson);
      
      if (dealsWithComps.length === 0) {
        return { summary: "No HelloData comparables found.", count: 0 };
      }

      let totalComps = 0;
      const compSummaries: string[] = [];
      
      for (const deal of dealsWithComps.slice(0, 20)) {
        try {
          const comps = JSON.parse(deal.comparablesJson as string);
          if (Array.isArray(comps) && comps.length > 0) {
            totalComps += comps.length;
            const avgRent = comps.reduce((sum: number, c: any) => sum + (c.rentPerSqft || 0), 0) / comps.length;
            const avgUnits = comps.reduce((sum: number, c: any) => sum + (c.unitCount || 0), 0) / comps.length;
            compSummaries.push(`Deal #${deal.dealNumber} (${deal.city}, ${deal.state}): ${comps.length} comps, Avg Rent: $${avgRent.toFixed(2)}/sqft, Avg Units: ${Math.round(avgUnits)}`);
          }
        } catch (e) {
        }
      }

      const summary = `
HELLODATA COMPARABLES (${totalComps} total comps across ${dealsWithComps.length} deals):
${compSummaries.join('\n') || 'No parsed comparables available.'}
      `.trim();

      return { summary, count: totalComps };
    } catch (error) {
      console.error('Error fetching comparables context:', error);
      return { summary: "Unable to fetch comparables data.", count: 0 };
    }
  }

  async chat(
    message: string,
    conversationHistory: ConversationMessage[] = []
  ): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      const [dealsContext, brokersContext, marketContext, compsContext] = await Promise.all([
        this.getDealsContext(message),
        this.getBrokersContext(),
        this.getMarketContext(),
        this.getComparablesContext()
      ]);

      const systemPrompt = `You are an AI assistant for LandLinq, a land acquisition platform for Catalyst Capital Partners. You have access to real deal data, broker information, HelloData comparables, and market analytics.

Your role is to:
1. Answer questions about deals, brokers, markets, and comparables
2. Provide insights and patterns you observe in the data
3. Make suggestions for deal prioritization and market focus
4. Help analyze trends and identify opportunities

Be concise but thorough. Reference specific deal numbers, broker names, or MSAs when relevant. If you don't have enough data to answer, say so.

CURRENT DATA CONTEXT:

${dealsContext.summary}

${brokersContext.summary}

${marketContext}

${compsContext.summary}

Remember:
- Classification colors: GREEN = high priority, YELLOW = potential, RED = rejected
- Reference specific deals by number when discussing them
- Be helpful and provide actionable insights
- If asked about something not in the data, acknowledge the limitation`;

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...conversationHistory.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content
        })),
        { role: "user", content: message }
      ];

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages,
        temperature: 0.7,
        max_tokens: 1500
      });

      const responseTime = Date.now() - startTime;
      
      apiCallTracker.logCall('OpenAI', 'chat/completions', true, responseTime);

      const assistantResponse = response.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response. Please try again.";

      return {
        response: assistantResponse,
        context: {
          dealsReferenced: dealsContext.count,
          brokersReferenced: brokersContext.count,
          compsReferenced: compsContext.count
        }
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      apiCallTracker.logCall('OpenAI', 'chat/completions', false, responseTime, { errorMessage: error.message });

      console.error('AI Chat error:', error);
      throw new Error('Failed to process chat request');
    }
  }
}

export const aiChatService = new AIChatService();
