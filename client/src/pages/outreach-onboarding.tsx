import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Users,
  Mail,
  MessageSquare,
  Calendar,
  Settings,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  RefreshCw,
  Link as LinkIcon,
  ExternalLink,
  Clock,
  Zap,
  Shield,
  ArrowRight,
  ArrowLeft,
  Save,
  Play,
  Pause,
  Globe,
  Building,
  User,
  Bold,
  Italic,
  Underline,
  List,
  Indent as IndentIncrease,
  Outdent as IndentDecrease,
  Eye,
  Send,
  Edit2,
  ImagePlus,
  TestTube,
  Tag,
  AlignJustify,
  X,
  Paperclip,
  FileText,
  Upload,
  AlertTriangle,
  TrendingUp,
  BarChart2
} from "lucide-react";
import { SiHubspot } from "react-icons/si";

interface OutreachSender {
  id: string;
  name: string;
  email: string;
  role: string;
  outlookConnected: boolean;
  tokenExpired?: boolean;
  tokenExpiringSoon?: boolean;
  microsoftTokenExpiry?: string;
  microsoftUserId?: string;
  hubspotOwnerId?: string;
  hubspotOwnerName?: string;
  smsFollowupEnabled: boolean;
  smsFollowupDays: number;
  isActive: boolean;
  createdAt: string;
  // HubSpot tagging automation settings
  hubspotTriggerTag?: string; // Legacy single tag (deprecated)
  hubspotTriggerTags?: string[]; // Multiple trigger tags - each triggers a different drip campaign
  welcomeTemplateKey?: string;
  deliveryMethod?: 'email' | 'sms' | 'both';
  delayAfterTagging?: number; // hours after HubSpot tagging
  // Email signature
  signatureHtml?: string; // Personal email signature (HTML) from Outlook
  // Daily send cap (overrides the global 150/day default)
  dailyLimitOverride?: number;
}

interface BusinessSettings {
  companyName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
}

interface CampaignConfig {
  name: string;
  cadence: string;
  scheduleWeek: string;
  sendHourUtc: number;
  channels: string[];
  emailTemplateKey: string;
  smsTemplateKey: string;
  status: string;
}

interface Attachment {
  filename: string;
  url: string;
  contentType: string;
  size: number;
}

interface CampaignStep {
  id: string;
  senderId: string;
  sequenceIndex: number;
  dayNumber: number;
  channel: 'email' | 'sms';
  subject?: string;
  content: string;
  templateKey?: string;
  isActive: boolean;
  lineHeight?: string;
  attachments?: string | any[]; // JSON string of Attachment[] or parsed array
  campaignTemplateId?: string; // For campaign template steps
  templateId?: string; // Alias returned by API when step source is a campaign template
}

