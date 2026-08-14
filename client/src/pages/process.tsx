import { useState, useEffect, useRef } from "react";
import { CheckCircle, FileText, Users, TrendingUp, MessageSquare, Monitor, Mail, Smartphone, Zap, Eye, Handshake, Brain, Database, TrendingUp as Analytics, BarChart3, Network, Building, Home, Building2, MapPin, LayoutGrid, User } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { getAssetUrl } from "@/lib/asset-manifest";

const mapBackground = getAssetUrl("image_1760625447005.png");

interface ProcessStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  duration: string;
  details: string[];
}

const processSteps: ProcessStep[] = [
  {
    id: 1,
    title: "Deal Submission",
    description: "Brokers submit land deals through our platform",
    icon: <FileText className="h-5 w-5" />,
    duration: "Instant",
    details: [
      "Submit via web form, email, or SMS",
      "Upload property documents and photos",
      "Automatic data validation"
    ]
  },
  {
    id: 2,
    title: "AI Analysis & Feedback",
    description: "Instant AI evaluation with Passed/Reviewing/Pursuing classification based on development potential",
    icon: <TrendingUp className="h-5 w-5" />,
    duration: "Instant",
    details: [
      "🔴 Passed: Clear no-go deals",
      "🟡 Reviewing: Potential opportunities", 
      "🟢 Pursuing: High-priority deals"
    ]
  },
  {
    id: 3,
    title: "Senior Developer Review",
    description: "Pursuing and Reviewing deals receive detailed analysis from our senior partners",
    icon: <Users className="h-5 w-5" />,
    duration: "under 48 hours",
    details: [
      "Market analysis for Pursuing and Reviewing deals",
      "Financial modeling and projections",
      "Investment committee presentation"
    ]
  },
  {
    id: 4,
    title: "Decision & LOI",
    description: "Final decision and LOI discussion",
    icon: <CheckCircle className="h-5 w-5" />,
    duration: "under 7 days",
    details: [
      "Investment committee decision",
      "Partnership terms discussion",
      "Deal closing timeline"
    ]
  },
  {
    id: 5,
    title: "Ongoing Transparency",
    description: "Regular detailed progress updates throughout development",
    icon: <MessageSquare className="h-5 w-5" />,
    duration: "Ongoing",
    details: [
      "Regular progress reports to brokers and landowners",
      "Development milestone updates",
      "Transparent communication throughout the process"
    ]
  }
];

// Animated Counter Component - Synchronized animations
const AnimatedCounter = ({ end, duration = 2000, suffix = "", prefix = "", isCountDown = false }: { 
  end: number; 
  duration?: number; 
  suffix?: string;
  prefix?: string;
  isCountDown?: boolean;
}) => {
  const [count, setCount] = useState(isCountDown ? end + 3 : 0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    const startValue = isCountDown ? end + 3 : 0;
    const endValue = end;
    const range = Math.abs(endValue - startValue);
    
    // Fixed frame rate for smooth animation (60fps)
    const frameTime = 1000 / 60;
    const totalFrames = duration / frameTime;
    const incrementPerFrame = range / totalFrames;
    
    let current = startValue;
    const timer = setInterval(() => {
      if (isCountDown) {
        current -= incrementPerFrame;
        if (current <= endValue) {
          setCount(endValue);
          clearInterval(timer);
        } else {
          setCount(Math.ceil(current));
        }
      } else {
        current += incrementPerFrame;
        if (current >= endValue) {
          setCount(endValue);
          clearInterval(timer);
        } else {
          setCount(Math.floor(current));
        }
      }
    }, frameTime);

    return () => clearInterval(timer);
  }, [isVisible, end, duration, isCountDown]);

  const formattedCount = count.toLocaleString();

  return (
    <div ref={ref} className="text-3xl sm:text-4xl font-bold text-white mb-2">
      {prefix}{formattedCount}{suffix}
    </div>
  );
};

