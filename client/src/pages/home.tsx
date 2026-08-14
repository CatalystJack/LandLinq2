import { lazy, Suspense, useState } from "react";
import Navigation from "@/components/navigation";
import HeroSection from "@/components/hero-section";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, MessageSquare, ArrowRight, Mail, Upload, Monitor, Smartphone, Zap, Brain, BarChart3, Network, Building2 } from "lucide-react";
import { Link } from "wouter";
import SlideInDealForm from "@/components/slide-in-deal-form";
import PlatformLayersAnimation from "@/components/platform-layers-animation";
import { useQuery } from "@tanstack/react-query";

// Lazy load components for better initial page load
const ProcessSection = lazy(() => import("@/components/process-section"));
const FAQSection = lazy(() => import("@/components/faq-section"));
const PhoneAnimationSection = lazy(() => import("@/components/phone-animation-section"));

const trackRecordStats = [
  { value: "$8.4B+", title: "Sales Volume", description: "Total sales volume closed" },
  { value: "25,000+", title: "Units Represented", description: "Units represented in transactions" },
  { value: "18,000+", title: "Units Developed", description: "Residential units developed or acquired" },
  { value: "$1.5B+", title: "Active Development", description: "In active development and investment" },
  { value: "15 Projects", title: "Under Development", description: "Projects under construction or in pre-development" }
];

