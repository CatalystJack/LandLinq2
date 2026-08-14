import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { apiRequest } from "@/lib/queryClient";
import type { Deal } from "@shared/schema";
import { format } from "date-fns";
import { formatDateEST } from "@/utils/timezone";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  MapPin, 
  DollarSign, 
  Ruler, 
  Home,
  TrendingUp, 
  Clock, 
  AlertCircle,
  Phone,
  Mail,
  Building,
  Calendar,
  User,
  FileText,
  Zap,
  Target,
  ChevronRight,
  ChevronLeft,
  List,
  Upload,
  Loader2
} from "lucide-react";

interface DealWithBroker extends Deal {
  broker?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    brokerage?: string;
  };
}

export default function DealDetails() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch deal data - Allow public access for shared links
  const {
    data: deal,
    isLoading,
    isError,
    error
  } = useQuery<DealWithBroker>({
    queryKey: ["/api/deals", id],
    enabled: !!id, // Remove authentication requirement for shared links
    retry: 1,
  });

  // Fetch all deals for navigation - Only for authenticated users
  const { data: allDealsResponse } = useQuery<{ deals: Deal[] }>({
    queryKey: ["/api/deals"],
    enabled: !!id && isAuthenticated, // Keep authentication requirement for deal navigation
    retry: 1,
  });

  // Fetch original submission (email/SMS) - Only for authenticated users and non-form submissions
  const { data: originalSubmission } = useQuery<{
    rawText?: string;
    subject?: string;
    message?: string;
    channel?: string;
    email?: string;
    phone?: string;
    createdAt?: string;
  }>({
    queryKey: ["/api/deals", id, "original-email"],
    enabled: !!id && isAuthenticated && !!deal && deal.submissionMethod !== 'form', // Wait for deal load, skip for form submissions
    retry: 1,
  });

  const allDeals = allDealsResponse?.deals || [];
  const currentIndex = allDeals.findIndex(d => d.id === id);
  const previousDeal = currentIndex > 0 ? allDeals[currentIndex - 1] : null;
  const nextDeal = currentIndex < allDeals.length - 1 ? allDeals[currentIndex + 1] : null;

  const handleShareDeal = () => {
    if (!deal) return;
    
    const shareUrl = `${window.location.origin}/deals/${id}`;
    
    // Create formatted email
    const subject = `Investment Opportunity: ${deal.address}`;
    const body = `Hi,

I wanted to share this land development opportunity with you:

📍 Property: ${deal.address}
💰 Price: ${formatPrice(deal.askingPrice)}
📏 Size: ${deal.sizeAcres || 'N/A'} Acres
${deal.classification === 'green' ? '✅ Status: Pursuing' : deal.classification === 'yellow' ? '⏱️ Status: Under Review' : ''}

View full details here:
${shareUrl}

Best regards`;

    // Open email client with pre-filled content
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !id) return;

    setIsUploading(true);
    try {
      const uploadedFilePaths: string[] = [];

      for (const file of Array.from(files)) {
        // Get presigned URL (note: API returns uploadURL, not uploadUrl)
        const response = await apiRequest('/api/deals/upload-url', {
          method: 'POST',
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
          }),
        });

        if (!response.uploadURL || !response.objectPath) {
          throw new Error('Failed to get upload URL');
        }

        // Upload file to presigned URL
        await fetch(response.uploadURL, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });

        uploadedFilePaths.push(response.objectPath);
      }

      // Update deal with new analyst documents
      await apiRequest(`/api/deals/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          analystDocumentUrls: [
            ...((deal as any)?.analystDocumentUrls || []),
            ...uploadedFilePaths,
          ],
        }),
      });

      // Refresh deal data
      queryClient.invalidateQueries({ queryKey: ["/api/deals", id] });

      toast({
        title: "Documents uploaded",
        description: `Successfully uploaded ${files.length} document(s)`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getGoogleMapsUrl = (deal: DealWithBroker) => {
    // Use coordinates if available (more accurate), otherwise use address
    if (deal.latitude && deal.longitude) {
      // Direct coordinates format with exact pin placement at zoom level 17
      return `https://www.google.com/maps?q=${deal.latitude},${deal.longitude}&z=17`;
    } else if (deal.address) {
      const fullAddress = [deal.address, deal.city, deal.state, deal.zip]
        .filter(Boolean)
        .join(', ');
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
    }
    return null;
  };

  const getStatusBadge = (status: string, classification?: string | null) => {
    // Show colored badges with icons for classified deals
    if (classification === "green") {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          <TrendingUp className="mr-1" size={12} />
          Pursuing
        </Badge>
      );
    }
    if (classification === "yellow") {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
          <Clock className="mr-1" size={12} />
          Reviewing
        </Badge>
      );
    }
    if (classification === "red") {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200">
          <AlertCircle className="mr-1" size={12} />
          Passed
        </Badge>
      );
    }
    
    switch (status) {
      case "pending_review":
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            Pending Review
          </Badge>
        );
      case "unclassified":
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            <Clock className="mr-1" size={12} />
            Unclassified
          </Badge>
        );
      case "approved":
      case "high_priority":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <TrendingUp className="mr-1" size={12} />
            Pursuing
          </Badge>
        );
      case "rejected":
      case "clear_no":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <AlertCircle className="mr-1" size={12} />
            Passed
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            Pending
          </Badge>
        );
    }
  };

  const formatPrice = (price?: string | null) => {
    if (!price) return "N/A";
    const num = parseFloat(price.toString());
    if (isNaN(num)) return price;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatProductTypes = (productTypes: any) => {
    if (!productTypes) return "Not specified";
    if (Array.isArray(productTypes)) {
      return productTypes.join(", ");
    }
    return productTypes.toString();
  };

  if (!isAuthenticated) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-catalyst-gray-50 flex items-center justify-center">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
              <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
              <p className="text-catalyst-gray-600 mb-4">
                Please log in to view deal details.
              </p>
              <Button 
                onClick={() => navigate("/auth")}
                className="w-full"
                data-testid="button-login"
              >
                Log In
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-catalyst-gray-50">
          <div className="container mx-auto px-4 py-8">
            <LoadingSkeleton />
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (isError || !deal) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-catalyst-gray-50 flex items-center justify-center">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
              <h2 className="text-xl font-semibold mb-2">Deal Not Found</h2>
              <p className="text-catalyst-gray-600 mb-4">
                The deal you're looking for doesn't exist or you don't have permission to view it.
              </p>
              <Button 
                onClick={() => navigate("/dashboard")}
                variant="outline"
                className="mr-2"
                data-testid="button-back-dashboard"
              >
                <ArrowLeft className="mr-2" size={16} />
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-catalyst-gray-50">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center space-x-2 text-sm text-catalyst-gray-600 mb-6">
            <button
              onClick={() => navigate("/dashboard")}
              className="hover:text-catalyst-navy transition-colors"
              data-testid="link-dashboard"
            >
              Dashboard
            </button>
            <ChevronRight size={16} />
            <span className="text-catalyst-navy font-medium" data-testid="text-deal-address">
              {deal.address || `Deal ${deal.id?.slice(0, 8)}`}
            </span>
          </div>

          {/* Header Section */}
          <div className="bg-white rounded-lg shadow-sm border border-catalyst-gray-200 p-6 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl font-bold text-catalyst-navy" data-testid="text-deal-title">
                    {deal.address || "Property Address Not Available"}
                  </h1>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(deal.status || 'pending_review', deal.classification)}
                    {deal.suggestedDevelopmentType && (
                      <Badge 
                        className="bg-blue-100 text-blue-800 border-blue-200" 
                        data-testid="badge-suggested-development-type"
                      >
                        <Building className="mr-1" size={12} />
                        {deal.suggestedDevelopmentType}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-catalyst-gray-600 mb-4">
                  {deal.dealNumber && (
                    <div className="flex items-center gap-1">
                      <Target size={16} />
                      <span className="font-medium" data-testid="text-deal-number">
                        Deal #{deal.dealNumber}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Calendar size={16} />
                    <span data-testid="text-submitted-date">
                      Submitted {deal.createdAt ? formatDateEST.date(deal.createdAt) : "Unknown"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText size={16} />
                    <span className="font-mono text-xs" data-testid="text-deal-id">
                      ID: {deal.id?.slice(0, 8)}...
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => navigate("/dashboard")}
                    variant="outline"
                    size="sm"
                    data-testid="button-back"
                  >
                    <ArrowLeft className="mr-2" size={16} />
                    Back to Submissions
                  </Button>
                  <Button
                    onClick={handleShareDeal}
                    variant="outline"
                    size="sm"
                    data-testid="button-share"
                  >
                    <Mail className="mr-2" size={16} />
                    Share via Email
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Property Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5" />
                    Property Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-catalyst-gray-600">Address</label>
                      {deal.address && getGoogleMapsUrl(deal) ? (
                        <a
                          href={getGoogleMapsUrl(deal) || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-catalyst-navy font-medium hover:text-blue-600 underline decoration-blue-500 decoration-2 underline-offset-4 transition-colors flex items-center gap-1"
                          data-testid="link-address-google-maps"
                        >
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          {deal.address}
                        </a>
                      ) : (
                        <p className="text-catalyst-navy font-medium" data-testid="text-address">
                          {deal.address || "Not provided"}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-catalyst-gray-600">Property Name</label>
                      <p className="text-catalyst-navy" data-testid="text-property-name">
                        {deal.propertyName || "Not provided"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-catalyst-gray-600">Asking Price</label>
                      <p className="text-catalyst-navy font-semibold" data-testid="text-asking-price">
                        {formatPrice(deal.askingPrice)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-catalyst-gray-600">Size (Acres)</label>
                      <p className="text-catalyst-navy" data-testid="text-size-acres">
                        {deal.sizeAcres || "Not provided"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-catalyst-gray-600">Zoning</label>
                      <p className="text-catalyst-navy" data-testid="text-zoning">
                        {deal.zoning || "Not provided"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-catalyst-gray-600">Proposed Unit Count</label>
                      <p className="text-catalyst-navy" data-testid="text-unit-count">
                        {deal.unitCount || "Not provided"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-catalyst-gray-600">Product Type</label>
                      <p className="text-catalyst-navy" data-testid="text-product-types">
                        {formatProductTypes(deal.productTypes)}
                      </p>
                      {deal.suggestedDevelopmentType && (
                        <div className="mt-2">
                          <label className="text-sm font-medium text-catalyst-gray-600">AI Suggested Type</label>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge 
                              className="bg-blue-100 text-blue-800 border-blue-200" 
                              data-testid="text-ai-suggested-type"
                            >
                              <Zap className="mr-1" size={12} />
                              {deal.suggestedDevelopmentType}
                            </Badge>
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-catalyst-gray-600">Pricing Type</label>
                      <p className="text-catalyst-navy" data-testid="text-pricing-type">
                        {deal.pricingType || "Not specified"}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-catalyst-gray-600">Sewer Available</label>
                      <p className="text-catalyst-navy" data-testid="text-sewer-available">
                        {deal.sewerAvailable ? "Yes" : "No"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-catalyst-gray-600">Entitlements</label>
                      <p className="text-catalyst-navy" data-testid="text-entitlements">
                        {deal.hasEntitlements ? "Yes" : "No"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-catalyst-gray-600">Parcel ID</label>
                      <p className="text-catalyst-navy font-mono text-sm" data-testid="text-parcel-id">
                        {deal.parcelId || "Not provided"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-catalyst-gray-600">Rent Comparable</label>
                      <p className="text-catalyst-navy" data-testid="text-rent-comparable">
                        {deal.topRentPSF ? `$${deal.topRentPSF}/SF` : "Not provided"}
                      </p>
                    </div>
                  </div>

                  {deal.brokerNotes && (
                    <>
                      <Separator />
                      <div>
                        <label className="text-sm font-medium text-catalyst-gray-600">Broker Notes</label>
                        <p className="text-catalyst-navy whitespace-pre-wrap" data-testid="text-broker-notes">
                          {deal.brokerNotes}
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Broker Information */}
              {deal.broker && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Broker Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-catalyst-gray-600">Name</label>
                        <p className="text-catalyst-navy font-medium" data-testid="text-broker-name">
                          {deal.broker.firstName} {deal.broker.lastName}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-catalyst-gray-600">Brokerage</label>
                        <p className="text-catalyst-navy" data-testid="text-broker-brokerage">
                          {deal.broker.brokerage || "Not provided"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {deal.broker.email && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.location.href = `mailto:${deal.broker?.email}`}
                          data-testid="button-email-broker"
                        >
                          <Mail className="mr-2" size={16} />
                          {deal.broker.email}
                        </Button>
                      )}
                      {deal.broker.phone && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.location.href = `tel:${deal.broker?.phone}`}
                          data-testid="button-call-broker"
                        >
                          <Phone className="mr-2" size={16} />
                          {deal.broker.phone}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Status & Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Status & Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-catalyst-gray-600">Current Status</span>
                    {getStatusBadge(deal.status || 'pending_review', deal.classification)}
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-catalyst-gray-600">Submitted</span>
                      <span className="text-catalyst-navy font-medium" data-testid="text-created-date">
                        {deal.createdAt ? formatDateEST.full(deal.createdAt) : "Unknown"}
                      </span>
                    </div>
                    
                    {deal.updatedAt && deal.updatedAt !== deal.createdAt && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-catalyst-gray-600">Last Updated</span>
                        <span className="text-catalyst-navy font-medium" data-testid="text-updated-date">
                          {formatDateEST.full(deal.updatedAt)}
                        </span>
                      </div>
                    )}

                    {deal.submissionMethod && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-catalyst-gray-600">Submission Method</span>
                        <Badge variant="secondary" data-testid="text-submission-method">
                          {deal.submissionMethod}
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Original Submission - Only for Email/SMS submissions */}
              {originalSubmission && (originalSubmission.rawText || originalSubmission.message) && deal?.submissionMethod !== 'form' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Original Submission
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {originalSubmission.subject && (
                      <div>
                        <label className="text-sm font-medium text-catalyst-gray-600">Subject</label>
                        <p className="text-catalyst-navy font-medium" data-testid="text-submission-subject">
                          {originalSubmission.subject}
                        </p>
                      </div>
                    )}
                    {originalSubmission.channel && (
                      <div>
                        <label className="text-sm font-medium text-catalyst-gray-600">Channel</label>
                        <Badge className="ml-2" data-testid="badge-submission-channel">
                          {originalSubmission.channel === 'email' ? 'Email' : originalSubmission.channel === 'sms' ? 'SMS' : originalSubmission.channel}
                        </Badge>
                      </div>
                    )}
                    {(originalSubmission.email || originalSubmission.phone) && (
                      <div>
                        <label className="text-sm font-medium text-catalyst-gray-600">From</label>
                        <p className="text-catalyst-navy" data-testid="text-submission-from">
                          {originalSubmission.email || originalSubmission.phone}
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium text-catalyst-gray-600">Original Message</label>
                      <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700">
                        <p className="text-catalyst-navy whitespace-pre-wrap font-mono text-sm" data-testid="text-submission-content">
                          {originalSubmission.rawText || originalSubmission.message}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Analyst Notes */}
              {deal.analystNotes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Analyst Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-catalyst-navy whitespace-pre-wrap" data-testid="text-analyst-notes">
                      {deal.analystNotes || 'No analyst notes available'}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Developer Notes */}
              {(deal as any).developerNotes && (
                <Card className="border-amber-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-800">
                      <Building className="h-5 w-5 text-amber-600" />
                      Developer Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-catalyst-navy whitespace-pre-wrap" data-testid="text-developer-notes">
                      {(deal as any).developerNotes}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Team Assignments */}
              {(deal.assignedAnalyst || deal.assignedDeveloper || deal.assignedPartner) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Team Assignments
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {deal.assignedAnalyst && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-catalyst-gray-600">Analyst</span>
                        <span className="text-catalyst-navy font-medium" data-testid="text-assigned-analyst">
                          {deal.assignedAnalyst}
                        </span>
                      </div>
                    )}
                    {deal.assignedDeveloper && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-catalyst-gray-600">Developer</span>
                        <span className="text-catalyst-navy font-medium" data-testid="text-assigned-developer">
                          {deal.assignedDeveloper}
                        </span>
                      </div>
                    )}
                    {deal.assignedPartner && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-catalyst-gray-600">Partner</span>
                        <span className="text-catalyst-navy font-medium" data-testid="text-assigned-partner">
                          {deal.assignedPartner}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Documents - Two Column Layout - Always visible for uploads */}
              <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Documents
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Broker Documents Column */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                          Broker Documents ({deal.documentUrls?.length || 0})
                        </h4>
                        {deal.documentUrls && Array.isArray(deal.documentUrls) && deal.documentUrls.length > 0 ? (
                          <div className="space-y-2">
                            {deal.documentUrls.map((doc: any, index: number) => {
                              const fileName = typeof doc === 'string' 
                                ? doc.split('/').pop() || `Document ${index + 1}`
                                : doc.filename || `Document ${index + 1}`;
                              const cleanFileName = fileName.replace(/^\d+-/, '');
                              const downloadUrl = `/api/deals/${id}/document/${index}`;
                              
                              return (
                                <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-100" data-testid={`broker-document-${index}`}>
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                    <span className="text-sm text-gray-900 truncate">{cleanFileName}</span>
                                  </div>
                                  <a
                                    href={downloadUrl}
                                    download={cleanFileName}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium ml-2"
                                    data-testid={`download-broker-document-${index}`}
                                  >
                                    Download
                                  </a>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 italic">No broker documents</p>
                        )}
                      </div>

                      {/* Analyst Documents Column */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                            Analyst Documents ({(deal as any).analystDocumentUrls?.length || 0})
                          </h4>
                          {isAuthenticated && (
                            <div>
                              <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                className="hidden"
                                multiple
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                                data-testid="analyst-document-upload-input"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="text-xs"
                                data-testid="upload-analyst-document-btn"
                              >
                                {isUploading ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Uploading...
                                  </>
                                ) : (
                                  <>
                                    <Upload className="h-3 w-3 mr-1" />
                                    Upload
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                        {(deal as any).analystDocumentUrls && Array.isArray((deal as any).analystDocumentUrls) && (deal as any).analystDocumentUrls.length > 0 ? (
                          <div className="space-y-2">
                            {(deal as any).analystDocumentUrls.map((doc: any, index: number) => {
                              const fileName = typeof doc === 'string' 
                                ? doc.split('/').pop() || `Document ${index + 1}`
                                : doc.filename || `Document ${index + 1}`;
                              const cleanFileName = fileName.replace(/^\d+-/, '');
                              const downloadUrl = `/api/deals/${id}/analyst-document/${index}`;
                              
                              return (
                                <div key={index} className="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-100" data-testid={`analyst-document-${index}`}>
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <FileText className="h-4 w-4 text-green-500 flex-shrink-0" />
                                    <span className="text-sm text-gray-900 truncate">{cleanFileName}</span>
                                  </div>
                                  <a
                                    href={downloadUrl}
                                    download={cleanFileName}
                                    className="text-xs text-green-600 hover:text-green-800 font-medium ml-2"
                                    data-testid={`download-analyst-document-${index}`}
                                  >
                                    Download
                                  </a>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 italic">No analyst documents</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

              {/* Rental Comparables */}
              {(deal.aiAnalysisData && typeof deal.aiAnalysisData === 'object' && deal.aiAnalysisData !== null && 
                'comparable_properties' in deal.aiAnalysisData && 
                Array.isArray(deal.aiAnalysisData.comparable_properties) && 
                deal.aiAnalysisData.comparable_properties.length > 0) ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Rental Comparables
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-catalyst-gray-200">
                            <th className="text-left py-2 px-3 font-medium text-catalyst-gray-600">Address</th>
                            <th className="text-left py-2 px-3 font-medium text-catalyst-gray-600">Year Built</th>
                            <th className="text-left py-2 px-3 font-medium text-catalyst-gray-600">Product Type</th>
                            <th className="text-right py-2 px-3 font-medium text-catalyst-gray-600">Avg Unit Rent</th>
                            <th className="text-right py-2 px-3 font-medium text-catalyst-gray-600">Rent PSF</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(deal.aiAnalysisData as any).comparable_properties.slice(0, 10).map((comp: any, index: number) => (
                            <tr key={index} className="border-b border-catalyst-gray-100">
                              <td className="py-3 px-3 text-catalyst-navy" data-testid={`comp-address-${index}`}>
                                {comp.address || 'Address not available'}
                              </td>
                              <td className="py-3 px-3 text-catalyst-navy" data-testid={`comp-year-${index}`}>
                                {comp.yearBuilt || comp.year_built || 'N/A'}
                              </td>
                              <td className="py-3 px-3 text-catalyst-navy" data-testid={`comp-type-${index}`}>
                                {comp.productType || comp.product_type || comp.propertyType || comp.property_type || 'N/A'}
                              </td>
                              <td className="py-3 px-3 text-right text-catalyst-navy" data-testid={`comp-unit-rent-${index}`}>
                                {comp.averageRent || comp.average_rent ? 
                                  `$${Math.round(comp.averageRent || comp.average_rent).toLocaleString()}` : 
                                  'N/A'
                                }
                              </td>
                              <td className="py-3 px-3 text-right text-catalyst-navy" data-testid={`comp-rent-psf-${index}`}>
                                {(() => {
                                  const rentPSF = comp.rentPerSqFt || comp.rent_per_sqft || comp.rentPerSF;
                                  if (!rentPSF) return 'N/A';
                                  const numValue = Number(rentPSF);
                                  return isNaN(numValue) ? 'N/A' : `$${numValue.toFixed(2)}`;
                                })()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {(deal.aiAnalysisData as any).comparable_properties.length > 10 && (
                      <p className="text-sm text-catalyst-gray-600 mt-3">
                        Showing 10 of {(deal.aiAnalysisData as any).comparable_properties.length} comparable properties
                      </p>
                    )}
                  </CardContent>
                </Card>
              ) : null
              }
            </div>
          </div>
        </div>
      </div>
      
      {/* Deal Navigation */}
      <div className="bg-white border-t border-gray-200 py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Previous Deal */}
            <div className="flex-1">
              {previousDeal ? (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/deals/${previousDeal.id}`)}
                  className="flex items-center gap-2 text-catalyst-navy border-catalyst-navy hover:bg-catalyst-navy hover:text-white"
                  data-testid="button-previous-deal"
                >
                  <ChevronLeft size={16} />
                  <span className="hidden sm:inline">Previous Deal</span>
                  <span className="sm:hidden">Previous</span>
                </Button>
              ) : (
                <div className="flex-1" />
              )}
            </div>

            {/* Back to List & Deal Counter */}
            <div className="flex flex-col items-center gap-2 mx-4">
              <Button
                variant="outline"
                onClick={() => navigate("/analyst")}
                className="flex items-center gap-2 text-catalyst-navy border-catalyst-navy hover:bg-catalyst-navy hover:text-white"
                data-testid="button-back-to-deals"
              >
                <List size={16} />
                <span className="hidden sm:inline">Back to Deals</span>
                <span className="sm:hidden">Deals</span>
              </Button>
              {allDeals.length > 0 && (
                <span className="text-sm text-gray-500" data-testid="text-deal-counter">
                  Deal {currentIndex + 1} of {allDeals.length}
                </span>
              )}
            </div>

            {/* Next Deal */}
            <div className="flex-1 flex justify-end">
              {nextDeal ? (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/deals/${nextDeal.id}`)}
                  className="flex items-center gap-2 text-catalyst-navy border-catalyst-navy hover:bg-catalyst-navy hover:text-white"
                  data-testid="button-next-deal"
                >
                  <span className="hidden sm:inline">Next Deal</span>
                  <span className="sm:hidden">Next</span>
                  <ChevronRight size={16} />
                </Button>
              ) : (
                <div className="flex-1" />
              )}
            </div>
          </div>
        </div>
      </div>
      
      <Footer />
    </>
  );
}