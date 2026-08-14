# 🏢 Broker Deal Submission & Auto-Classification Workflow

## 📋 Overview

This document outlines the complete workflow that occurs when a broker submits a land deal through the LandLinq platform, including the automated classification system that evaluates properties against Catalyst Capital Partners' exact acquisition criteria.

## 🚀 Deal Submission Process

### Step 1: Broker Portal Access
- Broker logs into the platform via Replit Auth
- Accesses the **Submit Deal** page with comprehensive property form
- Form includes all required fields for property evaluation

### Step 2: Property Information Input
Brokers provide the following data:
- **Basic Details**: Property address, acreage, asking price
- **Development Type**: Conventional Apartments, Active Adult, BTR, or Lot Development
- **Property Specifications**: Unit count, zoning, sewer availability
- **Market Information**: Current rents (if applicable), demographic data
- **Supporting Documents**: Upload capability for property photos, surveys, etc.

### Step 3: Real-Time Data Enrichment
Upon form submission, the system automatically:
- **Validates address** using USPS API for accuracy
- **Enriches property data** via HelloData and ATTOM Data APIs
- **Retrieves market comparables** from HelloData for rent analysis
- **Geocodes location** for mapping and demographic analysis
- **Cross-references zoning** information for development feasibility

### Step 4: Automated Classification Engine
The system immediately processes the submission through our AI-powered classification engine.

---

## 🎯 Auto-Classification Engine

### Core Classification Logic

The auto-classification engine evaluates each property against **exact acquisition criteria** for Catalyst Capital Partners, using real-time data from HelloData to ensure accuracy.

### Data Sources Integration

#### **HelloData Rent Data (Primary)**
- **Real-time rent comparables** for accurate market analysis
- **Property-specific rent data** when available
- **Market rent trends** for the specific area
- **Rent per square foot calculations** for classification

#### **ATTOM Data (Secondary)**
- Property characteristics and specifications
- Zoning information and development restrictions
- Historical sales data and market context

#### **User-Submitted Data (Authoritative)**
- **NEVER overwritten** by API data
- Used as the primary source for classification
- API data supplements and validates user input

---

## 📊 Auto-Classification Criteria (EXACT RULES)

### **Hard Rule: Under 4 Acres = ALWAYS RED**
Any property under 4 acres is automatically classified as RED regardless of other factors.

### **Processing Priority Order:**
1. **Conventional/Market-Rate & Active Adult Apartments** (same criteria)
2. **Build-To-Rent (BTR) Development** 
3. **LOT Development**

### **Comparable Search Rules:**
- Pull 3–5 comparable properties via HelloData/ATTOM APIs
- Built within the last 5 years
- Within 1 mile radius (expand to max 3 miles if <3 comps found)

---

### 🏙️ **Conventional/Market-Rate & Active Adult Apartments**
*(Same classification criteria for both types)*

**RED:**
- Rent ≤ $1.74 PSF *(HelloData verified)*

**YELLOW:**
- **Rent $1.75 – $2.05 PSF** → Suggest: "3-story walkup"
- **Rent $2.05 – $2.49 PSF** → Suggest: "4–5 story surface park"  
- **Rent $2.50 – $2.99 PSF** → Suggest: "4–5 story structured parking"
- **Rent ≥ $3.00 PSF** → Suggest: "Podium deal"

---

### 🏘️ **Build-To-Rent (BTR) Development**

**RED:**
- Total Unit Rent ≤ $1,999.99 per unit

**YELLOW:**
- **Total Unit Rent $2,000 – $2,399.99 per unit**
- **Total Unit Rent ≥ $2,400 per unit**

---

### 🏡 **LOT Development**

**RED:**
- Price Per Acre ≥ $350,000

**YELLOW:**
- Price Per Acre < $350,000

---

### ⚠️ **No Auto-GREEN Classification**
- **Green deals cannot be auto-classified**
- **Analysts must manually review** and change Yellow → Green if deal meets Catalyst's full investment criteria

---

## 🤖 Technical Implementation Requirements

### **Critical Developer Tasks**

#### 1. **HelloData Rent Integration (Priority #1)**
```typescript
// Required: Accurate rent data retrieval for classification
const rentData = await hellodataService.getRentComparables({
  address: property.address,
  radius: 0.5, // 0.5 mile radius
  propertyType: property.developmentType,
  units: property.unitCount
});

// Use rent data for precise classification
const rentPSF = calculateRentPSF(rentData, property.units);
const classification = classifyByRentThreshold(rentPSF, property.developmentType);
```

#### 2. **Email Notification System (Must Work)**
**Requirements:**
- **SendGrid API fully configured** and tested
- **Template system** for different deal statuses
- **Real-time delivery** upon classification completion
- **Delivery confirmation** tracking

**Email Types:**
- **Broker confirmation**: "Deal submitted successfully"
- **Team assignment**: Notify analyst/developer/partner
- **Status updates**: Classification results and next steps

#### 3. **SMS Notification System (Must Work)**
**Requirements:**
- **Twilio integration** fully functional with (704) 610-1549
- **Instant notifications** for high-priority (Green) deals
- **Status updates** for all deal classifications
- **Delivery tracking** and failure handling

