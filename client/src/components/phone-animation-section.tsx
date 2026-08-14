import { useState, useEffect } from "react";
import { Smartphone, Mail, MessageSquare } from "lucide-react";

export default function PhoneAnimationSection() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 3);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const steps = [
    {
      title: "Send an Email",
      description: "Forward property details to deals@catalyst.landlinq.ai",
      icon: Mail,
      color: "bg-blue-500"
    },
    {
      title: "Text a Deal",
      description: "SMS property info to (704) 610-1549",
      icon: MessageSquare,
      color: "bg-green-500"
    },
    {
      title: "Instant Confirmation",
      description: "Get AI-powered analysis in seconds",
      icon: Smartphone,
      color: "bg-catalyst-gold"
    }
  ];

  return (
    <section className="py-24 bg-gradient-to-br from-slate-50 to-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Side - Text Content */}
          <div className="order-2 lg:order-1">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-catalyst-gray-900 mb-6 tracking-tight">
              Submit Deals From Anywhere
            </h2>
            <p className="text-lg text-catalyst-gray-600 mb-12 leading-relaxed">
              No apps to download. No complicated forms. Just text or email property details and our AI handles the rest.
            </p>

            <div className="space-y-8">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = activeStep === index;
                
                return (
                  <div 
                    key={index}
                    className={`flex items-start space-x-4 transition-all duration-500 ${
                      isActive ? 'opacity-100 scale-105' : 'opacity-60 scale-100'
                    }`}
                  >
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${step.color} text-white flex items-center justify-center transition-transform duration-500 ${
                      isActive ? 'ring-4 ring-offset-2 ring-offset-white ring-current shadow-lg' : ''
                    }`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-catalyst-gray-900 mb-1">
                        {step.title}
                      </h3>
                      <p className="text-catalyst-gray-600">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Side - Phone Animation */}
          <div className="order-1 lg:order-2 flex justify-center lg:justify-end">
            <div className="relative" data-testid="phone-animation-container">
              {/* Phone Frame */}
              <div className="relative w-[280px] h-[560px] bg-gradient-to-br from-gray-800 to-gray-900 rounded-[3rem] p-3 shadow-2xl">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-900 rounded-b-2xl z-10" />
                
                {/* Screen */}
                <div className="relative w-full h-full bg-white rounded-[2.5rem] overflow-hidden">
                  
                  {/* Screen Content - Email Animation */}
                  <div className={`absolute inset-0 transition-all duration-700 ${
                    activeStep === 0 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full'
                  }`}>
                    <div className="h-full bg-gradient-to-br from-blue-50 to-white p-6">
                      <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
                        <div className="flex items-center mb-3">
                          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                            <Mail className="w-5 h-5 text-white" />
                          </div>
                          <div className="ml-3">
                            <div className="font-semibold text-sm">New Deal</div>
                            <div className="text-xs text-gray-500">To: deals@catalyst...</div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-700 leading-relaxed">
                          <div className="font-semibold mb-2">Property Available</div>
                          <div>📍 123 Main St, Charlotte NC</div>
                          <div>💰 $2.5M</div>
                          <div>📏 5.2 acres</div>
                        </div>
                      </div>
                      <div className="flex justify-center">
                        <div className="bg-blue-500 text-white px-6 py-2 rounded-full text-sm font-semibold animate-pulse">
                          Send
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Screen Content - SMS Animation */}
                  <div className={`absolute inset-0 transition-all duration-700 ${
                    activeStep === 1 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
                  }`}>
                    <div className="h-full bg-gradient-to-br from-green-50 to-white p-6">
                      <div className="flex flex-col space-y-3">
                        <div className="bg-green-500 text-white rounded-2xl rounded-tl-sm p-4 ml-auto max-w-[85%] shadow-lg">
                          <div className="text-sm leading-relaxed">
                            <div>123 Main St</div>
                            <div>Charlotte NC 28203</div>
                            <div>$2.5M • 5.2 acres</div>
                          </div>
                        </div>
                        <div className="bg-white border-2 border-gray-200 rounded-2xl rounded-tr-sm p-4 mr-auto max-w-[85%] shadow-lg">
                          <div className="text-sm text-gray-700">
                            ✅ Deal received! Analyzing now...
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Screen Content - Confirmation Animation */}
                  <div className={`absolute inset-0 transition-all duration-700 ${
                    activeStep === 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'
                  }`}>
                    <div className="h-full bg-gradient-to-br from-yellow-50 to-white p-6 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-20 h-20 bg-catalyst-gold rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="bg-white rounded-2xl shadow-xl p-6">
                          <h3 className="font-bold text-lg mb-2">Deal Confirmed!</h3>
                          <p className="text-sm text-gray-600 mb-4">
                            AI analysis complete
                          </p>
                          <div className="text-xs text-left space-y-2 bg-gray-50 rounded-lg p-3">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Status:</span>
                              <span className="font-semibold text-green-600">Reviewing</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Est. Value:</span>
                              <span className="font-semibold">$2.5M</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Response:</span>
                              <span className="font-semibold">24-48hrs</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Home Indicator */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/30 rounded-full" />
              </div>

              {/* Floating Elements */}
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-blue-500/10 rounded-2xl backdrop-blur-sm animate-pulse" />
              <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-catalyst-gold/10 rounded-2xl backdrop-blur-sm animate-pulse delay-150" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
