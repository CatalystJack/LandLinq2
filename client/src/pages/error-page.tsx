import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";

export default function ErrorPage() {
  const [countdown, setCountdown] = useState(10);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setLocation('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-white rounded-lg shadow-lg p-8 border border-gray-200">
            <div className="mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
              <p className="text-lg text-gray-700 mb-6 leading-relaxed">
                We apologize, but we are unable to complete your request. 
                We will redirect you to our home page in{" "}
                <span className="font-bold text-catalyst-dark-blue text-2xl">
                  {countdown}
                </span>{" "}
                seconds.
              </p>
              <p className="text-gray-600">
                If you need more help, please email us at{" "}
                <a 
                  href="mailto:help@landlinq.ai"
                  className="text-catalyst-dark-blue hover:text-catalyst-medium-blue font-semibold underline"
                >
                  help@landlinq.ai
                </a>
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setLocation('/')}
                className="bg-catalyst-dark-blue hover:bg-catalyst-medium-blue text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Go Home Now
              </button>
              <button
                onClick={() => window.location.href = 'mailto:help@landlinq.ai'}
                className="bg-white border border-catalyst-dark-blue text-catalyst-dark-blue hover:bg-catalyst-dark-blue hover:text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Contact Support
              </button>
            </div>
          </div>
        </div>
        <Footer />
    </div>
    </div>
  );
}