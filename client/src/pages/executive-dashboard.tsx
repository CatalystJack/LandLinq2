import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Users, 
  FileText, 
  Mail, 
  MessageSquare,
  Activity,
  ExternalLink,
  RefreshCw,
  Building2,
  MapPin,
  CheckCircle2,
  XCircle,
  Clock,
  Newspaper,
  Settings,
  Plus,
  X
} from "lucide-react";
import { format } from "date-fns";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/navigation";

interface ExecutiveStats {
  deals: {
    total: number;
    green: number;
    yellow: number;
    red: number;
    pending: number;
    thisWeek: number;
    thisMonth: number;
    uniqueBrokers: number;
  };
  brokers: {
    total: number;
    newThisMonth: number;
    smsOptedIn: number;
  };
  communications: {
    emailsSent: number;
    smsSent: number;
  };
  api: {
    totalCost: number;
    totalCalls: number;
    successRate: number;
  };
  trends: {
    dealsByMonth: Array<{
      month: string;
      total: number;
      green: number;
      yellow: number;
      red: number;
    }>;
  };
  topMarkets: Array<{
    state: string;
    dealCount: number;
    greenCount: number;
  }>;
}

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  imageUrl: string | null;
  sentiment: number | null;
}

interface NewsPreferences {
  keywords: string[];
  excludedDomains: string[];
  sentiment: 'all' | 'positive' | 'negative' | 'neutral';
  enabled: boolean;
}

interface ProfileAnalytics {
  id: string;
  companyName: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
  deals: { total: number; passed: number; review: number; pursuing: number };
  sources: { bulkImported: number; sourced: number };
  outreach: {
    sent: number;
    opens: number;
    clicks: number;
    replies: number;
    openRate: number;
    replyRate: number;
  };
  crmContactCount: number;
  lastActivityAt: string | null;
}

interface SystemWideAnalytics {
  profiles: ProfileAnalytics[];
  summary: {
    totalProfiles: number;
    activeProfiles: number;
    totalDeals: number;
    pursuingDeals: number;
    crmContacts: number;
    outreachSent: number;
  };
}

const COLORS = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  navy: '#081729',
};

