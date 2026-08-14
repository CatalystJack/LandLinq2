import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Phone } from "lucide-react";
import { getAssetUrl } from "@/lib/asset-manifest";

const landLinqLogo = getAssetUrl("Catalyst:LandLinq_logo_1761758327453.png");

export default function SMSOptIn() {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const optInMutation = useMutation({
    mutationFn: async (data: { phone: string; email: string; name: string }) => {
      return await apiRequest("POST", "/api/sms-opt-in", data);
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "✅ Success!",
        description: "You've been opted into SMS notifications. You'll receive updates about your deals.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to opt-in. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone || !email || !name) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    optInMutation.mutate({ phone, email, name });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full bg-white border-[#4A90E2]">
          <CardContent className="p-12 text-center">
            <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-[#081729] mb-4" data-testid="title-success">
              You're All Set!
            </h1>
            <p className="text-lg text-slate-600 mb-6" data-testid="text-success-message">
              You've successfully opted into SMS notifications. You'll now receive important updates about your property deals via text message.
            </p>
            <div className="bg-[#4A90E2]/10 rounded-lg p-6 mb-6">
              <p className="text-sm text-[#081729] font-medium">
                What's Next?
              </p>
              <p className="text-sm text-slate-600 mt-2">
                Keep an eye on your phone for updates about your submissions. You can opt-out anytime by replying "STOP" to any message.
              </p>
            </div>
            <a href="/" className="inline-block">
              <Button className="bg-[#4A90E2] text-white border-2 border-[#4A90E2] hover:bg-white hover:text-[#4A90E2] transition-colors" data-testid="button-go-home">
                Return to Home
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full bg-white border-[#4A90E2]">
        <CardHeader className="text-center border-b border-slate-200 pb-6">
          <div className="flex justify-center mb-6">
            <img 
              src={landLinqLogo} 
              alt="Catalyst - Powered by LandLinq" 
              className="h-32 w-auto object-contain"
            />
          </div>
          <CardTitle className="text-3xl font-bold text-[#081729] mb-3" data-testid="title-opt-in">
            Stay Updated via SMS
          </CardTitle>
          <CardDescription className="text-base text-slate-600" data-testid="text-description">
            Get instant notifications about your property deals directly to your phone
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-[#081729]">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
                className="border-slate-300 focus:border-[#4A90E2] focus:ring-[#4A90E2]"
                data-testid="input-name"
                required
              />
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-[#081729]">
                Email Address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="border-slate-300 focus:border-[#4A90E2] focus:ring-[#4A90E2]"
                data-testid="input-email"
                required
              />
            </div>

            {/* Phone Field */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium text-[#081729]">
                Phone Number <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="pl-10 border-slate-300 focus:border-[#4A90E2] focus:ring-[#4A90E2]"
                  data-testid="input-phone"
                  required
                />
              </div>
              <p className="text-xs text-slate-500">
                We'll send deal updates and notifications to this number
              </p>
            </div>

            {/* Benefits Section */}
            <div className="bg-slate-50 rounded-lg p-5 border border-slate-200">
              <h3 className="text-sm font-semibold text-[#081729] mb-3">What you'll receive:</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Instant deal submission confirmations</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Real-time status updates on your properties</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Important analyst feedback and requests</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Monthly outreach reminders</span>
                </li>
              </ul>
            </div>

            {/* Privacy Notice */}
            <p className="text-xs text-slate-500 text-center">
              By opting in, you agree to receive SMS notifications from LandLinq. Message and data rates may apply. Reply STOP to opt-out anytime. We respect your privacy and will never share your information.
            </p>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={optInMutation.isPending}
              className="w-full bg-[#4A90E2] text-white border-2 border-[#4A90E2] hover:bg-white hover:text-[#4A90E2] transition-colors h-12 text-base font-semibold"
              data-testid="button-submit"
            >
              {optInMutation.isPending ? "Processing..." : "Opt-In to SMS Notifications"}
            </Button>
          </form>

          {/* Footer Link */}
          <div className="mt-6 text-center">
            <a href="/" className="text-sm text-[#4A90E2] hover:underline" data-testid="link-home">
              ← Back to Home
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
