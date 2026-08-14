import { useState, useEffect, useMemo, Suspense, lazy } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Template editing functionality is now inline within this component
import { 
  Search, 
  Plus, 
  Send, 
  Settings, 
  Edit, 
  Trash2, 
  Archive,
  Mail, 
  MessageSquare, 
  Calendar, 
  Clock, 
  Users, 
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Activity,
  BarChart3,
  Eye,
  Timer,
  Zap,
  Globe,
  Save,
  X,
  RefreshCw
} from "lucide-react";
import Footer from "@/components/footer";
import Navigation from "@/components/navigation";
import { formatDateEST } from "@/utils/timezone";
import type { OutreachCampaign, OutreachRun, OutreachMessage } from "@shared/schema";

interface CampaignFormData {
  name: string;
  status: "active" | "paused";
  cadence: string;
  scheduleWeek: string; // Options: "1st_monday" | "3rd_monday"
  sendHourUtc: number;
  channels: string[];
  emailTemplateKey: string;
  smsTemplateKey: string;
  brokerFilter: Record<string, any>;
  rateLimitPerMinute: number;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  html?: string; // CRITICAL: Preserve HTML field when saving templates
  event: 'broker_registered' | 'deal_submitted' | 'sms_opt_in' | 'sms_unsubscribe' | 'info_missing' | 'info_missing_address' | 'info_missing_acreage' | 'info_missing_price' | 'info_missing_both' | 'info_missing_all_vital' | 'info_uncertain_details' | 'status_under_review' | 'status_pursuing' | 'status_rejected' | 'loi_sent' | 'info_missing_reminder' | 'monthly_broker_outreach' | 'password_reset' | 'weekly_report';
  backgroundColor?: string;
  textColor?: string;
  headerColor?: string;
  buttonColor?: string;
  fontSize?: string;
  fontFamily?: string;
  logoUrl?: string;
  // SendGrid integration - auto-detection based on sendgridTemplateId
  templateSource?: 'outreach' | 'sendgrid'; // DEPRECATED - kept for backward compatibility
  sendgridTemplateId?: string; // If provided, uses SendGrid; if empty, uses Outreach Tab
}

interface SmsTemplate {
  id: string;
  name: string;
  content: string;
  event: 'broker_registered' | 'deal_submitted' | 'sms_opt_in' | 'sms_unsubscribe' | 'info_missing' | 'info_missing_address' | 'info_missing_acreage' | 'info_missing_price' | 'info_missing_both' | 'info_missing_all_vital' | 'info_uncertain_details' | 'status_under_review' | 'status_pursuing' | 'status_rejected' | 'info_missing_reminder' | 'monthly_broker_outreach' | 'password_reset' | 'weekly_report';
}

interface CampaignStats {
  totalRuns: number;
  lastRunDate: string | null;
  totalSent: number;
  successRate: number;
  emailSent: number;
  smsSent: number;
  failures: number;
}

interface SchedulerStatus {
  isActive: boolean;
  nextRunTime: string | null;
  lastRunTime: string | null;
  status: string;
  uptime: number;
  processedToday: number;
}

