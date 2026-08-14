import Footer from "@/components/footer";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { 
  Users, 
  Plus, 
  Mail, 
  Building, 
  Phone, 
  CheckCircle, 
  Clock, 
  XCircle,
  Star,
  TrendingUp,
  Award
} from "lucide-react";

interface PreferredPartner {
  id: string;
  partnerEmail: string;
  partnerName: string;
  partnerType: string;
  partnerCompany?: string;
  partnerPhone?: string;
  status: string;
  createdAt: string;
}

interface PartnershipInvitation {
  id: string;
  inviteeEmail: string;
  inviteeName: string;
  inviteeType: string;
  personalMessage?: string;
  status: string;
  createdAt: string;
}

export default function PreferredPartners() {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    partnerName: "",
    partnerEmail: "",
    partnerType: "",
    partnerCompany: "",
    partnerPhone: "",
    personalMessage: "",
  });

  // Fetch preferred partners
  const { data: partners = [], isLoading: partnersLoading } = useQuery({
    queryKey: ["/api/broker/preferred-partners"],
    enabled: isAuthenticated,
  });

  // Fetch partnership invitations sent
  const { data: invitations = [], isLoading: invitationsLoading } = useQuery({
    queryKey: ["/api/broker/partnership-invitations"],
    enabled: isAuthenticated,
  });

  // Fetch partner badges (partnerships where this broker is the partner)
  const { data: partnerBadges = [], isLoading: badgesLoading } = useQuery({
    queryKey: ["/api/broker/partner-badges"],
    enabled: isAuthenticated,
  });

  const addPartnerMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("POST", "/api/preferred-partners", data);
    },
    onSuccess: () => {
      toast({
        title: "Partner Invitation Sent! 🎉",
        description: "Your preferred partner invitation has been sent. You'll earn points when they join!",
      });
      setShowAddForm(false);
      setFormData({
        partnerName: "",
        partnerEmail: "",
        partnerType: "",
        partnerCompany: "",
        partnerPhone: "",
        personalMessage: "",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/broker/preferred-partners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/broker/partnership-invitations"] });
    },
    onError: () => {
      toast({
        title: "Invitation Failed",
        description: "Unable to send partner invitation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.partnerName || !formData.partnerEmail || !formData.partnerType) {
      toast({
        title: "Missing Information",
        description: "Please provide partner name, email, and type.",
        variant: "destructive",
      });
      return;
    }
    addPartnerMutation.mutate(formData);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "accepted":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "declined":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "broker":
        return <Users className="h-4 w-4 text-blue-500" />;
      case "developer":
        return <Building className="h-4 w-4 text-green-500" />;
      case "investor":
        return <TrendingUp className="h-4 w-4 text-purple-500" />;
      default:
        return <Users className="h-4 w-4 text-gray-400" />;
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-catalyst-navy via-slate-900 to-catalyst-navy flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-catalyst-gold mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-catalyst-navy mb-4">Preferred Partners</h2>
            <p className="text-gray-600 mb-6">
              Please log in to manage your preferred partner network.
            </p>
            <Button 
              onClick={() => window.location.href = '/api/login'}
              className="w-full bg-catalyst-gold hover:bg-catalyst-gold/90 text-white"
              data-testid="button-login"
            >
              Sign In to Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-catalyst-navy via-slate-900 to-catalyst-navy py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4 flex items-center justify-center gap-3">
            <Users className="h-10 w-10 text-catalyst-gold" />
            Preferred Partners
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Build your professional network and earn rewards when partners join LandLinq.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white/95 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Partners</p>
                  <p className="text-2xl font-bold text-catalyst-navy">
                    {(partners as PreferredPartner[]).filter((p: PreferredPartner) => p.status === "accepted").length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/95 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Invitations</p>
                  <p className="text-2xl font-bold text-catalyst-navy">
                    {(invitations as PartnershipInvitation[]).filter((i: PartnershipInvitation) => i.status === "sent").length}
                  </p>
                </div>
                <Mail className="h-8 w-8 text-catalyst-gold" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/95 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Partner Badges</p>
                  <p className="text-2xl font-bold text-catalyst-navy">
                    {(partnerBadges as any[]).length}
                  </p>
                </div>
                <Award className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Add Partner Form */}
          <Card className="bg-white/95 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-catalyst-gold to-yellow-600 text-white">
              <CardTitle className="text-xl flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Preferred Partner
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {!showAddForm ? (
                <div className="text-center py-8">
                  <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-600 mb-6">
                    Invite brokers, developers, and investors to join your network.
                  </p>
                  <Button
                    onClick={() => setShowAddForm(true)}
                    className="bg-catalyst-gold hover:bg-catalyst-gold/90 text-white"
                    data-testid="button-add-partner"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Invite Partner
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="partnerName" className="text-sm font-medium">Name *</Label>
                      <Input
                        id="partnerName"
                        value={formData.partnerName}
                        onChange={(e) => setFormData({...formData, partnerName: e.target.value})}
                        placeholder="John Smith"
                        data-testid="input-partner-name"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="partnerEmail" className="text-sm font-medium">Email *</Label>
                      <Input
                        id="partnerEmail"
                        type="email"
                        value={formData.partnerEmail}
                        onChange={(e) => setFormData({...formData, partnerEmail: e.target.value})}
                        placeholder="john@company.com"
                        data-testid="input-partner-email"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="partnerType" className="text-sm font-medium">Type *</Label>
                      <Select onValueChange={(value) => setFormData({...formData, partnerType: value})}>
                        <SelectTrigger data-testid="select-partner-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="broker">Broker</SelectItem>
                          <SelectItem value="developer">Developer</SelectItem>
                          <SelectItem value="investor">Investor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="partnerCompany" className="text-sm font-medium">Company</Label>
                      <Input
                        id="partnerCompany"
                        value={formData.partnerCompany}
                        onChange={(e) => setFormData({...formData, partnerCompany: e.target.value})}
                        placeholder="Company Name"
                        data-testid="input-partner-company"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="partnerPhone" className="text-sm font-medium">Phone</Label>
                    <Input
                      id="partnerPhone"
                      value={formData.partnerPhone}
                      onChange={(e) => setFormData({...formData, partnerPhone: e.target.value})}
                      placeholder="(888) 486-6346"
                      data-testid="input-partner-phone"
                    />
                  </div>

                  <div>
                    <Label htmlFor="personalMessage" className="text-sm font-medium">Personal Message</Label>
                    <Textarea
                      id="personalMessage"
                      value={formData.personalMessage}
                      onChange={(e) => setFormData({...formData, personalMessage: e.target.value})}
                      placeholder="Add a personal note to your invitation..."
                      rows={3}
                      data-testid="input-personal-message"
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddForm(false)}
                      className="flex-1"
                      data-testid="button-cancel-partner"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={addPartnerMutation.isPending}
                      className="flex-1 bg-catalyst-gold hover:bg-catalyst-gold/90 text-white"
                      data-testid="button-submit-partner"
                    >
                      {addPartnerMutation.isPending ? "Sending..." : "Send Invitation"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Partner Status & Badges */}
          <Card className="bg-white/95 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-catalyst-navy to-slate-800 text-white">
              <CardTitle className="text-xl flex items-center gap-2">
                <Award className="h-5 w-5" />
                Your Partner Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {(partnerBadges as any[]).length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-purple-100 to-blue-100 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <Star className="h-8 w-8 text-purple-500" />
                      <div>
                        <h3 className="font-semibold text-purple-900">Preferred Partner</h3>
                        <p className="text-sm text-purple-700">
                          You're a preferred partner of {(partnerBadges as any[]).length} broker{(partnerBadges as any[]).length !== 1 ? 's' : ''}!
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900">Partner Connections:</h4>
                    {(partnerBadges as any[]).slice(0, 3).map((badge: any, index: number) => (
                      <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                        {getTypeIcon(badge.partnerType)}
                        <span className="text-sm text-gray-700">{badge.brokerName || badge.partnerEmail}</span>
                      </div>
                    ))}
                    {(partnerBadges as any[]).length > 3 && (
                      <p className="text-sm text-gray-500">...and {(partnerBadges as any[]).length - 3} more</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Award className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-600">
                    No partner badges yet. When other brokers add you as a preferred partner, you'll see your badges here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Partners & Invitations Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          {/* Active Partners */}
          <Card className="bg-white/95 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Active Partners ({(partners as PreferredPartner[]).filter((p: PreferredPartner) => p.status === "accepted").length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {(partners as PreferredPartner[]).filter((p: PreferredPartner) => p.status === "accepted").length > 0 ? (
                <div className="space-y-3">
                  {(partners as PreferredPartner[])
                    .filter((p: PreferredPartner) => p.status === "accepted")
                    .map((partner: PreferredPartner) => (
                    <div key={partner.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        {getTypeIcon(partner.partnerType)}
                        <div>
                          <h4 className="font-medium text-gray-900">{partner.partnerName}</h4>
                          <p className="text-sm text-gray-600">{partner.partnerEmail}</p>
                          {partner.partnerCompany && (
                            <p className="text-xs text-gray-500">{partner.partnerCompany}</p>
                          )}
                        </div>
                      </div>
                      {getStatusIcon(partner.status)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-600">No active partners yet. Send some invitations!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Invitations */}
          <Card className="bg-white/95 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                Pending Invitations ({(invitations as PartnershipInvitation[]).filter((i: PartnershipInvitation) => i.status === "sent").length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {(invitations as PartnershipInvitation[]).filter((i: PartnershipInvitation) => i.status === "sent").length > 0 ? (
                <div className="space-y-3">
                  {(invitations as PartnershipInvitation[])
                    .filter((i: PartnershipInvitation) => i.status === "sent")
                    .map((invitation: PartnershipInvitation) => (
                    <div key={invitation.id} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        {getTypeIcon(invitation.inviteeType)}
                        <div>
                          <h4 className="font-medium text-gray-900">{invitation.inviteeName}</h4>
                          <p className="text-sm text-gray-600">{invitation.inviteeEmail}</p>
                          <p className="text-xs text-gray-500">
                            Sent {new Date(invitation.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {getStatusIcon(invitation.status)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Mail className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-600">No pending invitations.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
}
