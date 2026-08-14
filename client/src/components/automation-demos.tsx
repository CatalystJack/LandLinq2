import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, MessageSquare, Smartphone, Monitor, TrendingUp, BarChart3, DollarSign, Clock, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

interface MessageAnimation {
  id: number;
  type: 'email' | 'sms';
  subject?: string;
  sender: string;
  message: string;
  time: string;
  status: 'sending' | 'delivered';
  isIncoming?: boolean;
}

export default function AutomationDemos() {
  const [emailMessages, setEmailMessages] = useState<MessageAnimation[]>([]);
  const [smsMessages, setSmsMessages] = useState<MessageAnimation[]>([]);
  const [activeDemo, setActiveDemo] = useState<'email' | 'sms' | 'dashboard'>('dashboard');
  const [dashboardStep, setDashboardStep] = useState(0);
  const [deals, setDeals] = useState([
    { id: 1, property: "15.2 Acres - Dallas, TX", details: "R-4 Zoning • Sewer Available", status: "Pursuing", value: "$680,000", time: "2 min ago", color: "bg-green-100 text-green-800" },
    { id: 2, property: "8.5 Acres - Austin, TX", details: "Commercial • Unclassified", status: "Reviewing", value: "$420,000", time: "1 hour ago", color: "bg-yellow-100 text-yellow-800" }
  ]);
  const [analytics, setAnalytics] = useState({ total: 47, pending: 12, approved: 28, pipeline: "$8.2M" });

  const emailTemplates = [
    {
      sender: "sarah.broker@realestate.com",
      subject: "New Land Deal - 15 Acres Houston",
      message: "Hi LandLinq Team! I have a 15-acre property in Houston with R-4 zoning and sewer available. Asking $750K. Let me know if interested!",
      time: "Just now",
      isIncoming: true
    },
    {
      sender: "LandLinq Team",
      subject: "Re: New Land Deal - We'll Check It Out",
      message: "Hi Sarah! Thanks for sending over the Houston deal. We received it and will review the property details. We'll get back to you soon with our assessment.",
      time: "2 min ago",
      isIncoming: false
    },
    {
      sender: "LandLinq Team", 
      subject: "Re: Houston Deal - We're Pursuing It!",
      message: "Great news Sarah! After reviewing your Houston property, we're pursuing this deal. Our team is very interested. Let's schedule a call to discuss next steps...",
      time: "1 hour ago",
      isIncoming: false
    }
  ];

  const smsTemplates = [
    {
      sender: "Sarah Broker",
      message: "Hey LandLinq! Got a 22-acre property in Dallas, mixed zoning, sewer ready. $1.2M asking. Interested?",
      time: "Just now",
      isIncoming: true
    },
    {
      sender: "LandLinq",
      message: "Hi Sarah! Thanks for the Dallas deal info. We'll check it out and review the property details. Talk soon!",
      time: "2 min ago",
      isIncoming: false
    },
    {
      sender: "LandLinq", 
      message: "GREAT NEWS Sarah! 🎉 We're pursuing your Dallas deal! Our team is very interested. Check email for next steps!",
      time: "1 hour ago",
      isIncoming: false
    }
  ];

  useEffect(() => {
    let emailInterval: NodeJS.Timeout;
    let smsInterval: NodeJS.Timeout;
    let dashboardInterval: NodeJS.Timeout;

    if (activeDemo === 'email') {
      // Animate email conversation sequence
      let emailStep = 0;
      emailInterval = setInterval(() => {
        if (emailStep < emailTemplates.length) {
          const template = emailTemplates[emailStep];
          const newEmail: MessageAnimation = {
            id: Date.now() + Math.random(),
            type: 'email',
            sender: template.sender,
            subject: template.subject,
            message: template.message,
            time: template.time,
            status: 'sending',
            isIncoming: template.isIncoming
          };

          setEmailMessages(prev => [newEmail, ...prev]);

          // Mark as delivered after 1 second
          setTimeout(() => {
            setEmailMessages(prev => prev.map(msg => 
              msg.id === newEmail.id ? {...msg, status: 'delivered'} : msg
            ));
          }, 1000);

          emailStep++;
        } else {
          // Reset and start over
          emailStep = 0;
          setEmailMessages([]);
        }
      }, 3000);
    } else if (activeDemo === 'sms') {
      // Animate SMS conversation sequence
      let smsStep = 0;
      smsInterval = setInterval(() => {
        if (smsStep < smsTemplates.length) {
          const template = smsTemplates[smsStep];
          const newSms: MessageAnimation = {
            id: Date.now() + Math.random(),
            type: 'sms',
            sender: template.sender,
            message: template.message,
            time: template.time,
            status: 'sending',
            isIncoming: template.isIncoming
          };

          setSmsMessages(prev => [...prev, newSms]);

          // Mark as delivered after 800ms
          setTimeout(() => {
            setSmsMessages(prev => prev.map(msg => 
              msg.id === newSms.id ? {...msg, status: 'delivered'} : msg
            ));
          }, 800);

          smsStep++;
        } else {
          // Reset and start over
          smsStep = 0;
          setSmsMessages([]);
        }
      }, 3000);
    } else if (activeDemo === 'dashboard') {
      // Dashboard animation sequence
      dashboardInterval = setInterval(() => {
        setDashboardStep(prev => {
          const nextStep = (prev + 1) % 7;
          
          // Form filling steps: 1-5 show progressive form completion
          // Step 6 shows submission
          // Step 0 shows success with deal tracking
          if (nextStep === 6) {
            // Form submitted - clear all form fields to restart animation
            // This creates a visual "form reset" when submit is clicked
          } else if (nextStep === 0) {
            // Success - show completed deal in tracking
            setDeals([
              { id: 3, property: "22 Acres - Houston, TX", details: "Mixed Use • Pursuing", status: "Pursuing", value: "$1,200,000", time: "Just now", color: "bg-green-100 text-green-800" },
              { id: 1, property: "15.2 Acres - Dallas, TX", details: "R-4 Zoning • Sewer Available", status: "Pursuing", value: "$680,000", time: "2 min ago", color: "bg-green-100 text-green-800" },
              { id: 2, property: "8.5 Acres - Austin, TX", details: "Commercial • Unclassified", status: "Reviewing", value: "$420,000", time: "1 hour ago", color: "bg-yellow-100 text-yellow-800" }
            ]);
            setAnalytics({ total: 48, pending: 11, approved: 29, pipeline: "$8.7M" });
          } else if (nextStep === 1) {
            // Reset for new animation cycle
            setDeals([
              { id: 1, property: "15.2 Acres - Dallas, TX", details: "R-4 Zoning • Sewer Available", status: "Pursuing", value: "$680,000", time: "2 min ago", color: "bg-green-100 text-green-800" },
              { id: 2, property: "8.5 Acres - Austin, TX", details: "Commercial • Unclassified", status: "Reviewing", value: "$420,000", time: "1 hour ago", color: "bg-yellow-100 text-yellow-800" }
            ]);
            setAnalytics({ total: 47, pending: 12, approved: 28, pipeline: "$8.2M" });
          }
          
          return nextStep;
        });
      }, 2500);
    }

    return () => {
      if (emailInterval) clearInterval(emailInterval);
      if (smsInterval) clearInterval(smsInterval);
      if (dashboardInterval) clearInterval(dashboardInterval);
    };
  }, [activeDemo]);

  return (
    <section className="py-12 md:py-24 bg-catalyst-gray-50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-8 md:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-catalyst-gray-900 mb-4 md:mb-8 tracking-tight leading-tight">
            See Our <span className="whitespace-nowrap">Automation</span> in Action
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-catalyst-gray-600 font-light max-w-3xl mx-auto leading-relaxed mb-6 md:mb-12 px-2">
            Choose how you want to submit and track your deals - all in one powerful platform
          </p>
          
          {/* Three Demo Buttons - Mobile Optimized */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 max-w-lg sm:max-w-none mx-auto">
            <Button
              onClick={() => setActiveDemo('dashboard')}
              className={`w-full sm:w-auto px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-bold uppercase tracking-wider rounded-lg transition-colors min-h-[48px] flex items-center justify-center ${
                activeDemo === 'dashboard'
                  ? 'bg-catalyst-gold text-white hover:bg-white hover:text-catalyst-gold border border-catalyst-gold hover:border-catalyst-gold'
                  : 'bg-white text-catalyst-gold border-2 border-catalyst-gold hover:bg-catalyst-gold hover:text-white'
              }`}
              data-testid="button-dashboard-demo"
            >
              <Monitor className="mr-2 sm:mr-3 flex-shrink-0" size={18} />
              <span className="allow-wrap">Online</span>
            </Button>
            <Button
              onClick={() => setActiveDemo('email')}
              className={`w-full sm:w-auto px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-bold uppercase tracking-wider rounded-lg transition-colors min-h-[48px] flex items-center justify-center ${
                activeDemo === 'email'
                  ? 'bg-catalyst-gold text-white hover:bg-white hover:text-catalyst-gold border border-catalyst-gold hover:border-catalyst-gold'
                  : 'bg-white text-catalyst-gold border-2 border-catalyst-gold hover:bg-catalyst-gold hover:text-white'
              }`}
              data-testid="button-email-automation"
            >
              <Mail className="mr-2 sm:mr-3 flex-shrink-0" size={18} />
              <span className="allow-wrap">Email</span>
            </Button>
            <Button
              onClick={() => setActiveDemo('sms')}
              className={`w-full sm:w-auto px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-bold uppercase tracking-wider rounded-lg transition-colors min-h-[48px] flex items-center justify-center ${
                activeDemo === 'sms'
                  ? 'bg-catalyst-gold text-white hover:bg-white hover:text-catalyst-gold border border-catalyst-gold hover:border-catalyst-gold'
                  : 'bg-white text-catalyst-gold border-2 border-catalyst-gold hover:bg-catalyst-gold hover:text-white'
              }`}
              data-testid="button-sms-automation"
            >
              <MessageSquare className="mr-2 sm:mr-3 flex-shrink-0" size={18} />
              <span className="allow-wrap">SMS</span>
            </Button>
          </div>
        </div>

        {/* Single Demo Container - Mobile Optimized */}
        <div className="max-w-4xl mx-auto mb-8 md:mb-16">
          {activeDemo === 'dashboard' && (
            <Card className="border-catalyst-gray-200 shadow-sm hover:shadow-md transition-all duration-300">
              <CardHeader className="pb-2 md:pb-4 px-3 md:px-6">
                <div className="flex items-center space-x-3 mb-2 md:mb-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-catalyst-gold/20 flex items-center justify-center rounded-lg flex-shrink-0">
                    <Monitor className="text-catalyst-gold" size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg md:text-2xl font-semibold text-catalyst-gray-900 tracking-tight leading-tight">
                      <span className="allow-wrap">Deal Submission Form</span>
                    </CardTitle>
                    <p className="text-xs md:text-sm text-catalyst-gray-500 mt-1">
                      <span className="allow-wrap">Quick and easy property submission</span>
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-3 md:px-6">
                <div className="bg-white rounded-xl shadow-xl border border-slate-200/50 overflow-hidden max-w-3xl mx-auto">
                  {/* Header */}
                  <div className="bg-catalyst-navy px-3 md:px-6 py-3 md:py-4 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-white font-semibold text-base md:text-lg"><span className="allow-wrap">Submit New Deal</span></h3>
                        <p className="text-blue-200 text-xs md:text-sm"><span className="allow-wrap">Tell us about your property</span></p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 md:p-8 space-y-4 md:space-y-6">
                    {/* Broker Information Section */}
                    <div className="space-y-3 md:space-y-4">
                      <h4 className="text-base md:text-lg font-semibold text-catalyst-navy border-b border-catalyst-gray-200 pb-2">
                        <span className="allow-wrap">Broker/Seller Information</span>
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className={`space-y-2 ${dashboardStep >= 0 ? 'animate-slide-in-up' : ''}`} style={{animationDelay: '0.1s'}}>
                          <label className="text-xs md:text-sm font-medium text-catalyst-gray-700"><span className="allow-wrap">Email Address *</span></label>
                          <div className="relative">
                            <input 
                              type="text" 
                              className={`w-full p-2 md:p-3 border rounded-lg focus:ring-2 focus:ring-catalyst-gold focus:border-catalyst-gold text-sm md:text-base ${dashboardStep >= 1 ? 'bg-green-50 border-green-300' : 'border-catalyst-gray-300'}`}
                              value={dashboardStep >= 1 ? "broker@realestate.com" : ""}
                              placeholder={dashboardStep < 1 ? "your.email@brokerage.com" : ""}
                              readOnly
                            />
                            {dashboardStep >= 1 && <div className="absolute right-2 md:right-3 top-2 md:top-3 text-green-600 text-xs md:text-sm">✓</div>}
                          </div>
                        </div>
                        
                        <div className={`space-y-2 ${dashboardStep >= 1 ? 'animate-slide-in-up' : ''}`} style={{animationDelay: '0.2s'}}>
                          <label className="text-xs md:text-sm font-medium text-catalyst-gray-700"><span className="allow-wrap">Phone Number</span></label>
                          <div className="relative">
                            <input 
                              type="text" 
                              className={`w-full p-2 md:p-3 border rounded-lg focus:ring-2 focus:ring-catalyst-gold focus:border-catalyst-gold text-sm md:text-base ${dashboardStep >= 2 ? 'bg-green-50 border-green-300' : 'border-catalyst-gray-300'}`}
                              value={dashboardStep >= 2 ? "(888) 486-6346" : ""}
                              placeholder={dashboardStep < 2 ? "(888) 486-6346" : ""}
                              readOnly
                            />
                            {dashboardStep >= 2 && <div className="absolute right-2 md:right-3 top-2 md:top-3 text-green-600 text-xs md:text-sm">✓</div>}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Property Information Section */}
                    <div className="space-y-3 md:space-y-4">
                      <h4 className="text-base md:text-lg font-semibold text-catalyst-navy border-b border-catalyst-gray-200 pb-2">
                        <span className="allow-wrap">Property Information</span>
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="space-y-2">
                          <label className="text-xs md:text-sm font-medium text-catalyst-gray-700"><span className="allow-wrap">Property Address *</span></label>
                          <div className="relative">
                            <input 
                              type="text" 
                              className={`w-full p-2 md:p-3 border rounded-lg focus:ring-2 focus:ring-catalyst-gold focus:border-catalyst-gold text-sm md:text-base ${dashboardStep >= 3 ? 'bg-green-50 border-green-300' : 'border-catalyst-gray-300'}`}
                              value={dashboardStep >= 3 ? "22 Acres - Houston, TX" : ""}
                              placeholder={dashboardStep < 3 ? "Enter property address..." : ""}
                              readOnly
                            />
                            {dashboardStep >= 3 && <div className="absolute right-2 md:right-3 top-2 md:top-3 text-green-600 text-xs md:text-sm">✓</div>}
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-xs md:text-sm font-medium text-catalyst-gray-700"><span className="allow-wrap">Asking Price</span></label>
                          <div className="relative">
                            <input 
                              type="text" 
                              className={`w-full p-2 md:p-3 border rounded-lg focus:ring-2 focus:ring-catalyst-gold focus:border-catalyst-gold text-sm md:text-base ${dashboardStep >= 4 ? 'bg-green-50 border-green-300' : 'border-catalyst-gray-300'}`}
                              value={dashboardStep >= 4 ? "$1,200,000" : ""}
                              placeholder={dashboardStep < 4 ? "$0" : ""}
                              readOnly
                            />
                            {dashboardStep >= 4 && <div className="absolute right-2 md:right-3 top-2 md:top-3 text-green-600 text-xs md:text-sm">✓</div>}
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-xs md:text-sm font-medium text-catalyst-gray-700"><span className="allow-wrap">Size (Acres)</span></label>
                          <div className="relative">
                            <input 
                              type="text" 
                              className={`w-full p-2 md:p-3 border rounded-lg focus:ring-2 focus:ring-catalyst-gold focus:border-catalyst-gold text-sm md:text-base ${dashboardStep >= 5 ? 'bg-green-50 border-green-300' : 'border-catalyst-gray-300'}`}
                              value={dashboardStep >= 5 ? "22" : ""}
                              placeholder={dashboardStep < 5 ? "Size in acres" : ""}
                              readOnly
                            />
                            {dashboardStep >= 5 && <div className="absolute right-2 md:right-3 top-2 md:top-3 text-green-600 text-xs md:text-sm">✓</div>}
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-xs md:text-sm font-medium text-catalyst-gray-700"><span className="allow-wrap">Zoning</span></label>
                          <div className="relative">
                            <input 
                              type="text" 
                              className={`w-full p-2 md:p-3 border rounded-lg focus:ring-2 focus:ring-catalyst-gold focus:border-catalyst-gold text-sm md:text-base ${dashboardStep >= 5 ? 'bg-green-50 border-green-300' : 'border-catalyst-gray-300'}`}
                              value={dashboardStep >= 5 ? "Mixed Use" : ""}
                              placeholder={dashboardStep < 5 ? "Property zoning type" : ""}
                              readOnly
                            />
                            {dashboardStep >= 5 && <div className="absolute right-2 md:right-3 top-2 md:top-3 text-green-600 text-xs md:text-sm">✓</div>}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Utilities Section */}
                    <div className="space-y-3 md:space-y-4">
                      <div className="space-y-2 md:space-y-3">
                        <label className="text-xs md:text-sm font-medium text-catalyst-gray-700"><span className="allow-wrap">Property Features</span></label>
                        <div className="space-y-2">
                          <label className="flex items-center space-x-2">
                            <input 
                              type="checkbox" 
                              className="text-catalyst-gold focus:ring-catalyst-gold" 
                              checked={dashboardStep >= 5} 
                              readOnly 
                            />
                            <span className="text-xs md:text-sm text-catalyst-gray-600"><span className="allow-wrap">Sewer Available</span></span>
                          </label>
                        </div>
                      </div>
                      
                      <div className="space-y-2 relative">
                        <label className="text-xs md:text-sm font-medium text-catalyst-gray-700"><span className="allow-wrap">Additional Notes</span></label>
                        <textarea 
                          className={`w-full p-2 md:p-3 border rounded-lg focus:ring-2 focus:ring-catalyst-gold focus:border-catalyst-gold text-sm md:text-base ${dashboardStep >= 5 ? 'bg-green-50 border-green-300' : 'border-catalyst-gray-300'}`}
                          rows={3}
                          value={dashboardStep >= 5 ? "Prime development land in high-growth area. Close to major highways and utilities." : ""}
                          placeholder={dashboardStep < 5 ? "Enter any additional property details..." : ""}
                          readOnly
                        />
                        {dashboardStep >= 5 && <div className="absolute right-2 md:right-3 top-8 md:top-9 text-green-600 text-xs md:text-sm">✓</div>}
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="text-center">
                      {dashboardStep >= 6 ? (
                        <div className="bg-catalyst-gold text-white px-4 md:px-8 py-2 md:py-3 rounded-lg font-semibold text-sm md:text-lg animate-pulse">
                          <span className="allow-wrap">Submitting Deal...</span>
                        </div>
                      ) : (
                        <div className="bg-catalyst-gray-100 text-catalyst-gray-400 px-4 md:px-8 py-2 md:py-3 rounded-lg font-semibold text-sm md:text-lg cursor-not-allowed">
                          <span className="allow-wrap">Submit Deal for Review</span>
                        </div>
                      )}
                      {dashboardStep >= 6 && <p className="text-xs md:text-sm text-catalyst-gray-500 mt-2"><span className="allow-wrap">Running AI analysis</span></p>}
                    </div>



                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {activeDemo === 'email' && (
            <Card className="border-catalyst-gray-200 shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader className="pb-2 md:pb-4 px-3 md:px-6">
              <div className="flex items-center space-x-3 mb-2 md:mb-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-100 flex items-center justify-center rounded-lg flex-shrink-0">
                  <Mail className="text-yellow-600" size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg md:text-2xl font-semibold text-catalyst-gray-900 tracking-tight leading-tight">
                    <span className="allow-wrap">Live Email Automation</span>
                  </CardTitle>
                  <p className="text-xs md:text-sm text-catalyst-gray-500 mt-1">
                    <span className="allow-wrap">Watch broker submissions and automated responses</span>
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-3 md:px-6">
              {/* Live Email Interface */}
              <div className="bg-white border border-catalyst-gray-200 rounded-lg p-3 md:p-4 mb-4 md:mb-6 min-h-[250px] md:min-h-[300px]">
                <div className="flex items-center justify-between mb-3 md:mb-4 pb-2 border-b border-catalyst-gray-100">
                  <div className="flex items-center space-x-1 md:space-x-2">
                    <div className="w-2 h-2 md:w-3 md:h-3 bg-red-500 rounded-full"></div>
                    <div className="w-2 h-2 md:w-3 md:h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-2 h-2 md:w-3 md:h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <div className="text-xs text-catalyst-gray-500 truncate ml-2"><span className="allow-wrap">sarah.broker@gmail.com</span></div>
                </div>
                
                <div className="space-y-3">
                  {emailMessages.map((email) => (
                    <div 
                      key={email.id}
                      className={`p-2 md:p-3 rounded-lg border transition-all duration-500 ${
                        email.status === 'sending' 
                          ? 'border-yellow-200 bg-yellow-50 animate-pulse' 
                          : email.isIncoming 
                            ? 'border-blue-200 bg-blue-50 ml-0 mr-4 md:mr-8' 
                            : 'border-green-200 bg-green-50 ml-4 md:ml-8 mr-0'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-1 md:space-x-2 min-w-0 flex-1">
                          <Mail className={`${email.isIncoming ? 'text-blue-600' : 'text-green-600'} flex-shrink-0`} size={14} />
                          <span className="text-xs md:text-sm font-medium text-catalyst-gray-900 truncate"><span className="allow-wrap">{email.sender}</span></span>
                          {email.status === 'delivered' && (
                            <span className="text-xs text-green-600 flex-shrink-0"><span className="allow-wrap">✓ Delivered</span></span>
                          )}
                        </div>
                        <span className="text-xs text-catalyst-gray-500 ml-2 flex-shrink-0"><span className="allow-wrap">{email.time}</span></span>
                      </div>
                      <p className="text-xs md:text-sm font-medium text-catalyst-gray-800 mb-1"><span className="allow-wrap">{email.subject}</span></p>
                      <p className="text-xs text-catalyst-gray-600 leading-relaxed"><span className="allow-wrap">{email.message}</span></p>
                    </div>
                  ))}
                  
                  {emailMessages.length === 0 && (
                    <div className="text-center py-8 text-catalyst-gray-500">
                      <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Waiting for next email...</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
            </Card>
          )}
          
          {activeDemo === 'sms' && (
            <Card className="border-catalyst-gray-200 shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader className="pb-2 md:pb-4 px-3 md:px-6">
              <div className="flex items-center space-x-3 mb-2 md:mb-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-100 flex items-center justify-center rounded-lg flex-shrink-0">
                  <MessageSquare className="text-amber-600" size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg md:text-2xl font-semibold text-catalyst-gray-900 tracking-tight leading-tight">
                    <span className="allow-wrap">Live SMS Automation</span>
                  </CardTitle>
                  <p className="text-xs md:text-sm text-catalyst-gray-500 mt-1">
                    <span className="allow-wrap">Watch broker texts and automated responses</span>
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-3 md:px-6">
              {/* Live Phone Interface */}
              <div className="bg-black rounded-3xl p-1 mx-auto max-w-[260px] md:max-w-[280px] mb-4 md:mb-6">
                <div className="bg-white rounded-3xl p-3 md:p-4 h-[500px] md:h-[600px] flex flex-col">
                  {/* Phone Header */}
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-12 h-1 bg-catalyst-gray-300 rounded-full"></div>
                  </div>
                  
                  {/* Messages Interface */}
                  <div className="flex-1 space-y-3 overflow-y-auto max-h-[500px]">
                    {smsMessages.map((sms) => (
                      <div key={sms.id} className={`flex items-start space-x-2 animate-slide-up ${sms.isIncoming ? 'justify-start' : 'justify-end'}`}>
                        {sms.isIncoming && (
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">S</span>
                          </div>
                        )}
                        <div className={`max-w-[180px] ${sms.isIncoming ? 'flex-1' : ''}`}>
                          <div 
                            className={`rounded-2xl p-3 transition-all duration-500 ${
                              sms.status === 'sending'
                                ? 'bg-catalyst-gray-200 animate-pulse'
                                : sms.isIncoming 
                                  ? 'bg-catalyst-gray-100 rounded-tl-sm'
                                  : 'bg-catalyst-gold text-white rounded-tr-sm'
                            }`}
                          >
                            <p className={`text-xs md:text-sm ${sms.isIncoming ? 'text-catalyst-gray-900' : 'text-white'}`}><span className="allow-wrap">{sms.message}</span></p>
                          </div>
                          <div className={`flex items-center space-x-1 mt-1 ${sms.isIncoming ? 'justify-start' : 'justify-end'}`}>
                            <p className="text-xs text-catalyst-gray-500">{sms.time}</p>
                            {sms.status === 'delivered' && (
                              <span className="text-xs text-catalyst-navy">✓</span>
                            )}
                          </div>
                        </div>
                        {!sms.isIncoming && (
                          <div className="w-8 h-8 bg-catalyst-navy rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">L</span>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {smsMessages.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-catalyst-gray-500">
                        <Smartphone className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-sm">Waiting for next message...</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
            </Card>
          )}
        </div>

        {/* Bottom CTA - Enhanced with Mission Section Design */}
        <div className="relative mt-8 md:mt-16 -mx-4 md:-mx-6 lg:-mx-8 py-16 md:py-20 bg-gradient-to-br from-[#081729] to-[#0a2540] overflow-hidden">
          {/* Decorative Elements */}
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
          
          {/* Content */}
          <div className="relative text-center max-w-3xl mx-auto px-4">
            <h3 className="text-xl md:text-2xl font-semibold text-white mb-3 md:mb-4 tracking-tight">
              <span className="allow-wrap">Ready to Get Started?</span>
            </h3>
            <p className="text-sm md:text-base text-gray-200 mb-4 md:mb-6 leading-relaxed">
              <span className="allow-wrap">Join LandLinq and access all submission methods - dashboard, email, and SMS - with professional automation for every deal.</span>
            </p>
            <a href="#registration" className="inline-flex items-center px-6 md:px-8 py-2 md:py-3 text-base md:text-lg font-semibold bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border-2 border-[#4A90E2] hover:border-[#4A90E2] transition-all duration-300 rounded-md">
              <span className="allow-wrap">Join LandLinq</span>
            </a>
          </div>

          {/* Decorative Divider */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
        </div>
      </div>
    </section>
  );
}