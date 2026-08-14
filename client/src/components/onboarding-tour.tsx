import { useState, useEffect } from "react";
import { X, ArrowRight, Trophy, DollarSign, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  targetSelector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: string;
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to LandLinq!',
    description: 'Ready to earn more with land deals? I\'ll walk you through the platform in 4 interactive steps. Let\'s get you set up for success!',
    icon: <Trophy className="h-8 w-8 text-catalyst-gold" />
  },
  {
    id: 'navigation',
    title: 'Step 1: Learn the Navigation',
    description: 'First, let\'s explore the main navigation. Look at the top navigation bar - these are your key tools for success.',
    icon: <FileText className="h-8 w-8 text-blue-600" />,
    targetSelector: '[data-testid="nav-submit-deal"]',
    position: 'bottom',
    action: 'Try hovering over "Submit Deal" in the navigation'
  },
  {
    id: 'form-demo',
    title: 'Step 2: Interactive Form Demo',
    description: 'Now let\'s try filling out a sample property. I\'ll guide you through each field with live examples.',
    icon: <FileText className="h-8 w-8 text-green-600" />,
    targetSelector: '[data-testid="input-broker-email"]',
    position: 'top',
    action: 'Click on the email field below and enter your email'
  },
  {
    id: 'leaderboard',
    title: 'Step 3: Check Your Competition',
    description: 'See how you stack up against other brokers. Top performers get recognition and can share their success on social media.',
    icon: <Trophy className="h-8 w-8 text-catalyst-gold" />,
    targetSelector: '[data-testid="nav-leaderboard"]',
    position: 'bottom',
    action: 'Click "Leaderboard" to see top performing brokers'
  },
  {
    id: 'earnings',
    title: 'Step 4: Start Earning',
    description: 'You\'re ready to start! Submit your first deal and join our network of successful brokers earning commissions on quality land opportunities.',
    icon: <DollarSign className="h-8 w-8 text-green-600" />,
    targetSelector: '[data-testid="deal-submission-form"]',
    position: 'top',
    action: 'Complete the form below to submit your first deal'
  }
];

