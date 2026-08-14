import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle } from "lucide-react";

interface BrokerFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  marketsCovered: string;
  agreedToTerms: boolean;
  smsConsent: boolean;
}

export default function RegistrationForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [formData, setFormData] = useState<BrokerFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    marketsCovered: "",
    agreedToTerms: false,
    smsConsent: false,
  });

  const registerBrokerMutation = useMutation({
    mutationFn: async (data: Omit<BrokerFormData, "agreedToTerms">) => {
      return await apiRequest("POST", "/api/brokers", data);
    },
    onSuccess: () => {
      setShowSuccessModal(true);
      // Reset form
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        marketsCovered: "",
        agreedToTerms: false,
        smsConsent: false,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/brokers"] });
    },
    onError: (error) => {
      toast({
        title: "Registration Failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.marketsCovered) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.agreedToTerms) {
      toast({
        title: "Terms Required",
        description: "Please agree to the terms and conditions.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.smsConsent) {
      toast({
        title: "SMS Consent Required",
        description: "Please agree to receive text messages by checking the SMS consent box.",
        variant: "destructive",
      });
      return;
    }

    const { agreedToTerms, ...brokerData } = formData;
    registerBrokerMutation.mutate(brokerData);
  };

  const handleChange = (field: keyof BrokerFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <section id="registration" className="py-24 bg-catalyst-gray-900 relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <Card className="shadow-xl">
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="firstName" className="text-sm font-medium text-catalyst-gray-700">
                      First Name *
                    </Label>
                    <Input
                      id="firstName"
                      type="text"
                      required
                      placeholder="John"
                      value={formData.firstName}
                      onChange={(e) => handleChange("firstName", e.target.value)}
                      className="mt-2 border-catalyst-gray-300 focus:ring-catalyst-blue focus:border-catalyst-blue"
                      data-testid="input-first-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="text-sm font-medium text-catalyst-gray-700">
                      Last Name *
                    </Label>
                    <Input
                      id="lastName"
                      type="text"
                      required
                      placeholder="Smith"
                      value={formData.lastName}
                      onChange={(e) => handleChange("lastName", e.target.value)}
                      className="mt-2 border-catalyst-gray-300 focus:ring-catalyst-blue focus:border-catalyst-blue"
                      data-testid="input-last-name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="email" className="text-sm font-medium text-catalyst-gray-700">
                      Email Address *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      className="mt-2 border-catalyst-gray-300 focus:ring-catalyst-blue focus:border-catalyst-blue"
                      data-testid="input-email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-sm font-medium text-catalyst-gray-700">
                      Phone Number *
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      required
                      placeholder="(888) 486-6346"
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      className="mt-2 border-catalyst-gray-300 focus:ring-catalyst-blue focus:border-catalyst-blue"
                      data-testid="input-phone"
                    />
                    <div className="mt-2">
                      <div className="flex items-start space-x-2">
                        <Checkbox 
                          id="sms-consent"
                          checked={formData.smsConsent}
                          onCheckedChange={(checked) => handleChange("smsConsent", checked as boolean)}
                          data-testid="checkbox-sms-consent"
                          className="mt-1"
                        />
                        <Label htmlFor="sms-consent" className="text-xs text-catalyst-gray-600 leading-4">
                          By providing my phone number, I agree to receive periodic, non-promotional text messages from LandLinq. Message and data rates may apply. Reply STOP to opt out. *
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="marketsCovered" className="text-sm font-medium text-catalyst-gray-700">
                    Markets Covered *
                  </Label>
                  <Textarea
                    id="marketsCovered"
                    required
                    rows={3}
                    placeholder="Charlotte, Matthews, Huntersville, Cornelius..."
                    value={formData.marketsCovered}
                    onChange={(e) => handleChange("marketsCovered", e.target.value)}
                    className="mt-2 border-catalyst-gray-300 focus:ring-catalyst-blue focus:border-catalyst-blue"
                    data-testid="textarea-markets-covered"
                  />
                </div>


                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="terms"
                    checked={formData.agreedToTerms}
                    onCheckedChange={(checked) => handleChange("agreedToTerms", checked as boolean)}
                    data-testid="checkbox-terms"
                  />
                  <Label htmlFor="terms" className="text-sm text-catalyst-gray-700">
                    I agree to the terms and conditions and privacy policy *
                  </Label>
                </div>

                <Button
                  type="submit"
                  disabled={registerBrokerMutation.isPending}
                  className="w-full py-2 px-4 text-xs lg:text-sm font-bold uppercase tracking-wider bg-catalyst-gold text-white hover:bg-white hover:text-catalyst-gold border border-catalyst-gold hover:border-catalyst-gold rounded transition-colors"
                  data-testid="button-join-program"
                >
                  {registerBrokerMutation.isPending ? "Joining..." : "Join LandLinq"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center w-16 h-16 bg-catalyst-gold rounded-full mx-auto mb-4">
              <CheckCircle className="text-catalyst-white" size={32} />
            </div>
            <DialogTitle className="text-center text-xl font-semibold text-catalyst-navy">
              Registration Complete!
            </DialogTitle>
          </DialogHeader>
          <div className="text-center">
            <p className="text-catalyst-gray-600 mb-6">
              You'll receive a confirmation email and text message shortly with next steps.
            </p>
            <Button
              onClick={() => setShowSuccessModal(false)}
              className="py-2 px-4 text-xs lg:text-sm font-bold uppercase tracking-wider bg-catalyst-gold text-white hover:bg-white hover:text-catalyst-gold border border-catalyst-gold hover:border-catalyst-gold rounded transition-colors"
              data-testid="button-close-success-modal"
            >
              Got It
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
