import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Link,
  Share2,
  DollarSign,
  TrendingUp,
  Award,
  Copy,
  ExternalLink,
  UserPlus,
  Handshake,
  Star,
  Target,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  MousePointer,
  Crown,
  Zap,
  Gift,
  Percent,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Filter,
  Download,
  Mail,
  Phone,
  LinkedinIcon,
  Twitter,
  MessageSquare,
  RefreshCw
} from "lucide-react";

interface ReferralLink {
  id: string;
  referralCode: string;
  linkType: string;
  isActive: boolean;
  clickCount: number;
  conversionCount: number;
  createdAt: string;
  expiresAt?: string;
}

interface ReferralMetrics {
  totalReferrals: number;
  successfulReferrals: number;
  totalCommissionEarned: number;
  totalClicks: number;
  conversionRate: number;
}

interface CommissionSplit {
  id: string;
  dealId: string;
  totalCommission: string;
  primaryBrokerShare: string;
  referrerShare: string;
  splitType: string;
  splitPercentage: string;
  status: string;
  createdAt: string;
}

interface BrokerPartnership {
  id: string;
  brokerAId: string;
  brokerBId: string;
  partnershipType: string;
  status: string;
  commissionSplitPercentage: string;
  totalDealsShared: number;
  totalCommissionShared: string;
  establishedAt: string;
}

