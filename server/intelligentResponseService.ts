// Intelligent Response Service - Determines missing profile and property information
import { storage } from './storage';
import { type Broker } from '@shared/schema';

export interface ProfileCheck {
  isComplete: boolean;
  missingFields: string[];
  message?: string;
}

export interface PropertyCheck {
  hasRequiredInfo: boolean;
  missingFields: string[];
  message?: string;
}

export interface ResponseData {
  shouldProcessDeal: boolean;
  responseMessage: string;
  responseType: 'profile_missing' | 'property_missing' | 'ready_to_process' | 'incomplete_but_creating';
  missingInfo: string[];
  shouldSendFollowUp?: boolean;
}

export class IntelligentResponseService {
  
  /**
   * Check if broker profile has all required information
   * UPDATED: Profile is complete with just ONE contact method (email OR phone)
   * Name and markets are OPTIONAL - not required for profile completion
   */
  static checkProfileCompleteness(broker: Broker): ProfileCheck {
    const missingFields: string[] = [];
    
    // Check if broker has at least ONE contact method (email OR phone)
    const isTempEmail = broker.email && /^sms-\d+-\d+@temp\.landlinq\.ai$/.test(broker.email);
    const hasEmail = broker.email && broker.email.trim() !== '' && !isTempEmail;
    const hasPhone = broker.phone && broker.phone.trim() !== '';
    
    // Profile is complete if broker has email OR phone
    const hasContactMethod = hasEmail || hasPhone;
    
    if (!hasContactMethod) {
      // Need at least one contact method
      missingFields.push('email_or_phone');
    }
    
    // Name is OPTIONAL - never required for profile completion
    // Markets are OPTIONAL - never required for profile completion
    
    const isComplete = missingFields.length === 0;
    
    return {
      isComplete,
      missingFields,
      message: isComplete ? undefined : this.generateProfileMissingMessage(missingFields)
    };
  }

  /**
   * Check if property submission has required information for analysis
   * UPDATED: Only address is required - price and acreage are optional
   */
  static checkPropertyInformation(propertyData: any): PropertyCheck {
    const requiredFields = ['address'];
    const missingFields: string[] = [];
    
    if (!propertyData.address || propertyData.address.trim() === '') {
      missingFields.push('address');
    }
    
    const hasRequiredInfo = missingFields.length === 0;
    
    return {
      hasRequiredInfo,
      missingFields,
      message: hasRequiredInfo ? undefined : this.generatePropertyMissingMessage(missingFields)
    };
  }

  /**
   * Generate intelligent response based on profile and property completeness
   * NOW CREATES DEALS WITH INCOMPLETE INFORMATION for email/SMS submissions
   */
  static async generateIntelligentResponse(
    contactInfo: string, // email or phone
    propertyData: any,
    communicationType: 'email' | 'sms'
  ): Promise<ResponseData> {
    try {
      // Find broker by email or phone
      let broker: Broker | null = null;
      
      if (contactInfo.includes('@')) {
        broker = await storage.getBrokerByEmail(contactInfo) || null;
      } else {
        broker = await storage.getBrokerByPhone(contactInfo) || null;
      }
      
      const allMissingInfo: string[] = [];
      
      // Check if broker exists and profile completeness
      // UPDATED: Profile is complete with just ONE contact method (email OR phone)
      let profileMissing: string[] = [];
      if (!broker) {
        // Broker will be auto-created with contact method (phone for SMS, email for email)
        // So profile is considered complete - no missing fields
        profileMissing = [];
      } else {
        const profileCheck = this.checkProfileCompleteness(broker);
        profileMissing = profileCheck.missingFields;
      }
      
      // Check property information
      const propertyCheck = this.checkPropertyInformation(propertyData);
      const propertyMissing = propertyCheck.missingFields;
      
      // Combine all missing information
      allMissingInfo.push(...profileMissing, ...propertyMissing);
      
      // NEW BEHAVIOR: Always create deals for email/SMS, but send follow-up for missing info
      if (allMissingInfo.length > 0) {
        return {
          shouldProcessDeal: true, // CHANGED: Always create deals
          responseMessage: this.generateIncompleteSubmissionMessage(profileMissing, propertyMissing, communicationType),
          responseType: 'incomplete_but_creating',
          missingInfo: allMissingInfo,
          shouldSendFollowUp: true // Will send follow-up asking for missing info
        };
      }
      
      // All information is complete, ready to process
      return {
        shouldProcessDeal: true,
        responseMessage: 'Processing your property submission...',
        responseType: 'ready_to_process',
        missingInfo: [],
        shouldSendFollowUp: false
      };
      
    } catch (error) {
      console.error('❌ Error generating intelligent response:', error);
      return {
        shouldProcessDeal: false,
        responseMessage: 'Sorry, we encountered an error. Please call (704) 610-1549 for assistance.',
        responseType: 'profile_missing',
        missingInfo: []
      };
    }
  }

