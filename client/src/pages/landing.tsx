import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import Navigation from "@/components/navigation";
import HeroSection from "@/components/hero-section";
import ProcessSection from "@/components/process-section";
import DashboardPreview from "@/components/dashboard-preview";
import Footer from "@/components/footer";
import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, MessageSquare, BarChart3, Mail, Smartphone, Monitor, Zap, TrendingUp, Bell, Eye } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { AuthModal } from "@/components/auth-modal";
import { getAssetUrl } from "@/lib/asset-manifest";

const landLinqLogo = getAssetUrl("LL Header Email_1761148707803.png");
const landImage = getAssetUrl("ian-aw8c-nqCOyc-unsplash_1761664267477.jpg");
const constructionImage = getAssetUrl("stock_images/construction_site_ap_014957d6.jpg");
const apartmentImage = getAssetUrl("stock_images/modern_completed_apa_b09d8609.jpg");

// Development Slideshow Component
function DevelopmentSlideshow() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const images = [
    { src: landImage, label: "Raw Land" },
    { src: constructionImage, label: "Under Construction" },
    { src: apartmentImage, label: "Completed Development" }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full rounded-3xl overflow-hidden shadow-xl" style={{ aspectRatio: '16/10' }}>
      {images.map((image, index) => (
        <div
          key={index}
          className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
          style={{ opacity: currentIndex === index ? 1 : 0 }}
        >
          <img 
            src={image.src}
            alt={image.label}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
            <p className="text-white font-semibold text-lg">{image.label}</p>
          </div>
        </div>
      ))}
      {/* Progress indicators */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
        {images.map((_, index) => (
          <div
            key={index}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              currentIndex === index ? 'w-8 bg-white' : 'w-1.5 bg-white/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// Animated Statistics Section Component
function StatisticsSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );
    
    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    
    return () => observer.disconnect();
  }, [isVisible]);
  
  return (
    <section ref={sectionRef} className="py-6 bg-[#081729]">
      <div className="max-w-5xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {isVisible ? (
            <>
              <AnimatedStat end={1.5} suffix="B+" label="Active Development" decimals={1} />
              <AnimatedStat end={18000} suffix="+" label="Units Developed" decimals={0} />
              <AnimatedStat end={15} suffix=" Projects" label="Under Development" decimals={0} />
            </>
          ) : (
            <>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-white mb-2">$1.5B+</div>
                <h4 className="text-sm sm:text-base font-normal text-gray-200">Active Development</h4>
              </div>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-white mb-2">18,000+</div>
                <h4 className="text-sm sm:text-base font-normal text-gray-200">Units Developed</h4>
              </div>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-white mb-2">15 Projects</div>
                <h4 className="text-sm sm:text-base font-normal text-gray-200">Under Development</h4>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// Individual animated statistic component
function AnimatedStat({ end, suffix, label, decimals }: { end: number; suffix: string; label: string; decimals: number }) {
  // All counters use the same 2.5 second duration to finish at the same time
  const { value } = useCountUp({
    end,
    duration: 2500,
    decimals,
    start: 0,
    delay: 0
  });
  
  // Format the value with $ prefix for development value
  const prefix = label === "Active Development" ? "$" : "";
  const displayValue = decimals > 0 ? value.toFixed(decimals) : value.toLocaleString();
  
  return (
    <div className="text-center">
      <div className="text-3xl sm:text-4xl font-bold text-white mb-2">
        {prefix}{displayValue}{suffix}
      </div>
      <h4 className="text-sm sm:text-base font-normal text-gray-200">{label}</h4>
    </div>
  );
}

// Animated Commission Card Component
function AnimatedCommissionCard({ value, label, delay = 0 }: { value: number; label: string; delay?: number }) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  
  const { value: animatedValue } = useCountUp({
    end: value,
    duration: 2000,
    decimals: 1,
    start: 0,
    delay: isVisible ? delay : 0,
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, []);

  return (
    <div 
      ref={cardRef}
      className="bg-white rounded-2xl p-5 text-center shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
      data-testid={`commission-card-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="text-4xl sm:text-5xl font-bold text-[#4A90E2] mb-2 transition-all duration-300">
        {isVisible ? `${animatedValue}%` : '0.0%'}
      </div>
      <div className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}

export default function Landing() {
  const [isVisible, setIsVisible] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState("Received");
  const [classification, setClassification] = useState("");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const featuresRef = useRef<HTMLDivElement>(null);

  // Smooth animated counters using useCountUp hook
  const { value: comparablesCount } = useCountUp({
    end: 6.75,
    duration: 1200,
    start: 0,
    delay: isVisible ? 1800 : 0,
  });

  const { value: dealsSubmitted } = useCountUp({
    end: 12,
    duration: 2000,
    start: 0,
    delay: isVisible ? 400 : 0,
  });

  const { value: underReview } = useCountUp({
    end: 3,
    duration: 1500,
    start: 0,
    delay: isVisible ? 1800 : 0,
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (featuresRef.current) {
      observer.observe(featuresRef.current);
    }

    return () => {
      if (featuresRef.current) {
        observer.unobserve(featuresRef.current);
      }
    };
  }, []);

  // Sequential status changes for AI Analysis
  useEffect(() => {
    if (!isVisible) return;

    // Stage 1: Received (initial)
    setAnalysisStatus("Received");
    setClassification("");

    // Stage 2: Analyzing (after 800ms)
    const timer1 = setTimeout(() => {
      setAnalysisStatus("Analyzing");
    }, 800);

    // Stage 3: Pursuing (after 3200ms when comparables finish)
    const timer2 = setTimeout(() => {
      setAnalysisStatus("Pursuing");
      setClassification("High Priority");
    }, 3200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isVisible]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 via-blue-900 to-slate-900">
      <SEO 
        title="Land Acquisition & Development Platform"
        description="LandLinq connects brokers with developers for multifamily land deals. Submit properties via SMS, email, or web. Instant confirmations, automated classification, and expert analysis."
        keywords="land acquisition, multifamily development, real estate brokers, property deals, land investing, development opportunities, broker network"
        url="https://landlinq.ai"
      />
      <Navigation />
      <div>
        <HeroSection />
        
        {/* Track Record Stats - Animated Counters */}
        <StatisticsSection />

        {/* What We Do Section */}
        <section className="relative py-20 bg-white overflow-hidden" data-testid="section-quick-what-we-do">
          <div className="py-4">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              
              {/* Split Layout */}
              <div className="grid lg:grid-cols-[400px,1fr] gap-12 items-center">
                
                {/* Left - Headline & CTA */}
                <div className="text-center lg:text-left">
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#081729] mb-6 leading-tight">
                    What We Do
                  </h2>
                  <p className="text-base text-gray-600 mb-8 leading-relaxed max-w-md mx-auto lg:mx-0">
                    Fast closings, premium commissions, and true partnership for your multifamily land deals.
                  </p>
                  <div className="flex justify-center lg:justify-start">
                    <Link href="/submit-deal">
                      <Button 
                        className="w-full sm:w-auto" 
                        data-testid="button-submit-deal"
                      >
                        Submit a deal
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Right - Offer Cards */}
                <div className="grid gap-3">
                  
                  {/* Card 1 */}
                  <motion.div 
                    className="bg-[#081729] rounded-2xl p-6 shadow-xl relative overflow-hidden" 
                    data-testid="step-opt-in"
                    initial={{ opacity: 0, x: 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0 }}
                  >
                    <div className="absolute" style={{ left: '60px', top: '50%', transform: 'translate(-50%, -50%)' }}>
                      <span className="text-[72px] font-bold text-white">1</span>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2 mt-2 ml-24">
                      We Buy Land
                    </h3>
                    <p className="text-gray-300 text-lg leading-relaxed ml-24">
                      Actively acquiring multifamily development sites across the Southeast.
                    </p>
                  </motion.div>

                  {/* Card 2 */}
                  <motion.div 
                    className="bg-[#081729] rounded-2xl p-6 shadow-xl relative overflow-hidden" 
                    data-testid="step-submit-deals"
                    initial={{ opacity: 0, x: 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  >
                    <div className="absolute" style={{ left: '60px', top: '50%', transform: 'translate(-50%, -50%)' }}>
                      <span className="text-[72px] font-bold text-white">2</span>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2 mt-2 ml-24">
                      We Close Fast
                    </h3>
                    <p className="text-gray-300 text-lg leading-relaxed ml-24">
                      LOI in less than 5 days. No drawn-out negotiations or uncertainty.
                    </p>
                  </motion.div>

                  {/* Card 3 */}
                  <motion.div 
                    className="bg-[#081729] rounded-2xl p-6 shadow-xl relative overflow-hidden" 
                    data-testid="step-earn-fees"
                    initial={{ opacity: 0, x: 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                  >
                    <div className="absolute" style={{ left: '60px', top: '50%', transform: 'translate(-50%, -50%)' }}>
                      <span className="text-[72px] font-bold text-white">3</span>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2 mt-2 ml-24">
                      You Get Paid More
                    </h3>
                    <p className="text-gray-300 text-lg leading-relaxed ml-24">
                      Extra commissions at rezoning, closing, and a share of the GP promote.
                    </p>
                  </motion.div>

                </div>

              </div>

            </div>
          </div>
        </section>

        {/* Built By Brokers, For Brokers Section */}
        <section className="relative py-20 sm:py-24 bg-gray-50 overflow-hidden">
          
          {/* Content */}
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#081729] mb-6">
                Built By Brokers, For Brokers
              </h2>
              <p className="text-lg sm:text-xl text-gray-700 mb-4 max-w-3xl mx-auto">
                With LandLinq, become a <strong className="text-[#4A90E2]">true partner.</strong> Make more money, in less time, with more transparency.
              </p>
              <p className="text-sm text-gray-500 italic">
                The following are extra commissions added to standard commissions
              </p>
            </div>

            {/* Commission Cards - Animated */}
            <div className="grid md:grid-cols-3 gap-6 mb-10 max-w-3xl mx-auto">
              <AnimatedCommissionCard value={1.0} label="At Rezoning" delay={0} />
              <AnimatedCommissionCard value={1.0} label="At Closing" delay={200} />
              <AnimatedCommissionCard value={2.0} label="GP Promote" delay={400} />
            </div>

            {/* Become a Partner Button */}
            <div className="text-center">
              <Button 
                onClick={() => setIsAuthModalOpen(true)}
                className="bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border-2 border-[#4A90E2] hover:border-[#4A90E2] text-base px-8 py-3 font-semibold transition-all duration-300" 
                data-testid="button-become-partner"
              >
                Become a Partner
              </Button>
            </div>
          </div>
        </section>
        
        <ProcessSection />
        
        {/* Comparison Chart Section - Why Brokers Choose LandLinq */}
        <section className="py-12 sm:py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-[#081729] mb-3 sm:mb-4">
                Why Brokers Choose LandLinq
              </h2>
              <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
                Work with a developer who respects your time and rewards your expertise.
              </p>
            </div>

            {/* Mobile Comparison - Clean List Design */}
            <div className="block md:hidden">
              {/* Broker Compensation - Featured Card */}
              <div className="bg-[#4A90E2] rounded-2xl p-6 mb-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-[#4A90E2]" />
                  </div>
                  <div>
                    <div className="text-white/80 text-sm">Extra Commission</div>
                    <div className="text-3xl font-bold text-white">+4%</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white/20 rounded-lg py-2 px-1">
                    <div className="text-lg font-bold text-white">1%</div>
                    <div className="text-[10px] text-white/80">Rezoning</div>
                  </div>
                  <div className="bg-white/20 rounded-lg py-2 px-1">
                    <div className="text-lg font-bold text-white">1%</div>
                    <div className="text-[10px] text-white/80">Closing</div>
                  </div>
                  <div className="bg-white/20 rounded-lg py-2 px-1">
                    <div className="text-lg font-bold text-white">2%</div>
                    <div className="text-[10px] text-white/80">GP Promote</div>
                  </div>
                </div>
              </div>

              {/* Comparison List */}
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                {/* Header Row */}
                <div className="grid grid-cols-3 bg-gray-100 py-3 px-4">
                  <div className="text-xs font-semibold text-gray-500"></div>
                  <div className="text-center">
                    <img 
                      src={landLinqLogo} 
                      alt="LandLinq" 
                      className="h-6 object-contain mx-auto"
                      data-testid="logo-comparison-mobile"
                    />
                  </div>
                  <div className="text-xs font-semibold text-gray-400 text-center">Others</div>
                </div>

                {/* Response Time */}
                <div className="grid grid-cols-3 items-center py-4 px-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#4A90E2]" />
                    <span className="text-sm font-medium text-gray-700">Response</span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-bold text-[#4A90E2]">Instant</span>
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-gray-400">2-4 weeks</span>
                  </div>
                </div>

                {/* Rejection Clarity */}
                <div className="grid grid-cols-3 items-center py-4 px-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-[#4A90E2]" />
                    <span className="text-sm font-medium text-gray-700">Feedback</span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-bold text-[#4A90E2]">Clear</span>
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-gray-400">Ghosted</span>
                  </div>
                </div>

                {/* How to Submit */}
                <div className="grid grid-cols-3 items-center py-4 px-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#4A90E2]" />
                    <span className="text-sm font-medium text-gray-700">Submit</span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-bold text-[#4A90E2]">Any Way</span>
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-gray-400">Email only</span>
                  </div>
                </div>

                {/* Deal Visibility */}
                <div className="grid grid-cols-3 items-center py-4 px-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[#4A90E2]" />
                    <span className="text-sm font-medium text-gray-700">Tracking</span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-bold text-[#4A90E2]">24/7</span>
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-gray-400">Manual</span>
                  </div>
                </div>

                {/* Updates */}
                <div className="grid grid-cols-3 items-center py-4 px-4">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#4A90E2]" />
                    <span className="text-sm font-medium text-gray-700">Updates</span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-bold text-[#4A90E2]">Auto</span>
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-gray-400">Maybe</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop Table Comparison */}
            <div className="hidden md:block bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600 w-1/3">What Matters Most</th>
                    <th className="text-center py-4 px-6 bg-[#4A90E2]/5">
                      <img 
                        src={landLinqLogo} 
                        alt="LandLinq" 
                        className="h-12 w-32 object-contain mx-auto"
                        data-testid="logo-comparison-table"
                      />
                    </th>
                    <th className="text-center py-4 px-6 text-sm font-semibold text-gray-600">Other Developers</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Response Time */}
                  <tr className="border-b border-gray-100">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#4A90E2]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Zap className="w-5 h-5 text-[#4A90E2]" />
                        </div>
                        <span className="text-sm font-medium text-gray-800">Response time</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center bg-[#4A90E2]/5">
                      <div className="font-semibold text-[#4A90E2]">Instant</div>
                      <div className="text-xs text-gray-500 mt-1">AI-powered analysis in seconds</div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="text-sm text-gray-500">2-4 weeks</div>
                      <div className="text-xs text-gray-400 mt-1">Manual review process</div>
                    </td>
                  </tr>

                  {/* Quick No's */}
                  <tr className="border-b border-gray-100">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#4A90E2]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Brain className="w-5 h-5 text-[#4A90E2]" />
                        </div>
                        <span className="text-sm font-medium text-gray-800">Rejection clarity</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center bg-[#4A90E2]/5">
                      <div className="font-semibold text-[#4A90E2]">Fast & Clear</div>
                      <div className="text-xs text-gray-500 mt-1">Quick no's with detailed reasoning</div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="text-sm text-gray-500">Slow or ghosted</div>
                      <div className="text-xs text-gray-400 mt-1">No response or vague feedback</div>
                    </td>
                  </tr>

                  {/* Broker Compensation */}
                  <tr className="border-t-2 border-b-2 border-[#4A90E2] transition-colors">
                    <td className="py-4 px-6 border-l-2 border-[#4A90E2]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#4A90E2]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <TrendingUp className="w-5 h-5 text-[#4A90E2]" />
                        </div>
                        <span className="text-sm font-medium text-gray-800">Broker compensation</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center bg-[#4A90E2]/5">
                      <div className="font-semibold text-[#4A90E2]">Extra Commission</div>
                      <div className="text-xs text-gray-500 mt-1">1% rezoning + 1% closing + 2.0% GP promote</div>
                    </td>
                    <td className="py-4 px-6 text-center border-r-2 border-[#4A90E2]">
                      <div className="text-sm text-gray-500">0%</div>
                      <div className="text-xs text-gray-400 mt-1">No extra compensation</div>
                    </td>
                  </tr>

                  {/* Submission Methods */}
                  <tr className="border-b border-gray-100">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#4A90E2]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Mail className="w-5 h-5 text-[#4A90E2]" />
                        </div>
                        <span className="text-sm font-medium text-gray-800">How to submit</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center bg-[#4A90E2]/5">
                      <div className="font-semibold text-[#4A90E2]">Email, SMS, or Web</div>
                      <div className="text-xs text-gray-500 mt-1">Submit your way</div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="text-sm text-gray-500">Email only</div>
                      <div className="text-xs text-gray-400 mt-1">Limited channels</div>
                    </td>
                  </tr>

                  {/* Deal Tracking */}
                  <tr className="border-b border-gray-100">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#4A90E2]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Eye className="w-5 h-5 text-[#4A90E2]" />
                        </div>
                        <span className="text-sm font-medium text-gray-800">Deal visibility</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center bg-[#4A90E2]/5">
                      <div className="font-semibold text-[#4A90E2]">Real-time Dashboard</div>
                      <div className="text-xs text-gray-500 mt-1">Track every deal 24/7</div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="text-sm text-gray-500">Email updates</div>
                      <div className="text-xs text-gray-400 mt-1">Manual status requests</div>
                    </td>
                  </tr>

                  {/* Communication & Transparency */}
                  <tr className="">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#4A90E2]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Bell className="w-5 h-5 text-[#4A90E2]" />
                        </div>
                        <span className="text-sm font-medium text-gray-800">Updates & transparency</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center bg-[#4A90E2]/5">
                      <div className="font-semibold text-[#4A90E2]">Automated & Transparent</div>
                      <div className="text-xs text-gray-500 mt-1">Email + SMS alerts • See every step</div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="text-sm text-gray-500">Manual & Limited</div>
                      <div className="text-xs text-gray-400 mt-1">When they remember • Black box</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
        
        {/* Call to Action */}
        <section className="relative py-12 sm:py-16 bg-gradient-to-br from-[#081729] to-[#0a2540] overflow-hidden">
          {/* Decorative Elements */}
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
          
          {/* Content */}
          <div className="relative max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg sm:text-xl text-gray-200 mb-8 max-w-2xl mx-auto leading-relaxed">
              Join our network of successful brokers and start earning premium fees & partnership.
            </p>
            <Link href="/submit-deal">
              <Button 
                className="bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border-2 border-[#4A90E2] transition-all duration-300 text-base px-8 py-3 font-semibold" 
                data-testid="button-submit-deal-landing"
              >
                Submit Your First Deal
              </Button>
            </Link>
          </div>
        </section>

        <Footer />
      </div>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
    </div>
  );
}