// Dec 12, 2025: Master Outreach Toggle Component
function MasterOutreachToggle() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: masterToggle, isLoading } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/outreach/master-toggle"]
  });
  
  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await apiRequest("PATCH", "/api/outreach/master-toggle", { enabled });
      return response;
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["/api/outreach/master-toggle"] });
      toast({
        title: enabled ? "Messaging ON" : "Messaging OFF",
        description: enabled 
          ? "All emails and SMS/texts are now active" 
          : "All messaging has been turned off - no emails or texts will be sent",
        variant: enabled ? "default" : "destructive"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update outreach status",
        variant: "destructive"
      });
    }
  });
  
  const isEnabled = masterToggle?.enabled !== false;
  
  return (
    <Card className={`border-2 ${isEnabled ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20'}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className={`h-5 w-5 ${isEnabled ? 'text-green-600' : 'text-red-600'}`} />
              <h3 className="text-lg font-semibold">Master Messaging</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {isEnabled 
                ? "All messaging is ACTIVE. Emails and SMS/texts will be sent normally." 
                : "All messaging is OFF. No emails or SMS/texts will be sent to anyone."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${isEnabled ? 'text-green-600' : 'text-red-600'}`}>
              {isEnabled ? 'ON' : 'OFF'}
            </span>
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) => toggleMutation.mutate(checked)}
              disabled={isLoading || toggleMutation.isPending}
              data-testid="master-messaging-toggle"
              className="data-[state=checked]:bg-green-600"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OutreachManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateCampaignOpen, setIsCreateCampaignOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<OutreachCampaign | null>(null);
  const [selectedCampaignStats, setSelectedCampaignStats] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("campaigns");
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplate[]>([]);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  
  // MSA Management state
  const [editingMSA, setEditingMSA] = useState<string | null>(null);
  const [msaEditData, setMSAEditData] = useState<any>({});
  const [showMSAForm, setShowMSAForm] = useState(false);
  
  // MSA Filtering state
  const [msaSearchTerm, setMsaSearchTerm] = useState("");
  const [msaProductFilter, setMsaProductFilter] = useState("all");
  const [msaStateFilter, setMsaStateFilter] = useState("all");
  const [msaActiveFilter, setMsaActiveFilter] = useState("all");
  const [newMSAData, setNewMSAData] = useState({
    msaName: "",
    county: "",
    state: "",
    fullCountyName: "",
    cityNote: "",
    productTypes: [] as string[],
    isActive: true,
    notes: ""
  });

  // Branding settings state
  const [brandingSettings, setBrandingSettings] = useState({
    logoUrl: '',
    companyName: 'LandLinq',
    tagline: 'Professional Land Acquisition Platform',
    supportEmail: 'catalyst@landlinq.ai',
    supportPhone: '(704) 610-1549',
    primaryColor: '#081729',
    secondaryColor: '#4A90E2',
    tertiaryColor: '#d4af37',
    backgroundColor: '#ffffff',
    fontFamily: 'system',
    fontSize: '14px',
    buttonStyle: 'rounded',
    emailWidth: '600px',
    emailSignature: `Best regards,\nLandLinq Team\nCatalyst Capital Partners\n\n📧 catalyst@landlinq.ai | 📱 (704) 610-1549\n🌐 https://landlinq.ai`
  });

  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<{subject: string, content: string, html: string} | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isTestEmailDialogOpen, setIsTestEmailDialogOpen] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');

  // Helper functions to handle escaped newlines in template content
  const convertEscapedNewlines = (content: string): string => {
    return content.replace(/\\n/g, '\n');
  };

  const convertNewlinesToEscaped = (content: string): string => {
    return content.replace(/\n/g, '\\n');
  };
  const [justSavedTemplateId, setJustSavedTemplateId] = useState<string | null>(null);
  
  // Dirty state tracking
  const [originalEmailTemplates, setOriginalEmailTemplates] = useState<EmailTemplate[]>([]);
  const [originalSmsTemplates, setOriginalSmsTemplates] = useState<SmsTemplate[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [campaignFormData, setCampaignFormData] = useState<CampaignFormData>({
    name: "",
    status: "active",
    cadence: "monthly",
    scheduleWeek: "1st_monday",
    sendHourUtc: 14,
    channels: ["email"],
    emailTemplateKey: "monthlyOutreachReminder",
    smsTemplateKey: "monthlyOutreachReminder",
    brokerFilter: {},
    rateLimitPerMinute: 10
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Refresh YOC state
  const [yocRefreshing, setYocRefreshing] = useState(false);

  // QCT + OZ state
  const [qctOzRunning, setQctOzRunning] = useState(false);
  const [qctOzResult, setQctOzResult] = useState<string | null>(null);

  const handleRefreshYoc = async () => {
    setYocRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
    setTimeout(() => setYocRefreshing(false), 2000);
  };

  const backfillQctOzMutation = useMutation({
    mutationFn: async () => {
      setQctOzRunning(true);
      setQctOzResult(null);
      const qctData = await apiRequest("POST", "/api/admin/backfill-qct-status", {}).then(r => r.json());
      const ozData = await apiRequest("POST", "/api/admin/backfill-oz-status", {}).then(r => r.json());
      return { qct: qctData, oz: ozData };
    },
    onSuccess: (data: any) => {
      setQctOzRunning(false);
      const msg = `QCT: ${data?.qct?.message || 'done'} | OZ: ${data?.oz?.message || 'done'}`;
      setQctOzResult(msg);
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      setTimeout(() => setQctOzResult(null), 8000);
    },
    onError: (err: any) => {
      setQctOzRunning(false);
      const msg = err?.message ? `Backfill failed: ${err.message}` : 'Backfill failed — check console';
      setQctOzResult(msg);
      setTimeout(() => setQctOzResult(null), 8000);
    },
  });

  // Save templates mutation
  const saveTemplatesMutation = useMutation({
    mutationFn: async ({ emailTemplates: emailTemplatesToSave, smsTemplates: smsTemplatesToSave }: { emailTemplates: EmailTemplate[], smsTemplates: SmsTemplate[] }) => {
      // Denormalize event values before sending to backend
      const denormalizedEmailTemplates = emailTemplatesToSave.map(t => ({
        ...t,
        event: denormalizeEventValue(t.event)
      }));
      const denormalizedSmsTemplates = smsTemplatesToSave.map(t => ({
        ...t,
        event: denormalizeEventValue(t.event)
      }));
      
      const result = await apiRequest("PUT", "/api/settings", {
        emailTemplates: denormalizedEmailTemplates,
        smsTemplates: denormalizedSmsTemplates,
      });
      
      return { result, emailTemplates: emailTemplatesToSave, smsTemplates: smsTemplatesToSave };
    },
    onSuccess: ({ result, emailTemplates: savedEmailTemplates, smsTemplates: savedSmsTemplates }) => {
      // Update last saved timestamp
      setLastSavedAt(new Date());
      
      // Reset original state to current state (no longer dirty)
      setOriginalEmailTemplates([...savedEmailTemplates]);
      setOriginalSmsTemplates([...savedSmsTemplates]);
      
      // Update the cache with the denormalized templates (what we just saved)
      const denormalizedEmailTemplates = savedEmailTemplates.map(t => ({
        ...t,
        event: denormalizeEventValue(t.event)
      }));
      const denormalizedSmsTemplates = savedSmsTemplates.map(t => ({
        ...t,
        event: denormalizeEventValue(t.event)
      }));
      
      queryClient.setQueryData(["/api/settings"], (prev: any) => ({ 
        ...prev, 
        emailTemplates: denormalizedEmailTemplates, 
        smsTemplates: denormalizedSmsTemplates 
      }));
      
      // Don't invalidate immediately - let the user see their changes
      // Instead, invalidate after a short delay
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      }, 1000);
      
      toast({
        title: "All templates saved successfully ✓",
        description: `Email and SMS templates updated at ${new Date().toLocaleTimeString()}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Save branding settings mutation
  const saveBrandingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PUT", "/api/branding", brandingSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branding"] });
      toast({
        title: "Branding settings saved",
        description: "Your branding settings have been updated successfully."
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error saving branding settings",
        description: error.message
      });
    }
  });

  // Send test email mutation
  const sendTestEmailMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/test-email", {
        email: testEmailAddress,
        brandingSettings
      });
    },
    onSuccess: () => {
      toast({
        title: "Test email sent",
        description: `Test email sent successfully to ${testEmailAddress}`
      });
      setIsTestEmailDialogOpen(false);
      setTestEmailAddress('');
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error sending test email",
        description: error.message
      });
    }
  });

  // MSA Management mutations
  const createMSAMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/msa/markets", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/msa/markets"] });
      toast({
        title: "MSA Market created",
        description: "New acquisition market added successfully"
      });
      setShowMSAForm(false);
      setNewMSAData({
        msaName: "",
        county: "",
        state: "",
        fullCountyName: "",
        cityNote: "",
        productTypes: [],
        isActive: true,
        notes: ""
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error creating MSA market",
        description: error.message
      });
    }
  });

  const updateMSAMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest("PUT", `/api/msa/markets/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/msa/markets"] });
      toast({
        title: "MSA Market updated",
        description: "Changes saved successfully"
      });
      setEditingMSA(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error updating MSA market",
        description: error.message
      });
    }
  });

  const deleteMSAMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/msa/markets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/msa/markets"] });
      toast({
        title: "MSA Market deleted",
        description: "Acquisition market removed successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error deleting MSA market",
        description: error.message
      });
    }
  });

  // Sync MSA data from seed file
  const syncMSAMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/seed/msa-markets`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/msa/markets"] });
      toast({
        title: "MSA Data Synced",
        description: data?.message || "Markets have been synced from seed file",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: error.message,
      });
    },
  });

  // MSA Management helper functions
  const handleMSACreate = () => {
    if (!newMSAData.msaName || !newMSAData.county || !newMSAData.state || newMSAData.productTypes.length === 0) {
      toast({
        variant: "destructive",
        title: "Missing required fields",
        description: "Please fill in MSA name, county, state, and select at least one product type"
      });
      return;
    }
    createMSAMutation.mutate(newMSAData);
  };

  const handleMSAUpdate = (id: string) => {
    updateMSAMutation.mutate({ id, data: msaEditData });
  };

  const handleMSADelete = (id: string, msaName: string) => {
    if (confirm(`Are you sure you want to delete ${msaName}? This action cannot be undone.`)) {
      deleteMSAMutation.mutate(id);
    }
  };

  const toggleMSAProductType = (marketId: string, productType: string) => {
    const currentTypes = msaEditData.productTypes || [];
    const updated = currentTypes.includes(productType)
      ? currentTypes.filter((t: string) => t !== productType)
      : [...currentTypes, productType];
    setMSAEditData({ ...msaEditData, productTypes: updated });
  };

  const toggleNewMSAProductType = (productType: string) => {
    const updated = newMSAData.productTypes.includes(productType)
      ? newMSAData.productTypes.filter(t => t !== productType)
      : [...newMSAData.productTypes, productType];
    setNewMSAData({ ...newMSAData, productTypes: updated });
  };

  const startMSAEdit = (market: any) => {
    setEditingMSA(market.id);
    setMSAEditData({
      msaName: market.msaName,
      county: market.county,
      state: market.state,
      fullCountyName: market.fullCountyName || "",
      cityNote: market.cityNote || "",
      productTypes: market.productTypes || [],
      isActive: market.isActive !== false,
      notes: market.notes || ""
    });
  };

  // Save function for templates
  const handleSaveTemplates = async (templateId?: string, customEmailTemplates?: EmailTemplate[], customSmsTemplates?: SmsTemplate[]) => {
    try {
      const templatesToSave = customEmailTemplates || emailTemplates;
      
      // Validate: If sendgridTemplateId has been started (not null/undefined) but is empty, show error
      const invalidTemplates = templatesToSave.filter(
        (t: any) => t.sendgridTemplateId !== undefined && 
                    t.sendgridTemplateId !== null && 
                    t.sendgridTemplateId.trim() !== '' && 
                    !t.sendgridTemplateId.startsWith('d-')
      );
      
      if (invalidTemplates.length > 0) {
        const templateNames = invalidTemplates.map((t: any) => t.name).join(', ');
        toast({
          title: "Invalid Template ID",
          description: `SendGrid template IDs must start with "d-": ${templateNames}`,
          variant: "destructive"
        });
        return;
      }
      
      await saveTemplatesMutation.mutateAsync({
        emailTemplates: templatesToSave,
        smsTemplates: customSmsTemplates || smsTemplates
      });
      
      // Show "just saved" state for the specific template
      if (templateId) {
        setJustSavedTemplateId(templateId);
        
        // Clear the "just saved" state and exit edit mode after 2 seconds
        setTimeout(() => {
          setJustSavedTemplateId(null);
          setEditingTemplateId(null);
        }, 2000);
      } else {
        // Exit edit mode immediately for global save
        setEditingTemplateId(null);
      }
    } catch (error) {
      // Error handling is done by the mutation
    }
  };

  // Fetch all campaigns
  const { data: campaignsData, isLoading: campaignsLoading, error: campaignsError } = useQuery({
    queryKey: ["/api/outreach/campaigns"]
  });

  // Fetch campaign runs
  const { data: runsData } = useQuery({
    queryKey: ["/api/outreach/runs"]
  });

  // Fetch scheduler status
  const { data: schedulerStatus } = useQuery({
    queryKey: ["/api/outreach/scheduler/status"],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch campaign statistics
  const { data: campaignStatsData } = useQuery({
    queryKey: ["/api/outreach/campaigns", selectedCampaignStats, "stats"],
    enabled: !!selectedCampaignStats
  });

  // Fetch settings for templates
  const { data: settingsData } = useQuery({
    queryKey: ["/api/settings"]
  });

  // Fetch MSA markets
  const { data: msaData, isLoading: msaLoading } = useQuery<{ success: boolean; markets: any[] }>({
    queryKey: ["/api/msa/markets"]
  });

  const msaMarkets = msaData?.markets || [];
  
  // Filter MSA markets based on search and filter criteria
  const filteredMSAMarkets = useMemo(() => {
    return msaMarkets.filter((market: any) => {
      // Search filter
      if (msaSearchTerm) {
        const searchLower = msaSearchTerm.toLowerCase();
        const matchesSearch = 
          market.msaName?.toLowerCase().includes(searchLower) ||
          market.county?.toLowerCase().includes(searchLower) ||
          market.state?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }
      
      // Product type filter
      if (msaProductFilter !== "all") {
        if (!market.productTypes?.includes(msaProductFilter)) return false;
      }
      
      // State filter
      if (msaStateFilter !== "all") {
        if (market.state !== msaStateFilter) return false;
      }
      
      // Active status filter
      if (msaActiveFilter === "active") {
        if (!market.isActive) return false;
      } else if (msaActiveFilter === "inactive") {
        if (market.isActive) return false;
      }
      
      return true;
    });
  }, [msaMarkets, msaSearchTerm, msaProductFilter, msaStateFilter, msaActiveFilter]);
  
  // Get unique states for filter dropdown
  const uniqueStates = useMemo(() => {
    const states = new Set(msaMarkets.map((m: any) => m.state).filter(Boolean));
    return Array.from(states).sort();
  }, [msaMarkets]);

  // Product type options for MSA management
  const productTypeOptions = ["Active Adult", "Affordable Housing", "BTR", "Conventional Apartments", "Lot Development", "Mixed Use"];

  // Normalize template event values - fix mismatch between backend and frontend
  const normalizeEventValue = (event: string): EmailTemplate['event'] | SmsTemplate['event'] => {
    if (event === 'monthlyOutreachReminder') return 'monthly_broker_outreach';
    return event as EmailTemplate['event'] | SmsTemplate['event'];
  };

  // Denormalize template event values - convert UI values back to backend format
  const denormalizeEventValue = (event: string): string => {
    if (event === 'monthly_broker_outreach') return 'monthlyOutreachReminder';
    return event;
  };

  // Branding settings handlers
  const updateBrandingSetting = (key: string, value: string) => {
    setBrandingSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveBrandingSettings = async () => {
    try {
      await saveBrandingMutation.mutateAsync();
    } catch (error) {
      console.error('Failed to save branding settings:', error);
    }
  };

  const handlePreviewEmail = async () => {
    setIsLoadingPreview(true);
    try {
      const response = await fetch("/api/template/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ eventType: "deal_submitted" }) // Use a sample template
      });
      
      if (response.ok) {
        const templateData = await response.json();
        setPreviewTemplate(templateData);
      } else {
        toast({
          title: "Error",
          description: "Failed to load template preview",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error loading template preview:", error);
      toast({
        title: "Error",
        description: "Failed to load template preview",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPreview(false);
      setIsPreviewDialogOpen(true);
    }
  };

  const handleSendTestEmail = () => {
    setIsTestEmailDialogOpen(true);
  };

  const handleSubmitTestEmail = async () => {
    if (!testEmailAddress) {
      toast({
        variant: "destructive",
        title: "Email required",
        description: "Please enter an email address to send the test email to."
      });
      return;
    }
    
    try {
      await sendTestEmailMutation.mutateAsync();
    } catch (error) {
      console.error('Failed to send test email:', error);
    }
  };

  // Check if templates have changes (dirty state)
  const areEmailTemplatesDirty = JSON.stringify(emailTemplates) !== JSON.stringify(originalEmailTemplates);
  const areSmsTemplatesDirty = JSON.stringify(smsTemplates) !== JSON.stringify(originalSmsTemplates);
  const hasUnsavedChanges = areEmailTemplatesDirty || areSmsTemplatesDirty;

  // Update template state when settings data changes (properly sync with useEffect)
  useEffect(() => {
    if (!settingsData) return;
    
    // Only update state if we're not currently editing AND if the data actually changed
    if (editingTemplateId || justSavedTemplateId) return;
    
    const emails = Array.isArray((settingsData as any).emailTemplates) ? 
      (settingsData as any).emailTemplates.map((t: any) => ({
        ...t,
        event: normalizeEventValue(t.event)
      })) : [];
    const sms = Array.isArray((settingsData as any).smsTemplates) ? 
      (settingsData as any).smsTemplates.map((t: any) => ({
        ...t,
        event: normalizeEventValue(t.event)
      })) : [];
    
    // Only update if the data has actually changed to prevent unnecessary resets
    const emailsChanged = JSON.stringify(emails) !== JSON.stringify(emailTemplates);
    const smsChanged = JSON.stringify(sms) !== JSON.stringify(smsTemplates);
    
    if (emailsChanged || smsChanged) {
      setEmailTemplates(emails);
      setSmsTemplates(sms);
      // Set original state for dirty tracking
      setOriginalEmailTemplates(emails);
      setOriginalSmsTemplates(sms);
    }
  }, [settingsData]);

  // Fetch existing branding settings
  const { data: existingBrandingSettings } = useQuery({
    queryKey: ["/api/branding"]
  });

  // Update branding settings when data is loaded
  useEffect(() => {
    if (existingBrandingSettings) {
      setBrandingSettings(existingBrandingSettings);
    }
  }, [existingBrandingSettings]);

  // Template change handlers
  const handleEmailTemplatesChange = (templates: EmailTemplate[]) => {
    setEmailTemplates(templates);
  };

  const handleSmsTemplatesChange = (templates: SmsTemplate[]) => {
    setSmsTemplates(templates);
  };

  const campaigns = (campaignsData as any)?.campaigns || [];
  const runs = (runsData as any)?.runs || [];

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign: OutreachCampaign) => {
      const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || campaign.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [campaigns, searchTerm, statusFilter]);

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: async (formData: CampaignFormData) => {
      return await apiRequest("POST", "/api/outreach/campaigns", formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/outreach/campaigns"] });
      setIsCreateCampaignOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Campaign created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update campaign mutation
  const updateCampaignMutation = useMutation({
    mutationFn: async (formData: CampaignFormData & { id: string }) => {
      const { id, ...updateData } = formData;
      return await apiRequest("PATCH", `/api/outreach/campaigns/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/outreach/campaigns"] });
      setEditingCampaign(null);
      resetForm();
      toast({
        title: "Success",
        description: "Campaign updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Archive campaign mutation (SAFE DELETE with confirmation)
  const archiveCampaignMutation = useMutation({
    mutationFn: async ({ campaignId, confirmationName }: { campaignId: string; confirmationName: string }) => {
      return await apiRequest("POST", `/api/outreach/campaigns/${campaignId}/archive`, {
        confirmationName
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/outreach/campaigns"] });
      toast({
        title: "Success",
        description: "Campaign archived successfully",
      });
      setArchiveConfirmDialog({ open: false, campaignId: '', campaignName: '', confirmationInput: '' });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || error?.response?.data?.error || "Failed to archive campaign";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      
      // If it's a pause requirement error, offer to pause
      if (error?.response?.data?.requiresPause) {
        toast({
          title: "Campaign Must Be Paused First",
          description: "You cannot archive an active campaign. Please pause it first.",
          variant: "destructive"
        });
      }
    },
  });

  // Manual trigger mutation
  const triggerCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return await apiRequest("POST", "/api/outreach/run", { campaignId });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/outreach/runs"] });
      toast({
        title: "Campaign Triggered",
        description: `Campaign run started successfully. Run ID: ${(data as any).runId}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Census backfill mutation
  const censusBackfillMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/admin/backfill-census`);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Census Backfill Complete",
        description: `Processed ${data.processed || 0} deals, enriched ${data.enriched || 0} with Census data.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Census Backfill Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setCampaignFormData({
      name: "",
      status: "active",
      cadence: "monthly",
      scheduleWeek: "1st_monday",
      sendHourUtc: 14,
      channels: ["email"],
      emailTemplateKey: "monthlyOutreachReminder",
      smsTemplateKey: "monthlyOutreachReminder",
      brokerFilter: {},
      rateLimitPerMinute: 10
    });
  };

  const handleCreateCampaign = () => {
    if (!campaignFormData.name.trim()) {
      toast({
        title: "Error",
        description: "Campaign name is required",
        variant: "destructive",
      });
      return;
    }
    createCampaignMutation.mutate(campaignFormData);
  };

  const handleUpdateCampaign = () => {
    if (!editingCampaign || !campaignFormData.name.trim()) {
      toast({
        title: "Error",
        description: "Campaign name is required",
        variant: "destructive",
      });
      return;
    }
    updateCampaignMutation.mutate({ ...campaignFormData, id: editingCampaign.id });
  };

  const handleEditCampaign = (campaign: OutreachCampaign) => {
    setEditingCampaign(campaign);
    setCampaignFormData({
      name: campaign.name,
      status: campaign.status,
      cadence: campaign.cadence,
      scheduleWeek: campaign.scheduleWeek || "1st_monday",
      sendHourUtc: campaign.sendHourUtc,
      channels: Array.isArray(campaign.channels) ? campaign.channels : [],
      emailTemplateKey: campaign.emailTemplateKey,
      smsTemplateKey: campaign.smsTemplateKey,
      brokerFilter: campaign.brokerFilter || {},
      rateLimitPerMinute: campaign.rateLimitPerMinute
    });
  };

  // Archive confirmation dialog state
  const [archiveConfirmDialog, setArchiveConfirmDialog] = useState({
    open: false,
    campaignId: '',
    campaignName: '',
    confirmationInput: ''
  });

  const handleArchiveCampaign = (campaignId: string, campaignName: string) => {
    setArchiveConfirmDialog({
      open: true,
      campaignId,
      campaignName,
      confirmationInput: ''
    });
  };

  const confirmArchiveCampaign = () => {
    if (archiveConfirmDialog.confirmationInput !== archiveConfirmDialog.campaignName) {
      toast({
        title: "Name Mismatch",
        description: "Please type the exact campaign name to confirm.",
        variant: "destructive"
      });
      return;
    }
    
    archiveCampaignMutation.mutate({
      campaignId: archiveConfirmDialog.campaignId,
      confirmationName: archiveConfirmDialog.confirmationInput
    });
  };

  const handleToggleChannelType = (channel: string) => {
    const currentChannels = campaignFormData.channels;
    const updatedChannels = currentChannels.includes(channel)
      ? currentChannels.filter(c => c !== channel)
      : [...currentChannels, channel];
    
    setCampaignFormData({ ...campaignFormData, channels: updatedChannels });
  };

  const getStatusBadge = (status: string) => {
    return status === "active" ? (
      <Badge variant="default" className="bg-green-100 text-green-800">
        <CheckCircle className="h-3 w-3 mr-1" />
        Active
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
        <Pause className="h-3 w-3 mr-1" />
        Paused
      </Badge>
    );
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "Never";
    return formatDateEST.full(dateString);
  };

  const calculateCampaignStats = (campaignId: string) => {
    const campaignRuns = runs.filter((run: OutreachRun) => run.campaignId === campaignId);
    const totalRuns = campaignRuns.length;
    const totalSent = campaignRuns.reduce((sum: number, run: OutreachRun) => sum + (run.sentEmailCount || 0) + (run.sentSMSCount || 0), 0);
    const totalFailures = campaignRuns.reduce((sum: number, run: OutreachRun) => sum + (run.failuresCount || 0), 0);
    const successRate = totalSent > 0 ? ((totalSent / (totalSent + totalFailures)) * 100) : 0;
    
    return {
      totalRuns,
      totalSent,
      successRate: Math.round(successRate),
      lastRun: campaignRuns.length > 0 ? campaignRuns[0].startedAt : null
    };
  };

  // Check for permission errors (403) vs other errors
  if (campaignsError) {
    const isPermissionError = (campaignsError as any)?.response?.status === 403;
    
    if (isPermissionError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
          <div className="max-w-4xl mx-auto">
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-6 text-center">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                <h2 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h2>
                <p className="text-red-600 mb-4">You don't have permission to access outreach management.</p>
                <Button 
                  onClick={() => window.location.href = '/analytics'}
                  variant="outline"
                  data-testid="back-to-analytics"
                >
                  Back to Analytics
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }
    
    // For other errors (like database issues), show a different message
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
              <h2 className="text-lg font-semibold text-yellow-800 mb-2">System Maintenance</h2>
              <p className="text-yellow-700 mb-4">
                The outreach management system is temporarily unavailable due to maintenance. 
                Please try again in a few minutes.
              </p>
              <p className="text-sm text-yellow-600 mb-4">
                Error: {(campaignsError as any)?.message || 'Unknown error'}
              </p>
              <Button 
                onClick={() => window.location.reload()}
                variant="outline"
                data-testid="retry-button"
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900" data-testid="outreach-management-title">
              Outreach Management
            </h1>
            <p className="text-slate-600 mt-2">Manage recurring broker outreach campaigns and monitor their performance</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button
              onClick={handleRefreshYoc}
              disabled={yocRefreshing}
              variant="outline"
              className="font-bold uppercase tracking-wider border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-all duration-200 whitespace-nowrap"
              title="Recalculate Auto YOC for all deals using the current formula rules"
            >
              <RefreshCw size={16} className={`mr-2 ${yocRefreshing ? 'animate-spin' : ''}`} />
              {yocRefreshing ? 'Recalculating…' : 'Refresh Auto YOC'}
            </Button>
            <div className="relative">
              <Button
                onClick={() => backfillQctOzMutation.mutate()}
                disabled={qctOzRunning}
                variant="outline"
                className="font-bold uppercase tracking-wider border-purple-300 text-purple-600 hover:bg-purple-50 hover:text-purple-800 transition-all duration-200 whitespace-nowrap"
                title="Run QCT + OZ census tract lookup for all deals that are missing these values"
              >
                <RefreshCw size={16} className={`mr-2 ${qctOzRunning ? 'animate-spin' : ''}`} />
                {qctOzRunning ? 'Running…' : 'Run QCT + OZ'}
              </Button>
              {qctOzResult && (
                <div className="absolute top-full mt-1 right-0 bg-white border border-gray-200 rounded shadow-lg p-2 text-xs text-gray-600 z-50 max-w-xs whitespace-normal">
                  {qctOzResult}
                </div>
              )}
            </div>
            <Link href="/outreach-analytics">
              <a className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors whitespace-nowrap">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                Email Analytics
              </a>
            </Link>
          </div>
        </div>


        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Optimized responsive tab layout - allows wrapping without horizontal scroll */}
          <div className="w-full">
            <TabsList className="h-auto w-full p-1 bg-muted/50 rounded-lg flex flex-wrap gap-1" data-testid="outreach-management-tabs">
                <TabsTrigger 
                  value="campaigns" 
                  className="flex-shrink-0 px-3 py-2 text-sm font-medium transition-all"
                >
                  Campaigns ({filteredCampaigns.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="runs" 
                  className="flex-shrink-0 px-3 py-2 text-sm font-medium transition-all"
                >
                  Recent Runs
                </TabsTrigger>
                <TabsTrigger 
                  value="scheduler" 
                  className="flex-shrink-0 px-3 py-2 text-sm font-medium transition-all"
                >
                  Scheduler Status
                </TabsTrigger>
                <TabsTrigger 
                  value="analytics" 
                  className="flex-shrink-0 px-3 py-2 text-sm font-medium transition-all"
                >
                  Analytics
                </TabsTrigger>
                <TabsTrigger 
                  value="email-templates" 
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Email Templates</span>
                  <span className="sm:hidden">Email</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="sms-templates" 
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">SMS Templates</span>
                  <span className="sm:hidden">SMS</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="branding-settings" 
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">Email & Branding Settings</span>
                  <span className="hidden sm:inline lg:hidden">Branding</span>
                  <span className="sm:hidden">Settings</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="msa-markets" 
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all"
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">MSA Markets</span>
                  <span className="sm:hidden">MSAs</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="admin-tools" 
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all"
                  data-testid="tab-admin-tools"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Admin Tools</span>
                  <span className="sm:hidden">Admin</span>
                </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="campaigns" className="space-y-6">
            {/* Master Outreach Toggle - Dec 12, 2025 */}
            <MasterOutreachToggle />

            {/* Campaign Controls */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="flex flex-col md:flex-row gap-4 flex-1">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search campaigns..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                        data-testid="campaign-search"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full md:w-48" data-testid="status-filter">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Dialog open={isCreateCampaignOpen} onOpenChange={setIsCreateCampaignOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2" data-testid="create-campaign-button">
                        <Plus className="h-4 w-4" />
                        Create Campaign
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Create New Campaign</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-6 pt-4">
                        {/* Basic Information */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium">Basic Information</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="campaignName">Campaign Name</Label>
                              <Input
                                id="campaignName"
                                value={campaignFormData.name}
                                onChange={(e) => setCampaignFormData({ ...campaignFormData, name: e.target.value })}
                                placeholder="Monthly Broker Outreach"
                                data-testid="campaign-name"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="campaignStatus">Status</Label>
                              <Select value={campaignFormData.status} onValueChange={(value: "active" | "paused") => setCampaignFormData({ ...campaignFormData, status: value })}>
                                <SelectTrigger data-testid="campaign-status">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="paused">Paused</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Scheduling */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium">Schedule Settings</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="scheduleWeek">Schedule Week</Label>
                              <Select value={campaignFormData.scheduleWeek} onValueChange={(value) => setCampaignFormData({ ...campaignFormData, scheduleWeek: value })}>
                                <SelectTrigger data-testid="schedule-week">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1st_monday">1st Monday (Recommended for Email)</SelectItem>
                                  <SelectItem value="3rd_monday">3rd Monday (Recommended for SMS)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="sendHour">Send Hour (EST)</Label>
                              <Select value={campaignFormData.sendHourUtc.toString()} onValueChange={(value) => setCampaignFormData({ ...campaignFormData, sendHourUtc: parseInt(value) })}>
                                <SelectTrigger data-testid="send-hour">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 24 }, (_, i) => i).map(hour => {
                                    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                                    const period = hour < 12 ? 'AM' : 'PM';
                                    return (
                                      <SelectItem key={hour} value={hour.toString()}>{displayHour}:00 {period} EST</SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="rateLimit">Rate Limit (per minute)</Label>
                              <Input
                                id="rateLimit"
                                type="number"
                                min="1"
                                max="100"
                                value={campaignFormData.rateLimitPerMinute}
                                onChange={(e) => setCampaignFormData({ ...campaignFormData, rateLimitPerMinute: parseInt(e.target.value) || 10 })}
                                data-testid="rate-limit"
                              />
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Communication Channels */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium">Communication Channels</h3>
                          <div className="space-y-3">
                            <div className="flex items-center space-x-2">
                              <Switch
                                id="email-channel"
                                checked={campaignFormData.channels.includes("email")}
                                onCheckedChange={() => handleToggleChannelType("email")}
                                data-testid="email-channel-toggle"
                              />
                              <Label htmlFor="email-channel" className="flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                Email
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Switch
                                id="sms-channel"
                                checked={campaignFormData.channels.includes("sms")}
                                onCheckedChange={() => handleToggleChannelType("sms")}
                                data-testid="sms-channel-toggle"
                              />
                              <Label htmlFor="sms-channel" className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" />
                                SMS
                              </Label>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Template Settings */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium">Template Settings</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="emailTemplate">Email Template</Label>
                              <Select value={campaignFormData.emailTemplateKey} onValueChange={(value) => setCampaignFormData({ ...campaignFormData, emailTemplateKey: value })}>
                                <SelectTrigger data-testid="email-template">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="monthlyOutreachReminder">Monthly Outreach Reminder</SelectItem>
                                  <SelectItem value="dealOpportunities">Deal Opportunities</SelectItem>
                                  <SelectItem value="marketUpdates">Market Updates</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="smsTemplate">SMS Template</Label>
                              <Select value={campaignFormData.smsTemplateKey} onValueChange={(value) => setCampaignFormData({ ...campaignFormData, smsTemplateKey: value })}>
                                <SelectTrigger data-testid="sms-template">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="monthlyOutreachReminder">Monthly Outreach Reminder</SelectItem>
                                  <SelectItem value="quickDealAlert">Quick Deal Alert</SelectItem>
                                  <SelectItem value="marketBrief">Market Brief</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-4">
                          <Button 
                            onClick={handleCreateCampaign}
                            disabled={createCampaignMutation.isPending}
                            className="flex-1"
                            data-testid="create-campaign-submit"
                          >
                            {createCampaignMutation.isPending ? "Creating..." : "Create Campaign"}
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setIsCreateCampaignOpen(false);
                              resetForm();
                            }}
                            className="flex-1"
                            data-testid="create-campaign-cancel"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            {/* Campaigns List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Active Campaigns ({filteredCampaigns.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {campaignsLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse h-24 bg-gray-100 rounded-lg"></div>
                    ))}
                  </div>
                ) : filteredCampaigns.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    <Send className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg mb-2">
                      {searchTerm || statusFilter !== 'all' ? 'No campaigns match your filters' : 'No campaigns found'}
                    </p>
                    <p className="text-sm">
                      {searchTerm || statusFilter !== 'all' ? 'Try adjusting your search or filters' : 'Create your first outreach campaign to get started'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4" data-testid="campaigns-list">
                    {filteredCampaigns.map((campaign: OutreachCampaign) => {
                      const stats = calculateCampaignStats(campaign.id);
                      const channels = Array.isArray(campaign.channels) ? campaign.channels : [];
                      
                      return (
                        <div 
                          key={campaign.id} 
                          className="flex items-center justify-between p-6 border rounded-lg hover:bg-gray-50 transition-colors"
                          data-testid={`campaign-${campaign.id}`}
                        >
                          <div className="flex items-center space-x-4 flex-1">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              campaign.status === "active" ? "bg-green-500" : "bg-yellow-500"
                            }`}>
                              {campaign.status === "active" ? (
                                <Send className="h-6 w-6 text-white" />
                              ) : (
                                <Pause className="h-6 w-6 text-white" />
                              )}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 text-lg">
                                {campaign.name}
                              </h4>
                              <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {campaign.cadence} on {(campaign.scheduleWeek || '1st_monday').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {(() => {
                                    const hour = campaign.sendHourUtc;
                                    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                                    const period = hour < 12 ? 'AM' : 'PM';
                                    return `${displayHour}:00 ${period} EST`;
                                  })()}
                                </div>
                                <div className="flex items-center gap-1">
                                  {channels.includes("email") && <Mail className="h-3 w-3" />}
                                  {channels.includes("sms") && <MessageSquare className="h-3 w-3" />}
                                  {channels.join(" + ")}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3" />
                                  {stats.totalRuns} runs
                                </div>
                                <div className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {stats.totalSent} sent
                                </div>
                                <div className="flex items-center gap-1">
                                  <BarChart3 className="h-3 w-3" />
                                  {stats.successRate}% success rate
                                </div>
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                Next run: {formatDateTime(campaign.nextRunAt)}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            {getStatusBadge(campaign.status)}
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="gap-1"
                                onClick={() => setSelectedCampaignStats(campaign.id)}
                                data-testid={`stats-campaign-${campaign.id}`}
                              >
                                <Eye className="h-3 w-3" />
                                Stats
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="gap-1"
                                onClick={() => triggerCampaignMutation.mutate(campaign.id)}
                                disabled={triggerCampaignMutation.isPending}
                                data-testid={`trigger-campaign-${campaign.id}`}
                              >
                                <Zap className="h-3 w-3" />
                                {triggerCampaignMutation.isPending ? "Running..." : "Test Run"}
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="gap-1"
                                onClick={() => handleEditCampaign(campaign)}
                                data-testid={`edit-campaign-${campaign.id}`}
                              >
                                <Edit className="h-3 w-3" />
                                Edit
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="gap-1 text-red-600 hover:bg-[#4A90E2] hover:text-cyan-300 hover:border-[#4A90E2]"
                                onClick={() => handleArchiveCampaign(campaign.id, campaign.name)}
                                data-testid={`archive-campaign-${campaign.id}`}
                              >
                                <Archive className="h-3 w-3" />
                                Archive
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="runs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Campaign Runs
                </CardTitle>
              </CardHeader>
              <CardContent>
                {runs.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    <Activity className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg mb-2">No campaign runs yet</p>
                    <p className="text-sm">Runs will appear here when campaigns are executed</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {runs.slice(0, 10).map((run: OutreachRun) => {
                      const campaign = campaigns.find((c: OutreachCampaign) => c.id === run.campaignId);
                      const getRunStatusBadge = (status: string) => {
                        switch (status) {
                          case "completed":
                            return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>;
                          case "running":
                            return <Badge variant="default" className="bg-blue-100 text-blue-800">Running</Badge>;
                          case "failed":
                            return <Badge variant="destructive">Failed</Badge>;
                          default:
                            return <Badge variant="secondary">{status}</Badge>;
                        }
                      };

                      return (
                        <div key={run.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-4">
                            <div className="flex flex-col">
                              <div className="font-medium text-gray-900">
                                {campaign?.name || "Unknown Campaign"}
                              </div>
                              <div className="text-sm text-gray-500">
                                Started: {formatDateTime(run.startedAt)}
                                {run.completedAt && ` • Completed: ${formatDateTime(run.completedAt)}`}
                              </div>
                              <div className="text-sm text-gray-500">
                                Sent: {(run.sentEmailCount || 0)} emails, {(run.sentSMSCount || 0)} SMS
                                {run.failuresCount > 0 && ` • Failures: ${run.failuresCount}`}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            {getRunStatusBadge(run.status)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scheduler" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Scheduler Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {schedulerStatus ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center p-4 border rounded-lg">
                        <div className="flex items-center justify-center mb-2">
                          {schedulerStatus?.status?.isRunning ? (
                            <CheckCircle className="h-8 w-8 text-green-500" />
                          ) : (
                            <XCircle className="h-8 w-8 text-red-500" />
                          )}
                        </div>
                        <div className="text-lg font-semibold">
                          {schedulerStatus?.status?.isRunning ? "Active" : "Inactive"}
                        </div>
                        <div className="text-sm text-gray-500">Scheduler Status</div>
                      </div>
                      
                      <div className="text-center p-4 border rounded-lg">
                        <div className="flex items-center justify-center mb-2">
                          <Timer className="h-8 w-8 text-blue-500" />
                        </div>
                        <div className="text-lg font-semibold">
                          {formatDateTime(schedulerStatus?.status?.nextRun)}
                        </div>
                        <div className="text-sm text-gray-500">Next Scheduled Run</div>
                      </div>
                      
                      <div className="text-center p-4 border rounded-lg">
                        <div className="flex items-center justify-center mb-2">
                          <Activity className="h-8 w-8 text-purple-500" />
                        </div>
                        <div className="text-lg font-semibold">
                          {schedulerStatus?.status?.isJobCurrentlyExecuting ? "Running" : "Idle"}
                        </div>
                        <div className="text-sm text-gray-500">Job Status</div>
                      </div>
                    </div>
                    
                    {/* Scheduler Control Toggle */}
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-lg font-medium">Scheduler Control</h4>
                          <p className="text-sm text-gray-500">
                            Start or stop the outreach scheduler service
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={schedulerStatus?.status?.isRunning || false}
                            onCheckedChange={async (checked) => {
                              try {
                                const endpoint = checked ? '/api/outreach/scheduler/start' : '/api/outreach/scheduler/stop';
                                await apiRequest('POST', endpoint, {});
                                queryClient.invalidateQueries({ queryKey: ["/api/outreach/scheduler/status"] });
                                toast({
                                  title: checked ? "Scheduler Started" : "Scheduler Stopped",
                                  description: checked ? "The outreach scheduler is now running" : "The outreach scheduler has been stopped"
                                });
                              } catch (error) {
                                console.error('Error toggling scheduler:', error);
                                toast({
                                  title: "Error",
                                  description: "Failed to toggle scheduler status",
                                  variant: "destructive"
                                });
                              }
                            }}
                            data-testid="scheduler-toggle"
                          />
                          <span className="text-sm font-medium">
                            {schedulerStatus?.status?.isRunning ? 'Running' : 'Stopped'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="border-t pt-4">
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Last Run: {formatDateTime(schedulerStatus?.status?.lastRun)}</div>
                        <div>Status: {schedulerStatus?.status?.isRunning ? 'Running' : 'Stopped'}</div>
                        <div>Health: {schedulerStatus?.health?.status || 'Unknown'} - {schedulerStatus?.health?.message || 'No health data'}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-12">
                    <Globe className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg mb-2">Scheduler status unavailable</p>
                    <p className="text-sm">Unable to connect to the scheduler service</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Campaign Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center text-gray-500 py-12">
                  <BarChart3 className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg mb-2">Analytics Dashboard</p>
                  <p className="text-sm">Detailed analytics and reporting will be available here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email Templates Tab */}
          <TabsContent value="email-templates" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Email Templates ({emailTemplates.length})
                    {areEmailTemplatesDirty && <div className="h-2 w-2 bg-orange-500 rounded-full animate-pulse ml-2"></div>}
                  </CardTitle>
                  <Button
                    onClick={() => {
                      const newTemplate = {
                        id: String(Date.now()),
                        name: "New Email Template",
                        subject: "Enter subject here",
                        content: "Enter your email content here...",
                        event: "broker_registered" as any
                      };
                      const updated = [...emailTemplates, newTemplate];
                      handleEmailTemplatesChange(updated);
                      setEditingTemplateId(newTemplate.id);
                    }}
                    data-testid="add-email-template"
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Template
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {emailTemplates.map((template) => (
                  <Card key={template.id} className="border">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{template.event}</Badge>
                          <Button
                            variant={editingTemplateId === template.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              if (editingTemplateId === template.id) {
                                handleSaveTemplates(template.id);
                              } else {
                                setEditingTemplateId(template.id);
                              }
                            }}
                            disabled={editingTemplateId === template.id && (saveTemplatesMutation.isPending || justSavedTemplateId === template.id)}
                            data-testid={`${editingTemplateId === template.id ? 'save' : 'edit'}-email-template-${template.id}`}
                          >
                            {editingTemplateId === template.id ? (
                              saveTemplatesMutation.isPending ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                              ) : justSavedTemplateId === template.id ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )
                            ) : (
                              <Edit className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const updatedEmail = emailTemplates.filter(t => t.id !== template.id);
                              handleEmailTemplatesChange(updatedEmail);
                              if (editingTemplateId === template.id) {
                                setEditingTemplateId(null);
                              }
                              // Save the deletion to backend with fresh state
                              await handleSaveTemplates(undefined, updatedEmail, smsTemplates);
                            }}
                            disabled={saveTemplatesMutation.isPending}
                            data-testid={`delete-email-template-${template.id}`}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Template Name</Label>
                        <Input
                          value={template.name}
                          onChange={(e) => {
                            const updated = emailTemplates.map(t => 
                              t.id === template.id ? { ...t, name: e.target.value } : t
                            );
                            handleEmailTemplatesChange(updated);
                          }}
                          disabled={editingTemplateId !== template.id}
                          placeholder="e.g., Super Admin Daily Digest"
                          data-testid={`email-template-name-${template.id}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Subject</Label>
                        <Input
                          value={template.subject}
                          onChange={(e) => {
                            const updated = emailTemplates.map(t => 
                              t.id === template.id ? { ...t, subject: e.target.value } : t
                            );
                            handleEmailTemplatesChange(updated);
                          }}
                          disabled={editingTemplateId !== template.id}
                          data-testid={`email-template-subject-${template.id}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Event Type</Label>
                        <Select 
                          value={template.event} 
                          onValueChange={(value) => {
                            const updated = emailTemplates.map(t => 
                              t.id === template.id ? { ...t, event: value as any } : t
                            );
                            handleEmailTemplatesChange(updated);
                          }}
                          disabled={editingTemplateId !== template.id}
                        >
                          <SelectTrigger data-testid={`email-template-event-${template.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="broker_registered">Broker Registered</SelectItem>
                            <SelectItem value="deal_submitted">Deal Submitted</SelectItem>
                            <SelectItem value="sms_opt_in">SMS Opt-In</SelectItem>
                            <SelectItem value="sms_unsubscribe">SMS Unsubscribe</SelectItem>
                            <SelectItem value="info_missing">Info Missing</SelectItem>
                            <SelectItem value="info_missing_address">Missing Address</SelectItem>
                            <SelectItem value="info_missing_acreage">Missing Acreage</SelectItem>
                            <SelectItem value="info_missing_price">Missing Price</SelectItem>
                            <SelectItem value="info_missing_both">Missing Price & Acreage</SelectItem>
                            <SelectItem value="info_missing_all_vital">Missing All Vital Info</SelectItem>
                            <SelectItem value="info_uncertain_details">Uncertain Details</SelectItem>
                            <SelectItem value="status_under_review">Deal Under Review - In Progress</SelectItem>
                            <SelectItem value="status_pursuing">High Priority</SelectItem>
                            <SelectItem value="status_rejected">Rejected</SelectItem>
                            <SelectItem value="loi_sent">LOI Sent</SelectItem>
                            <SelectItem value="info_missing_reminder">Missing Info Reminder</SelectItem>
                            <SelectItem value="monthly_broker_outreach">Monthly Outreach</SelectItem>
                            <SelectItem value="password_reset">Password Reset</SelectItem>
                            <SelectItem value="weekly_report">Weekly Report</SelectItem>
                            <SelectItem value="daily_digest_analyst">Junior Analyst Daily Digest</SelectItem>
                            <SelectItem value="daily_digest_senior">Senior Team Daily Digest</SelectItem>
                            <SelectItem value="daily_digest_super_admin">Super Admin Daily Digest</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* SendGrid Mode Toggle */}
                      <div className="space-y-3 border-t pt-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="text-base flex items-center gap-2">
                              Use SendGrid Dynamic Templates
                              {(template.sendgridTemplateId !== undefined && template.sendgridTemplateId !== null) ? (
                                <Badge variant="default" className="bg-blue-600 text-white">
                                  <Zap className="w-3 h-3 mr-1" />
                                  SendGrid
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  📝 Outreach Tab
                                </Badge>
                              )}
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Toggle ON to use SendGrid templates, OFF for Outreach Tab
                            </p>
                          </div>
                          <Switch
                            checked={!!(template.sendgridTemplateId !== undefined && template.sendgridTemplateId !== null)}
                            onCheckedChange={(checked) => {
                              const updated = emailTemplates.map(t => {
                                if (t.id === template.id) {
                                  if (!checked) {
                                    // Turn OFF: remove the field entirely
                                    const { sendgridTemplateId, ...rest } = t;
                                    return rest as EmailTemplate;
                                  } else {
                                    // Turn ON: set to empty string (will show input field)
                                    return { ...t, sendgridTemplateId: '' };
                                  }
                                }
                                return t;
                              });
                              handleEmailTemplatesChange(updated);
                            }}
                            disabled={editingTemplateId !== template.id}
                            data-testid={`email-template-sendgrid-toggle-${template.id}`}
                          />
                        </div>
                        
                        {/* Conditional SendGrid Template ID Field - Show when NOT null/undefined */}
                        {(template.sendgridTemplateId !== undefined && template.sendgridTemplateId !== null) ? (
                          <div className="space-y-2 bg-blue-50 dark:bg-blue-950 p-4 rounded-md border border-blue-200 dark:border-blue-800">
                            <Label className="flex items-center gap-2">
                              SendGrid Template ID
                              <span className="text-xs text-red-600 font-normal">*Required</span>
                            </Label>
                            <Input
                              value={template.sendgridTemplateId || ''}
                              onChange={(e) => {
                                const updated = emailTemplates.map(t => 
                                  t.id === template.id ? { ...t, sendgridTemplateId: e.target.value } : t
                                );
                                handleEmailTemplatesChange(updated);
                              }}
                              disabled={editingTemplateId !== template.id}
                              placeholder="d-1234567890abcdef"
                              className="font-mono"
                              data-testid={`email-template-sendgrid-id-${template.id}`}
                            />
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                              ℹ️ Template content is managed in SendGrid. Subject and content fields below will be ignored.
                            </p>
                          </div>
                        ) : null}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Content (Plain Text)</Label>
                        <Textarea
                          value={convertEscapedNewlines(template.content)}
                          onChange={(e) => {
                            const updated = emailTemplates.map(t => 
                              t.id === template.id ? { ...t, content: convertNewlinesToEscaped(e.target.value) } : t
                            );
                            handleEmailTemplatesChange(updated);
                          }}
                          disabled={editingTemplateId !== template.id}
                          rows={8}
                          className="font-mono whitespace-pre-wrap"
                          style={{ 
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                            tabSize: 2
                          }}
                          data-testid={`email-template-content-${template.id}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          HTML (Optional - Overrides Plain Text)
                          <span className="text-xs text-muted-foreground font-normal">
                            If provided, this HTML will be used instead of auto-generating from plain text
                          </span>
                        </Label>
                        <Textarea
                          value={template.html || ''}
                          onChange={(e) => {
                            const updated = emailTemplates.map(t => 
                              t.id === template.id ? { ...t, html: e.target.value } : t
                            );
                            handleEmailTemplatesChange(updated);
                          }}
                          disabled={editingTemplateId !== template.id}
                          rows={12}
                          placeholder="Leave empty to auto-generate HTML from plain text content above..."
                          className="font-mono whitespace-pre-wrap text-xs"
                          style={{ 
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                            tabSize: 2
                          }}
                          data-testid={`email-template-html-${template.id}`}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SMS Templates Tab */}
          <TabsContent value="sms-templates" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    SMS Templates ({smsTemplates.length})
                    {areSmsTemplatesDirty && <div className="h-2 w-2 bg-orange-500 rounded-full animate-pulse ml-2"></div>}
                  </CardTitle>
                  <Button
                    onClick={() => {
                      const newTemplate = {
                        id: String(Date.now()),
                        name: "New SMS Template",
                        content: "Enter your SMS content here...",
                        event: "broker_registered" as any
                      };
                      const updated = [...smsTemplates, newTemplate];
                      handleSmsTemplatesChange(updated);
                      setEditingTemplateId(newTemplate.id);
                    }}
                    data-testid="add-sms-template"
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Template
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {smsTemplates.map((template) => (
                  <Card key={template.id} className="border">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{template.event}</Badge>
                          <Button
                            variant={editingTemplateId === template.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              if (editingTemplateId === template.id) {
                                handleSaveTemplates(template.id);
                              } else {
                                setEditingTemplateId(template.id);
                              }
                            }}
                            disabled={editingTemplateId === template.id && (saveTemplatesMutation.isPending || justSavedTemplateId === template.id)}
                            data-testid={`${editingTemplateId === template.id ? 'save' : 'edit'}-sms-template-${template.id}`}
                          >
                            {editingTemplateId === template.id ? (
                              saveTemplatesMutation.isPending ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                              ) : justSavedTemplateId === template.id ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )
                            ) : (
                              <Edit className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const updatedSms = smsTemplates.filter(t => t.id !== template.id);
                              handleSmsTemplatesChange(updatedSms);
                              if (editingTemplateId === template.id) {
                                setEditingTemplateId(null);
                              }
                              // Save the deletion to backend with fresh state
                              await handleSaveTemplates(undefined, emailTemplates, updatedSms);
                            }}
                            disabled={saveTemplatesMutation.isPending}
                            data-testid={`delete-sms-template-${template.id}`}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Template Name</Label>
                        <Input
                          value={template.name}
                          onChange={(e) => {
                            const updated = smsTemplates.map(t => 
                              t.id === template.id ? { ...t, name: e.target.value } : t
                            );
                            handleSmsTemplatesChange(updated);
                          }}
                          disabled={editingTemplateId !== template.id}
                          placeholder="e.g., Welcome SMS"
                          data-testid={`sms-template-name-${template.id}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Event Type</Label>
                        <Select 
                          value={template.event} 
                          onValueChange={(value) => {
                            const updated = smsTemplates.map(t => 
                              t.id === template.id ? { ...t, event: value as any } : t
                            );
                            handleSmsTemplatesChange(updated);
                          }}
                          disabled={editingTemplateId !== template.id}
                        >
                          <SelectTrigger data-testid={`sms-template-event-${template.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="broker_registered">Broker Registered</SelectItem>
                            <SelectItem value="deal_submitted">Deal Submitted</SelectItem>
                            <SelectItem value="sms_opt_in">SMS Opt-In</SelectItem>
                            <SelectItem value="sms_unsubscribe">SMS Unsubscribe</SelectItem>
                            <SelectItem value="info_missing">Info Missing</SelectItem>
                            <SelectItem value="info_missing_address">Missing Address</SelectItem>
                            <SelectItem value="info_missing_acreage">Missing Acreage</SelectItem>
                            <SelectItem value="info_missing_price">Missing Price</SelectItem>
                            <SelectItem value="info_missing_both">Missing Price & Acreage</SelectItem>
                            <SelectItem value="info_missing_all_vital">Missing All Vital Info</SelectItem>
                            <SelectItem value="info_uncertain_details">Uncertain Details</SelectItem>
                            <SelectItem value="status_under_review">Deal Under Review - In Progress</SelectItem>
                            <SelectItem value="status_pursuing">High Priority</SelectItem>
                            <SelectItem value="status_rejected">Rejected</SelectItem>
                            <SelectItem value="loi_sent">LOI Sent</SelectItem>
                            <SelectItem value="info_missing_reminder">Missing Info Reminder</SelectItem>
                            <SelectItem value="monthly_broker_outreach">Monthly Outreach</SelectItem>
                            <SelectItem value="password_reset">Password Reset</SelectItem>
                            <SelectItem value="weekly_report">Weekly Report</SelectItem>
                            <SelectItem value="daily_digest_analyst">Junior Analyst Daily Digest</SelectItem>
                            <SelectItem value="daily_digest_senior">Senior Team Daily Digest</SelectItem>
                            <SelectItem value="daily_digest_super_admin">Super Admin Daily Digest</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Content</Label>
                        <Textarea
                          value={convertEscapedNewlines(template.content)}
                          onChange={(e) => {
                            const updated = smsTemplates.map(t => 
                              t.id === template.id ? { ...t, content: convertNewlinesToEscaped(e.target.value) } : t
                            );
                            handleSmsTemplatesChange(updated);
                          }}
                          disabled={editingTemplateId !== template.id}
                          rows={4}
                          className="font-mono whitespace-pre-wrap"
                          style={{ 
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                            tabSize: 2
                          }}
                          data-testid={`sms-template-content-${template.id}`}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email & Branding Settings Tab */}
          <TabsContent value="branding-settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Email & Branding Settings
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Customize email headers, colors, layouts, and branding for all outbound communications
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo Upload Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800">Company Logo</h3>
                  <p className="text-sm text-muted-foreground">
                    This logo will be displayed in all email communications
                  </p>
                  
                  {/* Logo Preview */}
                  {brandingSettings.logoUrl && (
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border">
                      <div className="flex-shrink-0">
                        <img 
                          src={brandingSettings.logoUrl} 
                          alt="Company Logo" 
                          className="h-16 w-auto max-w-[200px] object-contain"
                          crossOrigin="anonymous"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-slate-600 mb-2">Current logo preview</div>
                        <div className="text-xs text-slate-500 mb-2 font-mono break-all">{brandingSettings.logoUrl}</div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateBrandingSetting('logoUrl', '')}
                          className="text-red-600 hover:text-red-700"
                          data-testid="remove-logo-btn"
                        >
                          Remove Logo
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Logo File Upload */}
                  <div className="space-y-2">
                    <Label htmlFor="logo-file">Upload Logo</Label>
                    <Input
                      id="logo-file"
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        const formData = new FormData();
                        formData.append('logo', file);
                        
                        try {
                          const response = await fetch('/api/upload-logo', {
                            method: 'POST',
                            body: formData,
                            credentials: 'include'
                          });
                          
                          if (response.ok) {
                            const data = await response.json();
                            updateBrandingSetting('logoUrl', data.path);
                            toast({
                              title: "Logo uploaded",
                              description: "Your logo has been uploaded successfully. Don't forget to save your settings."
                            });
                          } else {
                            // Handle authentication errors clearly
                            if (response.status === 401) {
                              toast({
                                variant: "destructive",
                                title: "Authentication required",
                                description: "Please log in to upload a logo. Your session may have expired."
                              });
                              return;
                            }
                            
                            const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
                            console.error('Logo upload error:', response.status, errorData);
                            toast({
                              variant: "destructive",
                              title: "Upload failed",
                              description: errorData.error || `Upload failed (${response.status})`
                            });
                          }
                        } catch (error) {
                          const errorMessage = error instanceof Error ? error.message : 'Failed to upload logo. Please try again.';
                          console.error('Logo upload exception:', error);
                          toast({
                            variant: "destructive",
                            title: "Upload failed",
                            description: errorMessage
                          });
                        }
                      }}
                      data-testid="logo-file-input"
                    />
                    <p className="text-xs text-slate-500">
                      Supported formats: PNG, JPG, JPEG, SVG (max 5MB)
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Email Header Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800">Email Header & Layout</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company-name">Company Name</Label>
                      <Input
                        id="company-name"
                        placeholder="LandLinq"
                        value={brandingSettings.companyName}
                        onChange={(e) => updateBrandingSetting('companyName', e.target.value)}
                        data-testid="company-name-input"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="tagline">Tagline</Label>
                      <Input
                        id="tagline"
                        placeholder="Professional Land Acquisition Platform"
                        value={brandingSettings.tagline}
                        onChange={(e) => updateBrandingSetting('tagline', e.target.value)}
                        data-testid="tagline-input"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="support-email">Support Email</Label>
                      <Input
                        id="support-email"
                        type="email"
                        placeholder="catalyst@landlinq.ai"
                        value={brandingSettings.supportEmail}
                        onChange={(e) => updateBrandingSetting('supportEmail', e.target.value)}
                        data-testid="support-email-input"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="support-phone">Support Phone</Label>
                      <Input
                        id="support-phone"
                        type="tel"
                        placeholder="(704) 610-1549"
                        value={brandingSettings.supportPhone}
                        onChange={(e) => updateBrandingSetting('supportPhone', e.target.value)}
                        data-testid="support-phone-input"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Color Theme Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800">Color Theme</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="primary-color">Primary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="primary-color"
                          type="color"
                          value={brandingSettings.primaryColor}
                          onChange={(e) => updateBrandingSetting('primaryColor', e.target.value)}
                          className="w-16 h-10 p-1 border rounded"
                          data-testid="primary-color-picker"
                        />
                        <Input
                          placeholder="#081729"
                          value={brandingSettings.primaryColor}
                          onChange={(e) => updateBrandingSetting('primaryColor', e.target.value)}
                          className="flex-1"
                          data-testid="primary-color-hex"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="secondary-color">Secondary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="secondary-color"
                          type="color"
                          value={brandingSettings.secondaryColor}
                          onChange={(e) => updateBrandingSetting('secondaryColor', e.target.value)}
                          className="w-16 h-10 p-1 border rounded"
                          data-testid="secondary-color-picker"
                        />
                        <Input
                          placeholder="#4A90E2"
                          value={brandingSettings.secondaryColor}
                          onChange={(e) => updateBrandingSetting('secondaryColor', e.target.value)}
                          className="flex-1"
                          data-testid="secondary-color-hex"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="tertiary-color">Tertiary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="tertiary-color"
                          type="color"
                          value={brandingSettings.tertiaryColor}
                          onChange={(e) => updateBrandingSetting('tertiaryColor', e.target.value)}
                          className="w-16 h-10 p-1 border rounded"
                          data-testid="tertiary-color-picker"
                        />
                        <Input
                          placeholder="#d4af37"
                          value={brandingSettings.tertiaryColor}
                          onChange={(e) => updateBrandingSetting('tertiaryColor', e.target.value)}
                          className="flex-1"
                          data-testid="tertiary-color-hex"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="background-color">Background Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="background-color"
                          type="color"
                          value={brandingSettings.backgroundColor}
                          onChange={(e) => updateBrandingSetting('backgroundColor', e.target.value)}
                          className="w-16 h-10 p-1 border rounded"
                          data-testid="background-color-picker"
                        />
                        <Input
                          placeholder="#ffffff"
                          value={brandingSettings.backgroundColor}
                          onChange={(e) => updateBrandingSetting('backgroundColor', e.target.value)}
                          className="flex-1"
                          data-testid="background-color-hex"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Email Signature Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800">Email Signature</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email-signature">Default Email Signature</Label>
                    <Textarea
                      id="email-signature"
                      rows={4}
                      placeholder="Best regards,\nLandLinq Team\nCatalyst Capital Partners\n\n📧 catalyst@landlinq.ai | 📱 (704) 610-1549\n🌐 https://landlinq.ai"
                      value={brandingSettings.emailSignature}
                      onChange={(e) => updateBrandingSetting('emailSignature', e.target.value)}
                      className="font-mono text-sm"
                      data-testid="email-signature-textarea"
                    />
                  </div>
                </div>

                <Separator />

                {/* Email Layout Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800">Email Layout Options</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="font-family">Font Family</Label>
                        <Select value={brandingSettings.fontFamily} onValueChange={(value) => updateBrandingSetting('fontFamily', value)}>
                          <SelectTrigger data-testid="font-family-select">
                            <SelectValue placeholder="Select font family" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="system">System Default</SelectItem>
                            <SelectItem value="arial">Arial</SelectItem>
                            <SelectItem value="helvetica">Helvetica</SelectItem>
                            <SelectItem value="georgia">Georgia</SelectItem>
                            <SelectItem value="times">Times New Roman</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="font-size">Font Size</Label>
                        <Select value={brandingSettings.fontSize} onValueChange={(value) => updateBrandingSetting('fontSize', value)}>
                          <SelectTrigger data-testid="font-size-select">
                            <SelectValue placeholder="Select font size" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="12px">12px</SelectItem>
                            <SelectItem value="14px">14px (Default)</SelectItem>
                            <SelectItem value="16px">16px</SelectItem>
                            <SelectItem value="18px">18px</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="button-style">Button Style</Label>
                        <Select value={brandingSettings.buttonStyle} onValueChange={(value) => updateBrandingSetting('buttonStyle', value)}>
                          <SelectTrigger data-testid="button-style-select">
                            <SelectValue placeholder="Select button style" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rounded">Rounded</SelectItem>
                            <SelectItem value="square">Square</SelectItem>
                            <SelectItem value="pill">Pill Shape</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="email-width">Email Width</Label>
                        <Select value={brandingSettings.emailWidth} onValueChange={(value) => updateBrandingSetting('emailWidth', value)}>
                          <SelectTrigger data-testid="email-width-select">
                            <SelectValue placeholder="Select email width" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="500px">500px (Narrow)</SelectItem>
                            <SelectItem value="600px">600px (Default)</SelectItem>
                            <SelectItem value="700px">700px (Wide)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Preview & Actions */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800">Preview & Actions</h3>
                  
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button variant="outline" className="flex items-center gap-2" onClick={handlePreviewEmail} data-testid="preview-email-button">
                      <Eye className="h-4 w-4" />
                      Preview Email Template
                    </Button>
                    
                    <Button variant="outline" className="flex items-center gap-2" onClick={handleSendTestEmail} data-testid="test-email-button">
                      <Mail className="h-4 w-4" />
                      Send Test Email
                    </Button>
                    
                    <Button className="flex items-center gap-2" onClick={handleSaveBrandingSettings} disabled={saveBrandingMutation.isPending} data-testid="save-branding-button">
                      <Save className="h-4 w-4" />
                      {saveBrandingMutation.isPending ? 'Saving...' : 'Save Branding Settings'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MSA Markets Tab */}
          <TabsContent value="msa-markets" className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">MSA Target Markets</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Manage the {msaMarkets.length} acquisition markets across all product types
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowMSAForm(!showMSAForm)}
                  className="bg-[#4A90E2]"
                  data-testid="button-add-msa"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Market
                </Button>
                <Button
                  onClick={() => {
                    if (window.confirm('This will sync MSA data from the seed file. Any missing markets will be added. Continue?')) {
                      syncMSAMutation.mutate();
                    }
                  }}
                  variant="outline"
                  disabled={syncMSAMutation.isPending}
                  data-testid="button-sync-msa"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncMSAMutation.isPending ? 'animate-spin' : ''}`} />
                  {syncMSAMutation.isPending ? 'Syncing...' : 'Sync from Seed'}
                </Button>
              </div>
            </div>
            
            {/* Create New MSA Form */}
            {showMSAForm && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Create New Acquisition Market</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">MSA Name *</label>
                      <Input
                        value={newMSAData.msaName}
                        onChange={(e) => setNewMSAData({ ...newMSAData, msaName: e.target.value })}
                        placeholder="e.g., Charlotte MSA"
                        data-testid="input-new-msa-name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">County *</label>
                      <Input
                        value={newMSAData.county}
                        onChange={(e) => setNewMSAData({ ...newMSAData, county: e.target.value })}
                        placeholder="e.g., Mecklenburg"
                        data-testid="input-new-county"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">State *</label>
                      <Input
                        value={newMSAData.state}
                        onChange={(e) => setNewMSAData({ ...newMSAData, state: e.target.value.toUpperCase() })}
                        maxLength={2}
                        placeholder="NC"
                        data-testid="input-new-state"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Full County Name</label>
                      <Input
                        value={newMSAData.fullCountyName}
                        onChange={(e) => setNewMSAData({ ...newMSAData, fullCountyName: e.target.value })}
                        placeholder="e.g., Mecklenburg County, NC"
                        data-testid="input-new-full-county"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">City Note</label>
                      <Input
                        value={newMSAData.cityNote}
                        onChange={(e) => setNewMSAData({ ...newMSAData, cityNote: e.target.value })}
                        placeholder="e.g., (Charlotte)"
                        data-testid="input-new-city-note"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Active</label>
                      <Switch
                        checked={newMSAData.isActive}
                        onCheckedChange={(checked) => setNewMSAData({ ...newMSAData, isActive: checked })}
                        data-testid="switch-new-active"
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Product Types * (select at least one)</label>
                    <div className="flex flex-wrap gap-2">
                      {productTypeOptions.map((type) => (
                        <Button
                          key={type}
                          type="button"
                          size="sm"
                          variant={newMSAData.productTypes.includes(type) ? "default" : "outline"}
                          onClick={() => toggleNewMSAProductType(type)}
                          className={newMSAData.productTypes.includes(type) ? "bg-[#4A90E2]" : ""}
                          data-testid={`button-new-product-type-${type.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {type}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Notes</label>
                    <Textarea
                      value={newMSAData.notes}
                      onChange={(e) => setNewMSAData({ ...newMSAData, notes: e.target.value })}
                      placeholder="Optional notes about this market"
                      data-testid="textarea-new-notes"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleMSACreate}
                      disabled={!newMSAData.msaName || !newMSAData.county || !newMSAData.state || newMSAData.productTypes.length === 0}
                      className="bg-green-600 hover:bg-green-700"
                      data-testid="button-create-msa"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Create Market
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowMSAForm(false);
                        setNewMSAData({
                          msaName: "",
                          county: "",
                          state: "",
                          fullCountyName: "",
                          cityNote: "",
                          productTypes: [],
                          isActive: true,
                          notes: ""
                        });
                      }}
                      data-testid="button-cancel-new-msa"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Affordable Housing QCT Exception Notice */}
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-amber-900 mb-1">Affordable Housing Exception: Qualified Census Tracts (QCT)</h3>
                    <p className="text-sm text-amber-800 leading-relaxed">
                      While the {msaMarkets.length} MSA markets below define our standard acquisition targets, 
                      <strong className="font-semibold"> Affordable Housing deals are accepted in ANY MSA nationwide</strong> if the property 
                      is located in a <strong className="font-semibold">Qualified Census Tract (QCT)</strong>. This exception overrides the geographic 
                      restrictions that apply to other product types, allowing us to pursue affordable housing opportunities across all 50 states when they meet QCT criteria.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* MSA Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="MSA, county, or state..."
                        value={msaSearchTerm}
                        onChange={(e) => setMsaSearchTerm(e.target.value)}
                        className="pl-10"
                        data-testid="input-msa-search"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Product Type</Label>
                    <Select value={msaProductFilter} onValueChange={setMsaProductFilter}>
                      <SelectTrigger data-testid="select-product-filter">
                        <SelectValue placeholder="All product types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Product Types</SelectItem>
                        {productTypeOptions.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">State</Label>
                    <Select value={msaStateFilter} onValueChange={setMsaStateFilter}>
                      <SelectTrigger data-testid="select-state-filter">
                        <SelectValue placeholder="All states" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All States</SelectItem>
                        {uniqueStates.map((state) => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Status</Label>
                    <Select value={msaActiveFilter} onValueChange={setMsaActiveFilter}>
                      <SelectTrigger data-testid="select-active-filter">
                        <SelectValue placeholder="All markets" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Markets</SelectItem>
                        <SelectItem value="active">Active Only</SelectItem>
                        <SelectItem value="inactive">Inactive Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Showing {filteredMSAMarkets.length} of {msaMarkets.length} markets
                  </p>
                  {(msaSearchTerm || msaProductFilter !== "all" || msaStateFilter !== "all" || msaActiveFilter !== "all") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMsaSearchTerm("");
                        setMsaProductFilter("all");
                        setMsaStateFilter("all");
                        setMsaActiveFilter("all");
                      }}
                      data-testid="button-clear-filters"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Clear Filters
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* MSA Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">MSA Name</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">County</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">State</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Product Types</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Active</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Notes</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {msaLoading ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                            Loading MSA data...
                          </td>
                        </tr>
                      ) : filteredMSAMarkets.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                            {msaMarkets.length === 0 ? "No acquisition markets found" : "No markets match your filters"}
                          </td>
                        </tr>
                      ) : (
                        filteredMSAMarkets.map((market: any) => (
                          <tr key={market.id} className="hover:bg-gray-50" data-testid={`row-msa-${market.id}`}>
                            <td className="px-4 py-4">
                              {editingMSA === market.id ? (
                                <Input
                                  value={msaEditData.msaName}
                                  onChange={(e) => setMSAEditData({ ...msaEditData, msaName: e.target.value })}
                                  data-testid={`input-edit-msa-name-${market.id}`}
                                />
                              ) : (
                                <span className="font-medium text-gray-900">{market.msaName}</span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {editingMSA === market.id ? (
                                <Input
                                  value={msaEditData.county}
                                  onChange={(e) => setMSAEditData({ ...msaEditData, county: e.target.value })}
                                  data-testid={`input-edit-county-${market.id}`}
                                />
                              ) : (
                                <span className="text-gray-700">{market.county}</span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {editingMSA === market.id ? (
                                <Input
                                  value={msaEditData.state}
                                  onChange={(e) => setMSAEditData({ ...msaEditData, state: e.target.value.toUpperCase() })}
                                  maxLength={2}
                                  data-testid={`input-edit-state-${market.id}`}
                                />
                              ) : (
                                <Badge variant="outline">{market.state}</Badge>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {editingMSA === market.id ? (
                                <div className="flex flex-wrap gap-1">
                                  {productTypeOptions.map((type) => (
                                    <Button
                                      key={type}
                                      type="button"
                                      size="sm"
                                      variant={(msaEditData.productTypes || []).includes(type) ? "default" : "outline"}
                                      onClick={() => toggleMSAProductType(market.id, type)}
                                      className={(msaEditData.productTypes || []).includes(type) ? "bg-[#4A90E2] text-xs" : "text-xs"}
                                      data-testid={`button-edit-product-type-${type.toLowerCase().replace(/\s+/g, '-')}-${market.id}`}
                                    >
                                      {type}
                                    </Button>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {(market.productTypes || []).map((type: string) => (
                                    <Badge key={type} variant="secondary" className="text-xs">
                                      {type}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {editingMSA === market.id ? (
                                <Switch
                                  checked={msaEditData.isActive !== false}
                                  onCheckedChange={(checked) => setMSAEditData({ ...msaEditData, isActive: checked })}
                                  data-testid={`switch-edit-active-${market.id}`}
                                />
                              ) : (
                                <Badge variant={market.isActive ? "default" : "secondary"} className={market.isActive ? "bg-green-500" : ""}>
                                  {market.isActive ? "Active" : "Inactive"}
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {editingMSA === market.id ? (
                                <Textarea
                                  value={msaEditData.notes || ""}
                                  onChange={(e) => setMSAEditData({ ...msaEditData, notes: e.target.value })}
                                  className="min-h-[60px]"
                                  data-testid={`textarea-edit-notes-${market.id}`}
                                />
                              ) : (
                                <span className="text-sm text-gray-600">{market.notes || "-"}</span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {editingMSA === market.id ? (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleMSAUpdate(market.id)}
                                    className="bg-green-600 hover:bg-green-700"
                                    data-testid={`button-save-msa-${market.id}`}
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingMSA(null)}
                                    data-testid={`button-cancel-edit-msa-${market.id}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => startMSAEdit(market)}
                                    data-testid={`button-edit-msa-${market.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleMSADelete(market.id, market.msaName)}
                                    className="hover:bg-red-50 hover:text-red-600"
                                    data-testid={`button-delete-msa-${market.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Admin Tools Tab Content */}
          <TabsContent value="admin-tools" className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  System Maintenance Tools
                </h3>
                
                <div className="space-y-6">
                  {/* Census Data Backfill */}
                  <div className="p-4 border rounded-lg bg-blue-50">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-blue-900">Census Demographics Backfill</h4>
                        <p className="text-sm text-blue-700 mt-1">
                          Fetch Census data (population, income, age, vacancy rate) for all deals missing demographics.
                          This will also geocode any addresses that don't have coordinates yet.
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          if (window.confirm('This will geocode addresses and fetch Census data for all deals. This may take a few minutes. Continue?')) {
                            censusBackfillMutation.mutate();
                          }
                        }}
                        disabled={censusBackfillMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {censusBackfillMutation.isPending ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Run Census Backfill
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        {/* Edit Campaign Dialog */}
        <Dialog open={editingCampaign !== null} onOpenChange={(open) => !open && setEditingCampaign(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Campaign</DialogTitle>
            </DialogHeader>
            {editingCampaign && (
              <div className="space-y-6 pt-4">
                {/* Same form structure as create, but with update handler */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="editCampaignName">Campaign Name</Label>
                      <Input
                        id="editCampaignName"
                        value={campaignFormData.name}
                        onChange={(e) => setCampaignFormData({ ...campaignFormData, name: e.target.value })}
                        data-testid="edit-campaign-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="editCampaignStatus">Status</Label>
                      <Select value={campaignFormData.status} onValueChange={(value: "active" | "paused") => setCampaignFormData({ ...campaignFormData, status: value })}>
                        <SelectTrigger data-testid="edit-campaign-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="paused">Paused</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={handleUpdateCampaign}
                    disabled={updateCampaignMutation.isPending}
                    className="flex-1"
                    data-testid="update-campaign-submit"
                  >
                    {updateCampaignMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setEditingCampaign(null)}
                    className="flex-1"
                    data-testid="update-campaign-cancel"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Campaign Stats Dialog */}
        <Dialog open={selectedCampaignStats !== null} onOpenChange={(open) => !open && setSelectedCampaignStats(null)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Campaign Statistics</DialogTitle>
            </DialogHeader>
            {campaignStatsData && (
              <div className="space-y-6 pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{campaignStatsData.totalRuns || 0}</div>
                    <div className="text-sm text-gray-500">Total Runs</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{campaignStatsData.totalSent || 0}</div>
                    <div className="text-sm text-gray-500">Total Sent</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{campaignStatsData.successRate || 0}%</div>
                    <div className="text-sm text-gray-500">Success Rate</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{campaignStatsData.failures || 0}</div>
                    <div className="text-sm text-gray-500">Failures</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">
                    <div>Last run: {formatDateTime(campaignStatsData.lastRunDate)}</div>
                    <div>Email sent: {campaignStatsData.emailSent || 0}</div>
                    <div>SMS sent: {campaignStatsData.smsSent || 0}</div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Archive Confirmation Dialog - CRITICAL SAFETY FEATURE */}
        <Dialog open={archiveConfirmDialog.open} onOpenChange={(open) => !open && setArchiveConfirmDialog({ open: false, campaignId: '', campaignName: '', confirmationInput: '' })}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Archive className="h-5 w-5" />
                Archive Campaign
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-red-800 mb-1">This action will archive the campaign</p>
                    <p className="text-red-700">
                      Campaign: <strong>"{archiveConfirmDialog.campaignName}"</strong>
                    </p>
                    <p className="text-red-700 mt-2">
                      Please type the campaign name exactly to confirm.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmationInput" className="text-sm font-medium">
                  Type campaign name to confirm:
                </Label>
                <Input
                  id="confirmationInput"
                  type="text"
                  placeholder={`Type "${archiveConfirmDialog.campaignName}" to confirm`}
                  value={archiveConfirmDialog.confirmationInput}
                  onChange={(e) => setArchiveConfirmDialog({ 
                    ...archiveConfirmDialog, 
                    confirmationInput: e.target.value 
                  })}
                  className="font-mono"
                  data-testid="archive-confirmation-input"
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setArchiveConfirmDialog({ open: false, campaignId: '', campaignName: '', confirmationInput: '' })}
                  className="flex-1"
                  data-testid="archive-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={confirmArchiveCampaign}
                  disabled={archiveConfirmDialog.confirmationInput !== archiveConfirmDialog.campaignName || archiveCampaignMutation.isPending}
                  className="flex-1"
                  data-testid="archive-confirm"
                >
                  {archiveCampaignMutation.isPending ? "Archiving..." : "Archive Campaign"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Preview Email Dialog */}
        <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Email Template Preview
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                This is how your emails will appear to brokers using the current branding settings.
              </p>
            </DialogHeader>
            
            <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
              {isLoadingPreview ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Loading template preview...</p>
                  </div>
                </div>
              ) : previewTemplate?.html ? (
                <div 
                  className="bg-white rounded shadow-sm mx-auto"
                  dangerouslySetInnerHTML={{ __html: previewTemplate.html }}
                />
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-600">No template preview available</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Test Email Dialog */}
        <Dialog open={isTestEmailDialogOpen} onOpenChange={setIsTestEmailDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Send Test Email
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Enter an email address to send a test email with your current branding settings.
              </p>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-email-address">Email Address</Label>
                <Input
                  id="test-email-address"
                  type="email"
                  placeholder="test@example.com"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  data-testid="test-email-input"
                />
              </div>
              
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsTestEmailDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmitTestEmail} 
                  disabled={sendTestEmailMutation.isPending}
                  data-testid="send-test-email-submit"
                >
                  {sendTestEmailMutation.isPending ? 'Sending...' : 'Send Test Email'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Footer />
    </div>
    </div>
  );
}