function KPICard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  trendValue,
  color = 'blue'
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string;
  icon: any;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
  };

  const iconBgClasses = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    yellow: 'bg-yellow-100',
    red: 'bg-red-100',
    purple: 'bg-purple-100',
  };

  return (
    <Card className={`${colorClasses[color]} border-2 hover:shadow-lg transition-shadow`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {subtitle && (
              <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
            )}
            {trend && trendValue && (
              <div className={`flex items-center mt-2 text-sm ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'}`}>
                {trend === 'up' ? <TrendingUp size={14} className="mr-1" /> : trend === 'down' ? <TrendingDown size={14} className="mr-1" /> : null}
                <span>{trendValue}</span>
              </div>
            )}
          </div>
          <div className={`p-4 rounded-full ${iconBgClasses[color]}`}>
            <Icon className="h-8 w-8" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NewsCard({ article }: { article: NewsArticle }) {
  const getSentimentBadge = (sentiment: number | null) => {
    if (sentiment === null) return null;
    if (sentiment > 0.2) return <Badge className="bg-green-100 text-green-700">Positive</Badge>;
    if (sentiment < -0.2) return <Badge className="bg-red-100 text-red-700">Negative</Badge>;
    return <Badge className="bg-gray-100 text-gray-700">Neutral</Badge>;
  };

  return (
    <a 
      href={article.url} 
      target="_blank" 
      rel="noopener noreferrer"
      className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors group"
      data-testid={`news-article-${article.title?.slice(0, 20)}`}
    >
      <div className="flex gap-4">
        {article.imageUrl && (
          <img 
            src={article.imageUrl} 
            alt="" 
            className="w-24 h-16 object-cover rounded flex-shrink-0"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-sm text-gray-900 line-clamp-2 group-hover:text-blue-600">
              {article.title}
            </h4>
            <ExternalLink size={14} className="flex-shrink-0 text-gray-400 group-hover:text-blue-600" />
          </div>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{article.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-400">{article.source}</span>
            {article.publishedAt && (
              <>
                <span className="text-gray-300">•</span>
                <span className="text-xs text-gray-400">
                  {format(new Date(article.publishedAt), 'MMM d, yyyy')}
                </span>
              </>
            )}
            {getSentimentBadge(article.sentiment)}
          </div>
        </div>
      </div>
    </a>
  );
}

function SystemWideView() {
  const { data, isLoading, isError } = useQuery<SystemWideAnalytics>({
    queryKey: ["/api/admin/analytics/by-profile"],
  });

  if (isLoading) {
    return <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-32" />)}</div>;
  }
  if (isError || !data) {
    return <Card><CardContent className="py-16 text-center text-slate-500">Unable to load system-wide Investment Company analytics.</CardContent></Card>;
  }

  const summary = data.summary;
  return <div className="space-y-6">
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      <KPICard title="Investment Companies" value={summary.totalProfiles} subtitle={`${summary.activeProfiles} active`} icon={Building2} color="blue" />
      <KPICard title="Company Deal Activity" value={summary.totalDeals} subtitle={`${summary.pursuingDeals} pursuing`} icon={FileText} color="green" />
      <KPICard title="CRM Contacts" value={summary.crmContacts} subtitle="Company-owned contacts" icon={Users} color="purple" />
      <KPICard title="Outreach Sent" value={summary.outreachSent} subtitle="Across company campaigns" icon={Mail} color="blue" />
    </div>

    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-blue-600" />Classification by Investment Company</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={data.profiles} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="companyName" width={120} fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="deals.passed" name="Passed" fill="#3b82f6" stackId="classification" />
              <Bar dataKey="deals.review" name="Review" fill="#eab308" stackId="classification" />
              <Bar dataKey="deals.pursuing" name="Pursuing" fill="#22c55e" stackId="classification" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-purple-600" />Deal Source Mix</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={data.profiles} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="companyName" width={120} fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="sources.sourced" name="LandLinq sourced" fill="#081729" stackId="source" />
              <Bar dataKey="sources.bulkImported" name="Bulk imported" fill="#4A90E2" stackId="source" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader><CardTitle>Company Activity Detail</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[1050px] text-sm">
          <thead className="border-y bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-5 py-3">Investment Company</th><th className="px-4 py-3">Deals</th><th className="px-4 py-3">Passed</th><th className="px-4 py-3">Review</th><th className="px-4 py-3">Pursuing</th><th className="px-4 py-3">CRM</th><th className="px-4 py-3">Sent</th><th className="px-4 py-3">Open rate</th><th className="px-4 py-3">Reply rate</th><th className="px-4 py-3">Last activity</th></tr>
          </thead>
          <tbody>
            {data.profiles.map((profile) => <tr key={profile.id} className="border-b last:border-0">
              <td className="px-5 py-4"><div className="flex items-center gap-3">{profile.logoUrl ? <img src={profile.logoUrl} alt="" className="h-9 w-9 rounded border object-contain p-1" /> : <div className="flex h-9 w-9 items-center justify-center rounded bg-slate-100"><Building2 className="h-4 w-4 text-slate-400" /></div>}<div><p className="font-semibold text-slate-900">{profile.companyName}</p><Badge variant={profile.isActive ? "default" : "secondary"} className="mt-1">{profile.isActive ? "Active" : "Inactive"}</Badge></div></div></td>
              <td className="px-4 py-4 font-semibold">{profile.deals.total}</td><td className="px-4 py-4 text-blue-700">{profile.deals.passed}</td><td className="px-4 py-4 text-amber-700">{profile.deals.review}</td><td className="px-4 py-4 text-green-700">{profile.deals.pursuing}</td><td className="px-4 py-4">{profile.crmContactCount}</td><td className="px-4 py-4">{profile.outreach.sent}</td><td className="px-4 py-4">{profile.outreach.openRate.toFixed(1)}%</td><td className="px-4 py-4">{profile.outreach.replyRate.toFixed(1)}%</td><td className="px-4 py-4 text-slate-500">{profile.lastActivityAt ? format(new Date(profile.lastActivityAt), "MMM d, yyyy h:mm a") : "No activity"}</td>
            </tr>)}
          </tbody>
        </table>
        {!data.profiles.length && <div className="py-16 text-center text-slate-500">No Investment Company profiles have been created.</div>}
      </CardContent>
    </Card>
  </div>;
}

export default function ExecutiveDashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const email = String((user as any)?.claims?.email || (user as any)?.email || "").toLowerCase();
  const isPlatformAdmin = isAuthenticated && email.endsWith("@apexresi.com");
  const [newKeyword, setNewKeyword] = useState('');
  const [newExcludedDomain, setNewExcludedDomain] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<ExecutiveStats>({
    queryKey: ['/api/executive/stats'],
    refetchInterval: 60000,
  });

  const { data: newsData, isLoading: newsLoading, refetch: refetchNews } = useQuery<{ articles: NewsArticle[] }>({
    queryKey: ['/api/executive/news'],
    refetchInterval: 300000,
  });

  const { data: newsPrefs, isLoading: prefsLoading } = useQuery<NewsPreferences>({
    queryKey: ['/api/executive/news-preferences'],
  });

  const [localPrefs, setLocalPrefs] = useState<NewsPreferences>({
    keywords: ['interest rates', 'charlotte nc', 'multifamily real estate', 'commercial real estate', 'apartment'],
    excludedDomains: [],
    sentiment: 'all',
    enabled: true
  });

  useEffect(() => {
    if (newsPrefs) {
      setLocalPrefs(newsPrefs);
    }
  }, [newsPrefs]);

  const savePreferencesMutation = useMutation({
    mutationFn: async (prefs: NewsPreferences) => {
      return await apiRequest('POST', '/api/executive/news-preferences', prefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/executive/news-preferences'] });
      queryClient.invalidateQueries({ queryKey: ['/api/executive/news'] });
      toast({ title: 'News preferences saved', description: 'Your news feed will update shortly.' });
      setSettingsOpen(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error saving preferences', description: error.message, variant: 'destructive' });
    }
  });

  const handleAddKeyword = () => {
    if (newKeyword.trim() && !localPrefs.keywords.includes(newKeyword.trim())) {
      setLocalPrefs(prev => ({ ...prev, keywords: [...prev.keywords, newKeyword.trim()] }));
      setNewKeyword('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setLocalPrefs(prev => ({ ...prev, keywords: prev.keywords.filter(k => k !== keyword) }));
  };

  const handleAddExcludedDomain = () => {
    if (newExcludedDomain.trim() && !localPrefs.excludedDomains.includes(newExcludedDomain.trim())) {
      setLocalPrefs(prev => ({ ...prev, excludedDomains: [...prev.excludedDomains, newExcludedDomain.trim()] }));
      setNewExcludedDomain('');
    }
  };

  const handleRemoveExcludedDomain = (domain: string) => {
    setLocalPrefs(prev => ({ ...prev, excludedDomains: prev.excludedDomains.filter(d => d !== domain) }));
  };

  const handleSavePreferences = () => {
    savePreferencesMutation.mutate(localPrefs);
  };

  const handleOpenSettings = () => {
    if (newsPrefs) {
      setLocalPrefs(newsPrefs);
    }
    setSettingsOpen(true);
  };

  const handleRefresh = () => {
    refetchStats();
    refetchNews();
  };

  const pieData = stats?.deals ? [
    { name: 'Green', value: stats.deals.green || 0, color: COLORS.green },
    { name: 'Yellow', value: stats.deals.yellow || 0, color: COLORS.yellow },
    { name: 'Red', value: stats.deals.red || 0, color: COLORS.red },
    { name: 'Pending', value: stats.deals.pending || 0, color: '#94a3b8' },
  ].filter(item => item.value > 0) : [];

  const trendData = (stats?.trends?.dealsByMonth || []).map(item => {
    try {
      return {
        ...item,
        month: item.month ? format(new Date(item.month), 'MMM') : 'N/A',
      };
    } catch {
      return { ...item, month: 'N/A' };
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <Navigation />
      <div className="p-6 max-w-[1800px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#081729]" data-testid="text-dashboard-title">
               {isPlatformAdmin ? "Apex Platform Dashboard" : "Executive Dashboard"}
            </h1>
            <p className="text-gray-500 mt-1">
              {isPlatformAdmin
                ? "A parent view of every Investment Company, developer, deal, and platform activity"
                : "Real-time insights into LandLinq performance"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {isPlatformAdmin && (
              <Link href="/admin/investment-companies">
                <Button variant="outline" className="gap-2" data-testid="button-manage-development-partners">
                  <Building2 size={16} />
                  Manage Partners
                </Button>
              </Link>
            )}
            <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="outline" 
                  onClick={handleOpenSettings}
                  className="gap-2"
                  data-testid="button-news-settings"
                >
                  <Settings size={16} />
                  News Settings
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>News Feed Settings</SheetTitle>
                  <SheetDescription>
                    Customize what news and topics appear in your dashboard feed.
                  </SheetDescription>
                </SheetHeader>
                <div className="py-6 space-y-6">
                  <div className="space-y-4">
                    <Label className="text-sm font-semibold">Keywords & Topics</Label>
                    <p className="text-xs text-gray-500">Add topics you want to see news about</p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g., interest rates, Charlotte NC"
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                        data-testid="input-new-keyword"
                      />
                      <Button onClick={handleAddKeyword} size="sm" data-testid="button-add-keyword">
                        <Plus size={16} />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {localPrefs.keywords.map((keyword) => (
                        <Badge 
                          key={keyword} 
                          variant="secondary" 
                          className="px-3 py-1 flex items-center gap-1"
                        >
                          {keyword}
                          <button
                            onClick={() => handleRemoveKeyword(keyword)}
                            className="ml-1 hover:text-red-500"
                            data-testid={`button-remove-keyword-${keyword.replace(/\s+/g, '-')}`}
                          >
                            <X size={12} />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-sm font-semibold">Sentiment Filter</Label>
                    <p className="text-xs text-gray-500">Filter news by sentiment type</p>
                    <Select
                      value={localPrefs.sentiment}
                      onValueChange={(value: 'all' | 'positive' | 'negative' | 'neutral') => 
                        setLocalPrefs(prev => ({ ...prev, sentiment: value }))
                      }
                    >
                      <SelectTrigger data-testid="select-sentiment">
                        <SelectValue placeholder="Select sentiment filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sentiments</SelectItem>
                        <SelectItem value="positive">Positive Only</SelectItem>
                        <SelectItem value="negative">Negative Only</SelectItem>
                        <SelectItem value="neutral">Neutral Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-sm font-semibold">Excluded Sources</Label>
                    <p className="text-xs text-gray-500">Block news from specific domains</p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g., example.com"
                        value={newExcludedDomain}
                        onChange={(e) => setNewExcludedDomain(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddExcludedDomain()}
                        data-testid="input-excluded-domain"
                      />
                      <Button onClick={handleAddExcludedDomain} size="sm" data-testid="button-add-excluded">
                        <Plus size={16} />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {localPrefs.excludedDomains.map((domain) => (
                        <Badge 
                          key={domain} 
                          variant="outline" 
                          className="px-3 py-1 flex items-center gap-1 border-red-200 bg-red-50 text-red-700"
                        >
                          {domain}
                          <button
                            onClick={() => handleRemoveExcludedDomain(domain)}
                            className="ml-1 hover:text-red-900"
                          >
                            <X size={12} />
                          </button>
                        </Badge>
                      ))}
                      {localPrefs.excludedDomains.length === 0 && (
                        <span className="text-xs text-gray-400">No sources excluded</span>
                      )}
                    </div>
                  </div>
                </div>
                <SheetFooter className="mt-6">
                  <SheetClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </SheetClose>
                  <Button 
                    onClick={handleSavePreferences}
                    disabled={savePreferencesMutation.isPending || prefsLoading}
                    data-testid="button-save-preferences"
                  >
                    {prefsLoading ? 'Loading...' : savePreferencesMutation.isPending ? 'Saving...' : 'Save Preferences'}
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              className="gap-2"
              data-testid="button-refresh-dashboard"
            >
              <RefreshCw size={16} />
              Refresh
            </Button>
             <Link href={isPlatformAdmin ? "/admin/master-pipeline" : "/analyst-dashboard"}>
              <Button className="bg-[#081729] hover:bg-[#0a2540]" data-testid="button-go-to-deals">
                <FileText size={16} className="mr-2" />
                 {isPlatformAdmin ? "All Deal Pipeline" : "Deal Dashboard"}
              </Button>
            </Link>
          </div>
        </div>

         <Tabs defaultValue={isPlatformAdmin ? "system-wide" : "overview"} className="space-y-6">
          <TabsList className={`grid w-full max-w-md ${isPlatformAdmin ? "grid-cols-2" : "grid-cols-1"}`}>
            <TabsTrigger value="overview">LandLinq Overview</TabsTrigger>
            {isPlatformAdmin && <TabsTrigger value="system-wide">System-Wide</TabsTrigger>}
          </TabsList>
          {isPlatformAdmin && <TabsContent value="system-wide"><SystemWideView /></TabsContent>}
          <TabsContent value="overview" className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsLoading ? (
            <>
              {[1, 2, 3, 4].map(i => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-24" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <>
              <KPICard 
                title="Total Deals" 
                value={stats?.deals.total || 0}
                subtitle={`${stats?.deals.thisWeek || 0} this week`}
                icon={FileText}
                color="blue"
                trend="up"
                trendValue={`${stats?.deals.thisMonth || 0} this month`}
              />
              <KPICard 
                title="Green Deals" 
                value={stats?.deals.green || 0}
                subtitle="High priority opportunities"
                icon={CheckCircle2}
                color="green"
              />
              <KPICard 
                title="Active Brokers" 
                value={stats?.brokers.total || 0}
                subtitle={`${stats?.brokers.newThisMonth || 0} new this month`}
                icon={Users}
                color="purple"
              />
              <KPICard 
                title="Communications" 
                value={(stats?.communications.emailsSent || 0) + (stats?.communications.smsSent || 0)}
                subtitle="Last 30 days"
                icon={MessageSquare}
                color="blue"
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 size={20} className="text-blue-600" />
                Deal Flow Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-[300px]" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={trendData}>
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="green" name="Green" fill={COLORS.green} stackId="stack" />
                    <Bar dataKey="yellow" name="Yellow" fill={COLORS.yellow} stackId="stack" />
                    <Bar dataKey="red" name="Red" fill={COLORS.red} stackId="stack" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity size={20} className="text-purple-600" />
                Deal Classification
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-[300px]" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin size={20} className="text-green-600" />
                Top Markets
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8" />)}
                </div>
              ) : (stats?.topMarkets || []).length > 0 ? (
                <div className="space-y-3">
                  {(stats?.topMarkets || []).slice(0, 8).map((market, idx) => (
                    <div key={market.state || idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-500 w-5">{idx + 1}</span>
                        <span className="font-medium">{market.state || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {market.greenCount || 0} green
                        </Badge>
                        <span className="text-sm text-gray-500">{market.dealCount || 0} total</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <MapPin size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No market data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Newspaper size={20} className="text-orange-600" />
                Real Estate News
              </CardTitle>
            </CardHeader>
            <CardContent>
              {newsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
                </div>
              ) : newsData?.articles?.length ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {newsData.articles.map((article, idx) => (
                    <NewsCard key={idx} article={article} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Newspaper size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No news articles available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
          </TabsContent>
        </Tabs>

        <div className="mt-8 text-center text-sm text-gray-400">
          <p>Data refreshes automatically every minute. Last updated: {format(new Date(), 'h:mm a')}</p>
        </div>
      </div>
    </div>
  );
}
