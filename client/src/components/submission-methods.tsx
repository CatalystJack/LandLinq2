import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, MessageSquare, Upload, CheckCircle, Zap, Clock } from "lucide-react";
import { Link } from "wouter";

export default function SubmissionMethods() {
  return (
    <section id="submit-deal" className="py-20 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-[#081729] mb-6 tracking-tight" data-testid="text-submission-title">
            Submit Your Deal
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed" data-testid="text-submission-subtitle">
            We've made it incredibly easy to submit deals—choose the method that works best for you.
          </p>
        </div>

        {/* Why It's Easy - Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 max-w-5xl mx-auto">
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-[#4A90E2]/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-[#4A90E2]" />
            </div>
            <div>
              <h3 className="font-bold text-[#081729] mb-1">Address Only Required</h3>
              <p className="text-sm text-gray-600">
                Just provide the property address. We'll handle the rest with our AI-powered analysis.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-[#4A90E2]/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-[#4A90E2]" />
            </div>
            <div>
              <h3 className="font-bold text-[#081729] mb-1">Instant Confirmation</h3>
              <p className="text-sm text-gray-600">
                Receive immediate confirmation and AI classification the moment you submit.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-[#4A90E2]/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-[#4A90E2]" />
            </div>
            <div>
              <h3 className="font-bold text-[#081729] mb-1">Real-Time Tracking</h3>
              <p className="text-sm text-gray-600">
                Track your submission status and receive updates via your preferred channel.
              </p>
            </div>
          </div>
        </div>

        {/* Submission Methods */}
        <div className="mb-12">
          <h3 className="text-2xl font-bold text-[#081729] text-center mb-8">
            Choose Your Submission Method
          </h3>
          
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Online Form */}
            <Card className="bg-white border-2 border-gray-200 shadow-lg">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-[#4A90E2] rounded-xl flex items-center justify-center mb-6 shadow-md">
                  <Upload className="text-white" size={28} />
                </div>
                <h3 className="text-2xl font-bold text-[#081729] mb-3 tracking-tight">Online Form</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  Complete our simple web form with just the property address (or more!). Upload documents if you have them, or skip and let our AI find the data.
                </p>
                <Link href="/submit-deal" className="w-full">
                  <Button 
                    className="w-full bg-[#4A90E2] hover:bg-white text-white hover:text-[#4A90E2] border-2 border-[#4A90E2] hover:border-[#4A90E2] px-8 py-3 font-semibold rounded-lg transition-all duration-300"
                    data-testid="button-go-to-form"
                  >
                    Go to Form
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Email Submission */}
            <Card className="bg-white border-2 border-gray-200 shadow-lg">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-[#4A90E2] rounded-xl flex items-center justify-center mb-6 shadow-md">
                  <Mail className="text-white" size={28} />
                </div>
                <h3 className="text-2xl font-bold text-[#081729] mb-3 tracking-tight">Email</h3>
                <p className="text-gray-600 mb-4 leading-relaxed">
                  Forward property listings, write a quick note, or paste details. Our AI extracts the information automatically.
                </p>
                <div className="w-full bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-xs text-gray-500 mb-2 font-medium">Send to:</p>
                  <a 
                    href="mailto:deals@catalyst.landlinq.ai" 
                    className="text-lg font-bold text-[#4A90E2] hover:text-[#081729] transition-colors break-all" 
                    data-testid="text-email-address"
                  >
                    deals@catalyst.landlinq.ai
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* SMS Submission */}
            <Card className="bg-white border-2 border-gray-200 shadow-lg">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-[#4A90E2] rounded-xl flex items-center justify-center mb-6 shadow-md">
                  <MessageSquare className="text-white" size={28} />
                </div>
                <h3 className="text-2xl font-bold text-[#081729] mb-3 tracking-tight">SMS</h3>
                <p className="text-gray-600 mb-4 leading-relaxed">
                  Text us the address on the go. No formatting required—just send what you have and we'll process it instantly.
                </p>
                <div className="w-full bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-xs text-gray-500 mb-2 font-medium">Text to:</p>
                  <a 
                    href="sms:7046101549" 
                    className="text-lg font-bold text-[#4A90E2] hover:text-[#081729] transition-colors break-all" 
                    data-testid="text-phone-number"
                  >
                    (704) 610-1549
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