  /**
   * Generate message for new users
   */
  private static generateNewUserMessage(type: 'email' | 'sms'): string {
    const greeting = type === 'sms' ? 
      '👋 Welcome to LandLinq! ' :
      'Welcome to LandLinq!\n\n';
    
    const instruction = type === 'sms' ?
      'To get started, please reply with:\n\n' +
      '1️⃣ Your first name\n' +
      '2️⃣ Your last name\n' +
      '3️⃣ Your email address\n' +
      '4️⃣ Markets you cover\n\n' +
      'Example: "John Smith, john@realty.com, Dallas-Fort Worth, Austin"\n\n' +
      'Once we have your info, you can submit property deals!' :
      
      'To submit property deals for analysis, we need to set up your profile first.\n\n' +
      'Please reply to this email with the following information:\n\n' +
      '• First Name\n' +
      '• Last Name\n' +
      '• Email Address\n' +
      '• Phone Number\n' +
      '• Markets/Regions you cover\n\n' +
      'Once we have your profile information, you can submit property details for instant AI analysis.\n\n' +
      'Thank you!\n' +
      'The LandLinq Team\n' +
      '(704) 610-1549';
    
    return greeting + instruction;
  }

  /**
   * Generate message for missing profile information
   * UPDATED: Only requires contact method (email OR phone)
   */
  private static generateProfileMissingMessage(missingFields: string[]): string {
    const fieldNames: { [key: string]: string } = {
      email_or_phone: 'email address or phone number',
      firstName: 'first name',
      lastName: 'last name',
      email: 'email address',
      phone: 'phone number'
    };
    
    const missingFieldNames = missingFields.map(field => fieldNames[field] || field);
    const isPlural = missingFieldNames.length > 1;
    
    let message = `Hi! We need ${isPlural ? 'a few more details' : 'one more detail'} to complete your profile:\n\n`;
    
    missingFieldNames.forEach((field, index) => {
      message += `${index + 1}️⃣ Your ${field}\n`;
    });
    
    message += '\nPlease reply with the missing information so we can process your property submission.\n\n';
    message += 'Thank you!\nThe LandLinq Team';
    
    return message;
  }

  /**
   * Generate message for missing property information
   */
  private static generatePropertyMissingMessage(missingFields: string[]): string {
    const fieldNames: { [key: string]: string } = {
      address: 'property address',
      askingPrice: 'asking price',
      sizeAcres: 'size in acres'
    };
    
    const missingFieldNames = missingFields.map(field => fieldNames[field] || field);
    const isPlural = missingFieldNames.length > 1;
    
    let message = `Great! Your profile is complete. To run our AI analysis, we need ${isPlural ? 'a few more property details' : 'one more property detail'}:\n\n`;
    
    missingFieldNames.forEach((field, index) => {
      message += `${index + 1}️⃣ ${field.charAt(0).toUpperCase() + field.slice(1)}\n`;
    });
    
    message += '\nExample format: "123 Main Street, Charlotte, NC - $2,500,000 - 10 acres"\n\n';
    message += 'Once we have this information, our AI will instantly analyze the deal and send you the results!\n\n';
    message += 'The LandLinq Team';
    
    return message;
  }

  /**
   * Generate message for incomplete submissions (NEW: creates deal but asks for missing info)
   */
  private static generateIncompleteSubmissionMessage(
    profileMissing: string[], 
    propertyMissing: string[], 
    communicationType: 'email' | 'sms'
  ): string {
    const hasProfileMissing = profileMissing.length > 0;
    const hasPropertyMissing = propertyMissing.length > 0;
    
    let message = '';
    
    if (communicationType === 'sms') {
      message = '✅ Got your property! We\'ve created your submission and will review it.\n\n';
    } else {
      message = 'Thank you for your property submission! We\'ve received it and created your deal for review.\n\n';
    }
    
    // Add missing information request
    if (hasProfileMissing || hasPropertyMissing) {
      message += 'To complete our analysis, we\'d appreciate these additional details:\n\n';
      
      if (hasProfileMissing) {
        message += '📋 Profile Info:\n';
        const profileFieldNames: { [key: string]: string } = {
          email_or_phone: 'Email address or phone number',
          firstName: 'First name',
          lastName: 'Last name', 
          email: 'Email address',
          phone: 'Phone number'
        };
        profileMissing.forEach(field => {
          message += `• ${profileFieldNames[field] || field}\n`;
        });
        message += '\n';
      }
      
      if (hasPropertyMissing) {
        message += '🏘️ Property Details:\n';
        const propertyFieldNames: { [key: string]: string } = {
          address: 'Property address',
          askingPrice: 'Asking price',
          sizeAcres: 'Size in acres'
        };
        propertyMissing.forEach(field => {
          message += `• ${propertyFieldNames[field] || field}\n`;
        });
        message += '\n';
      }
      
      if (communicationType === 'sms') {
        message += 'Reply with the missing info when convenient. We\'ll still review what you\'ve provided!\n\n';
      } else {
        message += 'Please reply with any additional information when convenient. We\'ll proceed with our initial analysis based on what you\'ve provided.\n\n';
      }
    }
    
    message += 'Our team will review your submission and get back to you soon!\n\n';
    message += 'The LandLinq Team\n(704) 610-1549';
    
    return message;
  }

  /**
   * Extract basic contact info from text
   */
  static extractContactInfo(text: string): { name?: string; email?: string; phone?: string } {
    const result: { name?: string; email?: string; phone?: string } = {};
    
    // Extract email
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      result.email = emailMatch[1];
    }
    
    // Extract phone
    const phoneMatch = text.match(/(\(?\d{3}\)?[-.\ ]?\d{3}[-.\ ]?\d{4})/);
    if (phoneMatch) {
      result.phone = phoneMatch[1];
    }
    
    // Simple name extraction (looking for two words that could be names)
    const nameMatch = text.match(/([A-Z][a-z]+)\s+([A-Z][a-z]+)/);
    if (nameMatch) {
      result.name = `${nameMatch[1]} ${nameMatch[2]}`;
    }
    
    return result;
  }
}