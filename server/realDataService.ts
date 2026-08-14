import OpenAI from "openai";

// Real Data Service that integrates with multiple live data sources
export class RealDataService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
  }

  // Get real market analytics data - NO SYNTHETIC DATA
  async getMarketAnalytics() {
    try {
      // Try to get real market data from BLS, Census, and real estate APIs
      const blsData = await this.getBLSData();
      const censusData = await this.getCensusData();
      const fredData = await this.getFREDData();
      
      return {
        nationalTrends: blsData || "Error - Bureau of Labor Statistics API required",
        developmentMarkets: censusData || "Error - US Census API required", 
        interestRates: fredData || "Error - Federal Reserve Economic Data API required",
        constructionData: "Error - Construction industry API integration required"
      };
    } catch (error) {
      console.error("Market analytics error:", error);
      return {
        nationalTrends: "Error - Market data APIs not configured",
        developmentMarkets: "Error - Market data APIs not configured",
        interestRates: "Error - Market data APIs not configured", 
        constructionData: "Error - Market data APIs not configured"
      };
    }
  }

  private async getBLSData() {
    // Bureau of Labor Statistics - free government API
    try {
      const response = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/LAUCN370810000000005');
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn("BLS API failed:", error);
    }
    return null;
  }

  private async getCensusData() {
    // US Census Bureau - free government API  
    try {
      const response = await fetch('https://api.census.gov/data/2022/acs/acs5?get=NAME,B25077_001E&for=county:*&in=state:37');
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn("Census API failed:", error);
    }
    return null;
  }

  private async getFREDData() {
    const apiKey = process.env.FRED_API_KEY;
    if (!apiKey) {
      console.warn("[FRED] No API key found in environment");
      return null;
    }
    
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=MORTGAGE30US&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`;
      console.log(`[FRED] Fetching mortgage rate data...`);
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        console.warn(`[FRED] API error: ${JSON.stringify(data)}`);
        return null;
      }
      
      console.log(`[FRED] Successfully fetched data`);
      return data;
    } catch (error) {
      console.warn("[FRED] API failed:", error);
    }
    return null;
  }

  // Get real-time deal pipeline data
  async getDealPipelineData(deals: any[]) {
    try {
      const totalValue = deals.reduce((sum, deal) => sum + (parseFloat(deal.askingPrice) || 0), 0);
      const avgValue = deals.length > 0 ? totalValue / deals.length : 0;
      
      const statusCounts = deals.reduce((acc, deal) => {
        acc[deal.status] = (acc[deal.status] || 0) + 1;
        return acc;
      }, {});

      const marketBreakdown = deals.reduce((acc, deal) => {
        const market = deal.targetMarket || "Other";
        acc[market] = (acc[market] || 0) + 1;
        return acc;
      }, {});

      return {
        totalDeals: deals.length,
        totalValue,
        avgDealValue: avgValue,
        statusBreakdown: statusCounts,
        marketBreakdown,
        monthlyTrends: this.calculateMonthlyTrends(deals),
        conversionRates: this.calculateConversionRates(deals)
      };
    } catch (error) {
      console.error("Pipeline data error:", error);
      return { totalDeals: 0, totalValue: 0, avgDealValue: 0 };
    }
  }

  // Get real acquisition criteria - NO SYNTHETIC DATA
  async getAcquisitionCriteria() {
    return {
      criteria: "Error - Acquisition criteria must be configured manually by investment team",
      message: "Real acquisition criteria should be defined by your investment committee, not generated synthetically",
      requiredSetup: [
        "Manual configuration by investment team",
        "Real market analysis from qualified professionals", 
        "Actual zoning research for target markets",
        "Current infrastructure assessments"
      ]
    };
  }

  // Get real team performance metrics - NO SYNTHETIC DATA
  async getTeamMetrics(teamMembers: string[]) {
    return {
      teamSize: teamMembers.length,
      avgResponseTime: "Error - Team metrics tracking system required",
      totalDealsProcessed: "Error - Deal tracking system required", 
      teamMetrics: teamMembers.map(email => ({
        email,
        name: this.formatName(email.split('@')[0]),
        dealsReviewed: "Error - Activity tracking required",
        avgResponseTime: "Error - Response time tracking required",
        approvalRate: "Error - Performance tracking required",
        specializations: this.getSpecializations(email.split('@')[0]),
        currentWorkload: "Error - Workload tracking required",
        lastActive: "Error - Activity tracking required"
      })),
      performanceTrends: "Error - Performance analytics system required"
    };
  }

  // Helper methods
  // REMOVED: All fallback methods that generate synthetic data

  private calculateMonthlyTrends(deals: any[]) {
    // Use real deal data only
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    return months.map(month => ({
      month,
      submissions: "Error - Historical deal tracking required",
      approvals: "Error - Historical deal tracking required"
    }));
  }

  private calculateConversionRates(deals: any[]) {
    const total = deals.length;
    const approved = deals.filter(d => d.status === 'high_priority').length;
    const under_review = deals.filter(d => d.status === 'potentially').length;
    
    return {
      approvalRate: total > 0 ? ((approved / total) * 100).toFixed(1) + '%' : '0%',
      reviewRate: total > 0 ? (((approved + under_review) / total) * 100).toFixed(1) + '%' : '0%'
    };
  }

  private formatName(email: string): string {
    const nameMap: {[key: string]: string} = {
      'aj': 'AJ Klenk',
      'brian': 'Brian Ford', 
      'ted': 'Ted Hill',
      'erich': 'Erich Mahle',
      'john': 'John Bell',
      'steve': 'Steve Hillebrand',
      'mallie': 'Mallie Colavita',
      'nic': 'Nic Monroe',
      'mike': 'Mike Nichols',
      'austin': 'Austin Blondell',
      'davis': 'Davis Hammond',
      'darian': 'Darian Joyner',
      'jack': 'Jack Berg',
      'jim': 'Jim Hillim'
    };
    return nameMap[email] || email.charAt(0).toUpperCase() + email.slice(1);
  }

  private getSpecializations(name: string): string[] {
    const specializationMap: {[key: string]: string[]} = {
      'aj': ['Market Analysis', 'Financial Modeling'],
      'brian': ['Strategic Planning', 'Market Analysis'],
      'ted': ['Investment Analysis', 'Due Diligence'],
      'erich': ['Financial Analysis', 'Risk Assessment'],
      'john': ['Site Development', 'Regional Planning'],
      'steve': ['Construction', 'Site Planning'],
      'mallie': ['Market Research', 'Development Planning'],
      'nic': ['Construction Management', 'Site Analysis'],
      'mike': ['Construction', 'Project Management'],
      'austin': ['Financial Analysis', 'Market Research'],
      'davis': ['Development Planning', 'Site Analysis'],
      'darian': ['Marketing', 'Communications'],
      'jack': ['Project Management', 'Strategic Planning'],
      'jim': ['Development Management', 'Site Planning']
    };
    return specializationMap[name] || ['General Analysis'];
  }

  private generatePerformanceTrends() {
    return {
      responseTime: "Error - Performance tracking system required",
      accuracy: "Error - Performance tracking system required",
      throughput: "Error - Performance tracking system required"
    };
  }
}

export const realDataService = new RealDataService();