export default function Home() {
  const [slideFormOpen, setSlideFormOpen] = useState(false);

  // Fetch live platform statistics
  const { data: platformStats } = useQuery({
    queryKey: ['/api/platform-stats'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Format numbers with commas
  const formatNumber = (num: number) => num.toLocaleString();

  return (
    <div className="min-h-screen bg-background">
      <Navigation onOpenSlideForm={() => setSlideFormOpen(true)} />
      <div className="pt-20">
        <HeroSection onOpenSlideForm={() => setSlideFormOpen(true)} />
        <SlideInDealForm open={slideFormOpen} onOpenChange={setSlideFormOpen} />
        
        {/* Track Record Stats - Scrolling Banner */}
        <section className="overflow-hidden bg-white">
          <style>{`
            @keyframes scroll {
              0% {
                transform: translateX(0);
              }
              100% {
                transform: translateX(-50%);
              }
            }
            .scrolling-stats, .scrolling-stats-dark {
              animation: scroll 45s linear infinite;
              will-change: transform;
            }
            @media (max-width: 640px) {
              .scrolling-stats, .scrolling-stats-dark {
                animation: scroll 22s linear infinite;
              }
            }
          `}</style>
          <div className="flex scrolling-stats py-8">
            {/* First set of stats */}
            {trackRecordStats.map((stat, index) => (
              <div key={`stat-1-${index}`} className="flex-shrink-0 px-4 sm:px-6 text-center">
                <div className="text-lg sm:text-xl font-bold text-[#081729] mb-0.5 leading-none">{stat.value}</div>
                <h4 className="text-[10px] sm:text-xs font-normal text-[#081729] whitespace-nowrap leading-none">{stat.title}</h4>
              </div>
            ))}
            {/* Duplicate set for seamless loop */}
            {trackRecordStats.map((stat, index) => (
              <div key={`stat-2-${index}`} className="flex-shrink-0 px-4 sm:px-6 text-center">
                <div className="text-lg sm:text-xl font-bold text-[#081729] mb-0.5 leading-none">{stat.value}</div>
                <h4 className="text-[10px] sm:text-xs font-normal text-[#081729] whitespace-nowrap leading-none">{stat.title}</h4>
              </div>
            ))}
          </div>
        </section>
        
        {/* Stats Banner - Scrolling */}
        <section className="py-1 sm:py-1.5 overflow-hidden" style={{ backgroundColor: '#081729' }}>
          <div className="flex scrolling-stats-dark">
            {/* First set of stats */}
            {trackRecordStats.map((stat, index) => (
              <div key={`banner-1-${index}`} className="flex-shrink-0 px-4 sm:px-6 text-center">
                <div className="text-lg sm:text-xl font-bold text-white mb-0.5 leading-none">{stat.value}</div>
                <p className="text-[10px] sm:text-xs text-slate-300 whitespace-nowrap max-w-xs hidden sm:block leading-none">{stat.description}</p>
              </div>
            ))}
            {/* Duplicate set for seamless loop */}
            {trackRecordStats.map((stat, index) => (
              <div key={`banner-2-${index}`} className="flex-shrink-0 px-4 sm:px-6 text-center">
                <div className="text-lg sm:text-xl font-bold text-white mb-0.5 leading-none">{stat.value}</div>
                <p className="text-[10px] sm:text-xs text-slate-300 whitespace-nowrap max-w-xs hidden sm:block leading-none">{stat.description}</p>
              </div>
            ))}
          </div>
        </section>
        
        {/* Quick What We Do Section */}
        <section className="py-16 bg-gradient-to-r from-[#081729] to-[#0a2540]" data-testid="section-quick-what-we-do">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-2xl md:text-3xl font-normal text-gray-300 mb-6">
                What We Do
              </h2>
              <p className="text-3xl md:text-5xl font-bold text-white leading-tight">
                We Buy Land. We Close Fast. You Get Paid More.
              </p>
            </div>
          </div>
        </section>
        
        {/* Phone Animation Section */}
        <Suspense fallback={<div className="py-16 text-center text-gray-500">Loading...</div>}>
          <PhoneAnimationSection />
        </Suspense>
        
        {/* Platform Technology Layers */}
        <section className="py-20 bg-gradient-to-br from-slate-50 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-[#081729] mb-4">
                Enterprise-Grade Technology Platform
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
                A sophisticated multi-layered architecture powering intelligent land acquisition
              </p>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
                <div className="text-center" data-testid="stat-property-records">
                  <div className="text-3xl font-bold text-[#4A90E2] mb-2">
                    {platformStats ? `${(platformStats.propertyRecords / 1000000).toFixed(0)}M+` : '15M+'}
                  </div>
                  <div className="text-sm text-gray-600">Property Records<br />Real-Time Access</div>
                </div>
                <div className="text-center" data-testid="stat-census-variables">
                  <div className="text-3xl font-bold text-[#4A90E2] mb-2">
                    {platformStats ? `${platformStats.censusVariables}+` : '100+'}
                  </div>
                  <div className="text-sm text-gray-600">Census Variables<br />Per Property</div>
                </div>
                <div className="text-center" data-testid="stat-ai-response">
                  <div className="text-3xl font-bold text-[#4A90E2] mb-2">
                    &lt;{platformStats ? platformStats.avgResponseSeconds : '2'}s
                  </div>
                  <div className="text-sm text-gray-600">AI Classification<br />Average Response</div>
                </div>
              </div>
              
              <p className="text-sm text-gray-500 max-w-3xl mx-auto">
                Leveraging advanced AI, nationwide demographic intelligence, and real-time geospatial analysis 
                to deliver unparalleled accuracy in multifamily development site evaluation
              </p>
            </div>
            <PlatformLayersAnimation />
          </div>
        </section>

        {/* Feature Showcase - EliseAI Style */}
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Automate Your Deal Submission
              </h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Empowering brokers to submit deals through any channel, receive instant AI analysis, 
                and track submissions in real-time—enhancing efficiency and maximizing opportunities.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* AI Deal Analysis */}
              <div className="group bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 border border-[#4A90E2]/20 hover:shadow-xl hover:scale-105 transition-all duration-300">
                <div className="bg-white rounded-xl p-6 mb-6 shadow-sm group-hover:shadow-md transition-shadow duration-300">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-[#4A90E2]/10 rounded-lg flex items-center justify-center group-hover:bg-[#4A90E2]/20 transition-colors duration-300">
                      <Brain className="w-6 h-6 text-[#4A90E2]" />
                    </div>
                    <div className="text-lg font-semibold text-gray-900">AI Analysis</div>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Status</span>
                      <span className="text-green-600 font-medium">✓ Analyzing</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Yield on Cost</span>
                      <span className="font-medium">6.75%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Classification</span>
                      <span className="text-[#4A90E2] font-medium">High Priority</span>
                    </div>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Instant AI Analysis</h3>
                <p className="text-gray-600 text-sm">
                  GPT-5 powered analysis evaluates every deal against our criteria, allowing instant underwriting and feedback within seconds.
                </p>
              </div>

              {/* Multi-Channel Submission */}
              <div className="group bg-gradient-to-br from-[#081729]/5 to-[#081729]/10 rounded-2xl p-8 border border-[#081729]/20 hover:shadow-xl hover:scale-105 transition-all duration-300">
                <div className="bg-white rounded-xl p-6 mb-6 shadow-sm group-hover:shadow-md transition-shadow duration-300">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-[#081729]/10 rounded-lg flex items-center justify-center group-hover:bg-[#081729]/20 transition-colors duration-300">
                      <MessageSquare className="w-6 h-6 text-[#081729]" />
                    </div>
                    <div className="text-lg font-semibold text-gray-900">Submit Anywhere</div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">Via Email</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Smartphone className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">Via SMS</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Monitor className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">Via Web Form</span>
                    </div>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">All Channels Covered</h3>
                <p className="text-gray-600 text-sm">
                  Submit deals however you prefer—email, text, or online form. 
                  Our AI parses and processes every submission automatically.
                </p>
              </div>

              {/* Real-Time Dashboard */}
              <div className="group bg-gradient-to-br from-[#D4AF37]/10 to-[#D4AF37]/20 rounded-2xl p-8 border border-[#D4AF37]/30 hover:shadow-xl hover:scale-105 transition-all duration-300">
                <div className="bg-white rounded-xl p-6 mb-6 shadow-sm group-hover:shadow-md transition-shadow duration-300">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-[#D4AF37]/10 rounded-lg flex items-center justify-center group-hover:bg-[#D4AF37]/20 transition-colors duration-300">
                      <BarChart3 className="w-6 h-6 text-[#D4AF37]" />
                    </div>
                    <div className="text-lg font-semibold text-gray-900">Dashboard</div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="h-2 bg-[#D4AF37]/20 rounded-full overflow-hidden">
                      <div className="h-full w-3/4 bg-[#D4AF37] rounded-full animate-pulse"></div>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Deals Submitted</span>
                      <span className="font-medium">12</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Under Review</span>
                      <span className="font-medium">3</span>
                    </div>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Track Everything</h3>
                <p className="text-gray-600 text-sm">
                  Real-time visibility into all your submissions, status updates, 
                  and communication history in one unified dashboard.
                </p>
              </div>
            </div>
          </div>
        </section>
        
        {/* Commission Structure Section - Always Visible */}
        <section className="py-16 bg-white" data-testid="section-commission-structure">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-catalyst-dark-blue mb-4">
                Commission Structure
              </h2>
              <p className="text-lg text-catalyst-gray-600 max-w-3xl mx-auto">
                Earn competitive commissions that grow with your success. Our transparent commission structure rewards high performers with climbing rates.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <div className="bg-white p-6 rounded-lg shadow-lg text-center">
                <h3 className="text-xl font-bold text-catalyst-dark-blue mb-3">
                  Starting Rates
                </h3>
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-catalyst-gold">1.0% at Rezoning</p>
                  <p className="text-lg font-semibold text-catalyst-gold">1.0% at Closing</p>
                  <p className="text-lg font-semibold text-catalyst-gold">2.0% GP Promote</p>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-lg text-center">
                <h3 className="text-xl font-bold text-catalyst-dark-blue mb-3">
                  Growth Rewards
                </h3>
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-catalyst-gold">+0.1% Every 5 Deals</p>
                  <p className="text-sm text-catalyst-gray-600">All commission rates increase</p>
                  <p className="text-sm text-catalyst-gray-600">No maximum cap</p>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-lg text-center">
                <h3 className="text-xl font-bold text-catalyst-dark-blue mb-3">
                  Transparency
                </h3>
                <div className="space-y-2">
                  <p className="text-sm text-catalyst-gray-600">No hidden fees</p>
                  <p className="text-sm text-catalyst-gray-600">Straightforward structure</p>
                  <p className="text-sm text-catalyst-gray-600">What you see is what you get</p>
                </div>
              </div>
            </div>
            

          </div>
        </section>
        
        {/* What We Do Section */}
        <section className="py-16 bg-gradient-to-br from-catalyst-gray-50 to-white" data-testid="section-what-we-do">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-catalyst-dark-blue mb-4">
                What We Do
              </h2>
              <p className="text-lg text-catalyst-gray-600 max-w-3xl mx-auto">
                LandLinq acquires and develops multifamily communities across the Southeast, partnering with brokers to identify premium land opportunities.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-catalyst-gray-200 hover:shadow-md transition-shadow" data-testid="card-land-acquisition">
                <div className="w-12 h-12 bg-catalyst-dark-blue rounded-lg flex items-center justify-center mb-4" data-testid="icon-land-acquisition">
                  <svg className="w-6 h-6 text-catalyst-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-catalyst-dark-blue mb-3" data-testid="text-land-acquisition-title">
                  Land Acquisition
                </h3>
                <p className="text-catalyst-gray-600 text-sm" data-testid="text-land-acquisition-desc">
                  We identify and acquire strategically located land parcels ideal for multifamily development across our 232 target markets in the Southeast.
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-catalyst-gray-200 hover:shadow-md transition-shadow" data-testid="card-entitlements">
                <div className="w-12 h-12 bg-catalyst-dark-blue rounded-lg flex items-center justify-center mb-4" data-testid="icon-entitlements">
                  <svg className="w-6 h-6 text-catalyst-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-catalyst-dark-blue mb-3" data-testid="text-entitlements-title">
                  Entitlements & Rezoning
                </h3>
                <p className="text-catalyst-gray-600 text-sm" data-testid="text-entitlements-desc">
                  Our experienced team navigates complex zoning processes, securing necessary approvals and entitlements to maximize development potential.
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-catalyst-gray-200 hover:shadow-md transition-shadow" data-testid="card-development">
                <div className="w-12 h-12 bg-catalyst-dark-blue rounded-lg flex items-center justify-center mb-4" data-testid="icon-development">
                  <svg className="w-6 h-6 text-catalyst-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-catalyst-dark-blue mb-3" data-testid="text-development-title">
                  Multifamily Development
                </h3>
                <p className="text-catalyst-gray-600 text-sm" data-testid="text-development-desc">
                  From conventional apartments to affordable housing and active adult communities, we develop high-quality multifamily properties that meet market demand.
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-catalyst-gray-200 hover:shadow-md transition-shadow" data-testid="card-partnerships">
                <div className="w-12 h-12 bg-catalyst-dark-blue rounded-lg flex items-center justify-center mb-4" data-testid="icon-partnerships">
                  <svg className="w-6 h-6 text-catalyst-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-catalyst-dark-blue mb-3" data-testid="text-partnerships-title">
                  Strategic Partnerships
                </h3>
                <p className="text-catalyst-gray-600 text-sm" data-testid="text-partnerships-desc">
                  We partner with top brokers, offering competitive commissions, transparent processes, and genuine collaboration throughout the entire deal lifecycle.
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-catalyst-gray-200 hover:shadow-md transition-shadow" data-testid="card-market-analysis">
                <div className="w-12 h-12 bg-catalyst-dark-blue rounded-lg flex items-center justify-center mb-4" data-testid="icon-market-analysis">
                  <svg className="w-6 h-6 text-catalyst-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-catalyst-dark-blue mb-3" data-testid="text-market-analysis-title">
                  Market Analysis
                </h3>
                <p className="text-catalyst-gray-600 text-sm" data-testid="text-market-analysis-desc">
                  Using cutting-edge AI and data analytics, we evaluate each opportunity against our specific acquisition criteria to ensure strong investment performance.
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-catalyst-gray-200 hover:shadow-md transition-shadow" data-testid="card-we-close">
                <div className="w-12 h-12 bg-catalyst-dark-blue rounded-lg flex items-center justify-center mb-4" data-testid="icon-we-close">
                  <svg className="w-6 h-6 text-catalyst-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-catalyst-dark-blue mb-3" data-testid="text-we-close-title">
                  We Actually Close
                </h3>
                <p className="text-catalyst-gray-600 text-sm" data-testid="text-we-close-desc">
                  Unlike wholesalers, we close on every deal we commit to. When we issue an LOI, you can count on us to follow through from contract to closing.
                </p>
              </div>
            </div>
          </div>
        </section>
        
        {/* Why Partner With LandLinq Section */}
        <section className="py-16 bg-white" data-testid="section-why-partner">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-catalyst-dark-blue mb-4">
                Why Partner With LandLinq?
              </h2>
              <p className="text-lg text-catalyst-gray-600 max-w-3xl mx-auto">
                We're the Southeast's premier land acquisition partner, designed specifically for brokers who want more.
              </p>
            </div>
            
            <div className="max-w-5xl mx-auto mb-12">
              <div className="bg-white p-6 rounded-lg border border-catalyst-gold/20">
                <h3 className="text-xl font-bold text-catalyst-dark-blue mb-6 text-center" data-testid="text-commission-structure-title">
                  Our Commission Structure
                </h3>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-white rounded-lg border border-catalyst-gold/30">
                    <div className="text-2xl font-bold text-catalyst-gold mb-2">+1.0%</div>
                    <div className="text-sm text-catalyst-gray-600">At Rezoning</div>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg border border-catalyst-gold/30">
                    <div className="text-2xl font-bold text-catalyst-gold mb-2">+1.0%</div>
                    <div className="text-sm text-catalyst-gray-600">At Closing</div>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg border border-catalyst-gold/30">
                    <div className="text-2xl font-bold text-catalyst-gold mb-2">2.0%</div>
                    <div className="text-sm text-catalyst-gray-600">GP Promote</div>
                  </div>
                </div>
                <div className="text-center mt-4">
                  <p className="text-sm text-catalyst-gray-600 italic">
                    All percentages are in addition to your standard commission
                  </p>
                </div>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-catalyst-gray-200">
                <div className="w-12 h-12 bg-catalyst-dark-blue rounded-lg flex items-center justify-center mb-4">
                  <div className="w-6 h-6 bg-catalyst-gold rounded"></div>
                </div>
                <h3 className="text-lg font-bold text-catalyst-dark-blue mb-3">
                  Built By Brokers, For Brokers
                </h3>
                <p className="text-catalyst-gray-600 text-sm">
                  With LandLinq, become a <strong className="text-[#4A90E2]">true partner.</strong> Make more money, in less time, with more transparency.
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-catalyst-gray-200">
                <div className="w-12 h-12 bg-catalyst-dark-blue rounded-lg flex items-center justify-center mb-4">
                  <div className="w-6 h-6 bg-catalyst-gold rounded-full"></div>
                </div>
                <h3 className="text-lg font-bold text-catalyst-dark-blue mb-3">
                  Premium Commission Structure
                </h3>
                <p className="text-catalyst-gray-600 text-sm">
                  Earn extra +1% at rezoning, +1% at closing, plus 2.0% of the GP promote—all in addition to your standard commission.
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-catalyst-gray-200">
                <div className="w-12 h-12 bg-catalyst-dark-blue rounded-lg flex items-center justify-center mb-4">
                  <div className="w-6 h-6 bg-catalyst-gold rounded"></div>
                </div>
                <h3 className="text-lg font-bold text-catalyst-dark-blue mb-3">
                  Fast LOI Turnaround
                </h3>
                <p className="text-catalyst-gray-600 text-sm">
                  Receive a Letter of Intent within less than 5 business days for qualifying deals.
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-catalyst-gray-200">
                <div className="w-12 h-12 bg-catalyst-dark-blue rounded-lg flex items-center justify-center mb-4">
                  <div className="w-6 h-6 bg-catalyst-gold rounded-full"></div>
                </div>
                <h3 className="text-lg font-bold text-catalyst-dark-blue mb-3">
                  We Actually Close
                </h3>
                <p className="text-catalyst-gray-600 text-sm">
                  No wholesaling, no bait-and-switch. We underwrite and close on the deals we commit to.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Submission Methods - Enhanced with CTA Design */}
        <section className="py-24 relative overflow-hidden bg-gradient-to-br from-[#081729] to-[#0a2540]">
          {/* Decorative Elements */}
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-8 tracking-tight">
                Submit Your Deal
              </h2>
              <p className="text-xl text-gray-200 font-light">
                Multiple ways to get your deals to us quickly
              </p>
            </div>

            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-12">
              {/* Online Form */}
              <Card className="bg-white border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-[#4A90E2] rounded-xl flex items-center justify-center mb-4">
                    <Upload className="text-white" size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-[#081729] mb-2 tracking-tight">Online Form</h3>
                  <p className="text-gray-600 mb-4 leading-relaxed text-sm">
                    Submit property details via our online form
                  </p>
                  <Link href="/submit-deal" className="w-full">
                    <Button 
                      className="w-full bg-[#4A90E2] hover:bg-white text-white hover:text-[#4A90E2] border-2 border-[#4A90E2] hover:border-[#4A90E2] px-8 py-3 text-base font-semibold rounded-lg transition-all duration-300"
                      data-testid="button-go-to-form"
                    >
                      Go to Form
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Email Submission */}
              <Card className="bg-white border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-[#4A90E2] rounded-xl flex items-center justify-center mb-4">
                    <Mail className="text-white" size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-[#081729] mb-2 tracking-tight">Email</h3>
                  <p className="text-gray-600 mb-2 leading-relaxed text-sm">
                    Send deal details to
                  </p>
                  <a 
                    href="mailto:deals@catalyst.landlinq.ai" 
                    className="text-lg font-semibold text-[#4A90E2] hover:text-[#081729] transition-colors" 
                    data-testid="text-email-address"
                  >
                    deals@catalyst.landlinq.ai
                  </a>
                </CardContent>
              </Card>

              {/* SMS Submission */}
              <Card className="bg-white border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-[#4A90E2] rounded-xl flex items-center justify-center mb-4">
                    <MessageSquare className="text-white" size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-[#081729] mb-2 tracking-tight">SMS</h3>
                  <p className="text-gray-600 mb-2 leading-relaxed text-sm">
                    Text property details to
                  </p>
                  <a 
                    href="sms:7046101549" 
                    className="text-lg font-semibold text-[#4A90E2] hover:text-[#081729] transition-colors" 
                    data-testid="text-phone-number"
                  >
                    (704) 610-1549
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
          
          {/* Decorative Divider */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
        </section>
        
        <Suspense fallback={<div className="py-16 text-center text-gray-500">Loading...</div>}>
          <ProcessSection />
        </Suspense>
        <Suspense fallback={<div className="py-16 text-center text-gray-500">Loading...</div>}>
          <FAQSection />
        </Suspense>

        {/* Partner Developer Network — teaser linking to dedicated page */}
        <section className="py-16 bg-gradient-to-br from-[#081729] to-[#0d2545]" data-testid="section-partner-developer-network">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-catalyst-gold/20 border border-catalyst-gold/30 rounded-full px-4 py-1.5 mb-5">
                <Network className="w-4 h-4 text-catalyst-gold" />
                <span className="text-catalyst-gold text-sm font-semibold uppercase tracking-wide">Partner Developer Network</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
                Deal Doesn't Fit Our Box?
              </h2>
              <p className="text-lg text-blue-200/80 max-w-2xl mx-auto leading-relaxed mb-8">
                Register your acquisition criteria and we'll route qualifying deals that fall outside our buy box directly to you — especially deals we've passed on.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
                <Link href="/developer-network">
                  <Button size="lg" className="w-full sm:w-auto bg-catalyst-gold hover:bg-catalyst-gold/90 text-catalyst-dark-blue font-semibold px-8">
                    Register My Buy Box <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-left max-w-3xl mx-auto">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-catalyst-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Building2 className="w-4 h-4 text-catalyst-gold" />
                  </div>
                  <div>
                    <h3 className="text-white text-sm font-semibold mb-0.5">Define Your Buy Box</h3>
                    <p className="text-blue-200/60 text-xs leading-relaxed">States, product types, acreage, price thresholds.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-catalyst-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Zap className="w-4 h-4 text-catalyst-gold" />
                  </div>
                  <div>
                    <h3 className="text-white text-sm font-semibold mb-0.5">AI Routes Deals to You</h3>
                    <p className="text-blue-200/60 text-xs leading-relaxed">Real-time matching against every incoming deal.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-catalyst-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <TrendingUp className="w-4 h-4 text-catalyst-gold" />
                  </div>
                  <div>
                    <h3 className="text-white text-sm font-semibold mb-0.5">Get First Look</h3>
                    <p className="text-blue-200/60 text-xs leading-relaxed">Broker-sourced deals before they hit the market.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* Call to Action */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-2xl border border-catalyst-gold/20 shadow-xl p-8 sm:p-12 text-center">
                <div className="mb-6">
                  <div className="w-16 h-16 bg-catalyst-dark-blue rounded-xl flex items-center justify-center mx-auto mb-4">
                    <div className="w-8 h-8 bg-catalyst-gold rounded-lg"></div>
                  </div>
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-catalyst-dark-blue mb-4 sm:mb-6 tracking-tight">
                    Ready to Partner With Us?
                  </h2>
                  <p className="text-lg sm:text-xl text-catalyst-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
                    Join LandLinq and start earning competitive commissions with instant AI deal analysis, 
                    automated communications, and transparent partnership terms.
                  </p>
                </div>
                
                {/* Commission Highlight */}
                <div className="bg-catalyst-gray-50 rounded-xl p-6 mb-8">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-catalyst-gold mb-1">+1.0%</div>
                      <div className="text-sm text-catalyst-gray-600">At Rezoning</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-catalyst-gold mb-1">+1.0%</div>
                      <div className="text-sm text-catalyst-gray-600">At Closing</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-catalyst-gold mb-1">2.0%</div>
                      <div className="text-sm text-catalyst-gray-600">GP Promote</div>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center">
                  <Button className="w-full sm:w-auto px-8 py-3 text-base font-semibold">
                    send us your deal
                  </Button>
                  <Button variant="outline" className="w-full sm:w-auto px-8 py-3 text-base font-semibold">
                    View Acquisition Criteria
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        <Footer />
      </div>
    </div>
  );
}