// Shared Campaign Template - Tag-based routing for scalable outreach
interface CampaignTemplate {
  id: string;
  name: string;
  description?: string;
  hubspotTriggerTag: string;
  teamId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface CampaignTemplateStep {
  id: string;
  templateId: string;
  sequenceIndex: number;
  dayNumber: number;
  channel: 'email' | 'sms';
  subject?: string;
  content: string;
  sendgridTemplateId?: string;
  isActive: boolean;
  createdAt: string;
  lineHeight?: string;
  attachments?: string; // JSON string of Attachment[]
}

// Personalization tokens available for messages
const PERSONALIZATION_TOKENS = [
  { token: '{{broker.firstName}}', label: 'Broker First Name' },
  { token: '{{broker.lastName}}', label: 'Broker Last Name' },
  { token: '{{broker.email}}', label: 'Broker Email' },
  { token: '{{broker.phone}}', label: 'Broker Phone' },
  { token: '{{broker.company}}', label: 'Broker Company' },
  { token: '{{sender.name}}', label: 'Your Name' },
  { token: '{{sender.email}}', label: 'Your Email' },
  { token: '{{company.name}}', label: 'Company Name' },
];

// Daily Email Limit Card — controls how many outreach emails go out per day
// ─── Daily Send Activity Panel ──────────────────────────────────────────────
// Shows how many drip emails were sent each day per sender for the last 14 days.
// Placed above the step tabs so it's always visible regardless of which step
// the user is on. Auto-refreshes every 60 seconds.
function DailySendActivityPanel() {
  const [data, setData] = useState<{
    dailyBreakdown: { send_date: string; sender_id: string; sender_name: string; emails_sent: string }[];
    todayBySender: { sender_id: string; sender_name: string; sent_today: string }[];
    totalToday: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const load = () => {
    setLoading(true);
    fetch('/api/outreach/daily-sends', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setData(d); setLastRefreshed(new Date()); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Build sorted list of unique dates (most recent first, last 14 days)
  const allDates: string[] = [];
  if (data) {
    const seen = new Set<string>();
    data.dailyBreakdown.forEach(r => {
      if (!seen.has(r.send_date)) { seen.add(r.send_date); allDates.push(r.send_date); }
    });
    allDates.sort((a, b) => b.localeCompare(a));
  }

  // Build sorted list of unique senders
  const allSenders: string[] = [];
  if (data) {
    const seen = new Set<string>();
    data.dailyBreakdown.forEach(r => {
      if (!seen.has(r.sender_name)) { seen.add(r.sender_name); allSenders.push(r.sender_name); }
    });
    allSenders.sort();
  }

  // Lookup: date → sender → count
  const lookup: Record<string, Record<string, number>> = {};
  if (data) {
    data.dailyBreakdown.forEach(r => {
      if (!lookup[r.send_date]) lookup[r.send_date] = {};
      lookup[r.send_date][r.sender_name] = parseInt(r.emails_sent || '0');
    });
  }

  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

  const formatDate = (d: string) => {
    const dt = new Date(d + 'T12:00:00'); // noon to avoid tz issues
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="mb-6 border rounded-lg bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-slate-600" />
          <span className="font-semibold text-sm text-slate-700">Daily Send Activity</span>
          <span className="text-xs text-slate-400 ml-1">
            (refreshes every 60s · last: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
          </span>
        </div>
        <button
          onClick={load}
          className="p-1 rounded hover:bg-slate-200 transition-colors"
          title="Refresh now"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : !data || allDates.length === 0 ? (
        <div className="px-4 py-6 text-sm text-center text-slate-400">
          No emails sent in the last 14 days
        </div>
      ) : (
        <div className="overflow-x-auto">
          {/* Today spotlight row */}
          <div className="px-4 py-3 bg-blue-50 border-b flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-800">Today</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold text-blue-700">{data.totalToday}</span>
              <span className="text-sm text-blue-500 ml-1">total</span>
            </div>
            <div className="flex gap-4 flex-wrap">
              {data.todayBySender.length === 0 ? (
                <span className="text-sm text-slate-400 italic">None sent yet today</span>
              ) : (
                data.todayBySender.map(s => (
                  <div key={s.sender_id} className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-catalyst-navy text-white text-xs flex items-center justify-center font-medium">
                      {s.sender_name.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <span className="text-sm text-slate-600">{s.sender_name.split(' ')[0]}</span>
                    <span className="text-sm font-bold text-slate-800">{s.sent_today}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* History table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left px-4 py-2 font-medium text-slate-500 text-xs">Date</th>
                {allSenders.map(s => (
                  <th key={s} className="text-right px-4 py-2 font-medium text-slate-500 text-xs">
                    {s.split(' ')[0]}
                  </th>
                ))}
                <th className="text-right px-4 py-2 font-medium text-slate-500 text-xs">Total</th>
              </tr>
            </thead>
            <tbody>
              {allDates.map((date, i) => {
                const isToday = date === todayStr;
                const rowTotal = allSenders.reduce((sum, s) => sum + (lookup[date]?.[s] || 0), 0);
                return (
                  <tr
                    key={date}
                    className={`border-b last:border-0 ${isToday ? 'bg-blue-50/60 font-medium' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                  >
                    <td className="px-4 py-2 text-slate-600 whitespace-nowrap">
                      {isToday ? (
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"></span>
                          Today
                        </span>
                      ) : formatDate(date)}
                    </td>
                    {allSenders.map(s => {
                      const count = lookup[date]?.[s] || 0;
                      return (
                        <td key={s} className="text-right px-4 py-2 tabular-nums">
                          {count > 0 ? (
                            <span className={`font-medium ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>{count}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-right px-4 py-2 font-semibold tabular-nums text-slate-700">
                      {rowTotal > 0 ? rowTotal : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CrmDailyLimitCard() {
  const { toast } = useToast();
  const [dailyLimit, setDailyLimit] = useState(100);
  const [emailsSentToday, setEmailsSentToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/crm/outreach-stats', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.dailyLimit) setDailyLimit(data.dailyLimit);
        if (data.emailsSentToday !== undefined) setEmailsSentToday(data.emailsSentToday);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const saveLimit = async (newLimit: number) => {
    setSaving(true);
    try {
      const res = await fetch('/api/hubspot/daily-sync-limit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ limit: newLimit })
      });
      const result = await res.json();
      if (result.success) {
        setDailyLimit(newLimit);
        toast({ title: "Saved", description: `Daily email limit set to ${newLimit}` });
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to save limit", variant: "destructive" });
    }
    setSaving(false);
  };

  if (loading) return null;

  const remainingToday = Math.max(0, dailyLimit - emailsSentToday);
  const progressPercent = dailyLimit > 0 ? Math.min(100, (emailsSentToday / dailyLimit) * 100) : 0;

  return (
    <div className="border rounded-lg p-4 bg-amber-50/50">
      <h4 className="font-semibold mb-2 flex items-center gap-2">
        <Shield className="h-4 w-4 text-amber-600" />
        Email Deliverability Protection
      </h4>
      <p className="text-sm text-gray-600 mb-3">
        Limit daily outreach to prevent email blacklisting. Microsoft recommends 100–200/day for established accounts.
      </p>
      
      <div className="flex items-center gap-4 mb-3">
        <div className="flex-1">
          <div className="flex justify-between text-sm mb-1">
            <span>Sent today: {emailsSentToday}/{dailyLimit}</span>
            <span className={remainingToday === 0 ? "text-amber-600 font-medium" : "text-gray-500"}>
              {remainingToday} remaining
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all ${progressPercent >= 100 ? 'bg-amber-500' : 'bg-green-500'}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Daily limit:</label>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={dailyLimit}
          onChange={(e) => saveLimit(parseInt(e.target.value))}
          disabled={saving}
        >
          <option value={30}>30 (conservative)</option>
          <option value={50}>50 (safe)</option>
          <option value={100}>100 (recommended)</option>
          <option value={150}>150 (established accounts)</option>
          <option value={200}>200 (high volume)</option>
        </select>
        {saving && <span className="text-xs text-gray-500">Saving...</span>}
      </div>
    </div>
  );
}

// Helper to render email preview with formatting and nested lists
function renderEmailPreview(content: string, subject?: string): string {
  if (!content) return '';
  
  // Helper function to apply personalization token highlighting
  const applyPersonalizationTokens = (html: string): string => {
    return html
      .replace(/{{broker\.firstName}}/g, '<span class="bg-blue-100 text-blue-800 px-1 rounded">John</span>')
      .replace(/{{broker\.lastName}}/g, '<span class="bg-blue-100 text-blue-800 px-1 rounded">Smith</span>')
      .replace(/{{broker\.email}}/g, '<span class="bg-blue-100 text-blue-800 px-1 rounded">john@example.com</span>')
      .replace(/{{broker\.phone}}/g, '<span class="bg-blue-100 text-blue-800 px-1 rounded">(555) 123-4567</span>')
      .replace(/{{broker\.company}}/g, '<span class="bg-blue-100 text-blue-800 px-1 rounded">ABC Realty</span>')
      .replace(/{{sender\.name}}/g, '<span class="bg-green-100 text-green-800 px-1 rounded">Your Name</span>')
      .replace(/{{sender\.email}}/g, '<span class="bg-green-100 text-green-800 px-1 rounded">you@company.com</span>')
      .replace(/{{company\.name}}/g, '<span class="bg-purple-100 text-purple-800 px-1 rounded">Catalyst</span>');
  };
  
  // DETECT HTML CONTENT from rich text editor
  // Rich text editor outputs content with tags like <p>, <ul>, <li>, <strong>, etc.
  const isHtmlContent = /<(p|ul|ol|li|strong|em|u|br|div|span)\b/i.test(content);
  
  if (isHtmlContent) {
    // Keep bold and bullets but strip the newsletter-style indentation and spacing.
    let processedContent = content;

    // Lists: keep structure but minimal left indent so bullets sit close to body text
    processedContent = processedContent.replace(/<ul(?![^>]*style)([^>]*)>/gi, '<ul$1 style="margin: 0 0 8px 0; padding: 0 0 0 14px; list-style-type: disc;">');
    processedContent = processedContent.replace(/<ol(?![^>]*style)([^>]*)>/gi, '<ol$1 style="margin: 0 0 8px 0; padding: 0 0 0 14px;">');
    processedContent = processedContent.replace(/<li(?![^>]*style)([^>]*)>/gi, '<li$1 style="margin: 0 0 4px 0; padding: 0; line-height: 1.5;">');

    // Empty paragraphs → single line break
    processedContent = processedContent.replace(/<p[^>]*>\s*(<br\s*\/?>)?\s*<\/p>/gi, '<br>');
    // Paragraphs: comfortable line-height, modest bottom gap
    processedContent = processedContent.replace(/<p(?![^>]*style)([^>]*)>/gi, '<p$1 style="margin: 0 0 12px 0; line-height: 1.6;">');
    // <p> inside <li> — no extra margin
    processedContent = processedContent.replace(/(<li[^>]*>)\s*<p[^>]*>/gi, '$1<p style="margin: 0; line-height: 1.5;">');

    return applyPersonalizationTokens(processedContent);
  }
  
  // ========================================
  // LEGACY MARKDOWN PROCESSING FOR OLD CONTENT
  // ========================================
  
  // PRE-PROCESSING: Normalize dash-bullet formatting BEFORE markdown processing
  // Fix "-**Bold**" → "- **Bold**" (add space after dash when missing)
  let html = content.replace(/^(\s*)-(\*\*)/gm, '$1- $2');
  html = html.replace(/\n(\s*)-(\*\*)/g, '\n$1- $2');
  
  // Handle inline bullet items mashed together (e.g., "**text- **Next:**" → "**text**\n- **Next:**")
  // This catches cases where a bold item is immediately followed by "- **" without a line break
  html = html.replace(/(\*\*[^*]+)- \*\*([A-Z])/g, '$1**\n- **$2');
  
  // NOTE: We do NOT convert standalone bold headings to bullets
  // Bold headings like "**Current Multifamily Land...**" should remain as bold text only
  // Only items that already have a dash prefix should be treated as bullets
  
  // Apply text formatting
  html = html
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/__(.*?)__/g, '<u>$1</u>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 underline">$1</a>');
  
  // STEP 1: Handle inline bullets BEFORE normalizing to dash
  // First, detect inline bullets (•BoldWord:) and add line breaks before them
  // Pattern: text followed by bullet, followed by CapitalWord and colon
  html = html.replace(/([^\n\s])•\s*(?=[A-Z][a-z]*:)/g, '$1\n• ');
  html = html.replace(/([^\n\s])•\s+(?=[A-Z])/g, '$1\n• ');
  
  // Handle inline dashes/bullets that start a new bullet (e.g., "text-**Bold:**" → "text\n- **Bold:**")
  // Match: non-newline char, dash or bullet, <strong> tag - this is an inline bullet that needs a line break
  html = html.replace(/([^\n\s])[-•]<strong>/g, '$1\n- <strong>');
  // Also handle bullet followed directly by text (no strong) - e.g., "text•Capital:" → "text\n• Capital:"
  html = html.replace(/([^\n\s])•([A-Z])/g, '$1\n• $2');
  
  // STEP 2: Add space after bullets directly followed by letters (before normalization)
  while (html.match(/•(?=[A-Za-z<])/)) {
    html = html.replace(/•(?=[A-Za-z<])/g, '• ');
  }
  
  // STEP 3: Now normalize bullet characters to dash for list matching
  // PRESERVE leading whitespace! Match: (start or newline)(leading whitespace)(bullet)(trailing whitespace)
  // Replace with: $1$2- (preserves the leading whitespace)
  html = html.replace(/^(\s*)•\s*/gm, '$1- ');
  html = html.replace(/\n(\s*)•\s*/g, '\n$1- ');
  
  // STEP 3.5: Normalize |> (pipe-arrow) sub-bullet character - treat as indented bullet
  // Use a special marker [INDENT] that we'll detect later for forced indentation
  html = html.replace(/^\|>\s*/gm, '[INDENT]- ');
  html = html.replace(/\n\|>\s*/g, '\n[INDENT]- ');
  // Also handle when |> has leading whitespace already
  html = html.replace(/^(\s+)\|>\s*/gm, '$1[INDENT]- ');
  html = html.replace(/\n(\s+)\|>\s*/g, '\n$1[INDENT]- ');
  
  // STEP 3.6: Handle Tab character as indent marker
  // Tab at the start of a line (before bullet) means it's a sub-bullet
  html = html.replace(/^\t+/gm, (match) => '[INDENT]'.repeat(match.length));
  html = html.replace(/\n\t+/g, (match) => '\n' + '[INDENT]'.repeat(match.length - 1));
  
  // STEP 4: Also normalize other bullet Unicode characters - PRESERVE leading whitespace
  html = html.replace(/^(\s*)[●○◦▪▫■□▸▹►▻‣⦿⦾◉◎★☆✦✧◆◇·∙※\u2022\u2023\u2043\u204C\u204D\u2219\u25AA\u25AB\u25CF\u25CB\u25E6\u2B24]\s*/gm, '$1- ');
  html = html.replace(/\n(\s*)[●○◦▪▫■□▸▹►▻‣⦿⦾◉◎★☆✦✧◆◇·∙※\u2022\u2023\u2043\u204C\u204D\u2219\u25AA\u25AB\u25CF\u25CB\u25E6\u2B24]\s*/g, '\n$1- ');
  
  // Normalize dash bullets at start of lines (preserve leading whitespace)
  html = html.replace(/(^|\n)(\s*)-\s*(?=\S)/gm, '$1$2- ');
  
  // For dashes followed by <strong>, ensure proper spacing (preserve leading whitespace)
  html = html.replace(/(^|\n)(\s*)-\s*<strong>/gm, '$1$2- <strong>');
  
  // Common bullet characters for regex patterns (both • and - since some bullets may remain)
  const bulletCharsWithDash = '•\\-';
  
  // Parse lines to handle nested bullets with SEMANTIC detection
  // Parent bullets end with ":" and subsequent bullets are children until next parent
  // Also detect bold-only headings as section headers
  const lines = html.split('\n');
  let result: string[] = [];
  
  // STEP 1: Pre-scan to identify parent lines (bullets that end with ":" OR bold-only headings)
  const parentLineIndices = new Set<number>();
  const boldHeadingIndices = new Set<number>(); // Track which lines are bold-only headings (not bullets)
  const lineDebug: string[] = []; // DEBUG
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bulletMatch = line.match(/^(\s*)[•\-–—]\s*(.+)$/);
    
    if (bulletMatch) {
      const text = bulletMatch[2].replace(/^[\-–—\s]+/, '');
      const plainText = text.replace(/<[^>]*>/g, '').trim();
      // Parent bullet: ends with colon, has few words (is a label), and no content after
      const endsWithColonOnly = /:\s*$/.test(plainText) && 
                                plainText.replace(/:\s*$/, '').split(/\s+/).length <= 3;
      const isParent = endsWithColonOnly || /:<\/strong>\s*$/.test(text);
      if (isParent) {
        parentLineIndices.add(i);
      }
      lineDebug.push(`L${i}: bullet="${plainText.substring(0,25)}..." parent=${isParent}`);
    } else {
      // Check if it's a bold-only heading (e.g., "<strong>Title:</strong>")
      const boldHeadingMatch = line.match(/^<strong>([^<]+)<\/strong>\s*$/);
      if (boldHeadingMatch && boldHeadingMatch[1].trim().endsWith(':')) {
        parentLineIndices.add(i);
        boldHeadingIndices.add(i);
        lineDebug.push(`L${i}: bold-heading="${boldHeadingMatch[1].substring(0,25)}..."`);
      } else {
        lineDebug.push(`L${i}: non-bullet="${line.substring(0,25)}..."`);
      }
    }
  }
  console.log('=== PARENT SCAN ===', lineDebug.join(' | '));
  
  // STEP 2: Process lines with parent-child awareness
  let lastParentIndex = -1;
  const bulletDebug: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this is a bold-only heading (not a bullet)
    if (boldHeadingIndices.has(i)) {
      // Render as bold text without bullet, and set as parent context
      lastParentIndex = i;
      result.push(`<div style="margin-bottom:8px;margin-top:12px;font-weight:600">${line}</div>`);
      continue;
    }
    
    // Match any leading whitespace, [INDENT] markers, or spaces/tabs before a bullet/dash
    // [INDENT] markers were added in preprocessing for |> and Tab characters
    const bulletMatch = line.match(/^(\s*(?:\[INDENT\])*\s*)[•\-–—]\s*(.+)$/);
    
    if (bulletMatch) {
      const rawPrefix = bulletMatch[1] || '';
      let text = bulletMatch[2].replace(/^[\-–—\s]+/, '');
      
      const isParentBullet = parentLineIndices.has(i);
      
      // Determine indent level from [INDENT] markers and whitespace
      let level = 0;
      
      // Count [INDENT] markers (each one = 1 level)
      const indentMarkerCount = (rawPrefix.match(/\[INDENT\]/g) || []).length;
      
      // Also count regular whitespace (after removing [INDENT] markers)
      const whitespace = rawPrefix.replace(/\[INDENT\]/g, '');
      let wsIndent = 0;
      for (let j = 0; j < whitespace.length; j++) {
        wsIndent += whitespace[j] === '\t' ? 4 : 1;
      }
      
      // Total indent: marker count + whitespace-based level
      level = indentMarkerCount + Math.floor(wsIndent / 2);
      
      // Debug: Log whitespace info for bullets containing key words
      if (text.includes('Conventional') || text.includes('Product Types')) {
        bulletDebug.push(`LINE ${i}: markers=${indentMarkerCount} wsIndent=${wsIndent} level=${level} parent=${isParentBullet} lastParent=${lastParentIndex} text="${text.substring(0,30)}"`);
      }
      
      // Check if this line has explicit indent markers (from |> or Tab)
      const hasExplicitIndent = indentMarkerCount > 0 || wsIndent > 0;
      
      // SEMANTIC OVERRIDE: If this bullet comes AFTER a parent bullet (with no other parent in between)
      // and this is NOT itself a parent, it should be indented as a child
      const isKeyBullet = text.includes('Units') || text.includes('Vintage') || text.includes('Location') || 
                          text.includes('Acquisitions') || text.includes('Capital') || text.includes('well-capitalized') ||
                          text.includes('Conventional') || text.includes('BTR') || text.includes('Active Adult');
      if (isKeyBullet) {
        console.log(`[BULLET-v8] LINE ${i}: markers=${indentMarkerCount} wsIndent=${wsIndent} hasExplicit=${hasExplicitIndent} isParent=${isParentBullet} lastParent=${lastParentIndex} text="${text.substring(0,40)}"`);
      }
      
      if (isParentBullet) {
        lastParentIndex = i;
        level = 0; // Parent bullets are always level 0
        if (isKeyBullet) console.log(`[BULLET-v8] --> PARENT: level=0`);
      } else if (hasExplicitIndent) {
        // Has explicit indentation (from markers or whitespace) - use calculated level, minimum 1
        const oldLevel = level;
        level = Math.max(1, level);
        if (isKeyBullet) console.log(`[BULLET-v8] --> EXPLICIT INDENT: level ${oldLevel}->${level}`);
      } else if (lastParentIndex >= 0) {
        // After a parent but NO explicit indent - reset parent context, this is new top-level
        lastParentIndex = -1;
        level = 0;
        if (isKeyBullet) console.log(`[BULLET-v8] --> NEW TOP-LEVEL (after parent, no indent): level=0`);
      } else {
        // No parent context - this is a top-level bullet
        level = 0;
        if (isKeyBullet) console.log(`[BULLET-v8] --> TOP-LEVEL: no parent, level=0`);
      }
      
      // Cap at level 4
      level = Math.min(level, 4);
      
      // Debug: Log final level for key bullets
      if (text.includes('Conventional') || text.includes('Product Types')) {
        bulletDebug.push(`  --> FINAL level=${level} marginLeft=${level * 24}px`);
      }
      
      // Create visual indentation
      const marginLeft = level * 24; // 24px per level for clear visual distinction
      
      // Use bullet points for all levels, just indented
      const bulletChar = '•';
      const bulletColor = 'color:#334155';
      
      result.push(`<div style="display:flex;align-items:flex-start;margin-bottom:4px;margin-left:${marginLeft}px"><span style="margin-right:8px;flex-shrink:0;${bulletColor}">${bulletChar}</span><span>${text}</span></div>`);
    } else {
      // Non-bullet line - check if it resets the parent context
      // Only reset if this is a non-empty, non-whitespace line that's not a continuation
      const trimmed = line.trim();
      if (trimmed && !trimmed.match(/^<br\s*\/?>$/)) {
        // This is meaningful non-bullet content, reset the parent context
        lastParentIndex = -1;
      }
      result.push(line ? line + '<br />' : '<br />');
    }
  }
  
  html = result.join('');
  
  // Log bullet debug info
  if (bulletDebug.length > 0) {
    console.log('=== BULLET INDENT DEBUG ===', bulletDebug);
  }
  
  // Final cleanup: ensure any remaining bullet characters have proper spacing
  // This catches edge cases where bullets weren't properly processed
  html = html.replace(/•(?=[A-Za-z<])/g, '• ');
  html = html.replace(/-(?=<strong>)/g, '- ');
  
  // Apply personalization token highlighting (using helper function)
  return applyPersonalizationTokens(html);
}

// Rich text formatting toolbar component
function FormattingToolbar({ 
  content, 
  onContentChange,
  textareaRef 
}: { 
  content: string; 
  onContentChange: (content: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}) {
  const insertFormatting = (before: string, after: string, placeholder: string, e?: React.MouseEvent) => {
    // Prevent scroll to top when clicking formatting buttons
    e?.preventDefault();
    
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end) || placeholder;
    const newContent = content.substring(0, start) + before + selectedText + after + content.substring(end);
    onContentChange(newContent);
    
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + selectedText.length + after.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const insertBulletPoint = (e?: React.MouseEvent) => {
    // Prevent scroll to top when clicking bullet button
    e?.preventDefault();
    
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    // Check if multiple lines are selected
    if (start !== end) {
      const selectedText = content.substring(start, end);
      const lines = selectedText.split('\n');
      
      // Add bullet to each line that doesn't already have one
      const bulletedLines = lines.map(line => {
        const trimmed = line.trimStart();
        // Skip if line already has a bullet or is empty
        if (trimmed.startsWith('- ') || trimmed === '') {
          return line;
        }
        // Preserve leading whitespace for indentation
        const leadingSpace = line.match(/^\s*/)?.[0] || '';
        return leadingSpace + '- ' + trimmed;
      });
      
      const newContent = content.substring(0, start) + bulletedLines.join('\n') + content.substring(end);
      onContentChange(newContent);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + bulletedLines.join('\n').length);
      }, 0);
    } else {
      // Single cursor position - add bullet at current line
      const beforeCursor = content.substring(0, start);
      const isNewLine = beforeCursor.endsWith('\n') || beforeCursor === '';
      const prefix = isNewLine ? '- ' : '\n- ';
      const newContent = content.substring(0, start) + prefix + content.substring(start);
      onContentChange(newContent);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, start + prefix.length);
      }, 0);
    }
  };

  const indentLine = (e?: React.MouseEvent) => {
    e?.preventDefault();
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const beforeCursor = content.substring(0, start);
    const lineStart = beforeCursor.lastIndexOf('\n') + 1;
    const newContent = content.substring(0, lineStart) + '  ' + content.substring(lineStart);
    onContentChange(newContent);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 2, start + 2);
    }, 0);
  };

  const outdentLine = (e?: React.MouseEvent) => {
    e?.preventDefault();
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const beforeCursor = content.substring(0, start);
    const lineStart = beforeCursor.lastIndexOf('\n') + 1;
    const lineContent = content.substring(lineStart);
    
    if (lineContent.startsWith('  ')) {
      const newContent = content.substring(0, lineStart) + content.substring(lineStart + 2);
      onContentChange(newContent);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(Math.max(lineStart, start - 2), Math.max(lineStart, start - 2));
      }, 0);
    }
  };

  const insertLink = (e?: React.MouseEvent) => {
    e?.preventDefault();
    const url = prompt('Enter URL:', 'https://');
    if (!url) return;
    const linkText = prompt('Enter link text:', 'Click here');
    if (!linkText) return;
    
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const linkMarkdown = `[${linkText}](${url})`;
    const newContent = content.substring(0, start) + linkMarkdown + content.substring(start);
    onContentChange(newContent);
  };

  const insertLineSpacing = (spacing: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    // Add spacing marker before and after selection or at cursor
    let spacingMarker = '';
    if (spacing === 'single') {
      spacingMarker = ''; // No extra spacing
    } else if (spacing === '1.5') {
      spacingMarker = '\n'; // One extra line
    } else if (spacing === 'double') {
      spacingMarker = '\n\n'; // Two extra lines
    }
    
    if (selectedText) {
      // Add spacing between paragraphs in selection
      const lines = selectedText.split('\n\n');
      const spacedText = lines.join('\n\n' + spacingMarker);
      const newContent = content.substring(0, start) + spacedText + content.substring(end);
      onContentChange(newContent);
    } else {
      // Insert paragraph break with spacing at cursor
      const newContent = content.substring(0, start) + spacingMarker + content.substring(end);
      onContentChange(newContent);
    }
    
    setTimeout(() => {
      textarea.focus();
    }, 0);
  };

  return (
    <div className="flex flex-wrap gap-1 mb-2 p-1 bg-gray-50 rounded border">
      {/* Line Spacing Dropdown */}
      <Select onValueChange={(val) => insertLineSpacing(val)}>
        <SelectTrigger className="h-7 w-[90px] text-xs">
          <AlignJustify className="h-3.5 w-3.5 mr-1" />
          <span className="text-xs">Spacing</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="single">Single</SelectItem>
          <SelectItem value="1.5">1.5 Lines</SelectItem>
          <SelectItem value="double">Double</SelectItem>
        </SelectContent>
      </Select>
      <div className="w-px bg-gray-300 mx-1" />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        onClick={(e) => insertFormatting('**', '**', 'bold text', e)}
        title="Bold (**text**)"
      >
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        onClick={(e) => insertFormatting('*', '*', 'italic text', e)}
        title="Italic (*text*)"
      >
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        onClick={(e) => insertFormatting('__', '__', 'underline text', e)}
        title="Underline (__text__)"
      >
        <Underline className="h-3.5 w-3.5" />
      </Button>
      <div className="w-px bg-gray-300 mx-1" />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        onClick={(e) => insertBulletPoint(e)}
        title="Bullet point (select multiple lines to bullet all)"
      >
        <List className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        onClick={(e) => indentLine(e)}
        title="Indent (sub-bullet)"
      >
        <IndentIncrease className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        onClick={(e) => outdentLine(e)}
        title="Outdent"
      >
        <IndentDecrease className="h-3.5 w-3.5" />
      </Button>
      <div className="w-px bg-gray-300 mx-1" />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        onClick={(e) => insertLink(e)}
        title="Insert link [text](url)"
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </Button>
      <span className="text-xs text-gray-400 ml-2 self-center hidden sm:inline">
        Tab to indent bullets
      </span>
    </div>
  );
}

function tokenExpiryLabel(expiry: string | undefined | null): string {
  if (!expiry) return '';
  const diff = new Date(expiry).getTime() - Date.now();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  if (days < 0) {
    return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  }
  if (days === 0) return 'Expires today';
  return `Expires in ${days} day${days === 1 ? '' : 's'}`;
}

// Microsoft refresh tokens last 90 days from last use. Returns how many days
// remain before the refresh token (not the access token) likely expires.
function refreshTokenDaysLeft(accessTokenExpiry: string | undefined | null): number {
  if (!accessTokenExpiry) return 90;
  const daysSinceExpiry = (Date.now() - new Date(accessTokenExpiry).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.round(90 - daysSinceExpiry));
}

export default function OutreachOnboarding() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [editingSender, setEditingSender] = useState<OutreachSender | null>(null);
  const [newSenderData, setNewSenderData] = useState({ name: "", email: "", role: "partner" });
  const [hubspotOwnerIds, setHubspotOwnerIds] = useState<Record<string, string>>({});
  const [crmStats, setCrmStats] = useState<{ total: number; byAssignee: { name: string; count: number }[]; emailsSentToday: number; dailyLimit: number } | null>(null);
  const [crmSyncing, setCrmSyncing] = useState(false);
  const [showAddSender, setShowAddSender] = useState(false);
  const [campaignSteps, setCampaignSteps] = useState<CampaignStep[]>([]);
  const [templateStepsByTag, setTemplateStepsByTag] = useState<Record<string, CampaignStep[]>>({});
  const [expandedTags, setExpandedTags] = useState<Record<string, boolean>>({});
  const [addingStepForTag, setAddingStepForTag] = useState<string | null>(null);
  const [newTagStepData, setNewTagStepData] = useState<{ 
    dayNumber: number; 
    channel: 'email' | 'sms'; 
    subject: string; 
    content: string;
    lineHeight: string;
    attachments: Attachment[];
  }>({ dayNumber: 1, channel: 'email', subject: '', content: '', lineHeight: '1.5', attachments: [] });
  const [isSavingTagStep, setIsSavingTagStep] = useState(false);
  const [isUploadingTagAttachment, setIsUploadingTagAttachment] = useState(false);
  const [editingStep, setEditingStep] = useState<Partial<CampaignStep> | null>(null);
  const [isSendingEditTest, setIsSendingEditTest] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [showAddStep, setShowAddStep] = useState(false);
  const [newStepData, setNewStepData] = useState<{
    dayNumber: number;
    channel: 'email' | 'sms';
    subject: string;
    content: string;
    lineHeight: string;
    attachments: Attachment[];
  }>({ dayNumber: 1, channel: 'email', subject: '', content: '', lineHeight: '1.5', attachments: [] });
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  
  // Refs for textarea formatting
  const newStepTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editStepTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Ref for signature contentEditable (uncontrolled pattern to avoid React/DOM sync issues)
  const signatureEditorRef = useRef<HTMLDivElement>(null);
  const signatureLogoInputRef = useRef<HTMLInputElement>(null);
  const [signaturePopoverOpen, setSignaturePopoverOpen] = useState(false);
  const [isUploadingSignatureLogo, setIsUploadingSignatureLogo] = useState(false);
  const [showDryRunLogs, setShowDryRunLogs] = useState(false);
  
  // Sync ref content when popover opens
  useEffect(() => {
    if (signaturePopoverOpen && signatureEditorRef.current && editingSender) {
      signatureEditorRef.current.innerHTML = editingSender.signatureHtml || '';
    }
  }, [signaturePopoverOpen, editingSender?.id, editingSender?.signatureHtml]);

  useEffect(() => {
    if (currentStep === 3) {
      fetch('/api/crm/outreach-stats', { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.byAssignee) setCrmStats(data); })
        .catch(() => {});
    }
  }, [currentStep]);
  
  // Helper to clean HTML from Windows clipboard markers and problematic content
  // Jan 13, 2026: ULTRA-CONSERVATIVE - preserve almost everything from Outlook
  const cleanSignatureHtml = (html: string): string => {
    if (!html) return '';
    
    // If it's just a single <br> or empty whitespace, return empty
    const trimmed = html.trim();
    if (!trimmed || trimmed === '<br>' || trimmed === '<br/>' || trimmed === '<br />') return '';

    // ── DOM-based pass (runs in the browser) ────────────────────────────────
    // This is the most reliable way to strip Outlook Web App (OWA) UI garbage.
    // OWA injects hidden overlay divs + <button> elements for image controls.
    // These are invisible inside OWA (opacity:0, position:absolute) but render
    // as broken ↗ icons or blank gaps in Gmail and other email clients.
    let cleaned = html;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Remove all <button> elements — never valid in email signatures
      doc.querySelectorAll('button').forEach(el => el.remove());

      // Remove OWA hidden overlay containers: any element with BOTH
      // opacity:0 and position:absolute in its inline style
      doc.querySelectorAll<HTMLElement>('[style]').forEach(el => {
        const s = el.style;
        if ((s.opacity === '0' || s.opacity === '') && s.position === 'absolute') {
          el.remove();
        }
      });

      // Strip OWA-specific class names that indicate UI chrome, not content
      ['qF8_5', 'Do8Zj'].forEach(cls => {
        doc.querySelectorAll(`.${cls}`).forEach(el => {
          // Only remove if it has no meaningful text (pure chrome element)
          if (!el.textContent?.trim()) el.remove();
        });
      });

      cleaned = doc.body.innerHTML;

      // Drop any content that precedes the first <table> tag.
      // Real Outlook signatures are table-based; OWA UI garbage always comes before it.
      const tableStart = cleaned.indexOf('<table');
      if (tableStart > 0) {
        cleaned = cleaned.substring(tableStart);
      }
    } catch {
      // DOMParser not available (SSR/test env) — fall through to regex pass
    }

    // ── Regex pass (belt-and-suspenders) ────────────────────────────────────
    // Remove Windows clipboard markers
    cleaned = cleaned.replace(/<!--StartFragment-->/gi, '');
    cleaned = cleaned.replace(/<!--EndFragment-->/gi, '');
    // Remove conditional comments
    cleaned = cleaned.replace(/<!--\[if[^>]*>[\s\S]*?<!\[endif\]-->/gi, '');
    cleaned = cleaned.replace(/<!\[if[^>]*>[\s\S]*?<!\[endif\]>/gi, '');
    // Remove most-problematic mso- styles
    cleaned = cleaned.replace(/mso-bidi-[^;:"']+:[^;:"']+;?/gi, '');
    // Remove empty style attributes
    cleaned = cleaned.replace(/style="\s*"/gi, '');
    // Remove only VERY large base64 images (over 50KB)
    cleaned = cleaned.replace(/src="data:image\/[^"]{50000,}"/gi, 'src=""');
    // Remove broken images (cid:, file://, blob:, empty src)
    cleaned = cleaned.replace(/<img[^>]*src=["']cid:[^"']*["'][^>]*\/?>/gi, '');
    cleaned = cleaned.replace(/<img[^>]*src=["']file:[^"']*["'][^>]*\/?>/gi, '');
    cleaned = cleaned.replace(/<img[^>]*src=["']blob:[^"']*["'][^>]*\/?>/gi, '');
    cleaned = cleaned.replace(/<img[^>]*src=["']about:blank[^"']*["'][^>]*\/?>/gi, '');
    cleaned = cleaned.replace(/<img[^>]*src=["']["'][^>]*\/?>/gi, '');
    cleaned = cleaned.replace(/<img(?![^>]*src=)[^>]*\/?>/gi, '');

    cleaned = cleaned.trim();

    const hasAnyHtml = /<[^>]+>/.test(cleaned);
    const hasAnyText = cleaned.replace(/<[^>]*>/g, '').trim().length > 0;
    const hasNbsp = /&nbsp;/i.test(cleaned) || /\u00A0/.test(cleaned);
    
    if (hasAnyHtml || hasAnyText || hasNbsp) {
      console.log('[SIGNATURE-CLEAN] Keeping signature with:', { hasAnyHtml, hasAnyText, hasNbsp, length: cleaned.length });
      return cleaned;
    }
    
    console.log('[SIGNATURE-CLEAN] Returning empty - no meaningful content');
    return '';
  };

  // Helper to sync signature from ref to state
  const syncSignatureToState = () => {
    if (signatureEditorRef.current && editingSender) {
      const html = signatureEditorRef.current.innerHTML;
      const cleanHtml = cleanSignatureHtml(html);
      setEditingSender({ ...editingSender, signatureHtml: cleanHtml });
    }
  };

  // Helper to upload an image file and return the URL
  const uploadImageFile = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('logo', file);
      
      const response = await fetch('/api/upload-logo', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const data = await response.json();
      return data.path; // Full URL for emails
    } catch (error) {
      console.error('Image upload error:', error);
      return null;
    }
  };

  // Helper to convert data URI to File
  const dataURItoFile = (dataURI: string, filename: string): File | null => {
    try {
      const arr = dataURI.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      if (!mimeMatch) return null;
      const mime = mimeMatch[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    } catch {
      return null;
    }
  };

  // Handler for paste events - auto-uploads pasted images
  const handleSignaturePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const clipboardData = e.clipboardData;
    
    // Check if there are image files being pasted directly (screenshots, etc.)
    const imageFiles: File[] = [];
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    
    // If pasting image files directly, upload them
    if (imageFiles.length > 0) {
      e.preventDefault();
      setIsUploadingSignatureLogo(true);
      
      for (const file of imageFiles) {
        const imageUrl = await uploadImageFile(file);
        if (imageUrl && signatureEditorRef.current) {
          const img = document.createElement('img');
          img.src = imageUrl;
          img.alt = 'Logo';
          
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(img);
            range.collapse(false);
          } else {
            signatureEditorRef.current.appendChild(img);
          }
        }
      }
      
      setIsUploadingSignatureLogo(false);
      toast({ title: "Image uploaded", description: "Pasted image saved to server" });
      return;
    }
    
    // Handle HTML paste (from Outlook, web pages, etc.)
    e.preventDefault();
    let html = clipboardData.getData('text/html') || clipboardData.getData('text/plain');
    
    console.log('[SIGNATURE-PASTE] Paste event triggered');
    console.log('[SIGNATURE-PASTE] Raw HTML preview:', html.substring(0, 500));
    
    // Check for data: URI images and upload them
    const dataUriRegex = /<img[^>]*src="(data:image\/[^;]+;base64,[^"]+)"[^>]*>/gi;
    const dataUriMatches = [...html.matchAll(dataUriRegex)];
    
    if (dataUriMatches.length > 0) {
      setIsUploadingSignatureLogo(true);
      for (const match of dataUriMatches) {
        const fullTag = match[0];
        const dataUri = match[1];
        const file = dataURItoFile(dataUri, `pasted-image-${Date.now()}.png`);
        if (file) {
          const uploadedUrl = await uploadImageFile(file);
          if (uploadedUrl) {
            // Replace the data URI with the uploaded URL
            html = html.replace(fullTag, fullTag.replace(dataUri, uploadedUrl));
          }
        }
      }
      setIsUploadingSignatureLogo(false);
    }
    
    // Check for cid: images (Outlook embedded images) - these can't be extracted
    if (html.includes('src="cid:')) {
      console.log('[SIGNATURE-PASTE] Detected cid: images - browser cannot access these');
      // Remove cid: images since browser cannot access their binary data
      html = html.replace(/<img[^>]*src="cid:[^"]*"[^>]*>/gi, '');
      toast({ 
        title: "Outlook images not available", 
        description: "Please save logo images to your computer first, then use 'Add Logo' button to upload.",
        variant: "destructive"
      });
    }
    
    // Check for external image URLs (http/https) and try to re-upload them
    // Handle both single and double quotes in src attributes
    const externalImgRegex = /<img[^>]*src=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
    const externalImgMatches = [...html.matchAll(externalImgRegex)];
    
    console.log('[SIGNATURE-PASTE] HTML content length:', html.length);
    console.log('[SIGNATURE-PASTE] External image matches found:', externalImgMatches.length);
    
    if (externalImgMatches.length > 0) {
      setIsUploadingSignatureLogo(true);
      let uploadedCount = 0;
      
      for (const match of externalImgMatches) {
        const fullTag = match[0];
        const externalUrl = match[1];
        
        try {
          // Try to fetch the external image via our proxy
          console.log('[SIGNATURE-PASTE] Attempting to re-upload external image:', externalUrl);
          const response = await fetch('/api/upload-external-image', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: externalUrl })
          });
          
          if (response.ok) {
            const { url: uploadedUrl } = await response.json();
            if (uploadedUrl) {
              html = html.replace(fullTag, fullTag.replace(externalUrl, uploadedUrl));
              uploadedCount++;
              console.log('[SIGNATURE-PASTE] Re-uploaded external image successfully');
            }
          } else {
            console.log('[SIGNATURE-PASTE] Could not re-upload external image:', externalUrl);
          }
        } catch (err) {
          console.log('[SIGNATURE-PASTE] Error re-uploading external image:', err);
        }
      }
      
      setIsUploadingSignatureLogo(false);
      
      if (uploadedCount > 0) {
        toast({ 
          title: "Images uploaded", 
          description: `${uploadedCount} image(s) saved to your storage for reliable email delivery.`
        });
      } else if (externalImgMatches.length > 0) {
        toast({ 
          title: "Some images couldn't be uploaded", 
          description: "You can manually add them using the 'Add Logo' button.",
          variant: "destructive"
        });
      }
    }
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const fragment = range.createContextualFragment(html);
      range.insertNode(fragment);
      range.collapse(false);
    }
    
    // After pasting, detect and style broken images + constrain social icon sizes
    setTimeout(() => {
      if (signatureEditorRef.current) {
        const images = signatureEditorRef.current.querySelectorAll('img');
        let brokenCount = 0;
        
        images.forEach((img: HTMLImageElement) => {
          // Add cursor pointer style for clickability
          img.style.cursor = 'pointer';
          
          // Preserve original image dimensions from Outlook - no resizing
          // Only set dimensions if the image has explicit width/height attributes from the paste
          const hasExplicitWidth = img.getAttribute('width') || img.style.width;
          const hasExplicitHeight = img.getAttribute('height') || img.style.height;
          
          // If no explicit dimensions, let the image display at its natural size
          if (!hasExplicitWidth && !hasExplicitHeight) {
            // Don't modify - let it render at original size
          }
          
          // Check if image has a problematic URL (cid:, file://, blob:, empty)
          const src = img.src || '';
          const isBroken = !src || 
            src.startsWith('cid:') || 
            src.startsWith('file:') || 
            src.startsWith('blob:') ||
            src.includes('about:blank');
          
          if (isBroken) {
            brokenCount++;
            // Style as broken image placeholder - preserve original dimensions from paste
            // Use inline width/height attributes if present, otherwise use natural size
            const originalWidth = img.getAttribute('width') || img.style.width || img.naturalWidth;
            const originalHeight = img.getAttribute('height') || img.style.height || img.naturalHeight;
            if (originalWidth) img.style.width = typeof originalWidth === 'number' ? `${originalWidth}px` : originalWidth;
            if (originalHeight) img.style.height = typeof originalHeight === 'number' ? `${originalHeight}px` : originalHeight;
            img.style.backgroundColor = '#fee2e2';
            img.style.border = '2px dashed #ef4444';
            img.style.display = 'inline-block';
            img.alt = 'CLICK TO REPLACE';
            img.title = 'This image cannot be sent in emails. Click to upload a replacement.';
          }
          
          // Add error handler for images that fail to load - preserve original size
          img.onerror = () => {
            const originalWidth = img.getAttribute('width') || img.style.width || img.naturalWidth;
            const originalHeight = img.getAttribute('height') || img.style.height || img.naturalHeight;
            if (originalWidth) img.style.width = typeof originalWidth === 'number' ? `${originalWidth}px` : originalWidth;
            if (originalHeight) img.style.height = typeof originalHeight === 'number' ? `${originalHeight}px` : originalHeight;
            img.style.backgroundColor = '#fee2e2';
            img.style.border = '2px dashed #ef4444';
            img.style.display = 'inline-block';
            img.alt = 'CLICK TO REPLACE';
            img.title = 'This image failed to load. Click to upload a replacement.';
          };
        });
        
        if (brokenCount > 0) {
          toast({ 
            title: `${brokenCount} image(s) need replacement!`, 
            description: "Click on each RED BOX to upload a working image. Without this, images won't appear in emails.",
            variant: "destructive"
          });
        }
      }
    }, 200);
  };

  // Handler to upload logo image and insert into signature editor
  const handleSignatureLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid file", description: "Please select an image file", variant: "destructive" });
      return;
    }
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 5MB", variant: "destructive" });
      return;
    }
    
