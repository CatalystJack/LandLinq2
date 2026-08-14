import { Button } from "@/components/ui/button";
import { TrendingUp, Calendar, DollarSign, MapPin, FileText, BarChart3, Users, Target, Award, Mail, MessageSquare, Monitor } from "lucide-react";
import { useState } from "react";

export default function DashboardPreview() {
  const [activeTab, setActiveTab] = useState("online");

  return (
    <section className="py-16 sm:py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
                Submit deals your way with 
                <span className="text-catalyst-gold"> multiple channels</span>
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed mb-8">
                Choose how you want to submit deals - online dashboard, email, or SMS. Track everything in one place and get instant updates no matter how you submit.
              </p>
            </div>

            {/* Submission Method Tabs */}
            <div className="bg-white rounded-xl p-1 shadow-lg border border-slate-200">
              <div className="flex space-x-1">
                <button
                  onClick={() => setActiveTab("online")}
                  className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "online"
                      ? "bg-catalyst-gold text-white shadow-md"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                  <span>Online</span>
                </button>
                <button
                  onClick={() => setActiveTab("email")}
                  className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "email"
                      ? "bg-catalyst-gold text-white shadow-md"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  <span>Email</span>
                </button>
                <button
                  onClick={() => setActiveTab("sms")}
                  className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "sms"
                      ? "bg-catalyst-gold text-white shadow-md"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>SMS</span>
                </button>
              </div>
            </div>

            {/* Content based on active tab */}
            <div className="space-y-6">
              {activeTab === "online" && (
                <>
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-catalyst-gold rounded-lg flex items-center justify-center">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">Complete dashboard access</h3>
                      <p className="text-slate-600">Submit deals through our intuitive online form with real-time validation and instant status updates.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-catalyst-gold rounded-lg flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">Analytics & insights</h3>
                      <p className="text-slate-600">Access detailed performance metrics, success rates, and market analytics to optimize your strategy.</p>
                    </div>
                  </div>
                </>
              )}
              
              {activeTab === "email" && (
                <>
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-catalyst-gold rounded-lg flex items-center justify-center">
                      <Mail className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">Email submissions</h3>
                      <p className="text-slate-600">Send deal details directly to our automated system and get instant confirmations and status updates.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-catalyst-gold rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">Automated processing</h3>
                      <p className="text-slate-600">Our AI extracts key information from your emails and creates deal records automatically.</p>
                    </div>
                  </div>
                </>
              )}
              
              {activeTab === "sms" && (
                <>
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-catalyst-gold rounded-lg flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">Text message deals</h3>
                      <p className="text-slate-600">Submit deals on-the-go via SMS with simple text commands and get instant confirmation replies.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-catalyst-gold rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">Real-time alerts</h3>
                      <p className="text-slate-600">Get instant SMS notifications when deal status changes or when we need additional information.</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right - Preview based on active tab */}
          <div className="relative">
            {activeTab === "online" && (
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/50 overflow-hidden">
                <div className="bg-gradient-to-r from-catalyst-navy to-blue-800 px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-semibold text-xl">Online Dashboard</h3>
                      <p className="text-blue-200 text-sm">Submit & track deals online</p>
                    </div>
                    <Monitor className="w-6 h-6 text-blue-200" />
                  </div>
                </div>
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                      <div className="text-2xl font-bold text-blue-700">$540K</div>
                      <div className="text-xs text-blue-600 font-medium">Avg Deal Value</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
                      <div className="text-2xl font-bold text-green-700">78%</div>
                      <div className="text-xs text-green-600 font-medium">Success Rate</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl">
                      <div className="text-2xl font-bold text-amber-700">24</div>
                      <div className="text-xs text-amber-600 font-medium">Active</div>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <h4 className="font-semibold text-slate-700 text-sm mb-3">Quick Submit Form</h4>
                    <div className="space-y-3">
                      <div className="h-3 bg-slate-200 rounded w-3/4"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                      <div className="h-3 bg-slate-200 rounded w-5/6"></div>
                      <Button className="w-full">
                        Submit Deal Online
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "email" && (
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/50 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-semibold text-xl">Email Submissions</h3>
                      <p className="text-blue-200 text-sm">Send deals via email</p>
                    </div>
                    <Mail className="w-6 h-6 text-blue-200" />
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <div className="flex items-start space-x-3">
                      <Mail className="w-5 h-5 text-blue-600 mt-1" />
                      <div>
                        <h5 className="font-medium text-blue-900 text-sm">Email Template</h5>
                        <p className="text-blue-700 text-xs mt-1">Send to: deals@landlinq.ai</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <div className="text-xs text-slate-600 mb-2">Example Email:</div>
                    <div className="bg-white border rounded-lg p-3 text-xs">
                      <div className="font-medium mb-1">Subject: Land Deal - 15 Acres Dallas</div>
                      <div className="text-slate-600 space-y-1">
                        <div>Location: Dallas, TX</div>
                        <div>Size: 15 acres</div>
                        <div>Zoning: R-4</div>
                        <div>Price: $680,000</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-green-700 text-sm font-medium">Auto-processed in 30 seconds</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "sms" && (
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/50 overflow-hidden">
                <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-semibold text-xl">SMS Submissions</h3>
                      <p className="text-green-200 text-sm">Text deals on-the-go</p>
                    </div>
                    <MessageSquare className="w-6 h-6 text-green-200" />
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                    <div className="flex items-start space-x-3">
                      <MessageSquare className="w-5 h-5 text-green-600 mt-1" />
                      <div>
                        <h5 className="font-medium text-green-900 text-sm">Text Number</h5>
                        <p className="text-green-700 text-xs mt-1">(555) 123-LAND</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <div className="text-xs text-slate-600 mb-3">SMS Conversation:</div>
                    <div className="space-y-2">
                      <div className="bg-blue-500 text-white text-xs p-2 rounded-lg rounded-bl-sm max-w-xs ml-auto">
                        DEAL: 15 acres Dallas TX, R-4 zoning, $680K
                      </div>
                      <div className="bg-gray-200 text-slate-700 text-xs p-2 rounded-lg rounded-br-sm max-w-xs">
                        ✅ Deal received! Reference #LD12345. We'll review and get back to you within 24 hours.
                      </div>
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-green-700 text-sm font-medium">Instant confirmation texts</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Floating Elements */}
            <div className="absolute -top-4 -left-4 bg-white rounded-xl shadow-lg p-3 border border-slate-200">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-catalyst-gold" />
                <span className="text-sm font-medium text-slate-700">100+ Active Brokers</span>
              </div>
            </div>

            <div className="absolute -bottom-4 -right-4 bg-green-500 text-white px-4 py-2 rounded-xl shadow-lg">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-200 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">
                  {activeTab === "online" ? "Deal submitted!" : activeTab === "email" ? "Email processed!" : "SMS received!"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <Button 
            className="bg-catalyst-gold text-white hover:bg-white hover:text-catalyst-gold border border-catalyst-gold hover:border-catalyst-gold px-8 py-4 text-lg font-semibold rounded-xl shadow-lg"
            onClick={() => window.location.href = '/api/login'}
            data-testid="button-join-dashboard"
          >
            Get Access to Your Dashboard
          </Button>
          <p className="text-sm text-slate-500 mt-3">Join 100+ brokers already maximizing their deals with LandLinq</p>
        </div>
      </div>
    </section>
  );
}