export function ReferralDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedLinkType, setSelectedLinkType] = useState("signup");
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showPartnerDialog, setShowPartnerDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch referral data
  const { data: referralLinks = [] } = useQuery({
    queryKey: ["/api/referrals/links"],
  });

  const { data: referralMetrics } = useQuery({
    queryKey: ["/api/referrals/metrics"],
  });

  const { data: commissionSplits = [] } = useQuery({
    queryKey: ["/api/referrals/commissions"],
  });

  const { data: partnerships = [] } = useQuery({
    queryKey: ["/api/referrals/partnerships"],
  });

  // Generate referral link mutation
  const generateLinkMutation = useMutation({
    mutationFn: async (linkType: string) => {
      return await apiRequest(`/api/referrals/generate`, {
        method: "POST",
        body: { linkType }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referrals/links"] });
      setShowGenerateDialog(false);
      toast({
        title: "Referral Link Generated",
        description: "Your new referral link is ready to share!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate referral link. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create partnership mutation
  const createPartnershipMutation = useMutation({
    mutationFn: async (partnerData: any) => {
      return await apiRequest(`/api/referrals/partnerships`, {
        method: "POST",
        body: partnerData
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referrals/partnerships"] });
      setShowPartnerDialog(false);
      toast({
        title: "Partnership Created",
        description: "New broker partnership established successfully!",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Link copied to clipboard",
    });
  };

  const generateReferralUrl = (code: string) => {
    return `${window.location.origin}/signup?ref=${code}`;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-blue-100 text-blue-800", 
      paid: "bg-green-100 text-green-800",
      disputed: "bg-red-100 text-red-800",
      active: "bg-green-100 text-green-800",
      inactive: "bg-gray-100 text-gray-800",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-8">
      {/* Header Section with Key Metrics */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-catalyst-navy">Referral Hub</h1>
          <p className="text-slate-600 mt-1">
            Build your network, earn commissions, and grow with LandLinq
          </p>
        </div>
        
        <div className="flex gap-3">
          <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-catalyst-navy hover:bg-catalyst-navy/90" data-testid="button-generate-link">
                <Link className="h-4 w-4 mr-2" />
                Generate Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Referral Link</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="linkType">Link Type</Label>
                  <Select value={selectedLinkType} onValueChange={setSelectedLinkType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="signup">Broker Signup</SelectItem>
                      <SelectItem value="deal_share">Deal Sharing</SelectItem>
                      <SelectItem value="partner_invite">Partner Invite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={() => generateLinkMutation.mutate(selectedLinkType)}
                  disabled={generateLinkMutation.isPending}
                  className="w-full"
                  data-testid="button-create-referral-link"
                >
                  {generateLinkMutation.isPending ? "Generating..." : "Generate Link"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showPartnerDialog} onOpenChange={setShowPartnerDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-add-partner">
                <Handshake className="h-4 w-4 mr-2" />
                Add Partner
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Partnership</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="partnerEmail">Partner Email</Label>
                  <Input 
                    id="partnerEmail" 
                    placeholder="Enter broker email"
                    data-testid="input-partner-email"
                  />
                </div>
                <div>
                  <Label htmlFor="partnershipType">Partnership Type</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="referral_partner">Referral Partner</SelectItem>
                      <SelectItem value="co_broker">Co-Broker</SelectItem>
                      <SelectItem value="preferred_partner">Preferred Partner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="commissionSplit">Commission Split %</Label>
                  <Input 
                    id="commissionSplit" 
                    type="number" 
                    placeholder="10" 
                    data-testid="input-commission-split"
                  />
                </div>
                <Button 
                  onClick={() => createPartnershipMutation.mutate({})}
                  disabled={createPartnershipMutation.isPending}
                  className="w-full"
                  data-testid="button-create-partnership"
                >
                  {createPartnershipMutation.isPending ? "Creating..." : "Create Partnership"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Key Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">Total Referrals</p>
                <p className="text-2xl font-bold text-catalyst-navy" data-testid="metric-total-referrals">
                  {referralMetrics?.totalReferrals || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">Conversion Rate</p>
                <p className="text-2xl font-bold text-catalyst-navy" data-testid="metric-conversion-rate">
                  {referralMetrics?.conversionRate || 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">Commission Earned</p>
                <p className="text-2xl font-bold text-catalyst-navy" data-testid="metric-commission-earned">
                  ${(referralMetrics?.totalCommissionEarned || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <MousePointer className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">Total Clicks</p>
                <p className="text-2xl font-bold text-catalyst-navy" data-testid="metric-total-clicks">
                  {referralMetrics?.totalClicks || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="links" data-testid="tab-links">
            <Link className="h-4 w-4 mr-2" />
            My Links
          </TabsTrigger>
          <TabsTrigger value="commissions" data-testid="tab-commissions">
            <DollarSign className="h-4 w-4 mr-2" />
            Commissions
          </TabsTrigger>
          <TabsTrigger value="partnerships" data-testid="tab-partnerships">
            <Handshake className="h-4 w-4 mr-2" />
            Partnerships
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Referral Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Click Through Rate</span>
                    <span className="font-semibold">
                      {referralMetrics?.totalClicks ? 
                        ((referralMetrics.successfulReferrals / referralMetrics.totalClicks) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                  <Progress 
                    value={referralMetrics?.totalClicks ? 
                      (referralMetrics.successfulReferrals / referralMetrics.totalClicks) * 100 : 0} 
                    className="h-2"
                  />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Signup Conversion</span>
                    <span className="font-semibold">{referralMetrics?.conversionRate || 0}%</span>
                  </div>
                  <Progress value={referralMetrics?.conversionRate || 0} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Top Links */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-600" />
                  Top Performing Links
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {referralLinks.slice(0, 3).map((link: ReferralLink) => (
                    <div key={link.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{link.linkType.replace('_', ' ')}</p>
                        <p className="text-xs text-slate-500">{link.referralCode}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{link.clickCount} clicks</p>
                        <p className="text-xs text-green-600">{link.conversionCount} conversions</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  variant="outline" 
                  className="h-20 flex-col"
                  onClick={() => setShowGenerateDialog(true)}
                  data-testid="quick-generate-link"
                >
                  <Share2 className="h-6 w-6 mb-2" />
                  Share Deal
                </Button>
                <Button 
                  variant="outline" 
                  className="h-20 flex-col"
                  onClick={() => setShowPartnerDialog(true)}
                  data-testid="quick-invite-broker"
                >
                  <UserPlus className="h-6 w-6 mb-2" />
                  Invite Broker
                </Button>
                <Button 
                  variant="outline" 
                  className="h-20 flex-col"
                  data-testid="quick-view-earnings"
                >
                  <Gift className="h-6 w-6 mb-2" />
                  View Earnings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Links Tab */}
        <TabsContent value="links" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Active Referral Links</CardTitle>
              <p className="text-sm text-slate-600">
                Manage and track your referral links performance
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {referralLinks.map((link: ReferralLink) => (
                  <div key={link.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{link.linkType.replace('_', ' ')}</h4>
                        <p className="text-sm text-slate-500">Code: {link.referralCode}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={link.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                          {link.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-center bg-slate-50 rounded-lg p-3">
                      <div>
                        <p className="text-lg font-bold text-blue-600">{link.clickCount}</p>
                        <p className="text-xs text-slate-600">Clicks</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-green-600">{link.conversionCount}</p>
                        <p className="text-xs text-slate-600">Conversions</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-purple-600">
                          {link.clickCount > 0 ? ((link.conversionCount / link.clickCount) * 100).toFixed(1) : 0}%
                        </p>
                        <p className="text-xs text-slate-600">Rate</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Input 
                        value={generateReferralUrl(link.referralCode)} 
                        readOnly 
                        className="flex-1"
                        data-testid={`link-url-${link.referralCode}`}
                      />
                      <Button 
                        size="sm" 
                        onClick={() => copyToClipboard(generateReferralUrl(link.referralCode))}
                        data-testid={`button-copy-${link.referralCode}`}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" data-testid={`button-share-${link.referralCode}`}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commissions Tab */}
        <TabsContent value="commissions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Commission Splits</CardTitle>
              <p className="text-sm text-slate-600">
                Track your referral commissions and payment status
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {commissionSplits.map((split: CommissionSplit) => (
                  <div key={split.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium">Deal Commission Split</h4>
                        <p className="text-sm text-slate-500">
                          {split.splitType.replace('_', ' ')} • {split.splitPercentage}% split
                        </p>
                      </div>
                      <Badge className={getStatusColor(split.status)}>
                        {split.status}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 bg-slate-50 rounded-lg p-3">
                      <div>
                        <p className="text-sm text-slate-600">Total Commission</p>
                        <p className="font-bold text-catalyst-navy">${parseFloat(split.totalCommission).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Your Share</p>
                        <p className="font-bold text-green-600">${parseFloat(split.referrerShare).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Date</p>
                        <p className="text-sm">{new Date(split.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {commissionSplits.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No commission splits yet</p>
                    <p className="text-sm">Start referring brokers to earn commissions!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Partnerships Tab */}
        <TabsContent value="partnerships" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Broker Partnerships</CardTitle>
              <p className="text-sm text-slate-600">
                Manage your partner broker relationships and collaboration
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {partnerships.map((partnership: BrokerPartnership) => (
                  <div key={partnership.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium">
                          {partnership.partnershipType.replace('_', ' ')}
                        </h4>
                        <p className="text-sm text-slate-500">
                          Established {new Date(partnership.establishedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge className={getStatusColor(partnership.status)}>
                        {partnership.status}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 bg-slate-50 rounded-lg p-3">
                      <div>
                        <p className="text-sm text-slate-600">Commission Split</p>
                        <p className="font-bold text-catalyst-navy">{partnership.commissionSplitPercentage}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Deals Shared</p>
                        <p className="font-bold text-blue-600">{partnership.totalDealsShared}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Total Commission</p>
                        <p className="font-bold text-green-600">
                          ${parseFloat(partnership.totalCommissionShared).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {partnerships.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <Handshake className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No partnerships yet</p>
                    <p className="text-sm">Connect with other brokers to grow your network!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}