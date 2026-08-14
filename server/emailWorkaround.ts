// Emergency Email Processing Workaround
// Due to DNS issue with landlinq.ai domain

export interface EmailSubmission {
  senderEmail: string;
  senderName?: string;
  propertyAddress: string;
  acreage: string;
  askingPrice: string;
  developmentType: string;
  additionalDetails?: string;
}

export class EmailWorkaround {
  
  // Process email content and extract deal information
  static processEmailContent(emailText: string): EmailSubmission | null {
    try {
      // Extract key information from email text
      const addressMatch = emailText.match(/(?:address|property|location):?\s*([^\n,;]+)/i);
      const acreageMatch = emailText.match(/(\d+\.?\d*)\s*acres?/i);
      const priceMatch = emailText.match(/\$?([\d,]+(?:\.\d{2})?)/);
      const typeMatch = emailText.match(/(?:type|development):?\s*([^\n,;]+)/i);
      
      if (!addressMatch || !acreageMatch || !priceMatch) {
        console.log("❌ Missing required deal information in email");
        return null;
      }
      
      return {
        senderEmail: "unknown@broker.com", // Will be set by caller
        propertyAddress: addressMatch[1].trim(),
        acreage: acreageMatch[1],
        askingPrice: priceMatch[1].replace(/,/g, ''),
        developmentType: typeMatch ? typeMatch[1].trim() : 'Unknown',
        additionalDetails: emailText
      };
      
    } catch (error) {
      console.error("❌ Error processing email content:", error);
      return null;
    }
  }
  
  // Instructions for brokers on alternative submission methods
  static generateAlternativeInstructions(): string {
    return `
    🚨 EMAIL DELIVERY ISSUE DETECTED 🚨
    
    Due to a DNS configuration issue with landlinq.ai, emails are currently bouncing.
    
    📱 ALTERNATIVE SUBMISSION METHODS:
    
    1. PLATFORM DASHBOARD (Recommended)
       • Go to your LandLinq dashboard
       • Click "Submit Deal" 
       • Fill in property details
    
    2. TEXT MESSAGE (Fast)
       • Text: (704) 610-1549
       • Format: DEAL [Address] [Acres] [Price] [Type]
       • Example: "DEAL 123 Main St, Charlotte NC, 5 acres, $500000, Apartments"
    
    3. EMERGENCY EMAIL FORM
       • Visit: [Platform URL]/emergency-deal-submit
       • Copy/paste your deal details
       • Instant processing
    
    ⚠️ TECHNICAL ISSUE: 
    The landlinq.ai domain needs proper DNS/MX record configuration.
    Contact your IT team to:
    • Register/renew landlinq.ai domain
    • Configure MX records for email
    • Set up email forwarding to deals@landlinq.ai
    
    We'll email you once normal email processing is restored!
    `;
  }
}

// Express endpoint for emergency deal submission
export function setupEmergencyEndpoint(app: any) {
  app.post("/api/emergency-deal-submit", async (req, res) => {
    try {
      const { emailContent, brokerEmail, brokerName } = req.body;
      
      if (!emailContent) {
        return res.status(400).json({
          success: false,
          message: "Deal content is required"
        });
      }
      
      console.log("🚨 Emergency deal submission from:", brokerEmail);
      
      const dealData = EmailWorkaround.processEmailContent(emailContent);
      
      if (!dealData) {
        return res.status(400).json({
          success: false,
          message: "Could not extract deal information. Please ensure you include: Address, Acreage, and Price",
          example: "123 Main St, Charlotte NC\n5 acres\n$500,000\nConventional Apartments"
        });
      }
      
      dealData.senderEmail = brokerEmail;
      dealData.senderName = brokerName;
      
      // Import deal processing
      const { UnifiedDealPipeline } = await import('./unifiedDealPipeline');
      
      // Process the deal
      const result = await UnifiedDealPipeline.processDeal({
        address: dealData.propertyAddress,
        sizeAcres: dealData.acreage,
        askingPrice: parseFloat(dealData.askingPrice),
        developmentType: dealData.developmentType,
        brokerEmail: dealData.senderEmail,
        brokerName: dealData.senderName,
        submissionMethod: 'emergency_email',
        brokerNotes: dealData.additionalDetails
      });
      
      res.json({
        success: true,
        dealId: result.dealId,
        classification: result.classification,
        message: "Deal submitted successfully via emergency processing!",
        nextSteps: "Check your dashboard for updates. Normal email processing will resume once DNS is fixed."
      });
      
    } catch (error) {
      console.error("❌ Emergency submission error:", error);
      res.status(500).json({
        success: false,
        message: "Emergency processing failed. Please try the platform dashboard instead.",
        support: "Contact support if this issue persists"
      });
    }
  });
  
  console.log("🚨 Emergency deal submission endpoint active at /api/emergency-deal-submit");
}