**SMS Types:**
- **Instant alerts**: "🟢 GREEN deal submitted - immediate review needed"
- **Classification updates**: "Deal classified as Yellow - review scheduled"
- **Follow-up reminders**: Automated sequences based on deal status

#### 4. **Team Assignment Automation**
Based on development type, automatically assign:

**Conventional Apartments:**
- Analyst: Austin
- Developer: Steve (North/South Carolina), John (Everywhere else)
- Partner: AJ Klenk

**Active Adult:**
- Analyst: Austin
- Developer: John Bell
- Partner: AJ Klenk

**BTR (Build to Rent):**
- Analyst: Davis
- Developer: Steve (North/South Carolina), John (Everywhere else)
- Partner: Brian Ford

**Lot Development:**
- Analyst: Davis
- Developer: Mallie
- Partner: Brian Ford

---

## 🔄 Complete Workflow Timeline

### **Immediate (0-30 seconds)**
1. ✅ **Form submission** received and validated
2. ✅ **Data enrichment** via HelloData/ATTOM APIs
3. ✅ **Auto-classification** algorithm runs
4. ✅ **Team assignment** based on development type
5. ✅ **Email confirmation** sent to broker
6. ✅ **SMS alert** sent if Green classification

### **Within 5 Minutes**
1. ✅ **Detailed analysis** email sent to assigned team
2. ✅ **Dashboard updates** reflect new deal status
3. ✅ **Analytics tracking** records submission metrics

### **Within 1 Hour**
1. ✅ **Follow-up email** to broker with classification explanation
2. ✅ **Team notifications** via internal communication channels
3. ✅ **Automated market report** generation (if Green/Yellow)

---

## 📱 Communication Template Examples

### **Broker Confirmation Email**
```
Subject: ✅ Deal Submitted Successfully - [Property Address]

Hi [Broker Name],

Thanks for submitting the [Development Type] opportunity at [Address]. 

🎯 **Classification Result: [GREEN/YELLOW/RED]**
📊 **Analysis Score: [X/100]**
👥 **Assigned Team:** [Analyst], [Developer], [Partner]

**Next Steps:**
- Our team will review within [timeframe]
- You'll receive updates via email and SMS
- Questions? Reply to this email or call (704) 610-1549

Best regards,
Catalyst Capital Partners
```

### **Team Assignment SMS**
```
🟢 NEW GREEN DEAL: [Property Type] - [Address]
📊 Score: [X/100] | Units: [X] | Acres: [X]
👤 Broker: [Name] | Phone: [Number]
🔗 Review: [Dashboard Link]
```

---

## 🛠️ Developer Implementation Checklist

### **Phase 1: Core Functionality**
- [ ] **HelloData rent data integration** working 100%
- [ ] **Classification algorithm** using real rent data
- [ ] **Email system** fully functional with templates
- [ ] **SMS system** operational with (704) 610-1549
- [ ] **Team assignment** automation working

### **Phase 2: Enhanced Features**
- [ ] **Delivery confirmation** tracking for all communications
- [ ] **Failed notification** retry logic
- [ ] **Communication analytics** dashboard
- [ ] **Template customization** interface
- [ ] **Multi-language support** for Spanish-speaking brokers

### **Phase 3: Advanced Automation**
- [ ] **Smart follow-up sequences** based on deal status
- [ ] **Broker engagement scoring** and analytics
- [ ] **Automated market reports** for qualified deals
- [ ] **Calendar integration** for team meeting scheduling

---

## ⚠️ Critical Requirements

### **Data Accuracy (Non-Negotiable)**
- ✅ **HelloData rent data** must be used for all rent-based classifications
- ✅ **User-submitted data** is always authoritative (never overwritten)
- ✅ **Real-time API validation** for all property data
- ✅ **Transparent data sources** shown to users

### **Communication Reliability**
- ✅ **100% email delivery** rate required
- ✅ **SMS delivery confirmation** mandatory
- ✅ **Failed delivery** retry mechanisms
- ✅ **Fallback communication** methods if primary fails

### **Performance Standards**
- ✅ **Classification completion** within 30 seconds
- ✅ **Email delivery** within 2 minutes
- ✅ **SMS delivery** within 1 minute
- ✅ **Dashboard updates** in real-time

---

## 🎯 Success Metrics

### **Classification Accuracy**
- **95%+ accuracy** in property classification using HelloData rent data
- **Zero false positives** for Green classifications
- **Consistent results** across similar properties

### **Communication Performance**
- **100% email delivery** rate
- **98%+ SMS delivery** rate
- **<2 minute** average response time for notifications
- **Zero missed** Green deal alerts

### **User Experience**
- **<30 second** total submission-to-classification time
- **Instant feedback** to brokers on submission status
- **Clear explanations** of classification reasoning
- **Easy access** to deal status and next steps

---

## 📞 Support & Escalation

### **Technical Issues**
- **Email/SMS failures**: Immediate escalation to technical team
- **Classification errors**: Review algorithm and data sources
- **API timeouts**: Implement retry logic and fallback systems

### **Business Logic Updates**
- **Criteria changes**: Update classification thresholds
- **Team assignments**: Modify routing based on organizational changes
- **New property types**: Extend classification engine

---

This workflow ensures that every broker submission receives immediate, accurate evaluation based on Catalyst's exact criteria, with reliable communication keeping all parties informed throughout the process.