export default function ProcessPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Auto-advance timeline with optimized interval
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep(prev => (prev + 1) % processSteps.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Intersection observer for animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    const element = document.getElementById('process-timeline');
    if (element) observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const handleStepClick = (index: number) => {
    setActiveStep(index);
  };

  const progressWidth = `calc(${((activeStep + 1) / processSteps.length) * 100}% - 48px)`;

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      
      {/* Hero Section - Enhanced with CTA Design */}
      <section className="relative py-16 sm:py-20 lg:py-24 bg-gradient-to-br from-[#081729] to-[#0a2540] overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        
        {/* Content */}
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight" data-testid="text-process-title">
            The SiteIQ<sup className="text-xl sm:text-2xl md:text-3xl lg:text-3xl" style={{ verticalAlign: 'super', fontSize: '0.5em', top: '-0.5em', position: 'relative' }}>™</sup> System
          </h1>
          <p className="text-xl sm:text-2xl text-gray-200 leading-relaxed max-w-3xl mx-auto">
            Accelerating multifamily land acquisition through AI-powered intelligence and automation.
          </p>
        </div>


      </section>
      
      {/* Section 1: Interactive Timeline - White Background */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          {/* Section Title */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#081729] mb-5">
              How It Works
            </h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              From submission to partnership, our streamlined process ensures every deal receives expert evaluation.
            </p>
          </div>

          {/* Optimized Interactive Timeline */}
          <div id="process-timeline" className="mb-0">
            <div className={`transition-all duration-1200 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="relative bg-white rounded-3xl p-6 md:p-10">
                {/* Mobile Timeline Connector */}
                <div className="absolute left-8 top-20 bottom-20 w-0.5 bg-gray-200 md:hidden"></div>
                
                {/* Desktop Timeline Line - only spans between circles, not beyond */}
                <div 
                  className="absolute top-16 left-20 h-0.5 bg-gray-200 hidden md:block"
                  style={{ width: 'calc(80% - 64px)' }}
                ></div>
                
                {/* Optimized Progress Line */}
                <div 
                  className="absolute top-16 left-20 h-0.5 bg-gradient-to-r from-[#081729] via-[#081729] to-[#4A90E2] transition-all duration-2000 ease-out hidden md:block"
                  style={{ 
                    width: `calc(${progressWidth} - 32px)`,
                    boxShadow: '0 0 8px rgba(74, 144, 226, 0.4)'
                  }}
                ></div>

                {/* Timeline Steps Grid */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-4">
                  {processSteps.map((step, index) => {
                    const isActive = index === activeStep;
                    const isCompleted = index < activeStep;
                    const isAccessible = index <= activeStep;
                    
                    return (
                      <div 
                        key={step.id}
                        className={`relative flex flex-col items-center text-center cursor-pointer group transition-all duration-500 ${
                          isAccessible ? 'hover:scale-[1.02]' : ''
                        }`}
                        onClick={() => handleStepClick(index)}
                        style={{
                          animationDelay: `${index * 250}ms`,
                          animation: isVisible ? 'slideInUp 1s ease-out forwards' : 'none'
                        }}
                      >
                        {/* Timeline Node */}
                        <div className={`
                          relative w-14 h-14 md:w-16 md:h-16 rounded-full border-3 border-white shadow-lg 
                          flex items-center justify-center transition-all duration-700 z-20
                          ${isCompleted ? 'bg-[#081729] text-white shadow-xl scale-100' : ''}
                          ${isActive ? 'bg-[#4A90E2] text-white shadow-xl scale-110 ring-4 ring-[#4A90E2]/30' : ''}
                          ${!isAccessible ? 'bg-gray-200 text-gray-400' : ''}
                          ${isAccessible && !isActive && !isCompleted ? 'bg-gray-300 text-gray-600 hover:bg-gray-400 hover:scale-105' : ''}
                        `}>
                          {isCompleted ? <CheckCircle className="h-5 w-5" /> : step.icon}
                          
                          {/* Pulse animation for active step */}
                          {isActive && (
                            <div className="absolute inset-0 rounded-full bg-[#4A90E2] animate-ping opacity-25"></div>
                          )}
                        </div>
                        
                        {/* Step Content */}
                        <div className="mt-4 md:mt-6 px-2">
                          <Badge 
                            className={`text-xs mb-2 px-2 py-1 transition-all duration-300 ${
                              isAccessible 
                                ? 'bg-[#081729] text-white' 
                                : 'bg-gray-300 text-gray-500'
                            }`}
                          >
                            {step.duration}
                          </Badge>
                          
                          <h3 className={`font-bold text-sm md:text-base mb-2 transition-colors duration-300 ${
                            isAccessible ? 'text-[#081729]' : 'text-gray-400'
                          }`}>
                            {step.title}
                          </h3>
                          
                          <p className={`text-xs md:text-sm leading-relaxed transition-colors duration-300 ${
                            isAccessible ? 'text-gray-600' : 'text-gray-400'
                          }`}>
                            {step.description}
                          </p>
                          
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Technology Platform - Light Grey Background */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="mb-0">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl sm:text-4xl font-bold text-[#081729] mb-4">
                  Enterprise-Grade Technology Platform
                </h2>
                <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-8">
                  Leveraging advanced AI, nationwide demographic intelligence, and real-time geospatial analysis to deliver unparalleled accuracy in multifamily development site evaluation
                </p>
              </div>

              {/* Impressive Stats Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-[#081729] rounded-xl p-6 shadow-md text-center">
                  <AnimatedCounter end={15} suffix="M+" duration={2000} />
                  <div className="text-sm text-white font-medium">Property Records</div>
                  <div className="text-xs text-gray-400 mt-1">Real-Time Access</div>
                </div>
                <div className="bg-[#081729] rounded-xl p-6 shadow-md text-center">
                  <AnimatedCounter end={100} suffix="+" duration={2000} />
                  <div className="text-sm text-white font-medium">Census Variables</div>
                  <div className="text-xs text-gray-400 mt-1">Per Property</div>
                </div>
                <div className="bg-[#081729] rounded-xl p-6 shadow-md text-center">
                  <AnimatedCounter end={2} prefix="<" suffix="s" isCountDown={true} duration={2000} />
                  <div className="text-sm text-white font-medium">AI Classification</div>
                  <div className="text-xs text-gray-400 mt-1">Average Response</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: FAQ - White Background */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="mb-0">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-[#081729] mb-4">
                Frequently Asked Questions
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Everything you need to know about submitting and tracking your deals.
              </p>
            </div>

            <div className="max-w-4xl mx-auto">
              <Accordion type="single" collapsible className="space-y-0 border-t border-gray-200">
                {/* FAQ 1 */}
                <AccordionItem value="item-1" className="bg-white border-b border-gray-200" data-testid="faq-requirements">
                  <AccordionTrigger className="text-base md:text-lg font-semibold text-[#081729] hover:no-underline py-5 px-0">
                    What information do I need to submit a deal?
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600 leading-relaxed pb-5 px-0">
                    <strong>Address is the only required field.</strong> While pricing and acreage help our analysis, we can evaluate deals with just the property address. Our AI system will search for comparable properties and analyze the market automatically.
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 2 */}
                <AccordionItem value="item-2" className="bg-white border-b border-gray-200" data-testid="faq-timeline">
                  <AccordionTrigger className="text-base md:text-lg font-semibold text-[#081729] hover:no-underline py-5 px-0">
                    How long does the review process take?
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600 leading-relaxed pb-5 px-0">
                    You'll receive <strong>instant AI classification</strong> (Pursuing/Reviewing/Passed) within seconds of submission. Pursuing and Reviewing deals then receive detailed senior analyst review within <strong>under 48 hours</strong>. Final investment decisions typically happen in <strong>under 7 days</strong>.
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 3 */}
                <AccordionItem value="item-3" className="bg-white border-b border-gray-200" data-testid="faq-classification">
                  <AccordionTrigger className="text-base md:text-lg font-semibold text-[#081729] hover:no-underline py-5 px-0">
                    How do you determine Pursuing vs. Reviewing vs. Passed?
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600 leading-relaxed pb-5 px-0">
                    Our AI analyzes comparable properties within 3-5 miles built in the last 5 years. <strong className="text-green-600">🟢 Pursuing</strong> deals show strong development potential based on comparable data. <strong className="text-yellow-600">🟡 Reviewing</strong> deals have moderate potential and need analyst review. <strong className="text-red-600">🔴 Passed</strong> deals don't meet our current acquisition criteria.
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 4 */}
                <AccordionItem value="item-4" className="bg-white border-b border-gray-200" data-testid="faq-rejection">
                  <AccordionTrigger className="text-base md:text-lg font-semibold text-[#081729] hover:no-underline py-5 px-0">
                    What happens if my deal is marked as Passed?
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600 leading-relaxed pb-5 px-0">
                    You'll receive a clear explanation of why the deal doesn't fit our current criteria. Markets change constantly, so we encourage you to keep submitting new opportunities. Many brokers in our network submit multiple deals before finding the right fit.
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 5 */}
                <AccordionItem value="item-5" className="bg-white border-b border-gray-200" data-testid="faq-updates">
                  <AccordionTrigger className="text-base md:text-lg font-semibold text-[#081729] hover:no-underline py-5 px-0">
                    How will I receive updates on my deals?
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600 leading-relaxed pb-5 px-0">
                    You'll get updates via your preferred method (email or SMS). Instant confirmations when deals are received, status updates when classifications change, and detailed feedback from our senior team on Pursuing and Reviewing deals. You can also track everything in your dashboard 24/7.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
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
            Ready to Experience Our Process?
          </h2>
          <p className="text-lg sm:text-xl text-gray-200 mb-8 max-w-2xl mx-auto leading-relaxed">
            Submit your first deal and see how our AI-powered system works in real-time.
          </p>
          <Link href="/submit-deal">
            <Button 
              className="bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border-2 border-[#4A90E2] transition-all duration-300 text-base px-8 py-3 font-semibold" 
              data-testid="button-submit-deal-process"
            >
              Submit Your First Deal
            </Button>
          </Link>
        </div>
      </section>
      
      <Footer />
    </div>
  );
}
