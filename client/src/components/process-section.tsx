import { Users, CheckCircle, ArrowRight, TrendingUp, Shield, Zap, Mail, PlusCircle, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useState, useEffect } from "react";

export default function ProcessSection() {
  // Animation state for commission rates
  const [commissionRates, setCommissionRates] = useState({
    rezoning: 0,
    closing: 0,
    gpPromote: 0
  });

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Set up intersection observer to trigger animation when in view
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isVisible) {
          setIsVisible(true);
          animateCommissionRates();
        }
      },
      { threshold: 0.3 }
    );

    const element = document.getElementById('commission-rates-section');
    if (element) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [isVisible]);

  const animateCommissionRates = () => {
    const duration = 4000; // 4 seconds (doubled from 2 seconds)
    const steps = 80; // 80 frames for extra smooth animation
    const stepDuration = duration / steps;
    
    const targets = { rezoning: 1.0, closing: 1.0, gpPromote: 2.5 };
    
    let currentStep = 0;
    
    const timer = setInterval(() => {
      currentStep++;
      const progress = Math.min(currentStep / steps, 1);
      
      // Slower ease-out function for more dramatic deceleration
      const easeOut = 1 - Math.pow(1 - progress, 4);
      
      setCommissionRates({
        rezoning: targets.rezoning * easeOut,
        closing: targets.closing * easeOut,
        gpPromote: targets.gpPromote * easeOut
      });
      
      if (progress >= 1) {
        clearInterval(timer);
        // Ensure final values are exact
        setCommissionRates(targets);
      }
    }, stepDuration);
  };

  const steps = [
    {
      icon: PlusCircle,
      title: "Opt In",
      description: "1-minute application submission to become a LandLinq partner. Get access to our exclusive platform and stay connected.",
      highlight: "5 min setup"
    },
    {
      icon: Mail,
      title: "Submit Deals Effortlessly", 
      description: (
        <>
          <a href="mailto:deals@catalyst.landlinq.ai" className="text-catalyst-gold hover:text-catalyst-gold/80 transition-colors" data-testid="link-deals-email">Email deals</a>, <a href="sms:7046101549" className="text-catalyst-gold hover:text-catalyst-gold/80 transition-colors" data-testid="link-submit-phone">text us</a>, or use our <Link href="/submit-deal" className="text-catalyst-gold hover:text-catalyst-gold/80 transition-colors" data-testid="link-submit-form">online form</Link>. AI-powered analysis provides instant feedback.
        </>
      ),
      highlight: "Instant AI review"
    },
    {
      icon: DollarSign,
      title: "Earn Premium Fees & Partnership",
      description: "Industry-leading commission structure, with true GP partnership, transparent communication and fast payouts.",
      highlight: "Up to 2.5% GP"
    },
  ];

  const features = [
    {
      icon: Zap,
      title: "Instant Analysis",
      description: "AI-powered deal evaluation in seconds"
    },
    {
      icon: Shield,
      title: "Proven Track Record",
      description: "100+ successful acquisitions and counting"
    },
    {
      icon: TrendingUp,
      title: "Market Leadership",
      description: "Premier development partner across multiple markets"
    }
  ];

  return (
    <section id="process-section" className="bg-white overflow-hidden">
      {/* How to Get Started Section */}
      <div className="py-12 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Mobile Layout */}
          <div className="block lg:hidden">
            <h2 className="text-2xl font-bold text-catalyst-gray-900 mb-8 text-center" data-testid="text-process-title-mobile">
              How to Get Started
            </h2>
            
            {/* Horizontal Steps - 3 columns */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div 
                    key={index}
                    className="flex flex-col items-center text-center"
                    data-testid={`process-step-mobile-${index}`}
                  >
                    <div className="w-14 h-14 rounded-2xl bg-[#4A90E2] flex items-center justify-center mb-3 shadow-lg">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-xs font-bold text-[#4A90E2] mb-1">Step {index + 1}</div>
                    <h3 className="text-sm font-semibold text-catalyst-gray-900 leading-tight">
                      {step.title}
                    </h3>
                  </div>
                );
              })}
            </div>
            
            {/* Mobile CTA Card */}
            <Link href="/submit-deal">
              <div className="bg-[#081729] rounded-2xl p-6 text-center shadow-xl">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Users className="w-6 h-6 text-[#4A90E2]" />
                  <span className="text-xl font-bold text-white">Join 100+ Brokers</span>
                </div>
                <p className="text-slate-400 text-sm">
                  Already earning more with LandLinq
                </p>
              </div>
            </Link>
          </div>

          {/* Desktop Layout */}
          <div className="hidden lg:grid grid-cols-2 gap-16 items-center">
          
            {/* Left Side - Steps */}
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-catalyst-gray-900 mb-12 tracking-tight" data-testid="text-process-title">
                How to Get Started
              </h2>
              
              <div className="space-y-8 relative">
                {steps.map((step, index) => (
                  <div 
                    key={index} 
                    className="flex items-start space-x-6 relative"
                    data-testid={`process-step-${index}`}
                  >
                    {/* Simple Step Number */}
                    <div className="flex-shrink-0 relative z-10">
                      <div className="w-12 h-12 rounded-xl bg-catalyst-gold text-white flex items-center justify-center font-bold text-lg">
                        {index + 1}
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 pb-2">
                      <h3 className="text-2xl font-bold text-catalyst-gray-900 mb-3 break-words hyphens-none" data-testid={`text-step-title-${index}`}>
                        {step.title}
                      </h3>
                      <p className="text-lg text-catalyst-gray-600 leading-relaxed" data-testid={`text-step-description-${index}`}>
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Side - Community */}
            <div className="flex items-center justify-center">
              <Link href="/submit-deal">
                <div className="rounded-3xl p-10 text-center shadow-2xl cursor-pointer hover:shadow-3xl transition-all duration-300 hover:scale-105 w-[400px] h-[280px] flex flex-col items-center justify-center" style={{ backgroundColor: '#081729' }}>
                  <div className="bg-[#4A90E2] w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-white mb-3" data-testid="text-community-title">
                    Join 100+ Brokers
                  </h3>
                  
                  <p className="text-slate-300 text-base leading-relaxed" data-testid="text-community-description">
                    Already earning more with LandLinq's SiteIQ™ System.
                  </p>
                </div>
              </Link>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}