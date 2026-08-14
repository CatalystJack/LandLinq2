import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "wouter";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getAssetUrl } from "@/lib/asset-manifest";

const landBackground = getAssetUrl("image_1759236402608.png");

interface HeroSectionProps {
  onOpenSlideForm?: () => void;
}

export default function HeroSection({ onOpenSlideForm }: HeroSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Simple form state
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    address: '',
    optInSMS: false
  });

  // Submit deal mutation
  const submitDealMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const nameParts = data.fullName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      const dealData = {
        contactPhone: data.phone,
        contactName: data.fullName,
        address: data.address,
        submissionMethod: 'form' as const,
        brokerInfo: {
          firstName,
          lastName,
          phone: data.phone
        }
      };

      const response = await fetch('/api/deals/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(dealData),
      });

      const result = await response.json();
      if (!response.ok) {
        // Handle validation errors with details
        if (result.error === 'Validation failed' && result.details) {
          const errorMessages = result.details.map((d: any) => d.message).join(', ');
          throw new Error(errorMessages);
        }
        throw new Error(result.message || result.error || 'Failed to submit deal');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brokers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      setFormData({
        fullName: '',
        phone: '',
        address: '',
        optInSMS: false
      });
      toast({
        title: "Deal Submitted! 🎉",
        description: "Your property has been submitted successfully. Our team will review it and get back to you soon.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Please check your information and try again",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitDealMutation.mutate(formData);
  };
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  
  // Consolidated stats for better performance
  const [stats, setStats] = useState({
    transactionVolume: 0,
    brokersEnrolled: 0,
    developersEmpowered: 0
  });
  
  const rotatingWords = useMemo(() => [
    "for more",
    "faster",
    "efficiently"
  ], []);

  useEffect(() => {
    // Check if mobile device (simplified detection)
    const isMobile = window.innerWidth < 768;
    
    if (isMobile) {
      // On mobile: instantly set final values to avoid performance issues
      setStats({
        transactionVolume: 4.5,
        brokersEnrolled: 100,
        developersEmpowered: 10
      });
      return;
    }

    // Desktop: optimized single animation loop
    const animationInterval = 80; // Slightly slower for better performance
    const animationDuration = 2000;
    const targets = {
      transactionVolume: 4.5,
      brokersEnrolled: 100,
      developersEmpowered: 10
    };
    
    const steps = animationDuration / animationInterval;
    let currentStep = 0;
    
    const animationTimer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      
      if (progress >= 1) {
        setStats(targets);
        clearInterval(animationTimer);
        return;
      }
      
      setStats({
        transactionVolume: Math.floor(targets.transactionVolume * progress * 10) / 10,
        brokersEnrolled: Math.floor(targets.brokersEnrolled * progress),
        developersEmpowered: Math.floor(targets.developersEmpowered * progress)
      });
    }, animationInterval);

    return () => {
      clearInterval(animationTimer);
    };
  }, []);

  useEffect(() => {
    // Check if mobile device
    const isMobile = window.innerWidth < 768;
    
    // Slower word rotation on mobile to reduce animations
    const rotationSpeed = isMobile ? 4000 : 2500;
    
    const wordRotationInterval = setInterval(() => {
      setCurrentWordIndex((prev) => (prev + 1) % rotatingWords.length);
    }, rotationSpeed);

    return () => clearInterval(wordRotationInterval);
  }, [rotatingWords]);
  return (
    <section className="relative py-16 sm:py-16 md:py-20 lg:py-24 flex items-center overflow-hidden" style={{ backgroundColor: '#081729' }}>
      {/* Background Image with 10% Opacity */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: `url(${landBackground})`,
          opacity: 0.1
        }}
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* Two Column Layout: Content Left, Form Right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-center">
          
          {/* Left Column: Hero Content */}
          <div className="text-center sm:text-left">
            <h1 className="text-5xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold text-catalyst-white mb-3 sm:mb-4 tracking-tight leading-tight" data-testid="text-hero-title">
              <span className="block text-catalyst-white">We buy</span>
              <span className="block text-catalyst-white">your land,</span>
              <span className="text-[#4A90E2] block transition-all duration-300 sm:duration-500 ease-in-out">{rotatingWords[currentWordIndex]}</span>
            </h1>
            <p className="text-base sm:text-base md:text-lg text-slate-300 mb-5 sm:mb-6 max-w-md leading-relaxed font-light text-center sm:text-left mx-auto sm:mx-0" data-testid="text-hero-subtitle">
              We Buy Land. We Close Fast. You Get Paid More.
            </p>
            
          </div>

          {/* Right Column: Deal Submission Form - Visible on all screens */}
          <div className="w-full lg:w-auto">
            <div className="max-w-sm mx-auto lg:ml-auto lg:mr-0 bg-white rounded-lg shadow-2xl p-5 sm:p-6">
              <h3 className="text-lg sm:text-xl font-bold text-[#081729] mb-3 sm:mb-4">Quick Deal Submission</h3>
              <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
                <Input
                  type="text"
                  placeholder="Full Name *"
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  required
                  className="w-full h-10 sm:h-9 text-base sm:text-sm"
                  data-testid="input-fullname"
                />
                
                <Input
                  type="tel"
                  placeholder="Phone Number *"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  required
                  className="w-full h-10 sm:h-9 text-base sm:text-sm"
                  data-testid="input-phone"
                />
                
                <Input
                  type="text"
                  placeholder="Property Address *"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  required
                  className="w-full h-10 sm:h-9 text-base sm:text-sm"
                  data-testid="input-address"
                />
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="optInSMS"
                    checked={formData.optInSMS}
                    onCheckedChange={(checked) => setFormData({...formData, optInSMS: checked as boolean})}
                    data-testid="checkbox-sms-optin"
                  />
                  <label
                    htmlFor="optInSMS"
                    className="text-sm text-gray-700 cursor-pointer"
                  >
                    Opt in to SMS updates
                  </label>
                </div>
                
                <Button
                  type="submit"
                  className="w-full h-11 sm:h-9 text-base sm:text-sm font-semibold"
                  disabled={submitDealMutation.isPending}
                  data-testid="button-submit-deal"
                >
                  {submitDealMutation.isPending ? 'Submitting...' : 'Submit Deal'}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