export default function OnboardingTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState<Element | null>(null);
  const [isWaitingForInteraction, setIsWaitingForInteraction] = useState(false);

  // Check if classification progress popup is visible - hide tour button when it is
  const { data: classificationData } = useQuery<{ activeJobs: any[] }>({
    queryKey: ['/api/classification-progress'],
    refetchInterval: 2000,
    staleTime: 1000,
  });
  
  const hasActiveClassificationJobs = (classificationData?.activeJobs?.length || 0) > 0;

  useEffect(() => {
    // Check if user has seen the tour before
    const hasSeenTour = localStorage.getItem('landlinq-tour-completed');
    if (!hasSeenTour) {
      // Delay showing the tour slightly to let the page load
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Handle element highlighting
  useEffect(() => {
    if (!isOpen || currentStep >= tourSteps.length) return;

    const step = tourSteps[currentStep];
    if (step.targetSelector) {
      const element = document.querySelector(step.targetSelector);
      if (element) {
        setHighlightedElement(element);
        // Add highlight class
        element.classList.add('tour-highlight');
        
        // Scroll element into view
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });

        // For interactive steps, wait for user interaction
        if (step.action?.includes('Click') || step.action?.includes('hover')) {
          setIsWaitingForInteraction(true);
        }
      }
    }

    return () => {
      // Clean up highlight
      if (highlightedElement) {
        highlightedElement.classList.remove('tour-highlight');
      }
    };
  }, [currentStep, isOpen, highlightedElement]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const completeTour = () => {
    localStorage.setItem('landlinq-tour-completed', 'true');
    setIsOpen(false);
    setCurrentStep(0);
  };

  const skipTour = () => {
    localStorage.setItem('landlinq-tour-completed', 'true');
    setIsOpen(false);
    setCurrentStep(0);
  };

  const restartTour = () => {
    setCurrentStep(0);
    setIsOpen(true);
  };

  // Function to highlight target elements
  const highlightElement = (selector: string) => {
    const element = document.querySelector(selector);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a subtle highlight effect
      element.classList.add('ring-2', 'ring-catalyst-gold', 'ring-opacity-75', 'transition-all', 'duration-300');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-catalyst-gold', 'ring-opacity-75', 'transition-all', 'duration-300');
      }, 3000);
    }
  };

  useEffect(() => {
    const step = tourSteps[currentStep];
    if (step.targetSelector && isOpen) {
      setTimeout(() => {
        highlightElement(step.targetSelector!);
      }, 500);
    }
  }, [currentStep, isOpen]);

  if (!isOpen) {
    // Hide the tour button when classification progress popup is visible
    if (hasActiveClassificationJobs) {
      return null;
    }
    
    return (
      <Button
        onClick={restartTour}
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-40 shadow-lg hover:bg-catalyst-gold hover:text-white hover:border-catalyst-gold"
        data-testid="button-restart-tour"
      >
        <Trophy className="h-4 w-4 mr-2" />
        Take Tour
      </Button>
    );
  }

  const step = tourSteps[currentStep];

  return (
    <>
      {/* Interactive Overlay with Spotlight Effect */}
      <div className="fixed inset-0 bg-black bg-opacity-60 z-50 tour-spotlight" />
      
      {/* Tour Modal - Mobile Optimized Positioning */}
      <div className="fixed z-50 p-2 sm:p-4" style={{
        top: step.targetSelector && step.position === 'bottom' ? '60px' : 
             step.targetSelector && step.position === 'top' ? 'auto' : '50%',
        bottom: step.targetSelector && step.position === 'top' ? '60px' : 'auto',
        left: '50%',
        transform: step.targetSelector ? 'translateX(-50%)' : 'translate(-50%, -50%)',
        maxWidth: '420px',
        width: '95vw'
      }}>
        <Card className="shadow-2xl border-2 border-catalyst-gold/30">
          <CardContent className="p-4 sm:p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0">
                  {step.icon}
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-catalyst-gray-900 truncate">
                  {step.title}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={skipTour}
                className="text-catalyst-gray-500 hover:text-catalyst-gray-700"
                data-testid="button-skip-tour"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="mb-6">
              <p className="text-catalyst-gray-700 leading-relaxed mb-4">
                {step.description}
              </p>
              
              {step.action && (
                <div className="bg-gradient-to-r from-catalyst-gold/10 to-catalyst-gold/5 border border-catalyst-gold/30 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-6 h-6 rounded-full bg-catalyst-gold flex items-center justify-center">
                      <span className="text-white text-xs font-bold">!</span>
                    </div>
                    <p className="font-medium text-catalyst-gray-800">Try it now:</p>
                  </div>
                  <p className="text-catalyst-gold font-medium pl-9">
                    {step.action}
                  </p>
                  {isWaitingForInteraction && (
                    <div className="flex items-center gap-2 mt-3 pl-9 text-sm text-catalyst-gray-600">
                      <div className="w-2 h-2 bg-catalyst-gold rounded-full animate-pulse"></div>
                      Waiting for your interaction...
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Progress Indicator */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-catalyst-gray-600">
                  Step {currentStep + 1} of {tourSteps.length}
                </span>
                <span className="text-sm text-catalyst-gray-600">
                  {Math.round(((currentStep + 1) / tourSteps.length) * 100)}%
                </span>
              </div>
              <div className="w-full bg-catalyst-gray-200 rounded-full h-2">
                <div 
                  className="bg-catalyst-gold h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentStep + 1) / tourSteps.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Mobile-Optimized Navigation */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
              <div className="flex justify-between sm:gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  className="flex items-center gap-1 sm:gap-2 min-h-[40px] px-3 sm:px-4 text-catalyst-gray-700 border-catalyst-gray-300 hover:border-catalyst-gold hover:text-catalyst-gold disabled:opacity-50"
                  data-testid="button-tour-previous"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous</span>
                  <span className="sm:hidden">Prev</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={skipTour}
                  className="min-h-[40px] px-3 sm:px-4 text-catalyst-gray-600 border-catalyst-gray-300 hover:border-catalyst-gold hover:text-catalyst-gold"
                  data-testid="button-tour-skip"
                >
                  Skip Tour
                </Button>
              </div>

              <Button
                onClick={handleNext}
                size="sm"
                className="flex items-center justify-center gap-2 min-h-[44px] px-6 bg-catalyst-gold text-white hover:bg-catalyst-gold/90 border-0 font-medium shadow-md hover:shadow-lg transition-all duration-200"
                data-testid="button-tour-next"
              >
                {currentStep === tourSteps.length - 1 ? (
                  <>
                    <Trophy className="h-4 w-4" />
                    Get Started
                  </>
                ) : (
                  <>
                    Next Step
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// Export function to manually trigger tour (for testing or admin purposes)
export const triggerOnboardingTour = () => {
  localStorage.removeItem('landlinq-tour-completed');
  window.location.reload();
};