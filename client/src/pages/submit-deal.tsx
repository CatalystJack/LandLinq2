import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import { MobileDealForm } from "@/components/mobile-friendly-forms";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, MessageSquare, Upload } from "lucide-react";
import Footer from "@/components/footer";
import SEO from "@/components/SEO";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getAssetUrl } from "@/lib/asset-manifest";

const mapBackground = getAssetUrl("image_1760625447005.png");

export default function SubmitDeal() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuth();

  // Get current user's broker information if authenticated
  const { data: brokerInfo } = useQuery({
    queryKey: ['/api/broker/profile'],
    enabled: isAuthenticated && !!user,
    retry: 1
  });

  // Submit deal mutation
  const submitDealMutation = useMutation({
    mutationFn: async (data: {
      email?: string;
      phone?: string;
      fullName?: string;
      address?: string;
      zip?: string;
      askingPrice?: string;
      sizeAcres?: string;
      pricingType?: string;
      unitCount?: string;
      entitlements?: string;
      sewerAvailable?: string;
      productTypes?: string[];
      brokerNotes?: string;
      additionalTeamEmails?: string;
      marketsCovered?: string;
      companyName?: string;
      files?: File[];
    }) => {
      // Split full name into first and last name
      const nameParts = data.fullName ? data.fullName.trim().split(' ') : [];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      // Transform the form data to match the backend expectations
      const dealData = {
        // Backend expects contactEmail and contactPhone (NOT brokerId/brokerPhone)
        contactEmail: data.email || (brokerInfo as any)?.email || '',
        contactPhone: data.phone || (brokerInfo as any)?.phone || '',
        contactName: data.fullName || `${(brokerInfo as any)?.firstName || ''} ${(brokerInfo as any)?.lastName || ''}`.trim(),
        
        // Property fields
        address: data.address,
        zip: data.zip,
        askingPrice: data.askingPrice ? parseFloat(data.askingPrice.replace(/[,$]/g, '')) : undefined,
        sizeAcres: data.sizeAcres ? parseFloat(data.sizeAcres) : undefined,
        pricingType: data.pricingType || 'whole_deal',
        unitCount: data.unitCount ? parseInt(data.unitCount) : undefined,
        hasEntitlements: data.entitlements === 'yes' ? true : data.entitlements === 'no' ? false : undefined,
        parcelId: data.parcelId,
        sewerAvailable: data.sewerAvailable === 'yes' ? true : data.sewerAvailable === 'no' ? false : undefined,
        productTypes: data.productTypes || [],
        brokerNotes: data.brokerNotes,
        
        // Additional broker info for team members
        teamMemberEmails: data.additionalTeamEmails ? 
          data.additionalTeamEmails.split(',').map((email: string) => email.trim()).filter(Boolean) : [],
        
        // Store broker info only if new broker (not logged in)
        brokerInfo: !isAuthenticated ? {
          firstName: firstName,
          lastName: lastName,
          email: data.email,
          phone: data.phone,
          marketsCovered: data.marketsCovered,
          companyName: data.companyName
        } : undefined
      };

      // Upload files using presigned URLs if present
      let uploadedFilePaths: string[] = [];
      if (data.files && data.files.length > 0) {
        console.log(`📎 [FILE-UPLOAD] Starting upload for ${data.files.length} files...`);
        console.log(`📎 [FILE-UPLOAD] Files to upload:`, data.files.map(f => ({ name: f.name, size: f.size, type: f.type })));
        
        try {
          const uploadPromises = data.files.map(async (file, index) => {
            console.log(`📎 [FILE-${index}] Requesting presigned URL for: ${file.name}`);
            
            const urlResponse = await fetch('/api/deals/upload-url', {
              method: 'POST',
              credentials: 'include',
            });
            
            console.log(`📎 [FILE-${index}] Upload URL response status: ${urlResponse.status}`);
            
            if (!urlResponse.ok) {
              const errorData = await urlResponse.json().catch(() => ({ error: 'Unknown error' }));
              console.error(`❌ [FILE-${index}] Failed to get upload URL:`, errorData);
              throw new Error(`Failed to get upload URL for ${file.name}: ${errorData.error || 'Unknown error'}`);
            }
            
            const { uploadURL, objectPath } = await urlResponse.json();
            console.log(`📎 [FILE-${index}] Got upload URL, object path: ${objectPath}`);
            console.log(`📎 [FILE-${index}] Uploading to GCS...`);
            
            const uploadResponse = await fetch(uploadURL, {
              method: 'PUT',
              body: file,
              headers: {
                'Content-Type': file.type,
              },
            });
            
            console.log(`📎 [FILE-${index}] GCS upload response status: ${uploadResponse.status}`);
            
            if (!uploadResponse.ok) {
              const errorText = await uploadResponse.text().catch(() => 'Unknown error');
              console.error(`❌ [FILE-${index}] GCS upload failed:`, errorText);
              throw new Error(`Failed to upload ${file.name} to cloud storage (Status: ${uploadResponse.status})`);
            }
            
            console.log(`✅ [FILE-${index}] Successfully uploaded ${file.name} to ${objectPath}`);
            return objectPath;
          });
          
          uploadedFilePaths = await Promise.all(uploadPromises);
          console.log(`✅ [FILE-UPLOAD] All ${uploadedFilePaths.length} files uploaded successfully`);
          console.log(`✅ [FILE-UPLOAD] Object paths:`, uploadedFilePaths);
        } catch (uploadError) {
          console.error('❌ [FILE-UPLOAD] Upload process failed:', uploadError);
          console.error('❌ [FILE-UPLOAD] Error details:', {
            message: uploadError instanceof Error ? uploadError.message : 'Unknown error',
            stack: uploadError instanceof Error ? uploadError.stack : undefined
          });
          throw new Error(`File upload failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
        }
      } else {
        console.log(`📎 [FILE-UPLOAD] No files to upload`);
      }

      // Submit deal with uploaded file paths
      const dealDataWithFiles = {
        ...dealData,
        uploadedFiles: uploadedFilePaths
      };

      const response = await fetch('/api/deals/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(dealDataWithFiles),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to submit deal');
      }

      return result;
    },
    onSuccess: () => {
      // Invalidate broker and deal queries to ensure automatic updates
      queryClient.invalidateQueries({ queryKey: ["/api/brokers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      
      // Show success confirmation
      toast({
        title: "Deal Submitted! 🎉",
        description: "Your property has been submitted successfully. Our team will review it and get back to you soon.",
      });
    },
    onError: (error: Error) => {
      console.error('❌ Deal submission error:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause
      });
      toast({
        title: "Submission Failed",
        description: error.message || "Please check your information and try again",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = async (data: any) => {
    submitDealMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Submit Your Land Deal"
        description="Submit your land deal to LandLinq via web form, email, or SMS. Instant confirmation and expert analysis for multifamily development opportunities. Quick and easy submission process."
        keywords="submit land deal, property submission, broker submission, land deal form, multifamily land opportunities, real estate deal submission"
        url="https://landlinq.ai/submit-deal"
      />
      <Navigation />
      
      {/* Hero Header Section - Enhanced with CTA Design */}
      <section className="relative py-16 sm:py-20 lg:py-24 bg-gradient-to-br from-[#081729] to-[#0a2540] overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        
        {/* Content */}
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight">
            Submit Your Deal
          </h1>
          <p className="text-xl sm:text-2xl text-gray-200 leading-relaxed max-w-3xl mx-auto">
            Multiple ways to get your deals to us quickly and start earning competitive commissions.
          </p>
        </div>

      </section>
      
      {/* Submission Methods Boxes - Email, Online Form, SMS */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Online Form */}
            <Card className="bg-white border-2 border-gray-100 shadow-lg hover:shadow-2xl transition-all duration-300">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-[#4A90E2] rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                  <Upload className="text-white" size={28} />
                </div>
                <h3 className="text-xl font-bold text-[#081729] mb-2 tracking-tight">Online Form</h3>
                <p className="text-gray-600 mb-4 leading-relaxed text-sm">
                  Submit property details via our online form
                </p>
                <Button 
                  onClick={() => document.getElementById('deal-form')?.scrollIntoView({ behavior: 'smooth' })}
                  className="w-full bg-[#4A90E2] hover:bg-white text-white hover:text-[#4A90E2] border-2 border-[#4A90E2] hover:border-[#4A90E2] px-8 py-3 font-semibold rounded-lg transition-all duration-300"
                  data-testid="button-go-to-form"
                >
                  Go to Form
                </Button>
              </CardContent>
            </Card>

            {/* Email Submission */}
            <Card className="bg-white border-2 border-gray-100 shadow-lg hover:shadow-2xl transition-all duration-300">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-[#4A90E2] rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                  <Mail className="text-white" size={28} />
                </div>
                <h3 className="text-xl font-bold text-[#081729] mb-2 tracking-tight">Email</h3>
                <p className="text-gray-600 mb-2 leading-relaxed text-sm">
                  Send deal details to
                </p>
                <a 
                  href="mailto:deals@catalyst.landlinq.ai" 
                  className="text-lg font-semibold text-[#4A90E2] hover:text-[#081729] transition-colors" 
                  data-testid="text-email-address"
                >
                  deals@catalyst.landlinq.ai
                </a>
              </CardContent>
            </Card>

            {/* SMS Submission */}
            <Card className="bg-white border-2 border-gray-100 shadow-lg hover:shadow-2xl transition-all duration-300">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-[#4A90E2] rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                  <MessageSquare className="text-white" size={28} />
                </div>
                <h3 className="text-xl font-bold text-[#081729] mb-2 tracking-tight">SMS</h3>
                <p className="text-gray-600 mb-2 leading-relaxed text-sm">
                  Text property details to
                </p>
                <a 
                  href="tel:7046101549" 
                  className="text-lg font-semibold text-[#4A90E2] hover:text-[#081729] transition-colors" 
                  data-testid="text-phone-number"
                >
                  (704) 610-1549
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      
      {/* Form Section - Matching Process Page Style */}
      <div id="deal-form" className="pt-8 pb-20 bg-gray-50">
        <MobileDealForm 
          onSubmit={handleSubmit} 
          loading={submitDealMutation.isPending}
          initialBrokerData={brokerInfo}
          isAuthenticated={isAuthenticated}
        />
      </div>
      
      <Footer />
    </div>
  );
}