    setIsUploadingSignatureLogo(true);
    
    try {
      const formData = new FormData();
      formData.append('logo', file);
      
      const response = await fetch('/api/upload-logo', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const data = await response.json();
      const imageUrl = data.path; // Full URL for emails
      
      // Insert image at cursor position in the signature editor
      if (signatureEditorRef.current) {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.maxWidth = '200px';
        img.style.height = 'auto';
        img.alt = 'Logo';
        
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(img);
          range.collapse(false);
        } else {
          // If no selection, append to end
          signatureEditorRef.current.appendChild(img);
        }
      }
      
      toast({ title: "Logo uploaded", description: "Image inserted into signature" });
    } catch (error) {
      console.error('Logo upload error:', error);
      toast({ title: "Upload failed", description: "Could not upload image", variant: "destructive" });
    } finally {
      setIsUploadingSignatureLogo(false);
      // Clear the file input so the same file can be uploaded again if needed
      if (signatureLogoInputRef.current) {
        signatureLogoInputRef.current.value = '';
      }
    }
  };

  const totalSteps = 3;
  const progressPercent = (currentStep / totalSteps) * 100;

  // Helper function to safely parse hubspotTriggerTags (handles Postgres array strings like "{tag1,tag2}")
  const parseHubspotTags = (sender: OutreachSender | null): string[] => {
    if (!sender) return ["LandLinq Broker"];
    const rawTags = sender.hubspotTriggerTags as string[] | string | undefined | null;
    if (Array.isArray(rawTags)) return rawTags;
    if (typeof rawTags === "string" && rawTags.startsWith("{")) {
      return rawTags.slice(1, -1).split(",").map((t: string) => t.replace(/^"|"$/g, "").trim()).filter(Boolean);
    }
    if (sender.hubspotTriggerTag) return [sender.hubspotTriggerTag];
    return ["LandLinq Broker"];
  };

  // Fetch senders - always fetch fresh data to ensure CRM Owner IDs are up to date
  const { data: senders = [], isLoading: sendersLoading, refetch: refetchSenders } = useQuery<OutreachSender[]>({
    queryKey: ["/api/outreach/senders"],
    staleTime: 0,
    refetchOnMount: "always",
    select: (data: OutreachSender[]) => {
      // Guard against non-array data
      if (!Array.isArray(data)) {
        console.error("[SENDER-CLIENT] Expected array from /api/outreach/senders, got:", typeof data, data);
        return [];
      }
      return data.map((sender: OutreachSender) => {
        const rawOutlookConnected = (sender as any).outlookConnected;
        const outlookConnected = rawOutlookConnected === true || rawOutlookConnected === 't' || rawOutlookConnected === 'true' || rawOutlookConnected === 1;
        return {
          ...sender,
          outlookConnected: outlookConnected,
          isActive: (sender as any).isActive === true || (sender as any).isActive === 't' || (sender as any).isActive === 'true' || (sender as any).isActive === 1,
        };
      });
    },
  });

  // Detect OAuth callback success and refresh senders data
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'outlook_connected') {
      toast({ title: "Outlook Connected", description: "Your Microsoft Outlook account has been connected successfully." });
      refetchSenders();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (urlParams.get('error')) {
      const errorType = urlParams.get('error');
      const expected = urlParams.get('expected');
      const actual = urlParams.get('actual');
      
      let errorMessage = `OAuth error: ${errorType}. Please try again.`;
      let errorTitle = "Outlook Connection Failed";
      
      // Handle email mismatch error with more specific message
      if (errorType === 'email_mismatch' && expected && actual) {
        errorTitle = "Wrong Microsoft Account";
        errorMessage = `You logged in with ${actual} but this sender is configured for ${expected}. Please sign out of Microsoft and try again with the correct account.`;
      }
      
      toast({ 
        title: errorTitle, 
        description: errorMessage,
        variant: "destructive",
        duration: 10000  // Show for 10 seconds so user can read it
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Keep editingSender in sync with server data after refreshes (e.g., after signature auto-save)
  useEffect(() => {
    if (editingSender && senders.length > 0) {
      const latestSender = senders.find(s => s.id === editingSender.id);
      if (latestSender && latestSender.signatureHtml !== editingSender.signatureHtml) {
        setEditingSender(prev => prev ? { ...prev, signatureHtml: latestSender.signatureHtml } : null);
      }
    }
  }, [senders, editingSender?.id]);

  // Fetch business settings for branding
  const { data: settings } = useQuery<BusinessSettings>({
    queryKey: ["/api/business-settings"],
  });

  // Fetch dry run mode status
  const { data: dryRunData } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/outreach/dry-run-mode"],
  });
  const isDryRunMode = dryRunData?.enabled === true;

  // Fetch dry run logs when modal is open
  interface DryRunLog {
    id: string;
    channel: string;
    recipient: string;
    subject?: string;
    content: string;
    sentAt: string;
    createdAt: string;
    brokerFirstName?: string;
    brokerLastName?: string;
    brokerEmail?: string;
    campaignName?: string;
  }
  const { data: dryRunLogsData, refetch: refetchDryRunLogs, isLoading: isLoadingDryRunLogs } = useQuery<{ logs: DryRunLog[], count: number }>({
    queryKey: ["/api/outreach/dry-run-logs"],
    enabled: showDryRunLogs, // Only fetch when modal is open
  });

  // Clear dry run logs mutation
  const clearDryRunLogsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/outreach/dry-run-logs", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/outreach/dry-run-logs"] });
      toast({ title: "Logs Cleared", description: "All dry run logs have been deleted." });
    },
  });

  // Toggle dry run mode
  const toggleDryRunMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch("/api/outreach/dry-run-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/outreach/dry-run-mode"] });
      toast({ 
        title: data.enabled ? "Dry Run Mode ON" : "LIVE Mode Enabled", 
        description: data.enabled 
          ? "Emails will be logged but NOT sent. Safe for testing." 
          : "Emails will now be sent to real recipients!",
        variant: data.enabled ? "default" : "destructive"
      });
    },
  });

  // Fetch campaign config
  const { data: campaigns = [] } = useQuery<CampaignConfig[]>({
    queryKey: ["/api/outreach/campaigns"],
  });

  // Fetch shared campaign templates for tag-to-campaign lookup
  interface SharedCampaignTemplate {
    id: string;
    name: string;
    hubspotTriggerTag: string;
    isActive: boolean;
  }
  const { data: sharedTemplates = [] } = useQuery<SharedCampaignTemplate[]>({
    queryKey: ["/api/outreach/campaign-templates"],
  });

  // Helper function to find matching campaign template for a tag
  const findMatchingTemplate = (tag: string): SharedCampaignTemplate | undefined => {
    if (!tag.trim()) return undefined;
    return sharedTemplates.find(t => 
      t.hubspotTriggerTag?.toLowerCase() === tag.toLowerCase()
    );
  };

  // Fetch team members for dropdown selection
  interface TeamMember {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  }
  const { data: usersData } = useQuery<{ users: TeamMember[] }>({
    queryKey: ["/api/users"],
  });

  const { data: crmTags = [] } = useQuery<string[]>({
    queryKey: ["/api/crm/tags"],
  });
  const safeSenders = Array.isArray(senders) ? senders : [];
  const teamMembers = (Array.isArray(usersData?.users) ? usersData.users : []).filter(u => 
    u.email?.endsWith('@catalystcp.com') && 
    !safeSenders.some(s => s.email === u.email) // Exclude already added senders
  );

  // Create sender mutation
  const createSenderMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; role: string }) => {
      const res = await fetch("/api/outreach/senders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sender added successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/outreach/senders"] });
      setShowAddSender(false);
      setNewSenderData({ name: "", email: "", role: "partner" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add sender", description: error.message, variant: "destructive" });
    },
  });

  // Update sender mutation (closes the editing modal on success)
  const updateSenderMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<OutreachSender> & { id: string }) => {
      const res = await fetch(`/api/outreach/senders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sender updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/outreach/senders"] });
      setEditingSender(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update sender", description: error.message, variant: "destructive" });
    },
  });

  // Auto-save mutation for signature (uses dedicated endpoint, keeps the editing modal open)
  const autoSaveSignatureMutation = useMutation({
    mutationFn: async ({ id, signatureHtml, senderEmail }: { id: string; signatureHtml: string; senderEmail?: string }) => {
      console.log('[SIGNATURE] Saving signature for sender:', id, 'email:', senderEmail, 'length:', signatureHtml?.length);
      const res = await fetch(`/api/outreach/senders/${id}/signature`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureHtml, senderEmail }),
        credentials: "include",
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[SIGNATURE] Save failed:', res.status, errorText);
        // Parse error message if it's JSON
        let errorMessage = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorText;
        } catch (e) {
          // Not JSON, use as-is
        }
        // Special handling for auth issues
        if (res.status === 401) {
          throw new Error("Session expired. Please refresh the page and try again.");
        }
        if (res.status === 403) {
          throw new Error("Access denied. Only analysts can save signatures.");
        }
        throw new Error(errorMessage);
      }
      const result = await res.json();
      console.log('[SIGNATURE] Save successful:', result);
      return result;
    },
    onSuccess: () => {
      toast({ title: "Signature saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/outreach/senders"] });
      // Don't close the editing modal - user may continue editing other fields
    },
    onError: (error: any, variables) => {
      console.error('[SIGNATURE] Mutation error:', error);
      // Roll back the optimistic update so the badge stops showing "Configured"
      setEditingSender(prev => prev ? { ...prev, signatureHtml: '' } : null);
      toast({ title: "Failed to save signature", description: error.message, variant: "destructive" });
    },
  });

  // Delete sender mutation
  const deleteSenderMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/outreach/senders/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sender removed successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/outreach/senders"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to remove sender", description: err.message, variant: "destructive" });
    },
  });

  // Fetch campaign steps when editing a sender
  useEffect(() => {
    if (editingSender) {
      fetch(`/api/outreach/senders/${editingSender.id}/campaign-steps`, { credentials: 'include' })
        .then(res => res.json())
        .then(steps => {
          // Guard against non-array responses
          if (Array.isArray(steps)) {
            setCampaignSteps(steps);
          } else {
            console.error("[CAMPAIGN-STEPS] Expected array, got:", typeof steps, steps);
            setCampaignSteps([]);
          }
        })
        .catch((err) => {
          console.error("[CAMPAIGN-STEPS] Fetch error:", err);
          setCampaignSteps([]);
        });
    } else {
      setCampaignSteps([]);
    }
  }, [editingSender?.id]);


  // Fetch template steps for a specific tag
  const fetchTemplateStepsForTag = async (tag: string) => {
    if (!tag.trim()) return;
    try {
      const templateRes = await fetch(`/api/outreach/campaign-templates?hubspotTriggerTag=${encodeURIComponent(tag)}`, { credentials: 'include' });
      const templates = await templateRes.json();
      if (templates && templates.length > 0) {
        const templateId = templates[0].id;
        const stepsRes = await fetch(`/api/outreach/campaign-templates/${templateId}/steps`, { credentials: 'include' });
        const steps = await stepsRes.json();
        setTemplateStepsByTag(prev => ({ ...prev, [tag]: Array.isArray(steps) ? steps : [] }));
      } else {
        setTemplateStepsByTag(prev => ({ ...prev, [tag]: [] }));
      }
    } catch (err) {
      console.error("[TEMPLATE-STEPS] Fetch error for tag:", tag, err);
      setTemplateStepsByTag(prev => ({ ...prev, [tag]: [] }));
    }
  };

  // Fetch template steps when editing sender with trigger tags
  useEffect(() => {
    if (editingSender) {
      const tags = parseHubspotTags(editingSender);
      tags.forEach(tag => {
        if (tag.trim()) {
          fetchTemplateStepsForTag(tag);
        }
      });
    } else {
      setTemplateStepsByTag({});
      setExpandedTags({});
    }
  }, [editingSender?.id]);

  // Create campaign step mutation
  const createStepMutation = useMutation({
    mutationFn: async (data: { senderId: string; dayNumber: number; channel: string; subject?: string; content: string; lineHeight?: string; attachments?: string }) => {
      const res = await fetch(`/api/outreach/senders/${data.senderId}/campaign-steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (newStep) => {
      toast({ title: "Campaign step added" });
      setCampaignSteps(prev => Array.isArray(prev) ? [...prev, newStep] : [newStep]);
      setShowAddStep(false);
      setNewStepData({ dayNumber: 1, channel: 'email', subject: '', content: '', lineHeight: '1.5', attachments: [] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add step", description: error.message, variant: "destructive" });
    },
  });

  // Update campaign step mutation
  const updateStepMutation = useMutation({
    mutationFn: async ({ stepId, ...data }: { stepId: string } & Partial<CampaignStep>) => {
      const res = await fetch(`/api/outreach/campaign-steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (updated) => {
      toast({ title: "Campaign step updated" });
      setCampaignSteps(prev => Array.isArray(prev) ? prev.map(s => s.id === updated.id ? updated : s) : []);
      setEditingStep(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update step", description: error.message, variant: "destructive" });
    },
  });

  // Delete campaign step mutation
  const deleteStepMutation = useMutation({
    mutationFn: async (stepId: string) => {
      const res = await fetch(`/api/outreach/campaign-steps/${stepId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (_, stepId) => {
      toast({ title: "Campaign step removed" });
      setCampaignSteps(prev => Array.isArray(prev) ? prev.filter(s => s.id !== stepId) : []);
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove step", description: error.message, variant: "destructive" });
    },
  });

  // Connect Outlook mutation
  const connectOutlookMutation = useMutation({
    mutationFn: async (senderId: string) => {
      const res = await fetch(`/api/outreach/senders/${senderId}/connect-outlook`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data: any) => {
      console.log('Connect Outlook response:', data);
      if (data.authUrl) {
        console.log('Redirecting to Microsoft OAuth:', data.authUrl);
        // Use window.location.href for better cross-browser compatibility
        window.location.href = data.authUrl;
      } else if (data.error) {
        toast({ title: "OAuth Error", description: data.message || data.error, variant: "destructive" });
      } else {
        toast({ title: "No auth URL received", description: "Please try again", variant: "destructive" });
      }
    },
    onError: (error: any) => {
      console.error('Connect Outlook error:', error);
      toast({ title: "Failed to initiate Outlook connection", description: error.message, variant: "destructive" });
    },
  });

  const companyName = settings?.companyName || "Your Company";

  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center mb-4">
        {[1, 2, 3].map((step, index) => (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all flex-shrink-0 ${
                step < currentStep
                  ? "bg-green-500 text-white"
                  : step === currentStep
                  ? "bg-catalyst-navy text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {step < currentStep ? <CheckCircle className="h-5 w-5" /> : step}
            </div>
            {step < 3 && (
              <div
                className={`flex-1 h-1 ${
                  step < currentStep ? "bg-green-500" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-sm text-gray-600">
        <span>Team Setup</span>
        <span className="text-center">Email Integration</span>
        <span>CRM Sync</span>
      </div>
      <Progress value={progressPercent} className="mt-4" />
    </div>
  );

  // Step 1: Team/Sender Setup
  const renderStep1 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Configure Your Outreach Team
        </CardTitle>
        <CardDescription>
          Add team members who will send personalized outreach emails to your contacts.
          Each sender can have their own email account connected for authentic communication.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {sendersLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {(senders || []).map((sender) => (
              <div
                key={sender.id}
                className="border rounded-lg p-4 space-y-4"
                data-testid={`sender-card-${sender.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-catalyst-navy rounded-full flex items-center justify-center text-white font-semibold">
                      {sender.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <h4 className="font-semibold">{sender.name}</h4>
                      <p className="text-sm text-gray-500">{sender.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={sender.isActive ? "default" : "secondary"}>
                      {sender.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge
                      variant={sender.outlookConnected === true && !sender.tokenExpired ? "default" : "outline"}
                      className={
                        sender.tokenExpired
                          ? "bg-red-500 text-white border-red-500"
                          : sender.tokenExpiringSoon
                          ? "bg-yellow-400 text-black border-yellow-400"
                          : sender.outlookConnected === true
                          ? "bg-green-500"
                          : ""
                      }
                    >
                      {sender.tokenExpired ? (
                        <>
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Session expired — Reconnect
                        </>
                      ) : sender.tokenExpiringSoon ? (
                        <>
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Reconnect within {refreshTokenDaysLeft(sender.microsoftTokenExpiry)} days
                        </>
                      ) : sender.outlookConnected === true ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Outlook Connected
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          Not Connected
                        </>
                      )}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div>
                    <Label className="text-xs text-gray-500">Role</Label>
                    <p className="font-medium capitalize">{sender.role}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">SMS Steps</Label>
                    <p className="font-medium text-gray-600 text-sm">
                      Add via Configure
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">CRM Owner ID</Label>
                    <p className="font-medium">{sender.hubspotOwnerId || "Not linked"}</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  {sender.tokenExpired ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => connectOutlookMutation.mutate(sender.id)}
                      disabled={connectOutlookMutation.isPending}
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Reconnect Outlook — Token Expired
                    </Button>
                  ) : sender.outlookConnected !== true ? (
                    <Button
                      size="sm"
                      onClick={() => connectOutlookMutation.mutate(sender.id)}
                      disabled={connectOutlookMutation.isPending}
                      data-testid={`connect-outlook-${sender.id}`}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Connect Outlook
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => {
                        console.log('[RECONNECT-CLICK] Initiating reconnect for sender:', sender.id, sender.email);
                        connectOutlookMutation.mutate(sender.id);
                      }}
                      disabled={connectOutlookMutation.isPending}
                      data-testid={`reconnect-outlook-${sender.id}`}
                      title="Reconnect if your token has expired"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reconnect Outlook
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingSender(sender)}
                    data-testid={`edit-sender-${sender.id}`}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => {
                      if (confirm("Are you sure you want to remove this sender?")) {
                        deleteSenderMutation.mutate(sender.id);
                      }
                    }}
                    data-testid={`delete-sender-${sender.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {showAddSender ? (
              <div className="border-2 border-dashed rounded-lg p-4 space-y-4">
                <h4 className="font-semibold">Add New Team Member</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Select Team Member</Label>
                    <Select
                      value={newSenderData.email}
                      onValueChange={(email) => {
                        const member = teamMembers.find(m => m.email === email);
                        if (member) {
                          const fullName = [member.firstName, member.lastName].filter(Boolean).join(' ') || email.split('@')[0];
                          setNewSenderData({ 
                            ...newSenderData, 
                            name: fullName,
                            email: member.email 
                          });
                        }
                      }}
                    >
                      <SelectTrigger data-testid="new-sender-name">
                        <SelectValue placeholder="Select a team member..." />
                      </SelectTrigger>
                      <SelectContent>
                        {!Array.isArray(teamMembers) || teamMembers.length === 0 ? (
                          <div className="p-2 text-sm text-gray-500">No team members available</div>
                        ) : (
                          teamMembers.map((member) => (
                            <SelectItem key={member.id} value={member.email}>
                              {[member.firstName, member.lastName].filter(Boolean).join(' ') || member.email.split('@')[0]} ({member.email})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Email Address</Label>
                    <Input
                      type="email"
                      placeholder="Auto-filled from selection"
                      value={newSenderData.email}
                      readOnly
                      className="bg-gray-50"
                      data-testid="new-sender-email"
                    />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Select
                      value={newSenderData.role}
                      onValueChange={(val) => setNewSenderData({ ...newSenderData, role: val })}
                    >
                      <SelectTrigger data-testid="new-sender-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="partner">Partner</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="representative">Representative</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => createSenderMutation.mutate(newSenderData)}
                    disabled={!newSenderData.name || !newSenderData.email || createSenderMutation.isPending}
                    data-testid="save-new-sender"
                  >
                    {createSenderMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Add Team Member
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddSender(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={() => setShowAddSender(true)}
                data-testid="add-sender-button"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Team Member
              </Button>
            )}
          </>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <div />
        <Button 
          onClick={() => {
            // Dec 22, 2025: Auto-save unsaved team member before navigating
            if (showAddSender && newSenderData.name && newSenderData.email) {
              createSenderMutation.mutate(newSenderData, {
                onSuccess: () => setCurrentStep(2)
              });
            } else {
              setCurrentStep(2);
            }
          }} 
          disabled={!!(showAddSender && newSenderData.name && newSenderData.email && createSenderMutation.isPending)}
          data-testid="step1-next"
        >
          {createSenderMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Continue to Email Integration
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );

  // Step 2: Email Integration (Microsoft Graph API)
  const renderStep2 = () => {
    const connectedCount = senders.filter((s) => s.outlookConnected === true && !s.tokenExpired).length;
    const expiredCount = senders.filter((s) => s.tokenExpired).length;
    const totalCount = senders.length;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-[#0078D4]" />
            Connect Email Accounts
          </CardTitle>
          <CardDescription>
            Connect each team member's Microsoft Outlook account to send emails directly from their inbox.
            This creates authentic, personal communication with your contacts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Secure OAuth Connection:</strong> We use Microsoft's official OAuth 2.0 flow.
              Your team members will sign in directly with Microsoft - we never see their passwords.
            </AlertDescription>
          </Alert>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="font-medium">Connection Status</span>
              <div className="flex items-center gap-2">
                {expiredCount > 0 && (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {expiredCount} expired
                  </Badge>
                )}
                <Badge variant={connectedCount === totalCount ? "default" : "secondary"}>
                  {connectedCount} of {totalCount} active
                </Badge>
              </div>
            </div>
            <Progress value={(connectedCount / Math.max(totalCount, 1)) * 100} />
          </div>

          <div className="space-y-3">
            {(senders || []).map((sender) => (
              <div
                key={sender.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  sender.tokenExpired
                    ? "bg-red-50 border-red-300"
                    : sender.tokenExpiringSoon
                    ? "bg-yellow-50 border-yellow-300"
                    : sender.outlookConnected === true
                    ? "bg-green-50 border-green-200"
                    : "bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      sender.tokenExpired
                        ? "bg-red-500 text-white"
                        : sender.tokenExpiringSoon
                        ? "bg-yellow-400 text-black"
                        : sender.outlookConnected === true
                        ? "bg-green-500 text-white"
                        : "bg-gray-300"
                    }`}
                  >
                    {sender.tokenExpired ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : sender.outlookConnected === true ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <Mail className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{sender.name}</p>
                    <p className="text-sm text-gray-500">{sender.email}</p>
                    {sender.tokenExpired && (
                      <p className="text-xs text-red-600 font-medium mt-0.5">
                        Session expired — emails are not sending. Reconnect to resume.
                      </p>
                    )}
                    {sender.tokenExpiringSoon && !sender.tokenExpired && (
                      <p className="text-xs text-yellow-700 font-medium mt-0.5">
                        Reconnect within {refreshTokenDaysLeft(sender.microsoftTokenExpiry)} days to avoid interruption.
                      </p>
                    )}
                  </div>
                </div>
                {sender.tokenExpired ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => connectOutlookMutation.mutate(sender.id)}
                    disabled={connectOutlookMutation.isPending}
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Reconnect
                  </Button>
                ) : sender.outlookConnected === true ? (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-500">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => connectOutlookMutation.mutate(sender.id)}
                      disabled={connectOutlookMutation.isPending}
                      title="Reconnect if your token has expired"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => connectOutlookMutation.mutate(sender.id)}
                    disabled={connectOutlookMutation.isPending}
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Connect Now
                  </Button>
                )}
              </div>
            ))}
          </div>

          {connectedCount === 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                At least one email account must be connected to send outreach campaigns.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => setCurrentStep(1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button onClick={() => setCurrentStep(3)} data-testid="step2-next">
            Continue to CRM Sync
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardFooter>
      </Card>
    );
  };

  // Step 3: Internal CRM Sync
  const renderStep3 = () => {
    const previewSync = async () => {
      setCrmSyncing(true);
      try {
        const res = await fetch('/api/crm/outreach-stats', { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data?.byAssignee) throw new Error('Invalid response');
        setCrmStats(data);
        toast({
          title: "CRM Synced",
          description: `${(data.total || 0).toLocaleString()} contacts ready — ${data.dailyLimit} emails will go out per day.`,
        });
      } catch {
        toast({ title: "Sync failed", description: "Could not load CRM stats", variant: "destructive" });
      }
      setCrmSyncing(false);
    };

    return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          CRM Sync
        </CardTitle>
        <CardDescription>
          Your internal CRM is the source of truth for outreach. Configure the daily send rate and confirm contact assignments before launching.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* CRM Overview */}
        <div className="border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Contact Overview</h4>
            {crmStats && (
              <Badge variant="secondary" className="text-sm">
                {crmStats.total.toLocaleString()} total contacts
              </Badge>
            )}
          </div>
          <Separator />
          {!crmStats ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading CRM stats…
            </div>
          ) : (
            <div className="space-y-3">
              {(crmStats.byAssignee || []).length === 0 ? (
                <p className="text-sm text-gray-500">No contacts with assigned team members yet. Import your contacts first.</p>
              ) : (
                (crmStats.byAssignee || []).map(row => (
                  <div key={row.name || 'unknown'} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {(row.name || '?').split(" ").map((n: string) => n[0] || '').join("").slice(0, 2).toUpperCase() || '?'}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-0.5">
                        <span className="font-medium">{row.name}</span>
                        <span className="text-gray-500">{row.count.toLocaleString()} contacts</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-blue-500"
                          style={{ width: `${Math.round((row.count / crmStats.total) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 w-8 text-right">
                      {Math.round((row.count / crmStats.total) * 100)}%
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              data-testid="sync-crm"
              onClick={previewSync}
              disabled={crmSyncing}
            >
              {crmSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh Stats
            </Button>
          </div>
        </div>

        {/* Daily limit */}
        <CrmDailyLimitCard />

        {/* Team member → sender mapping */}
        <div className="border rounded-lg p-4">
          <h4 className="font-semibold mb-1">Team Member Senders</h4>
          <p className="text-sm text-gray-500 mb-4">
            Each team member's contacts will be emailed from their connected Outlook account.
            The "Assigned To" field in the CRM determines routing.
          </p>
          <div className="space-y-3">
            {(senders || []).map((sender) => {
              const assigneeRow = crmStats?.byAssignee.find(r =>
                r.name.toLowerCase().includes(sender.name.split(" ")[0].toLowerCase())
              );
              return (
                <div key={sender.id} className="flex items-center gap-4 py-2 border-b last:border-0">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                    {sender.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{sender.name}</p>
                    <p className="text-xs text-gray-500">{sender.email}</p>
                  </div>
                  <div className="text-right">
                    {assigneeRow ? (
                      <>
                        <p className="text-sm font-semibold text-blue-700">{assigneeRow.count.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">contacts</p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400">—</p>
                    )}
                  </div>
                  <Badge variant={sender.outlookConnected ? "default" : "outline"} className="text-xs">
                    {sender.outlookConnected ? "Outlook ✓" : "No Outlook"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep(2)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={() => {
            toast({ title: "Setup Complete!", description: "Your outreach team is configured. Campaigns will start sending at the configured daily rate." });
          }}
          data-testid="step3-complete"
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Complete Setup
        </Button>
      </CardFooter>
    </Card>
    );
  };

  // Sender edit modal with HubSpot tagging automation
  const renderEditSenderModal = () => {
    if (!editingSender) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-[95vw] h-[95vh] m-4 overflow-y-auto">
          <CardHeader>
            <CardTitle>Configure {editingSender.name} ({editingSender.email})</CardTitle>
            <CardDescription>
              Build multi-step drip campaigns for automated broker outreach
              <span className="block text-xs text-gray-400 mt-1">Sender ID: {editingSender.id}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input
                value={editingSender.name}
                onChange={(e) => setEditingSender({ ...editingSender, name: e.target.value })}
                data-testid="sender-name-input"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={editingSender.email}
                onChange={(e) => setEditingSender({ ...editingSender, email: e.target.value })}
                data-testid="sender-email-input"
              />
            </div>

            {/* Email Signature */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-purple-500" />
                  <span className="font-medium text-sm text-gray-700">Email Signature</span>
                  {editingSender.signatureHtml && (
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">Configured</Badge>
                  )}
                </div>
                <Popover open={signaturePopoverOpen} onOpenChange={(open) => {
                  if (!open) {
                    // Sync signature from ref to state when popover closes
                    syncSignatureToState();
                  }
                  setSignaturePopoverOpen(open);
                }}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Edit2 className="h-3 w-3 mr-1" />
                      {editingSender.signatureHtml ? 'Edit Signature' : 'Add Signature'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[500px] p-4" align="end">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <Label className="text-sm font-medium">Personal Email Signature</Label>
                          <p className="text-xs text-gray-500">
                            Paste from Outlook. Select text/image then click "Add Link" for hyperlinks.
                          </p>
                        </div>
                        <div className="flex gap-1 flex-wrap justify-end">
                          <input
                            ref={signatureLogoInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleSignatureLogoUpload}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => signatureLogoInputRef.current?.click()}
                            disabled={isUploadingSignatureLogo}
                            className="text-xs"
                          >
                            {isUploadingSignatureLogo ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <ImagePlus className="h-3 w-3 mr-1" />
                            )}
                            Add Logo
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const url = prompt('Enter the link URL (e.g., https://linkedin.com/in/yourprofile):');
                              if (url) {
                                const selection = window.getSelection();
                                if (selection && selection.rangeCount > 0) {
                                  const range = selection.getRangeAt(0);
                                  
                                  // Check if an image is selected
                                  const selectedNode = range.startContainer.parentElement;
                                  if (selectedNode?.tagName === 'IMG' || range.startContainer.nodeName === 'IMG') {
                                    // Wrap image in anchor
                                    const img = selectedNode?.tagName === 'IMG' ? selectedNode : range.startContainer;
                                    const anchor = document.createElement('a');
                                    anchor.href = url;
                                    anchor.target = '_blank';
                                    img.parentNode?.insertBefore(anchor, img);
                                    anchor.appendChild(img);
                                  } else if (!range.collapsed) {
                                    // Wrap selected text in anchor
                                    document.execCommand('createLink', false, url);
                                  } else {
                                    toast({ title: "Select something first", description: "Highlight text or click on an image before adding a link.", variant: "destructive" });
                                  }
                                }
                              }
                            }}
                            className="text-xs"
                          >
                            <LinkIcon className="h-3 w-3 mr-1" />
                            Add Link
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              if (!signatureEditorRef.current) return;
                              
                              setIsUploadingSignatureLogo(true);
                              const imgs = signatureEditorRef.current.querySelectorAll('img');
                              let uploadedCount = 0;
                              let brokenCount = 0;
                              const brokenTypes: string[] = [];
                              
                              console.log('[SIGNATURE] Found', imgs.length, 'images in editor');
                              
                              for (const img of Array.from(imgs)) {
                                const src = img.getAttribute('src') || '';
                                console.log('[SIGNATURE] Image src:', src.substring(0, 80));
                                
                                // Skip already uploaded images (on our domain)
                                if (src.includes('catalyst.landlinq.ai') || src.includes('/api/public/storage/')) {
                                  console.log('[SIGNATURE] Already hosted, skipping');
                                  continue;
                                }
                                
                                // Skip data URIs (already handled/embedded)
                                if (src.startsWith('data:')) {
                                  console.log('[SIGNATURE] Data URI, skipping');
                                  continue;
                                }
                                
                                // Detect broken/unfixable images
                                if (!src || src.startsWith('file://') || src.startsWith('cid:') || src.startsWith('blob:')) {
                                  brokenCount++;
                                  if (src.startsWith('file://')) brokenTypes.push('local file');
                                  else if (src.startsWith('cid:')) brokenTypes.push('email attachment');
                                  else if (src.startsWith('blob:')) brokenTypes.push('temporary blob');
                                  else brokenTypes.push('empty source');
                                  // Remove broken image from editor
                                  img.remove();
                                  continue;
                                }
                                
                                // Try to re-upload external URLs
                                if (src.startsWith('http://') || src.startsWith('https://')) {
                                  try {
                                    console.log('[SIGNATURE] Re-uploading external image:', src.substring(0, 50));
                                    const response = await fetch('/api/upload-external-image', {
                                      method: 'POST',
                                      credentials: 'include',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ imageUrl: src })
                                    });
                                    
                                    if (response.ok) {
                                      const { url } = await response.json();
                                      if (url) {
                                        img.setAttribute('src', url);
                                        uploadedCount++;
                                        console.log('[SIGNATURE] Image re-uploaded successfully');
                                      }
                                    } else {
                                      // External URL failed to upload - remove it
                                      brokenCount++;
                                      brokenTypes.push('inaccessible URL');
                                      img.remove();
                                    }
                                  } catch (err) {
                                    console.error('[SIGNATURE] Failed to re-upload:', err);
                                    brokenCount++;
                                    brokenTypes.push('failed download');
                                    img.remove();
                                  }
                                }
                              }
                              
                              setIsUploadingSignatureLogo(false);
                              
                              if (uploadedCount > 0 && brokenCount === 0) {
                                toast({ title: "Images fixed", description: `${uploadedCount} image(s) uploaded to your server.` });
                              } else if (brokenCount > 0) {
                                const uniqueTypes = [...new Set(brokenTypes)].join(', ');
                                toast({ 
                                  title: `Removed ${brokenCount} broken image(s)`, 
                                  description: `These images can't be saved: ${uniqueTypes}. Use "Add Logo" to manually upload images from your computer.`,
                                  variant: "destructive"
                                });
                              } else {
                                toast({ title: "No images to fix", description: "All images are already hosted or none were found.", variant: "default" });
                              }
                            }}
                            disabled={isUploadingSignatureLogo}
                            className="text-xs"
                          >
                            {isUploadingSignatureLogo ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3 mr-1" />
                            )}
                            Fix Images
                          </Button>
                        </div>
                      </div>
                      <input
                        ref={(el) => { (window as any).__signatureReplaceInput = el; }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          const targetImg = (window as any).__signatureReplaceTarget as HTMLImageElement | null;
                          if (!file || !targetImg) return;
                          
                          setIsUploadingSignatureLogo(true);
                          try {
                            const formData = new FormData();
                            formData.append('logo', file);
                            const response = await fetch('/api/upload-logo', {
                              method: 'POST',
                              credentials: 'include',
                              body: formData
                            });
                            
                            if (response.ok) {
                              const data = await response.json();
                              const imageUrl = data.url || data.path || data.relativePath;
                              if (imageUrl) {
                                // Create a fresh img element to replace the broken one
                                // This ensures no cached error state persists from the old element
                                const newImg = document.createElement('img');
                                newImg.src = imageUrl;
                                newImg.style.maxWidth = targetImg.style.maxWidth || '150px';
                                newImg.style.height = 'auto';
                                newImg.alt = '';
                                
                                // Copy over any existing dimensions
                                if (targetImg.width) newImg.width = targetImg.width;
                                if (targetImg.height) newImg.height = targetImg.height;
                                
                                // Replace the old img with the new one in the DOM
                                targetImg.parentNode?.replaceChild(newImg, targetImg);
                                
                                console.log('[SIGNATURE] Image replaced with new element, src:', imageUrl);
                                toast({ title: "Image replaced!", description: "Click Done to save your signature." });
                              }
                            }
                          } catch (err) {
                            console.error('Failed to upload replacement image:', err);
                            toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
                          } finally {
                            setIsUploadingSignatureLogo(false);
                            (window as any).__signatureReplaceTarget = null;
                            e.target.value = '';
                          }
                        }}
                      />
                      <p className="text-xs text-blue-600 mb-1">💡 Click any image to replace it with your own photo</p>
                      <div 
                        ref={signatureEditorRef}
                        contentEditable
                        suppressContentEditableWarning
                        data-signature-editor
                        className="border rounded-lg p-3 min-h-[150px] max-h-[350px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 overflow-auto"
                        onPaste={handleSignaturePaste}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.tagName === 'IMG') {
                            e.preventDefault();
                            // Highlight the clicked image
                            target.style.outline = '3px solid #3b82f6';
                            
                            // Show action menu: Replace or Add Link
                            const action = window.confirm(
                              'What would you like to do with this image?\n\n' +
                              'Click OK to ADD A LINK (hyperlink the image)\n' +
                              'Click Cancel to REPLACE the image with a new one'
                            );
                            
                            if (action) {
                              // User chose to ADD A LINK
                              const url = prompt('Enter the link URL for this image:\n(e.g., https://linkedin.com/in/yourprofile)');
                              if (url && url.trim()) {
                                // Wrap image in anchor tag
                                const anchor = document.createElement('a');
                                anchor.href = url.trim();
                                anchor.target = '_blank';
                                anchor.style.textDecoration = 'none';
                                target.parentNode?.insertBefore(anchor, target);
                                anchor.appendChild(target);
                                target.style.outline = '';
                                toast({ title: "Link added!", description: "Image is now clickable. Click Done to save." });
                              } else {
                                target.style.outline = '';
                              }
                            } else {
                              // User chose to REPLACE image
                              (window as any).__signatureReplaceTarget = target;
                              const input = (window as any).__signatureReplaceInput as HTMLInputElement;
                              if (input) input.click();
                            }
                          }
                        }}
                        data-testid="sender-signature-input"
                      />
                      <div className="flex gap-2">
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => {
                            // Sync signature from ref and auto-save to database
                            if (signatureEditorRef.current && editingSender) {
                              const html = signatureEditorRef.current.innerHTML;
                              console.log('[SIGNATURE-DEBUG] Raw HTML from editor:', html?.substring(0, 200), '... (length:', html?.length, ')');
                              const cleanedHtml = cleanSignatureHtml(html);
                              console.log('[SIGNATURE-DEBUG] Cleaned HTML:', cleanedHtml?.substring(0, 200), '... (length:', cleanedHtml?.length, ')');
                              
                              // Check for broken images that need replacing
                              const brokenImageCount = (html.match(/src="(file:|cid:|blob:|data:image\/[^"]{50000,})"/gi) || []).length;
                              if (brokenImageCount > 0) {
                                toast({ 
                                  title: "Warning: Some images may not work", 
                                  description: `${brokenImageCount} image(s) have problematic URLs. Click on them to replace with uploaded versions.`,
                                  variant: "destructive"
                                });
                              }
                              
                              // CRITICAL: Don't save if user just opened empty editor and clicked Done
                              // Only save if there's actual content OR if we're clearing an existing signature
                              if (cleanedHtml || editingSender.signatureHtml) {
                                setEditingSender({ ...editingSender, signatureHtml: cleanedHtml });
                                autoSaveSignatureMutation.mutate({ id: editingSender.id, signatureHtml: cleanedHtml, senderEmail: editingSender.email });
                                console.log('[SIGNATURE-DEBUG] Saving signature to database');
                                toast({ title: "Saving signature...", description: `${cleanedHtml.length} characters` });
                              } else {
                                console.log('[SIGNATURE-DEBUG] No content to save, skipping');
                                toast({ title: "No signature to save", description: "Paste your signature content first", variant: "destructive" });
                              }
                            } else {
                              toast({ title: "Error", description: "Could not access signature editor", variant: "destructive" });
                            }
                            setSignaturePopoverOpen(false);
                          }}
                          disabled={autoSaveSignatureMutation.isPending}
                        >
                          {autoSaveSignatureMutation.isPending ? 'Saving...' : 'Done'}
                        </Button>
                        {editingSender.signatureHtml && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              if (signatureEditorRef.current) {
                                signatureEditorRef.current.innerHTML = '';
                              }
                              setEditingSender({ ...editingSender, signatureHtml: '' });
                              // Auto-save cleared signature to database (keeps modal open)
                              autoSaveSignatureMutation.mutate({ id: editingSender.id, signatureHtml: '', senderEmail: editingSender.email });
                            }}
                            disabled={autoSaveSignatureMutation.isPending}
                          >
                            {autoSaveSignatureMutation.isPending ? 'Clearing...' : 'Clear Signature'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            {/* Saved Signature Preview - shows what's actually saved in database */}
            {editingSender.signatureHtml && (
              <div className="mt-3 border rounded-lg p-3 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-medium text-gray-600">Saved Signature Preview:</Label>
                  <Badge variant="outline" className="text-xs">Read-only</Badge>
                </div>
                <div 
                  className="bg-white border rounded p-3 text-sm overflow-auto max-h-[200px] [&_img]:max-h-[32px] [&_img]:w-auto"
                  dangerouslySetInnerHTML={{ __html: editingSender.signatureHtml }}
                />
              </div>
            )}

            {/* CRM Tag Triggers - Multiple triggers for different drip campaigns */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium text-sm text-gray-700 mb-3 flex items-center gap-2">
                <Tag className="h-4 w-4 text-blue-500" />
                CRM Tag Triggers
              </h4>
              <p className="text-xs text-gray-500 mb-3">Each trigger tag routes to a different drip campaign. Select tags from your CRM to match your Campaign Templates.</p>
              
              {/* List of current trigger tags with campaign match indicators */}
              <div className="space-y-2 mb-3">
                {(parseHubspotTags(editingSender) || []).map((tag, index) => {
                  const matchingTemplate = findMatchingTemplate(tag);
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Select
                          value={tag}
                          onValueChange={(val) => {
                            const tags = [...parseHubspotTags(editingSender)];
                            tags[index] = val;
                            setEditingSender({ ...editingSender, hubspotTriggerTags: tags });
                          }}
                        >
                          <SelectTrigger className="flex-1" data-testid={`hubspot-trigger-tag-input-${index}`}>
                            <SelectValue placeholder="Select a CRM tag..." />
                          </SelectTrigger>
                          <SelectContent>
                            {crmTags.length === 0 && (
                              <SelectItem value="_none" disabled>No CRM tags found</SelectItem>
                            )}
                            {crmTags.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const tags = [...parseHubspotTags(editingSender)];
                            tags.splice(index, 1);
                            setEditingSender({ ...editingSender, hubspotTriggerTags: tags.length > 0 ? tags : undefined });
                          }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          disabled={parseHubspotTags(editingSender).length <= 1}
                          title="Remove trigger"
                          data-testid={`remove-trigger-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {/* Campaign match indicator and collapsible drip steps */}
                      {tag.trim() && (
                        <div className="ml-1">
                          {matchingTemplate ? (
                            <div className="space-y-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedTags(prev => ({ ...prev, [tag]: !prev[tag] }));
                                  if (!templateStepsByTag[tag]) {
                                    fetchTemplateStepsForTag(tag);
                                  }
                                }}
                                className="text-xs text-green-600 flex items-center gap-1 hover:text-green-800 transition-colors w-full text-left"
                              >
                                <ChevronRight className={`h-3 w-3 transition-transform ${expandedTags[tag] ? 'rotate-90' : ''}`} />
                                <CheckCircle className="h-3 w-3" />
                                Routes to: <strong>{matchingTemplate.name}</strong>
                                {!matchingTemplate.isActive && <Badge variant="outline" className="text-xs ml-1">Inactive</Badge>}
                                <span className="text-gray-500 ml-1">({(templateStepsByTag[tag] || []).length} steps)</span>
                              </button>
                              
                              {/* Collapsible drip steps section */}
                              {expandedTags[tag] && (
                                <div className="ml-4 mt-2 p-3 bg-gray-50 rounded-lg border space-y-2">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-gray-600">Drip Campaign Steps</span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setAddingStepForTag(tag)}
                                      className="h-6 text-xs"
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Add Step
                                    </Button>
                                  </div>
                                  
                                  {(templateStepsByTag[tag] || []).length === 0 ? (
                                    <div className="text-center py-4 text-gray-400 text-xs">
                                      <Mail className="h-5 w-5 mx-auto mb-1 opacity-50" />
                                      <p>No steps configured yet</p>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      {(templateStepsByTag[tag] || []).sort((a: any, b: any) => a.dayNumber - b.dayNumber).map((step: any, stepIdx: number) => (
                                        <div key={step.id} className="flex items-center gap-2 p-2 bg-white rounded border text-xs">
                                          <div className="flex-shrink-0 w-12 font-medium text-blue-600">
                                            Day {step.dayNumber}
                                          </div>
                                          <Badge variant={step.channel === 'email' ? 'default' : 'secondary'} className="text-xs">
                                            {step.channel === 'email' ? 'Email' : 'SMS'}
                                          </Badge>
                                          <div className="flex-1 truncate text-gray-600">
                                            {step.subject || step.content?.substring(0, 50) || 'No content'}
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setEditingStep({ ...step, campaignTemplateId: matchingTemplate.id })}
                                            className="h-6 w-6 p-0"
                                          >
                                            <Settings className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={async () => {
                                              if (confirm('Delete this step?')) {
                                                await fetch(`/api/outreach/campaign-templates/${matchingTemplate.id}/steps/${step.id}`, {
                                                  method: 'DELETE',
                                                  credentials: 'include'
                                                });
                                                fetchTemplateStepsForTag(tag);
                                              }
                                            }}
                                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  
                                  {/* Full Rich Text Editor Form */}
                                  {addingStepForTag === tag && (
                                    <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200 shadow-lg">
                                      <div className="flex items-center justify-between mb-4">
                                        <h5 className="font-medium text-sm text-blue-700">Add Campaign Step</h5>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            setAddingStepForTag(null);
                                            setNewTagStepData({ dayNumber: 1, channel: 'email', subject: '', content: '', lineHeight: '1.5', attachments: [] });
                                          }}
                                          className="h-6 w-6 p-0"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                      <div className="grid grid-cols-2 gap-6">
                                        {/* Left side - Editor */}
                                        <div className="flex flex-col">
                                          <div className="grid grid-cols-2 gap-3 mb-3">
                                            <div>
                                              <Label className="text-xs">Day</Label>
                                              <Input
                                                type="number"
                                                min="1"
                                                max="365"
                                                value={newTagStepData.dayNumber}
                                                onChange={(e) => setNewTagStepData(prev => ({ ...prev, dayNumber: parseInt(e.target.value) || 1 }))}
                                              />
                                            </div>
                                            <div>
                                              <Label className="text-xs">Method</Label>
                                              <Select
                                                value={newTagStepData.channel}
                                                onValueChange={(v: 'email' | 'sms') => setNewTagStepData(prev => ({ ...prev, channel: v }))}
                                              >
                                                <SelectTrigger>
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="email">Email</SelectItem>
                                                  <SelectItem value="sms">SMS</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          </div>
                                          {newTagStepData.channel === 'email' && (
                                            <div className="mb-3">
                                              <Label className="text-xs">Subject Line</Label>
                                              <Input
                                                value={newTagStepData.subject}
                                                onChange={(e) => setNewTagStepData(prev => ({ ...prev, subject: e.target.value }))}
                                                placeholder="e.g., Quick follow-up on land opportunities"
                                              />
                                            </div>
                                          )}
                                          <div className="mb-3">
                                            <Label className="text-xs">Message Content</Label>
                                            {newTagStepData.channel === 'email' ? (
                                              <RichTextEditor
                                                value={newTagStepData.content}
                                                onChange={(content) => setNewTagStepData(prev => ({ ...prev, content }))}
                                                placeholder="Hi {{broker.firstName}}, I wanted to follow up..."
                                                minHeight="250px"
                                                lineHeight={newTagStepData.lineHeight}
                                                onLineHeightChange={(lineHeight) => setNewTagStepData(prev => ({ ...prev, lineHeight }))}
                                              />
                                            ) : (
                                              <Textarea
                                                value={newTagStepData.content}
                                                onChange={(e) => setNewTagStepData(prev => ({ ...prev, content: e.target.value }))}
                                                placeholder="Hi {{broker.firstName}}, I wanted to follow up..."
                                                rows={6}
                                                className="font-mono text-sm"
                                              />
                                            )}
                                            <div className="mt-2 flex flex-wrap gap-1">
                                              <span className="text-xs text-gray-400">Insert personalization:</span>
                                              {PERSONALIZATION_TOKENS.slice(0, 4).map(t => (
                                                <button
                                                  key={t.token}
                                                  type="button"
                                                  className="text-xs text-blue-600 hover:underline"
                                                  onClick={() => setNewTagStepData(prev => ({ ...prev, content: prev.content + t.token }))}
                                                >
                                                  {t.label}
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                          
                                          {/* Attachments */}
                                          {newTagStepData.channel === 'email' && (
                                            <div className="mb-3">
                                              <Label className="text-xs flex items-center gap-1">
                                                <Paperclip className="h-3 w-3" />
                                                Attachments
                                              </Label>
                                              <div className="mt-1 space-y-2">
                                                {newTagStepData.attachments.length > 0 && (
                                                  <div className="space-y-1">
                                                    {newTagStepData.attachments.map((file, idx) => (
                                                      <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                                                        <FileText className="h-4 w-4 text-blue-500" />
                                                        <span className="flex-1 truncate">{file.filename}</span>
                                                        <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</span>
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          className="h-6 w-6 p-0 text-red-500"
                                                          onClick={() => setNewTagStepData(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== idx) }))}
                                                        >
                                                          <X className="h-3 w-3" />
                                                        </Button>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                                <div>
                                                  <input
                                                    type="file"
                                                    id={`tag-step-attachment-${tag}`}
                                                    className="hidden"
                                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.gif"
                                                    onChange={async (e) => {
                                                      const file = e.target.files?.[0];
                                                      if (!file) return;
                                                      if (file.size > 50 * 1024 * 1024) {
                                                        toast({ title: "File too large", description: "Maximum file size is 50MB", variant: "destructive" });
                                                        return;
                                                      }
                                                      setIsUploadingTagAttachment(true);
                                                      try {
                                                        const formData = new FormData();
                                                        formData.append('file', file);
                                                        const response = await fetch('/api/upload/attachment', {
                                                          method: 'POST',
                                                          body: formData,
                                                          credentials: 'include'
                                                        });
                                                        if (response.ok) {
                                                          const data = await response.json();
                                                          setNewTagStepData(prev => ({
                                                            ...prev,
                                                            attachments: [...prev.attachments, { filename: data.filename, url: data.url, size: data.size, contentType: data.mimeType || data.contentType || 'application/octet-stream' }]
                                                          }));
                                                          toast({ title: "File uploaded successfully" });
                                                        } else {
                                                          toast({ title: "Upload failed", variant: "destructive" });
                                                        }
                                                      } catch (error) {
                                                        toast({ title: "Upload failed", variant: "destructive" });
                                                      } finally {
                                                        setIsUploadingTagAttachment(false);
                                                        e.target.value = '';
                                                      }
                                                    }}
                                                  />
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => document.getElementById(`tag-step-attachment-${tag}`)?.click()}
                                                    disabled={isUploadingTagAttachment}
                                                    className="text-xs"
                                                  >
                                                    {isUploadingTagAttachment ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Paperclip className="h-3 w-3 mr-1" />}
                                                    Add Attachment
                                                  </Button>
                                                  <span className="text-xs text-gray-400 ml-2">Max 50MB (PDF, DOC, Images)</span>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                          
                                          {/* Active toggle */}
                                          <div className="flex items-center gap-2 mb-3">
                                            <Switch id={`tag-step-active-${tag}`} defaultChecked />
                                            <Label htmlFor={`tag-step-active-${tag}`} className="text-xs">Active</Label>
                                          </div>
                                          
                                          {/* Action buttons */}
                                          <div className="flex gap-2">
                                            <Button
                                              size="sm"
                                              disabled={isSavingTagStep || !newTagStepData.content.trim()}
                                              onClick={async () => {
                                                setIsSavingTagStep(true);
                                                try {
                                                  const existingSteps = templateStepsByTag[tag] || [];
                                                  const maxSequence = existingSteps.length > 0 ? Math.max(...existingSteps.map((s: any) => s.sequenceIndex || 0)) : 0;
                                                  const res = await fetch(`/api/outreach/campaign-templates/${matchingTemplate.id}/steps`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    credentials: 'include',
                                                    body: JSON.stringify({
                                                      sequenceIndex: maxSequence + 1,
                                                      dayNumber: newTagStepData.dayNumber,
                                                      channel: newTagStepData.channel,
                                                      subject: newTagStepData.subject,
                                                      content: newTagStepData.content,
                                                      attachments: newTagStepData.attachments
                                                    })
                                                  });
                                                  if (res.ok) {
                                                    toast({ title: 'Step added successfully' });
                                                    fetchTemplateStepsForTag(tag);
                                                    setAddingStepForTag(null);
                                                    setNewTagStepData({ dayNumber: 1, channel: 'email', subject: '', content: '', lineHeight: '1.5', attachments: [] });
                                                  } else {
                                                    const err = await res.json();
                                                    toast({ title: 'Error', description: err.error || 'Failed to add step', variant: 'destructive' });
                                                  }
                                                } catch (e: any) {
                                                  toast({ title: 'Error', description: e.message || 'Failed to add step', variant: 'destructive' });
                                                } finally {
                                                  setIsSavingTagStep(false);
                                                }
                                              }}
                                            >
                                              {isSavingTagStep ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save Changes'}
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => {
                                                setAddingStepForTag(null);
                                                setNewTagStepData({ dayNumber: 1, channel: 'email', subject: '', content: '', lineHeight: '1.5', attachments: [] });
                                              }}
                                            >
                                              Cancel
                                            </Button>
                                          </div>
                                        </div>
                                        
                                        {/* Right side - Preview */}
                                        <div className="flex flex-col h-full">
                                          <div className="flex items-center gap-2 mb-2">
                                            <Mail className="h-4 w-4 text-[#0078D4]" />
                                            <Label className="text-xs font-medium">Outlook Preview</Label>
                                          </div>
                                          {newTagStepData.channel === 'email' ? (
                                            <div className="border rounded-lg bg-white shadow-lg overflow-hidden flex-1 flex flex-col">
                                              <div className="bg-[#0078D4] text-white px-4 py-2 flex items-center gap-2">
                                                <Mail className="h-4 w-4" />
                                                <span className="text-sm font-medium">Outlook</span>
                                              </div>
                                              <div className="bg-gray-50 px-4 py-3 border-b space-y-2">
                                                <div className="flex items-start gap-3">
                                                  <div className="w-10 h-10 rounded-full bg-[#0078D4] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                                                    {editingSender?.name.split(' ').map(n => n[0]).join('') || 'JB'}
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                    <div className="flex items-baseline justify-between">
                                                      <span className="font-semibold text-sm">{editingSender?.name || 'Sender Name'}</span>
                                                      <span className="text-xs text-gray-500">Just now</span>
                                                    </div>
                                                    <div className="text-xs text-gray-500">{editingSender?.email || 'sender@example.com'}</div>
                                                    <div className="text-xs text-gray-400 mt-1">To: John Smith &lt;broker@example.com&gt;</div>
                                                  </div>
                                                </div>
                                                <div className="font-semibold text-sm text-gray-800 pl-13">
                                                  {newTagStepData.subject || '(No subject line)'}
                                                </div>
                                              </div>
                                              <div className="p-4 flex-1 overflow-auto bg-white min-h-[300px]">
                                                {newTagStepData.content ? (
                                                  <div 
                                                    className="text-sm text-gray-700 prose prose-sm max-w-none"
                                                    style={{ lineHeight: newTagStepData.lineHeight || '1.5' }}
                                                    dangerouslySetInnerHTML={{ __html: renderEmailPreview(newTagStepData.content, newTagStepData.subject) }}
                                                  />
                                                ) : (
                                                  <p className="text-gray-400 italic text-center mt-8">Start typing to see how your email will appear in Outlook...</p>
                                                )}
                                              </div>
                                              <div className="bg-gray-50 px-4 py-2 border-t text-xs text-gray-400 text-center">
                                                Personalization tokens like {"{{broker.firstName}}"} will be replaced with actual data
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="border rounded-lg bg-white shadow-lg overflow-hidden flex-1 flex flex-col">
                                              <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-center">
                                                <span className="text-sm font-medium">SMS Preview</span>
                                              </div>
                                              <div className="bg-gray-100 p-4 flex-1 flex items-start justify-end">
                                                <div className="bg-[#0078D4] text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%] shadow-md">
                                                  <p className="text-sm">
                                                    {newTagStepData.content ? renderEmailPreview(newTagStepData.content, '') : 'Your SMS message will appear here...'}
                                                  </p>
                                                </div>
                                              </div>
                                              <div className="bg-gray-50 px-4 py-2 border-t text-xs text-gray-400 text-center">
                                                {(newTagStepData.content || '').length}/160 characters
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <button
                                type="button"
                                onClick={() => setExpandedTags(prev => ({ ...prev, [tag]: !prev[tag] }))}
                                className="text-xs text-blue-600 flex items-center gap-1 hover:text-blue-800 transition-colors w-full text-left"
                              >
                                {expandedTags[tag] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                <span>Drip Campaign (0 steps)</span>
                              </button>
                              {expandedTags[tag] && (
                                <div className="ml-4 mt-2 p-3 bg-gray-50 rounded-lg border space-y-2">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-gray-600">Drip Campaign Steps</span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        try {
                                          const res = await fetch('/api/outreach/campaign-templates', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            credentials: 'include',
                                            body: JSON.stringify({ name: tag, hubspotTriggerTag: tag })
                                          });
                                          if (res.ok) {
                                            await queryClient.invalidateQueries({ queryKey: ['/api/outreach/campaign-templates'] });
                                            setAddingStepForTag(tag);
                                          } else {
                                            const err = await res.json();
                                            toast({ title: 'Error', description: err.error || 'Failed to create template', variant: 'destructive' });
                                          }
                                        } catch (e) {
                                          toast({ title: 'Error', description: 'Failed to create template', variant: 'destructive' });
                                        }
                                      }}
                                      className="h-6 text-xs"
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Add Step
                                    </Button>
                                  </div>
                                  {addingStepForTag !== tag ? (
                                    <div className="text-center py-4 text-gray-400 text-xs">
                                      <Mail className="h-5 w-5 mx-auto mb-1 opacity-50" />
                                      <p>No steps configured yet</p>
                                      <p className="text-xs text-gray-400">Click "Add Step" to create your first outreach</p>
                                    </div>
                                  ) : (
                                    <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200 shadow-lg">
                                      <div className="flex items-center justify-between mb-4">
                                        <h5 className="font-medium text-sm text-blue-700">Add Campaign Step</h5>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            setAddingStepForTag(null);
                                            setNewTagStepData({ dayNumber: 1, channel: 'email', subject: '', content: '', lineHeight: '1.5', attachments: [] });
                                          }}
                                          className="h-6 w-6 p-0"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                      <div className="grid grid-cols-2 gap-6">
                                        {/* Left side - Editor */}
                                        <div className="flex flex-col">
                                          <div className="grid grid-cols-2 gap-3 mb-3">
                                            <div>
                                              <Label className="text-xs">Day</Label>
                                              <Input
                                                type="number"
                                                min="1"
                                                max="365"
                                                value={newTagStepData.dayNumber}
                                                onChange={(e) => setNewTagStepData(prev => ({ ...prev, dayNumber: parseInt(e.target.value) || 1 }))}
                                              />
                                            </div>
                                            <div>
                                              <Label className="text-xs">Method</Label>
                                              <Select
                                                value={newTagStepData.channel}
                                                onValueChange={(v: 'email' | 'sms') => setNewTagStepData(prev => ({ ...prev, channel: v }))}
                                              >
                                                <SelectTrigger>
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="email">Email</SelectItem>
                                                  <SelectItem value="sms">SMS</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          </div>
                                          {newTagStepData.channel === 'email' && (
                                            <div className="mb-3">
                                              <Label className="text-xs">Subject Line</Label>
                                              <Input
                                                value={newTagStepData.subject}
                                                onChange={(e) => setNewTagStepData(prev => ({ ...prev, subject: e.target.value }))}
                                                placeholder="e.g., Quick follow-up on land opportunities"
                                              />
                                            </div>
                                          )}
                                          <div className="mb-3">
                                            <Label className="text-xs">Message Content</Label>
                                            {newTagStepData.channel === 'email' ? (
                                              <RichTextEditor
                                                value={newTagStepData.content}
                                                onChange={(content) => setNewTagStepData(prev => ({ ...prev, content }))}
                                                placeholder="Hi {{broker.firstName}}, I wanted to follow up..."
                                                minHeight="250px"
                                                lineHeight={newTagStepData.lineHeight}
                                                onLineHeightChange={(lineHeight) => setNewTagStepData(prev => ({ ...prev, lineHeight }))}
                                              />
                                            ) : (
                                              <Textarea
                                                value={newTagStepData.content}
                                                onChange={(e) => setNewTagStepData(prev => ({ ...prev, content: e.target.value }))}
                                                placeholder="Hi {{broker.firstName}}, I wanted to follow up..."
                                                rows={6}
                                                className="font-mono text-sm"
                                              />
                                            )}
                                            <div className="mt-2 flex flex-wrap gap-1">
                                              <span className="text-xs text-gray-400">Insert personalization:</span>
                                              {PERSONALIZATION_TOKENS.slice(0, 4).map(t => (
                                                <button
                                                  key={t.token}
                                                  type="button"
                                                  className="text-xs text-blue-600 hover:underline"
                                                  onClick={() => setNewTagStepData(prev => ({ ...prev, content: prev.content + t.token }))}
                                                >
                                                  {t.label}
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                          
                                          {/* Attachments */}
                                          {newTagStepData.channel === 'email' && (
                                            <div className="mb-3">
                                              <Label className="text-xs flex items-center gap-1">
                                                <Paperclip className="h-3 w-3" />
                                                Attachments
                                              </Label>
                                              <div className="mt-1 space-y-2">
                                                {newTagStepData.attachments.length > 0 && (
                                                  <div className="space-y-1">
                                                    {newTagStepData.attachments.map((file, idx) => (
                                                      <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                                                        <FileText className="h-4 w-4 text-blue-500" />
                                                        <span className="flex-1 truncate">{file.filename}</span>
                                                        <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</span>
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          className="h-6 w-6 p-0 text-red-500"
                                                          onClick={() => setNewTagStepData(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== idx) }))}
                                                        >
                                                          <X className="h-3 w-3" />
                                                        </Button>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                                <div>
                                                  <input
                                                    type="file"
                                                    id={`tag-step-attachment-new-${tag}`}
                                                    className="hidden"
                                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.gif"
                                                    onChange={async (e) => {
                                                      const file = e.target.files?.[0];
                                                      if (!file) return;
                                                      if (file.size > 50 * 1024 * 1024) {
                                                        toast({ title: "File too large", description: "Maximum file size is 50MB", variant: "destructive" });
                                                        return;
                                                      }
                                                      setIsUploadingTagAttachment(true);
                                                      try {
                                                        const formData = new FormData();
                                                        formData.append('file', file);
                                                        const response = await fetch('/api/upload/attachment', {
                                                          method: 'POST',
                                                          body: formData,
                                                          credentials: 'include'
                                                        });
                                                        if (response.ok) {
                                                          const data = await response.json();
                                                          setNewTagStepData(prev => ({
                                                            ...prev,
                                                            attachments: [...prev.attachments, { filename: data.filename, url: data.url, size: data.size, contentType: data.mimeType || data.contentType || 'application/octet-stream' }]
                                                          }));
                                                          toast({ title: "File uploaded successfully" });
                                                        } else {
                                                          toast({ title: "Upload failed", variant: "destructive" });
                                                        }
                                                      } catch (error) {
                                                        toast({ title: "Upload failed", variant: "destructive" });
                                                      } finally {
                                                        setIsUploadingTagAttachment(false);
                                                        e.target.value = '';
                                                      }
                                                    }}
                                                  />
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => document.getElementById(`tag-step-attachment-new-${tag}`)?.click()}
                                                    disabled={isUploadingTagAttachment}
                                                    className="text-xs"
                                                  >
                                                    {isUploadingTagAttachment ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Paperclip className="h-3 w-3 mr-1" />}
                                                    Add Attachment
                                                  </Button>
                                                  <span className="text-xs text-gray-400 ml-2">Max 50MB (PDF, DOC, Images)</span>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                          
                                          {/* Active toggle */}
                                          <div className="flex items-center gap-2 mb-3">
                                            <Switch id={`tag-step-active-new-${tag}`} defaultChecked />
                                            <Label htmlFor={`tag-step-active-new-${tag}`} className="text-xs">Active</Label>
                                          </div>
                                          
                                          {/* Action buttons */}
                                          <div className="flex gap-2">
                                            <Button
                                              size="sm"
                                              disabled={isSavingTagStep || !newTagStepData.content.trim()}
                                              onClick={async () => {
                                                setIsSavingTagStep(true);
                                                try {
                                                  const templateRes = await fetch(`/api/outreach/campaign-templates?hubspotTriggerTag=${encodeURIComponent(tag)}`, { credentials: 'include' });
                                                  const templates = await templateRes.json();
                                                  if (!templates || templates.length === 0) {
                                                    toast({ title: 'Error', description: 'Template not found', variant: 'destructive' });
                                                    return;
                                                  }
                                                  const templateId = templates[0].id;
                                                  const res = await fetch(`/api/outreach/campaign-templates/${templateId}/steps`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    credentials: 'include',
                                                    body: JSON.stringify({
                                                      sequenceIndex: 1,
                                                      dayNumber: newTagStepData.dayNumber,
                                                      channel: newTagStepData.channel,
                                                      subject: newTagStepData.subject,
                                                      content: newTagStepData.content,
                                                      attachments: newTagStepData.attachments
                                                    })
                                                  });
                                                  if (res.ok) {
                                                    toast({ title: 'Step added successfully' });
                                                    await queryClient.invalidateQueries({ queryKey: ['/api/outreach/campaign-templates'] });
                                                    fetchTemplateStepsForTag(tag);
                                                    setAddingStepForTag(null);
                                                    setNewTagStepData({ dayNumber: 1, channel: 'email', subject: '', content: '', lineHeight: '1.5', attachments: [] });
                                                  } else {
                                                    const err = await res.json();
                                                    toast({ title: 'Error', description: err.error || 'Failed to add step', variant: 'destructive' });
                                                  }
                                                } catch (e: any) {
                                                  toast({ title: 'Error', description: e.message || 'Failed to add step', variant: 'destructive' });
                                                } finally {
                                                  setIsSavingTagStep(false);
                                                }
                                              }}
                                            >
                                              {isSavingTagStep ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save Changes'}
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => {
                                                setAddingStepForTag(null);
                                                setNewTagStepData({ dayNumber: 1, channel: 'email', subject: '', content: '', lineHeight: '1.5', attachments: [] });
                                              }}
                                            >
                                              Cancel
                                            </Button>
                                          </div>
                                        </div>
                                        
                                        {/* Right side - Preview */}
                                        <div className="flex flex-col h-full">
                                          <div className="flex items-center gap-2 mb-2">
                                            <Mail className="h-4 w-4 text-[#0078D4]" />
                                            <Label className="text-xs font-medium">Outlook Preview</Label>
                                          </div>
                                          {newTagStepData.channel === 'email' ? (
                                            <div className="border rounded-lg bg-white shadow-lg overflow-hidden flex-1 flex flex-col">
                                              <div className="bg-[#0078D4] text-white px-4 py-2 flex items-center gap-2">
                                                <Mail className="h-4 w-4" />
                                                <span className="text-sm font-medium">Outlook</span>
                                              </div>
                                              <div className="bg-gray-50 px-4 py-3 border-b space-y-2">
                                                <div className="flex items-start gap-3">
                                                  <div className="w-10 h-10 rounded-full bg-[#0078D4] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                                                    {editingSender?.name.split(' ').map(n => n[0]).join('') || 'JB'}
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                    <div className="flex items-baseline justify-between">
                                                      <span className="font-semibold text-sm">{editingSender?.name || 'Sender Name'}</span>
                                                      <span className="text-xs text-gray-500">Just now</span>
                                                    </div>
                                                    <div className="text-xs text-gray-500">{editingSender?.email || 'sender@example.com'}</div>
                                                    <div className="text-xs text-gray-400 mt-1">To: John Smith &lt;broker@example.com&gt;</div>
                                                  </div>
                                                </div>
                                                <div className="font-semibold text-sm text-gray-800 pl-13">
                                                  {newTagStepData.subject || '(No subject line)'}
                                                </div>
                                              </div>
                                              <div className="p-4 flex-1 overflow-auto bg-white min-h-[300px]">
                                                {newTagStepData.content ? (
                                                  <div 
                                                    className="text-sm text-gray-700 prose prose-sm max-w-none"
                                                    style={{ lineHeight: newTagStepData.lineHeight || '1.5' }}
                                                    dangerouslySetInnerHTML={{ __html: renderEmailPreview(newTagStepData.content, newTagStepData.subject) }}
                                                  />
                                                ) : (
                                                  <p className="text-gray-400 italic text-center mt-8">Start typing to see how your email will appear in Outlook...</p>
                                                )}
                                              </div>
                                              <div className="bg-gray-50 px-4 py-2 border-t text-xs text-gray-400 text-center">
                                                Personalization tokens like {"{{broker.firstName}}"} will be replaced with actual data
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="border rounded-lg bg-white shadow-lg overflow-hidden flex-1 flex flex-col">
                                              <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-center">
                                                <span className="text-sm font-medium">SMS Preview</span>
                                              </div>
                                              <div className="bg-gray-100 p-4 flex-1 flex items-start justify-end">
                                                <div className="bg-[#0078D4] text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%] shadow-md">
                                                  <p className="text-sm">
                                                    {newTagStepData.content ? renderEmailPreview(newTagStepData.content, '') : 'Your SMS message will appear here...'}
                                                  </p>
                                                </div>
                                              </div>
                                              <div className="bg-gray-50 px-4 py-2 border-t text-xs text-gray-400 text-center">
                                                {(newTagStepData.content || '').length}/160 characters
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Add new trigger button */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const currentTags = parseHubspotTags(editingSender);
                  setEditingSender({ ...editingSender, hubspotTriggerTags: [...currentTags, ""] });
                }}
                className="w-full"
                data-testid="add-trigger-btn"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Another Trigger
              </Button>

              {/* Edit Step Modal for Campaign Template Steps */}
              {editingStep && (
                <div className="mt-4 p-4 border rounded-lg bg-yellow-50/50">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-medium text-sm">Edit Step (Day {editingStep.dayNumber})</h5>
                    <Button size="sm" variant="ghost" onClick={() => setEditingStep(null)} className="h-6 w-6 p-0">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-[1fr_2fr] gap-6">
                    {/* Left side - Editor */}
                    <div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <Label className="text-xs">Day</Label>
                          <Input
                            type="number"
                            min="1"
                            max="365"
                            value={editingStep.dayNumber || 1}
                            onChange={(e) => setEditingStep({ ...editingStep, dayNumber: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Method</Label>
                          <Select
                            value={editingStep.channel || 'email'}
                            onValueChange={(val: 'email' | 'sms') => setEditingStep({ ...editingStep, channel: val })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="sms">SMS</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {editingStep.channel === 'email' && (
                        <div className="mb-3">
                          <Label className="text-xs">Subject Line</Label>
                          <Input
                            value={editingStep.subject || ''}
                            onChange={(e) => setEditingStep({ ...editingStep, subject: e.target.value })}
                          />
                        </div>
                      )}
                      <div className="mb-3">
                        <Label className="text-xs">Message Content</Label>
                        {editingStep.channel === 'email' ? (
                          <RichTextEditor
                            value={editingStep.content || ''}
                            onChange={(content) => setEditingStep({ ...editingStep, content })}
                            placeholder="Enter your email content..."
                          />
                        ) : (
                          <Textarea
                            value={editingStep.content || ''}
                            onChange={(e) => setEditingStep({ ...editingStep, content: e.target.value })}
                            placeholder="Enter your SMS message..."
                            maxLength={160}
                          />
                        )}
                      </div>
                      {/* Personalization tokens */}
                      <div className="mb-3">
                        <Label className="text-xs text-gray-500">Add Personalization</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {[
                            { label: 'First Name', token: '{{broker.firstName}}' },
                            { label: 'Last Name', token: '{{broker.lastName}}' },
                            { label: 'Company', token: '{{broker.company}}' },
                            { label: 'Sender Name', token: '{{sender.name}}' }
                          ].map(t => (
                            <Button
                              key={t.token}
                              type="button"
                              size="sm"
                              variant="outline"
                              className="text-xs h-6 px-2"
                              onClick={() => setEditingStep({ ...editingStep, content: (editingStep.content || '') + t.token })}
                            >
                              {t.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                      {/* File Attachments */}
                      {editingStep.channel === 'email' && (() => {
                        const atts: any[] = typeof editingStep.attachments === 'string' 
                          ? (editingStep.attachments ? (JSON.parse(editingStep.attachments) || []) : [])
                          : (editingStep.attachments || []);
                        return (
                        <div className="mb-3">
                          <Label className="text-xs">Attachments</Label>
                          <div className="space-y-2">
                            {atts.map((att: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 text-xs p-2 bg-gray-50 rounded">
                                <Paperclip className="h-3 w-3 text-gray-400" />
                                <span className="flex-1 truncate">{att.filename}</span>
                                <span className="text-gray-400">{(att.size / 1024).toFixed(1)}KB</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-5 w-5 p-0 text-red-500"
                                  onClick={() => {
                                    const newAtts = [...atts];
                                    newAtts.splice(idx, 1);
                                    setEditingStep({ ...editingStep, attachments: newAtts });
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                            <input
                              type="file"
                              id="edit-tag-step-attachment"
                              className="hidden"
                              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.gif"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                e.target.value = '';
                                if (file.size > 50 * 1024 * 1024) {
                                  toast({ title: "File too large", description: "Max 50MB per file", variant: "destructive" });
                                  return;
                                }
                                setIsUploadingAttachment(true);
                                try {
                                  const formData = new FormData();
                                  formData.append('file', file);
                                  const uploadRes = await fetch('/api/upload/attachment', {
                                    method: 'POST',
                                    body: formData,
                                    credentials: 'include'
                                  });
                                  if (!uploadRes.ok) throw new Error('Upload failed');
                                  const { url, filename, contentType, size } = await uploadRes.json();
                                  setEditingStep({
                                    ...editingStep,
                                    attachments: [...atts, { filename, url, contentType, size }]
                                  });
                                  toast({ title: "File attached", description: filename });
                                } catch (err) {
                                  toast({ title: "Upload failed", description: "Could not upload file", variant: "destructive" });
                                } finally {
                                  setIsUploadingAttachment(false);
                                }
                              }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="w-full text-xs"
                              disabled={isUploadingAttachment}
                              onClick={() => document.getElementById('edit-tag-step-attachment')?.click()}
                            >
                              {isUploadingAttachment ? (
                                <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Uploading...</>
                              ) : (
                                <><Plus className="h-3 w-3 mr-1" />Add Attachment</>
                              )}
                            </Button>
                          </div>
                        </div>
                        );
                      })()}
                      {/* Active toggle and Save */}
                      <div className="flex items-center gap-3 mt-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={editingStep.isActive !== false}
                            onCheckedChange={(checked) => setEditingStep({ ...editingStep, isActive: checked })}
                          />
                          <Label className="text-xs">Active</Label>
                        </div>
                        <Button
                          size="sm"
                          onClick={async () => {
                            if (!editingStep.id) return;
                            try {
                              // Use template endpoint if we have a campaignTemplateId, otherwise direct step endpoint
                              const url = editingStep.campaignTemplateId
                                ? `/api/outreach/campaign-templates/${editingStep.campaignTemplateId}/steps/${editingStep.id}`
                                : `/api/outreach/campaign-steps/${editingStep.id}`;
                              const res = await fetch(url, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({
                                  dayNumber: editingStep.dayNumber,
                                  channel: editingStep.channel,
                                  subject: editingStep.subject,
                                  content: editingStep.content,
                                  isActive: editingStep.isActive,
                                  attachments: editingStep.attachments
                                })
                              });
                              if (!res.ok) {
                                const errText = await res.text();
                                throw new Error(errText || `Server error ${res.status}`);
                              }
                              toast({ title: 'Step updated!' });
                              // Refresh steps
                              const tags = parseHubspotTags(editingSender);
                              if (tags.length > 0) {
                                for (const tag of tags) fetchTemplateStepsForTag(tag);
                              } else {
                                // Reload sender steps
                                fetch(`/api/outreach/senders/${editingSender?.id}/campaign-steps`, { credentials: 'include' })
                                  .then(r => r.json()).then(steps => Array.isArray(steps) && setCampaignSteps(steps));
                              }
                              setEditingStep(null);
                            } catch (e: any) {
                              toast({ title: 'Error', description: e.message, variant: 'destructive' });
                            }
                          }}
                        >
                          Save Changes
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingStep(null)}>
                          Cancel
                        </Button>
                      </div>
                      {/* Test Email Send Section */}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                        <Label className="text-xs whitespace-nowrap">Send Test To:</Label>
                        <Input
                          type="email"
                          placeholder="recipient@example.com"
                          value={testEmailRecipient}
                          onChange={(e) => setTestEmailRecipient(e.target.value)}
                          className="flex-1 h-8 text-sm"
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={isSendingEditTest || !testEmailRecipient.includes('@')}
                          onClick={async () => {
                            if (!editingSender?.id || !testEmailRecipient) return;
                            setIsSendingEditTest(true);
                            try {
                              const atts: any[] = typeof editingStep.attachments === 'string' 
                                ? (editingStep.attachments ? (JSON.parse(editingStep.attachments) || []) : [])
                                : (editingStep.attachments || []);
                              
                              const res = await fetch(`/api/outreach/senders/${editingSender.id}/test-drip-email`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({
                                  subject: editingStep.subject || '(No subject)',
                                  content: editingStep.content || '',
                                  attachments: atts,
                                  testRecipientEmail: testEmailRecipient
                                })
                              });
                              if (!res.ok) {
                                const data = await res.json();
                                throw new Error(data.error || 'Failed to send test');
                              }
                              toast({ title: 'Test email sent!', description: `Check ${testEmailRecipient}` });
                            } catch (e: any) {
                              toast({ title: 'Error', description: e.message, variant: 'destructive' });
                            } finally {
                              setIsSendingEditTest(false);
                            }
                          }}
                        >
                          {isSendingEditTest ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                          Send Test
                        </Button>
                      </div>
                    </div>
                    {/* Right side - Preview */}
                    <div className="flex flex-col h-full">
                      <div className="flex items-center gap-2 mb-2">
                        <Mail className="h-4 w-4 text-[#0078D4]" />
                        <Label className="text-xs font-medium">Outlook Preview</Label>
                      </div>
                      {editingStep.channel === 'email' ? (
                        <div className="border rounded-lg bg-white shadow-lg overflow-hidden flex-1 flex flex-col">
                          <div className="bg-[#0078D4] text-white px-4 py-2 flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <span className="text-sm font-medium">Outlook</span>
                          </div>
                          <div className="bg-gray-50 px-4 py-3 border-b space-y-2">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#0078D4] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                                {editingSender?.name.split(' ').map(n => n[0]).join('') || 'JB'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline justify-between">
                                  <span className="font-semibold text-sm">{editingSender?.name || 'Sender Name'}</span>
                                  <span className="text-xs text-gray-500">Just now</span>
                                </div>
                                <div className="text-xs text-gray-500">{editingSender?.email || 'sender@example.com'}</div>
                                <div className="text-xs text-gray-400 mt-1">To: John Smith &lt;broker@example.com&gt;</div>
                              </div>
                            </div>
                            <div className="font-semibold text-sm text-gray-800 pl-13">
                              {editingStep.subject || '(No subject line)'}
                            </div>
                          </div>
                          <div className="p-4 flex-1 overflow-auto bg-white min-h-[200px]">
                            {editingStep.content ? (
                              <div 
                                className="text-sm text-gray-700 prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: renderEmailPreview(editingStep.content, editingStep.subject || '') }}
                              />
                            ) : (
                              <p className="text-gray-400 italic text-center mt-8">Start typing to see how your email will appear...</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="border rounded-lg bg-white shadow-lg overflow-hidden flex-1 flex flex-col">
                          <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-center">
                            <span className="text-sm font-medium">SMS Preview</span>
                          </div>
                          <div className="bg-gray-100 p-4 flex-1 flex items-start justify-end">
                            <div className="bg-[#0078D4] text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%] shadow-md">
                              <p className="text-sm">
                                {editingStep.content ? renderEmailPreview(editingStep.content, '') : 'Your SMS message will appear here...'}
                              </p>
                            </div>
                          </div>
                          <div className="bg-gray-50 px-4 py-2 border-t text-xs text-gray-400 text-center">
                            {(editingStep.content || '').length}/160 characters
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Multi-Step Campaign Builder - Hidden when sender has trigger tags (steps shown per-tag above) */}
            {(!editingSender?.hubspotTriggerTags || editingSender.hubspotTriggerTags.length === 0) && (
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-500" />
                    Drip Campaign Sequence
                  </h4>
                  <p className="text-xs text-gray-500">Add Email or SMS steps at any day number (e.g., Day 1 Email, Day 5 SMS, Day 90 Email, Day 95 SMS)</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddStep(true)}
                  data-testid="add-campaign-step-btn"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Step
                </Button>
              </div>

              {/* Campaign Steps Timeline */}
              <div className="space-y-2">
                {!Array.isArray(campaignSteps) || campaignSteps.length === 0 ? (
                  <div className="text-center py-6 border-2 border-dashed rounded-lg bg-gray-50">
                    <Calendar className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">No campaign steps yet</p>
                    <p className="text-xs text-gray-400">Click "Add Step" to create your first outreach</p>
                  </div>
                ) : (
                  [...campaignSteps]
                    .sort((a, b) => a.dayNumber - b.dayNumber)
                    .map((step, idx) => (
                      <div
                        key={step.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border ${
                          step.isActive ? 'bg-white' : 'bg-gray-50 opacity-60'
                        }`}
                        data-testid={`campaign-step-${step.id}`}
                      >
                        {/* Timeline indicator */}
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            step.channel === 'email' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                          }`}>
                            {step.channel === 'email' ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                          </div>
                          {idx < (Array.isArray(campaignSteps) ? campaignSteps.length : 0) - 1 && (
                            <div className="w-0.5 h-4 bg-gray-200 mt-1" />
                          )}
                        </div>

                        {/* Step content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">Day {step.dayNumber}</span>
                            <Badge variant="outline" className="text-xs">
                              {step.channel === 'email' ? 'Email' : 'SMS'}
                            </Badge>
                            {!step.isActive && (
                              <Badge variant="secondary" className="text-xs">Paused</Badge>
                            )}
                          </div>
                          {step.channel === 'email' && step.subject && (
                            <p className="text-sm text-gray-700 font-medium truncate">{step.subject}</p>
                          )}
                          <p className="text-xs text-gray-500 line-clamp-2">{step.content}</p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => setEditingStep({ ...step, campaignTemplateId: step.templateId ?? step.campaignTemplateId })}
                            data-testid={`edit-step-${step.id}`}
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                            onClick={() => deleteStepMutation.mutate(step.id)}
                            data-testid={`delete-step-${step.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                )}
              </div>

              {/* Add Step Form - Side by Side Layout */}
              {showAddStep && (
                <div className="mt-4 p-4 border rounded-lg bg-blue-50/50 min-h-[500px]">
                  <h5 className="font-medium text-sm mb-3">Add Campaign Step</h5>
                  <div className="grid grid-cols-2 gap-6">
                    {/* Left side - Editor */}
                    <div className="flex flex-col">
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <Label className="text-xs">Day</Label>
                          <Input
                            type="number"
                            min="1"
                            max="365"
                            value={newStepData.dayNumber}
                            onChange={(e) => setNewStepData({ ...newStepData, dayNumber: parseInt(e.target.value) || 1 })}
                            data-testid="new-step-day-input"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Method</Label>
                          <Select
                            value={newStepData.channel}
                            onValueChange={(val: 'email' | 'sms') => setNewStepData({ ...newStepData, channel: val })}
                          >
                            <SelectTrigger data-testid="new-step-channel-select">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="sms">SMS</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {newStepData.channel === 'email' && (
                        <div className="mb-3">
                          <Label className="text-xs">Subject Line</Label>
                          <Input
                            value={newStepData.subject}
                            onChange={(e) => setNewStepData({ ...newStepData, subject: e.target.value })}
                            placeholder="e.g., Quick follow-up on land opportunities"
                            data-testid="new-step-subject-input"
                          />
                        </div>
                      )}
                      <div className="mb-3">
                        <Label className="text-xs">Message Content</Label>
                        {newStepData.channel === 'email' ? (
                          <RichTextEditor
                            value={newStepData.content}
                            onChange={(content) => setNewStepData({ ...newStepData, content })}
                            placeholder="Hi {{broker.firstName}}, I wanted to follow up..."
                            minHeight="350px"
                            lineHeight={newStepData.lineHeight}
                            onLineHeightChange={(lineHeight) => setNewStepData({ ...newStepData, lineHeight })}
                          />
                        ) : (
                          <Textarea
                            value={newStepData.content}
                            onChange={(e) => setNewStepData({ ...newStepData, content: e.target.value })}
                            placeholder="Hi {{broker.firstName}}, I wanted to follow up..."
                            rows={6}
                            className="font-mono text-sm"
                            data-testid="new-step-content-input"
                          />
                        )}
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="text-xs text-gray-400">Insert personalization:</span>
                          {PERSONALIZATION_TOKENS.slice(0, 4).map(t => (
                            <button
                              key={t.token}
                              type="button"
                              className="text-xs text-blue-600 hover:underline"
                              onClick={() => setNewStepData({ ...newStepData, content: newStepData.content + t.token })}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* File Attachments for Email */}
                      {newStepData.channel === 'email' && (
                        <div className="mb-3">
                          <Label className="text-xs flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />
                            Attachments
                          </Label>
                          <div className="mt-1 space-y-2">
                            {newStepData.attachments.length > 0 && (
                              <div className="space-y-1">
                                {newStepData.attachments.map((file, idx) => (
                                  <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                                    <FileText className="h-4 w-4 text-blue-500" />
                                    <span className="flex-1 truncate">{file.filename}</span>
                                    <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0 text-red-500"
                                      onClick={() => {
                                        setNewStepData({
                                          ...newStepData,
                                          attachments: newStepData.attachments.filter((_, i) => i !== idx)
                                        });
                                      }}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div>
                              <input
                                type="file"
                                id="new-step-attachment"
                                className="hidden"
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.gif"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  
                                  if (file.size > 50 * 1024 * 1024) {
                                    toast({ title: "File too large", description: "Maximum file size is 50MB", variant: "destructive" });
                                    return;
                                  }
                                  
                                  setIsUploadingAttachment(true);
                                  try {
                                    const formData = new FormData();
                                    formData.append('file', file);
                                    
                                    const response = await fetch('/api/upload/attachment', {
                                      method: 'POST',
                                      body: formData,
                                      credentials: 'include'
                                    });
                                    
                                    if (!response.ok) throw new Error('Upload failed');
                                    
                                    const { url, filename, contentType, size } = await response.json();
                                    setNewStepData({
                                      ...newStepData,
                                      attachments: [...newStepData.attachments, { filename, url, contentType, size }]
                                    });
                                    toast({ title: "File attached", description: filename });
                                  } catch (error) {
                                    toast({ title: "Upload failed", description: "Could not upload file", variant: "destructive" });
                                  } finally {
                                    setIsUploadingAttachment(false);
                                    e.target.value = '';
                                  }
                                }}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => document.getElementById('new-step-attachment')?.click()}
                                disabled={isUploadingAttachment}
                                className="gap-1"
                              >
                                {isUploadingAttachment ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Upload className="h-3 w-3" />
                                )}
                                {isUploadingAttachment ? 'Uploading...' : 'Add File'}
                              </Button>
                              <span className="ml-2 text-xs text-gray-400">PDF, DOC, images (max 50MB)</span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            if (editingSender && newStepData.content) {
                              createStepMutation.mutate({
                                senderId: editingSender.id,
                                dayNumber: newStepData.dayNumber,
                                channel: newStepData.channel,
                                subject: newStepData.channel === 'email' ? newStepData.subject : undefined,
                                content: newStepData.content,
                                lineHeight: newStepData.channel === 'email' ? newStepData.lineHeight : undefined,
                                attachments: newStepData.channel === 'email' && newStepData.attachments.length > 0 
                                  ? JSON.stringify(newStepData.attachments) 
                                  : undefined,
                              });
                            }
                          }}
                          disabled={createStepMutation.isPending || !newStepData.content}
                          data-testid="save-new-step-btn"
                        >
                          {createStepMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add Step'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowAddStep(false);
                            setNewStepData({ dayNumber: 1, channel: 'email', subject: '', content: '', lineHeight: '1.5', attachments: [] });
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                    
                    {/* Right side - Outlook-style Preview */}
                    <div className="flex flex-col h-full">
                      <div className="flex items-center gap-2 mb-2">
                        <Mail className="h-4 w-4 text-[#0078D4]" />
                        <Label className="text-xs font-medium">Outlook Preview</Label>
                      </div>
                      {newStepData.channel === 'email' ? (
                        <div className="border rounded-lg bg-white shadow-lg overflow-hidden flex-1 flex flex-col">
                          {/* Outlook Header Bar */}
                          <div className="bg-[#0078D4] text-white px-4 py-2 flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <span className="text-sm font-medium">Outlook</span>
                          </div>
                          
                          {/* Email Header */}
                          <div className="bg-gray-50 px-4 py-3 border-b space-y-2">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#0078D4] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                                {editingSender?.name.split(' ').map(n => n[0]).join('') || 'JB'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline justify-between">
                                  <span className="font-semibold text-sm">{editingSender?.name || 'Sender Name'}</span>
                                  <span className="text-xs text-gray-500">Just now</span>
                                </div>
                                <div className="text-xs text-gray-500">{editingSender?.email || 'sender@example.com'}</div>
                                <div className="text-xs text-gray-400 mt-1">To: John Smith &lt;broker@example.com&gt;</div>
                              </div>
                            </div>
                            <div className="font-semibold text-sm text-gray-800 pl-13">
                              {newStepData.subject || '(No subject line)'}
                            </div>
                          </div>
                          
                          {/* Email Body */}
                          <div className="p-4 flex-1 overflow-auto bg-white min-h-[400px]">
                            {newStepData.content ? (
                              <div 
                                className="text-sm text-gray-700 prose prose-sm max-w-none"
                                style={{ lineHeight: newStepData.lineHeight || '1.5' }}
                                dangerouslySetInnerHTML={{ 
                                  __html: renderEmailPreview(newStepData.content, newStepData.subject) 
                                }}
                              />
                            ) : (
                              <p className="text-gray-400 italic text-center mt-8">Start typing to see how your email will appear in Outlook...</p>
                            )}
                          </div>
                          
                          {/* Footer */}
                          <div className="bg-gray-50 px-4 py-2 border-t text-xs text-gray-400 text-center">
                            Personalization tokens like {"{{broker.firstName}}"} will be replaced with actual data
                          </div>
                        </div>
                      ) : (
                        <div className="border rounded-lg bg-white shadow-lg overflow-hidden flex-1 flex flex-col">
                          {/* SMS Phone Preview */}
                          <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-center">
                            <span className="text-sm font-medium">SMS Preview</span>
                          </div>
                          <div className="bg-gray-100 p-4 flex-1 flex items-start justify-end">
                            <div className="bg-[#0078D4] text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%] shadow-md">
                              <p className="text-sm">
                                {newStepData.content ? renderEmailPreview(newStepData.content, '') : 'Your SMS message will appear here...'}
                              </p>
                            </div>
                          </div>
                          <div className="bg-gray-50 px-4 py-2 border-t text-xs text-gray-400 text-center">
                            {(newStepData.content || '').length}/160 characters
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Edit Step Modal - Side by Side Layout */}
              {editingStep && (
                <div className="mt-4 p-4 border rounded-lg bg-yellow-50/50">
                  <h5 className="font-medium text-sm mb-3">Edit Step (Day {editingStep.dayNumber})</h5>
                  <div className="grid grid-cols-[1fr_2fr] gap-6">
                    {/* Left side - Editor (compact) */}
                    <div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <Label className="text-xs">Day</Label>
                          <Input
                            type="number"
                            min="1"
                            max="365"
                            value={editingStep.dayNumber || 1}
                            onChange={(e) => setEditingStep({ ...editingStep, dayNumber: parseInt(e.target.value) || 1 })}
                            data-testid="edit-step-day-input"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Method</Label>
                          <Select
                            value={editingStep.channel || 'email'}
                            onValueChange={(val: 'email' | 'sms') => setEditingStep({ ...editingStep, channel: val })}
                          >
                            <SelectTrigger data-testid="edit-step-channel-select">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="sms">SMS</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {editingStep.channel === 'email' && (
                        <div className="mb-3">
                          <Label className="text-xs">Subject Line</Label>
                          <Input
                            value={editingStep.subject || ''}
                            onChange={(e) => setEditingStep({ ...editingStep, subject: e.target.value })}
                            data-testid="edit-step-subject-input"
                          />
                        </div>
                      )}
                      <div className="mb-3">
                        <Label className="text-xs">Message Content</Label>
                        {editingStep.channel === 'email' ? (
                          <RichTextEditor
                            value={editingStep.content || ''}
                            onChange={(content) => setEditingStep({ ...editingStep, content })}
                            placeholder="Enter your email content..."
                            minHeight="350px"
                          />
                        ) : (
                          <Textarea
                            value={editingStep.content || ''}
                            onChange={(e) => setEditingStep({ ...editingStep, content: e.target.value })}
                            rows={6}
                            className="font-mono text-sm"
                            data-testid="edit-step-content-input"
                          />
                        )}
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="text-xs text-gray-400">Insert personalization:</span>
                          {PERSONALIZATION_TOKENS.slice(0, 4).map(t => (
                            <button
                              key={t.token}
                              type="button"
                              className="text-xs text-blue-600 hover:underline"
                              onClick={() => setEditingStep({ ...editingStep, content: (editingStep.content || '') + t.token })}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* File Attachments for Email (Edit Step) */}
                      {editingStep.channel === 'email' && (
                        <div className="mb-3">
                          <Label className="text-xs flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />
                            Attachments
                          </Label>
                          <div className="mt-1 space-y-2">
                            {(() => {
                              let attachments: any[] = [];
                              try {
                                const raw = editingStep.attachments;
                                if (!raw) {
                                  attachments = [];
                                } else if (typeof raw === 'string') {
                                  const parsed = JSON.parse(raw);
                                  attachments = Array.isArray(parsed) ? parsed : [];
                                } else if (Array.isArray(raw)) {
                                  attachments = raw;
                                } else {
                                  attachments = [];
                                }
                              } catch (e) {
                                console.error('Failed to parse attachments:', e);
                                attachments = [];
                              }
                              return attachments.length > 0 && (
                                <div className="space-y-1">
                                  {attachments.map((file: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                                      <FileText className="h-4 w-4 text-blue-500" />
                                      <span className="flex-1 truncate">{file.filename}</span>
                                      <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</span>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0 text-red-500"
                                        onClick={() => {
                                          const newAttachments = attachments.filter((_: any, i: number) => i !== idx);
                                          setEditingStep({
                                            ...editingStep,
                                            attachments: JSON.stringify(newAttachments)
                                          });
                                        }}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                            <div>
                              <input
                                type="file"
                                id="edit-step-attachment"
                                className="hidden"
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.gif"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  
                                  if (file.size > 50 * 1024 * 1024) {
                                    toast({ title: "File too large", description: "Max 50MB per file", variant: "destructive" });
                                    return;
                                  }
                                  
                                  setIsUploadingAttachment(true);
                                  try {
                                    const formData = new FormData();
                                    formData.append('file', file);
                                    const response = await fetch('/api/upload/attachment', {
                                      method: 'POST',
                                      body: formData,
                                      credentials: 'include'
                                    });
                                    if (!response.ok) throw new Error('Upload failed');
                                    const { url, filename, contentType, size } = await response.json();
                                    
                                    let currentAttachments: any[] = [];
                                    try {
                                      const raw = editingStep.attachments;
                                      if (!raw) {
                                        currentAttachments = [];
                                      } else if (typeof raw === 'string') {
                                        const parsed = JSON.parse(raw);
                                        currentAttachments = Array.isArray(parsed) ? parsed : [];
                                      } else if (Array.isArray(raw)) {
                                        currentAttachments = raw;
                                      } else {
                                        currentAttachments = [];
                                      }
                                    } catch (e) {
                                      currentAttachments = [];
                                    }
                                    setEditingStep({
                                      ...editingStep,
                                      attachments: JSON.stringify([...currentAttachments, { filename, url, contentType, size }])
                                    });
                                    toast({ title: "File attached", description: filename });
                                  } catch (error) {
                                    toast({ title: "Upload failed", description: "Could not upload file", variant: "destructive" });
                                  } finally {
                                    setIsUploadingAttachment(false);
                                    e.target.value = '';
                                  }
                                }}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => document.getElementById('edit-step-attachment')?.click()}
                                disabled={isUploadingAttachment}
                                className="text-xs"
                              >
                                {isUploadingAttachment ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <Paperclip className="h-3 w-3 mr-1" />
                                )}
                                Add Attachment
                              </Button>
                              <span className="text-xs text-gray-400 ml-2">Max 50MB (PDF, DOC, images)</span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={editingStep.isActive !== false}
                            onCheckedChange={(checked) => setEditingStep({ ...editingStep, isActive: checked })}
                            data-testid="edit-step-active-switch"
                          />
                          <Label className="text-xs">Active</Label>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            if (editingStep.id && editingStep.content) {
                              updateStepMutation.mutate({
                                stepId: editingStep.id,
                                dayNumber: editingStep.dayNumber,
                                channel: editingStep.channel,
                                subject: editingStep.subject,
                                content: editingStep.content,
                                isActive: editingStep.isActive,
                                attachments: editingStep.attachments,
                              });
                            }
                          }}
                          disabled={updateStepMutation.isPending || !editingStep.content}
                          data-testid="save-edit-step-btn"
                        >
                          {updateStepMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save Changes'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingStep(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-auto border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors"
                          onClick={async () => {
                            console.log(`[TEST-CLICK] Sending test for sender: ${editingSender?.name} (${editingSender?.email}) ID: ${editingSender?.id}`);
                            const testEmail = prompt("Enter email address to send test email to:");
                            if (!testEmail) return;
                            
                            try {
                              const response = await fetch(`/api/outreach/senders/${editingSender?.id}/test-drip-email`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                  testRecipientEmail: testEmail,
                                  stepIndex: 0,
                                  subject: editingStep?.subject || '',
                                  content: editingStep?.content || '',
                                  attachments: editingStep?.attachments || []
                                })
                              });
                              const result = await response.json();
                              if (result.success) {
                                toast({ title: "Test Email Sent!", description: result.message });
                              } else {
                                toast({ title: "Failed", description: result.error || "Could not send test email", variant: "destructive" });
                              }
                            } catch (error) {
                              toast({ title: "Error", description: "Failed to send test email", variant: "destructive" });
                            }
                          }}
                          data-testid="send-test-email-btn"
                        >
                          <Send className="h-3 w-3 mr-1" />
                          Send Test
                        </Button>
                      </div>
                    </div>
                    
                    {/* Right side - Outlook-style Preview */}
                    <div className="flex flex-col h-full">
                      <div className="flex items-center gap-2 mb-2">
                        <Mail className="h-4 w-4 text-[#0078D4]" />
                        <Label className="text-xs font-medium">Outlook Preview</Label>
                      </div>
                      {editingStep.channel === 'email' ? (
                        <div className="border rounded-lg bg-white shadow-lg overflow-hidden flex-1 flex flex-col">
                          <div className="bg-[#0078D4] text-white px-4 py-2 flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <span className="text-sm font-medium">Outlook</span>
                          </div>
                          <div className="bg-gray-50 px-4 py-3 border-b space-y-2">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#0078D4] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                                {editingSender?.name.split(' ').map(n => n[0]).join('') || 'JB'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline justify-between">
                                  <span className="font-semibold text-sm">{editingSender?.name || 'Sender Name'}</span>
                                  <span className="text-xs text-gray-500">Just now</span>
                                </div>
                                <div className="text-xs text-gray-500">{editingSender?.email || 'sender@example.com'}</div>
                                <div className="text-xs text-gray-400 mt-1">To: John Smith &lt;broker@example.com&gt;</div>
                              </div>
                            </div>
                            <div className="font-semibold text-sm text-gray-800 pl-13">
                              {editingStep.subject || '(No subject line)'}
                            </div>
                          </div>
                          <div className="p-4 flex-1 overflow-auto bg-white min-h-[400px]">
                            {editingStep.content ? (
                              <div 
                                className="text-sm text-gray-700 prose prose-sm max-w-none"
                                style={{ lineHeight: editingStep.lineHeight || '1.5' }}
                                dangerouslySetInnerHTML={{ 
                                  __html: renderEmailPreview(editingStep.content, editingStep.subject) 
                                }}
                              />
                            ) : (
                              <p className="text-gray-400 italic text-center mt-8">Start typing to see how your email will appear in Outlook...</p>
                            )}
                          </div>
                          <div className="bg-gray-50 px-4 py-2 border-t text-xs text-gray-400 text-center">
                            Personalization tokens like {"{{broker.firstName}}"} will be replaced with actual data
                          </div>
                        </div>
                      ) : (
                        <div className="border rounded-lg bg-white shadow-lg overflow-hidden flex-1 flex flex-col">
                          <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-center">
                            <span className="text-sm font-medium">SMS Preview</span>
                          </div>
                          <div className="bg-gray-100 p-4 flex-1 flex items-start justify-end min-h-[400px]">
                            <div className="bg-[#0078D4] text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%] shadow-md">
                              <p className="text-sm">
                                {editingStep.content ? renderEmailPreview(editingStep.content, '') : 'Your SMS message will appear here...'}
                              </p>
                            </div>
                          </div>
                          <div className="bg-gray-50 px-4 py-2 border-t text-xs text-gray-400 text-center">
                            {(editingStep.content || '').length}/160 characters
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Daily email limit */}
            <div className="border-t pt-4 mt-4">
              <Label className="text-sm font-medium">Daily Email Limit</Label>
              <p className="text-xs text-gray-500 mb-2">
                Max emails this sender sends per day. The worker spreads them evenly across the 9 AM–5 PM window.
                Default is 150.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={10}
                  max={500}
                  step={10}
                  value={editingSender.dailyLimitOverride ?? 150}
                  onChange={(e) =>
                    setEditingSender({ ...editingSender, dailyLimitOverride: parseInt(e.target.value) || 150 })
                  }
                  className="w-28 border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-500">emails / day · ~{Math.ceil((editingSender.dailyLimitOverride ?? 150) / 8)} per hourly run</span>
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-4 mt-4">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-gray-500">Include in outreach campaigns</p>
              </div>
              <Switch
                checked={editingSender.isActive}
                onCheckedChange={(checked) =>
                  setEditingSender({ ...editingSender, isActive: checked })
                }
                data-testid="sender-active-switch"
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingSender(null)} data-testid="cancel-sender-edit">
              Cancel
            </Button>
            <Button
              onClick={() => {
                // Sync signature from ref ONLY if the signature popover is currently open
                // This prevents overwriting with stale/empty content when popover was never opened
                let senderToSave = editingSender;
                if (signaturePopoverOpen && signatureEditorRef.current) {
                  const html = signatureEditorRef.current.innerHTML;
                  const cleanHtml = cleanSignatureHtml(html);
                  senderToSave = { ...editingSender, signatureHtml: cleanHtml };
                }
                setSignaturePopoverOpen(false);
                updateSenderMutation.mutate(senderToSave);
              }}
              disabled={updateSenderMutation.isPending}
              data-testid="save-sender-changes"
            >
              {updateSenderMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <SEO
        title={`Outreach Setup | ${companyName}`}
        description="Configure your automated outreach campaigns"
      />
      <Navigation />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-catalyst-navy mb-2">
            Outreach Campaign Setup
          </h1>
          <p className="text-gray-600">
            Configure your team, connect email accounts, and launch personalized outreach
          </p>
        </div>

        {/* Dry Run Mode Toggle - Critical for testing */}
        <div className={`mb-6 p-4 rounded-lg border-2 ${isDryRunMode ? 'bg-amber-50 border-amber-400' : 'bg-green-50 border-green-400'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isDryRunMode ? 'bg-amber-100' : 'bg-green-100'}`}>
                {isDryRunMode ? (
                  <TestTube className="h-5 w-5 text-amber-600" />
                ) : (
                  <Zap className="h-5 w-5 text-green-600" />
                )}
              </div>
              <div>
                <h3 className={`font-semibold ${isDryRunMode ? 'text-amber-800' : 'text-green-800'}`}>
                  {isDryRunMode ? '🧪 Dry Run Mode (Testing)' : '⚡ Live Mode (Sending Emails)'}
                </h3>
                <p className={`text-sm ${isDryRunMode ? 'text-amber-700' : 'text-green-700'}`}>
                  {isDryRunMode 
                    ? 'Emails are logged but NOT sent. Safe for testing your setup.'
                    : 'Emails will be sent to real recipients. Make sure everything is configured correctly!'}
                </p>
              </div>
            </div>
            <Switch
              checked={!isDryRunMode}
              onCheckedChange={(checked) => toggleDryRunMutation.mutate(!checked)}
              disabled={toggleDryRunMutation.isPending}
            />
          </div>
          {isDryRunMode && (
            <p className="mt-2 text-xs text-amber-600">
              View logs to see what WOULD be sent. Toggle to "Live" when ready to send real emails.
            </p>
          )}
        </div>

        <DailySendActivityPanel />

        {renderStepIndicator()}

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}

        {renderEditSenderModal()}
      </main>

      <Footer />
    </div>
  );
}
