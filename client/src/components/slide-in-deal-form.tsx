import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Building2, MapPin, DollarSign, Ruler, CheckCircle2 } from "lucide-react";

interface SlideInDealFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SlideInDealForm({ open, onOpenChange }: SlideInDealFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    address: "",
    sizeAcres: "",
    askingPrice: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    productTypes: [] as string[],
    brokerNotes: ""
  });

  const [showSuccess, setShowSuccess] = useState(false);

  const submitDealMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const nameParts = (data.contactName || '').trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      const response = await fetch('/api/deals/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          address: data.address,
          sizeAcres: data.sizeAcres ? parseFloat(data.sizeAcres) : undefined,
          askingPrice: data.askingPrice ? parseFloat(data.askingPrice) : undefined,
          contactName: data.contactName,
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone,
          productTypes: data.productTypes,
          brokerNotes: data.brokerNotes,
          submissionMethod: "form",
          brokerInfo: {
            firstName,
            lastName,
            email: data.contactEmail,
            phone: data.contactPhone
          }
        })
      });

      const result = await response.json();
      if (!response.ok) {
        if (result.error === 'Validation failed' && result.details) {
          const errorMessages = result.details.map((d: any) => d.message).join(', ');
          throw new Error(errorMessages);
        }
        throw new Error(result.message || result.error || 'Failed to submit deal');
      }
      return result;
    },
    onSuccess: () => {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onOpenChange(false);
        setFormData({
          address: "",
          sizeAcres: "",
          askingPrice: "",
          contactName: "",
          contactEmail: "",
          contactPhone: "",
          productTypes: [],
          brokerNotes: ""
        });
      }, 2500);
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Please try again or contact us directly.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.address || !formData.contactEmail) {
      toast({
        title: "Missing Information",
        description: "Please provide at least an address and email.",
        variant: "destructive"
      });
      return;
    }

    submitDealMutation.mutate(formData);
  };

  const productTypeOptions = [
    "Active Adult",
    "Affordable",
    "Build-to-Rent",
    "Conventional",
    "Lot Development"
  ];

  const handleProductTypeToggle = (type: string) => {
    setFormData(prev => ({
      ...prev,
      productTypes: prev.productTypes.includes(type)
        ? prev.productTypes.filter(t => t !== type)
        : [...prev.productTypes, type]
    }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto">
        {showSuccess ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-[#081729] mb-3">Deal Submitted!</h2>
            <p className="text-lg text-gray-600">
              Thank you! We'll review your submission and get back to you within 24 hours.
            </p>
          </div>
        ) : (
          <>
            <SheetHeader className="mb-6">
              <SheetTitle className="text-2xl font-bold text-[#081729]">
                Submit a Deal
              </SheetTitle>
              <SheetDescription className="text-base">
                Tell us about your property. We'll analyze it and respond within 24 hours.
              </SheetDescription>
            </SheetHeader>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Property Address */}
              <div>
                <Label htmlFor="address" className="text-sm font-semibold text-[#081729] flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-catalyst-gold" />
                  Property Address *
                </Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="123 Main St, Charlotte, NC 28202"
                  required
                  data-testid="input-slide-address"
                  className="border-gray-300"
                />
              </div>

              {/* Size & Price Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="size" className="text-sm font-semibold text-[#081729] flex items-center gap-2 mb-2">
                    <Ruler className="w-4 h-4 text-catalyst-gold" />
                    Size (Acres)
                  </Label>
                  <Input
                    id="size"
                    type="number"
                    step="0.01"
                    value={formData.sizeAcres}
                    onChange={(e) => setFormData({...formData, sizeAcres: e.target.value})}
                    placeholder="5.5"
                    data-testid="input-slide-size"
                    className="border-gray-300"
                  />
                </div>
                <div>
                  <Label htmlFor="price" className="text-sm font-semibold text-[#081729] flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-catalyst-gold" />
                    Asking Price
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    step="1000"
                    value={formData.askingPrice}
                    onChange={(e) => setFormData({...formData, askingPrice: e.target.value})}
                    placeholder="500000"
                    data-testid="input-slide-price"
                    className="border-gray-300"
                  />
                </div>
              </div>

              {/* Product Types */}
              <div>
                <Label className="text-sm font-semibold text-[#081729] flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-catalyst-gold" />
                  Product Types
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {productTypeOptions.map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={`slide-product-${type}`}
                        checked={formData.productTypes.includes(type)}
                        onCheckedChange={() => handleProductTypeToggle(type)}
                        data-testid={`checkbox-slide-product-${type.toLowerCase().replace(/[^a-z]/g, '-')}`}
                      />
                      <label
                        htmlFor={`slide-product-${type}`}
                        className="text-sm text-gray-700 cursor-pointer leading-tight"
                      >
                        {type}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact Information */}
              <div className="border-t pt-5 mt-5">
                <h3 className="text-sm font-semibold text-[#081729] mb-3">Your Contact Information</h3>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="contactName" className="text-sm font-medium text-gray-700">
                      Name
                    </Label>
                    <Input
                      id="contactName"
                      value={formData.contactName}
                      onChange={(e) => setFormData({...formData, contactName: e.target.value})}
                      placeholder="John Smith"
                      data-testid="input-slide-name"
                      className="mt-1 border-gray-300"
                    />
                  </div>

                  <div>
                    <Label htmlFor="contactEmail" className="text-sm font-medium text-gray-700">
                      Email *
                    </Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({...formData, contactEmail: e.target.value})}
                      placeholder="john@example.com"
                      required
                      data-testid="input-slide-email"
                      className="mt-1 border-gray-300"
                    />
                  </div>

                  <div>
                    <Label htmlFor="contactPhone" className="text-sm font-medium text-gray-700">
                      Phone
                    </Label>
                    <Input
                      id="contactPhone"
                      type="tel"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({...formData, contactPhone: e.target.value})}
                      placeholder="(704) 555-1234"
                      data-testid="input-slide-phone"
                      className="mt-1 border-gray-300"
                    />
                  </div>
                </div>
              </div>

              {/* Broker Notes */}
              <div>
                <Label htmlFor="notes" className="text-sm font-medium text-gray-700">
                  Broker Notes
                </Label>
                <Textarea
                  id="notes"
                  value={formData.brokerNotes}
                  onChange={(e) => setFormData({...formData, brokerNotes: e.target.value})}
                  placeholder="Any additional details about the property, zoning, utilities, etc."
                  rows={3}
                  data-testid="textarea-slide-notes"
                  className="mt-1 border-gray-300"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={submitDealMutation.isPending}
                className="w-full bg-catalyst-gold hover:bg-catalyst-gold/90 text-white font-semibold py-6 text-lg"
                data-testid="button-slide-submit"
              >
                {submitDealMutation.isPending ? "Submitting..." : "Submit Deal"}
              </Button>

              <p className="text-xs text-gray-500 text-center">
                By submitting, you agree to our Terms of Service and Privacy Policy
              </p>
            </form>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
