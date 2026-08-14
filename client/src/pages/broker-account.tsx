import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { User, Edit3, Save, X, Key, Shield, AlertCircle, CheckCircle } from "lucide-react";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { useLocation } from "wouter";

interface BrokerProfile {
  // User table fields
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  profileImageUrl?: string;
  // Broker table fields
  phone?: string;
  brokerage?: string;
  yearsExperience?: string;
  marketsCovered?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PasswordResetRequest {
  email: string;
}

export default function BrokerAccount() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<BrokerProfile>>({});
  const [passwordResetSent, setPasswordResetSent] = useState(false);

  // Query broker profile
  const {
    data: profile,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery<BrokerProfile>({
    queryKey: ["/api/broker/profile"],
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: isAuthenticated,
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<BrokerProfile>) => {
      return await apiRequest("PUT", "/api/broker/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broker/profile"] });
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
      setIsEditing(false);
      setEditFormData({});
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error?.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  // Password reset mutation
  const passwordResetMutation = useMutation({
    mutationFn: async (data: PasswordResetRequest) => {
      return await apiRequest("POST", "/api/password-reset/request", data);
    },
    onSuccess: () => {
      setPasswordResetSent(true);
      toast({
        title: "Password Reset Sent",
        description: "Check your email for password reset instructions.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Reset Failed",
        description: error?.message || "Failed to send password reset email",
        variant: "destructive",
      });
    },
  });

  // Initialize edit form when profile loads or editing starts
  useEffect(() => {
    if (profile && isEditing) {
      setEditFormData({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        phone: profile.phone || '',
        brokerage: profile.brokerage || '',
        yearsExperience: profile.yearsExperience || '',
        marketsCovered: profile.marketsCovered || [],
      });
    }
  }, [profile, isEditing]);

  // Handle authentication errors
  useEffect(() => {
    if (isError && error) {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Session Expired",
          description: "Please log in again to access your account.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = '/auth';
        }, 2000);
        return;
      }
      
      toast({
        title: "Error Loading Profile",
        description: "Failed to load your profile information. Please try again.",
        variant: "destructive",
      });
    }
  }, [isError, error, toast]);

  const startEditing = () => {
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditFormData({});
  };

  const saveProfile = () => {
    updateProfileMutation.mutate(editFormData);
  };

  const handlePasswordReset = () => {
    if (profile?.email) {
      passwordResetMutation.mutate({ email: profile.email });
    }
  };

  // Show loading state
  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-catalyst-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-catalyst-gold mx-auto"></div>
            <p className="mt-2 text-catalyst-gray-600">Loading...</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // Show error state
  if (isError && error && !error.message?.includes("Failed to fetch")) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-catalyst-gray-50 py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-catalyst-gray-900 mb-4">Account Settings</h1>
              <p className="text-catalyst-navy mb-4">Error loading your profile: {error.message}</p>
              <Button onClick={() => refetch()}>
                Try Again
              </Button>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-catalyst-gray-50">
        <div className="py-16 sm:py-20 lg:py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Page Header */}
            <div className="text-center mb-8 sm:mb-12">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-catalyst-gray-900 mb-4 sm:mb-6 tracking-tight" data-testid="text-account-title">
                Account Settings
              </h1>
              <p className="text-lg sm:text-xl text-catalyst-gray-600 font-light">
                Manage your profile information and account settings
              </p>
            </div>

            {isLoading ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="h-6 bg-catalyst-gray-200 rounded w-1/3 animate-pulse"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="h-4 bg-catalyst-gray-200 rounded w-full animate-pulse"></div>
                      <div className="h-4 bg-catalyst-gray-200 rounded w-2/3 animate-pulse"></div>
                      <div className="h-4 bg-catalyst-gray-200 rounded w-1/2 animate-pulse"></div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : profile ? (
              <div className="space-y-8">
                {/* Profile Information Card */}
                <Card className="border-catalyst-gray-200 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-catalyst-gold rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-catalyst-gray-900">Profile Information</CardTitle>
                        <p className="text-sm text-catalyst-gray-600">Manage your personal and business details</p>
                      </div>
                    </div>
                    {!isEditing && (
                      <Button
                        onClick={startEditing}
                        variant="outline"
                        size="sm"
                        className="border-catalyst-gold text-catalyst-gold hover:bg-catalyst-gold hover:text-white"
                        data-testid="button-edit-profile"
                      >
                        <Edit3 size={14} className="mr-2" />
                        Edit
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {isEditing ? (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="firstName">First Name</Label>
                            <Input
                              id="firstName"
                              value={editFormData.firstName || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                              placeholder="Enter your first name"
                              data-testid="input-first-name"
                            />
                          </div>
                          <div>
                            <Label htmlFor="lastName">Last Name</Label>
                            <Input
                              id="lastName"
                              value={editFormData.lastName || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                              placeholder="Enter your last name"
                              data-testid="input-last-name"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input
                              id="phone"
                              value={editFormData.phone || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                              placeholder="(555) 123-4567"
                              data-testid="input-phone"
                            />
                          </div>
                          <div>
                            <Label htmlFor="yearsExperience">Years of Experience</Label>
                            <Input
                              id="yearsExperience"
                              value={editFormData.yearsExperience || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, yearsExperience: e.target.value })}
                              placeholder="e.g. 5-10 years"
                              data-testid="input-experience"
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="brokerage">Brokerage</Label>
                          <Input
                            id="brokerage"
                            value={editFormData.brokerage || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, brokerage: e.target.value })}
                            placeholder="Enter your brokerage name"
                            data-testid="input-brokerage"
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          <Button
                            onClick={saveProfile}
                            disabled={updateProfileMutation.isPending}
                            className="bg-catalyst-gold hover:bg-catalyst-gold/90 text-white"
                            data-testid="button-save-profile"
                          >
                            <Save size={14} className="mr-2" />
                            {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                          </Button>
                          <Button
                            onClick={cancelEditing}
                            variant="outline"
                            disabled={updateProfileMutation.isPending}
                            data-testid="button-cancel-edit"
                          >
                            <X size={14} className="mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <Label className="text-sm font-medium text-catalyst-gray-600">Name</Label>
                            <p className="text-catalyst-gray-900 font-medium" data-testid="text-profile-name">
                              {profile.firstName && profile.lastName 
                                ? `${profile.firstName} ${profile.lastName}`
                                : "Not provided"
                              }
                            </p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-catalyst-gray-600">Email</Label>
                            <p className="text-catalyst-gray-900 font-medium" data-testid="text-profile-email">
                              {profile.email}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <Label className="text-sm font-medium text-catalyst-gray-600">Phone</Label>
                            <p className="text-catalyst-gray-900" data-testid="text-profile-phone">
                              {profile.phone || "Not provided"}
                            </p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-catalyst-gray-600">Experience</Label>
                            <p className="text-catalyst-gray-900" data-testid="text-profile-experience">
                              {profile.yearsExperience || "Not provided"}
                            </p>
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-catalyst-gray-600">Brokerage</Label>
                          <p className="text-catalyst-gray-900" data-testid="text-profile-brokerage">
                            {profile.brokerage || "Not provided"}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Label className="text-sm font-medium text-catalyst-gray-600">Account Status:</Label>
                          <Badge 
                            className={profile.isActive 
                              ? "bg-green-100 text-green-800 border-green-200" 
                              : "bg-red-100 text-red-800 border-red-200"
                            }
                            data-testid="badge-account-status"
                          >
                            {profile.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Security Settings Card */}
                <Card className="border-catalyst-gray-200 shadow-sm">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-catalyst-navy rounded-full flex items-center justify-center">
                        <Shield className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-catalyst-gray-900">Security Settings</CardTitle>
                        <p className="text-sm text-catalyst-gray-600">Manage your password and account security</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="bg-catalyst-gray-50 p-4 rounded-lg border border-catalyst-gray-200">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <AlertCircle className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-catalyst-gray-900 mb-2">Password Reset Information</h4>
                            <p className="text-sm text-catalyst-gray-600 mb-3">
                              {profile.email.includes('@catalystcp.com') 
                                ? "Your account uses Replit authentication. To reset your password, you'll need to use Replit's password reset system."
                                : "You can reset your password using the button below. A reset link will be sent to your email address."
                              }
                            </p>
                            {profile.email.includes('@catalystcp.com') ? (
                              <div className="space-y-3">
                                <p className="text-sm font-medium text-catalyst-gray-700">To reset your Replit password:</p>
                                <ol className="text-sm text-catalyst-gray-600 space-y-1 ml-4">
                                  <li>1. Sign out of LandLinq</li>
                                  <li>2. Go to <a href="https://replit.com" className="text-catalyst-gold hover:underline" target="_blank" rel="noopener noreferrer">replit.com</a></li>
                                  <li>3. Click "Forgot Password?" on Replit's login page</li>
                                  <li>4. Enter your email and follow the instructions</li>
                                  <li>5. Return to LandLinq and sign in with your new password</li>
                                </ol>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <Button
                                  onClick={handlePasswordReset}
                                  disabled={passwordResetMutation.isPending || passwordResetSent}
                                  className="bg-catalyst-navy hover:bg-catalyst-navy/90 text-white"
                                  data-testid="button-password-reset"
                                >
                                  <Key size={14} className="mr-2" />
                                  {passwordResetMutation.isPending 
                                    ? "Sending..." 
                                    : passwordResetSent 
                                      ? "Reset Email Sent" 
                                      : "Reset Password"
                                  }
                                </Button>
                                {passwordResetSent && (
                                  <div className="flex items-center gap-2 text-green-600">
                                    <CheckCircle size={16} />
                                    <span className="text-sm">Check your email</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <Label className="text-sm font-medium text-catalyst-gray-600">Account Type</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className="bg-catalyst-gold text-white">
                            {profile.role === 'BROKER' ? 'Broker Account' : profile.role}
                          </Badge>
                          <span className="text-sm text-catalyst-gray-600">
                            • Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="max-w-2xl mx-auto text-center border-catalyst-gray-200">
                <CardContent className="p-12">
                  <div className="mb-6">
                    <div className="w-24 h-24 bg-catalyst-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <User className="w-12 h-12 text-catalyst-gray-400" />
                    </div>
                    <h3 className="text-2xl font-semibold text-catalyst-gray-900 mb-4 tracking-tight">Profile Not Found</h3>
                    <p className="text-catalyst-gray-600 leading-relaxed">
                      We couldn't load your profile information. This might be a temporary issue.
                    </p>
                  </div>
                  <Button onClick={() => refetch()}>
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        <Footer />
    </div>
    </>
  );
}