import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Rss, Plus, Trash2, Play, ChevronLeft, Clock, CheckCircle2,
  XCircle, SkipForward, AlertCircle, ExternalLink, RefreshCw
} from "lucide-react";
import type { RssFeedSource } from "../../../shared/schema";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
];

interface ActivityResult {
  id: string;
  feedSourceId: string;
  listingGuid: string;
  processedAt: string;
  dealId: string | null;
  status: string;
  skipReason: string | null;
  listingTitle: string | null;
  listingUrl: string | null;
}

const STATUS_BADGE: Record<string, { label: string; icon: any; className: string }> = {
  deal_created: { label: "Deal Created", icon: CheckCircle2, className: "bg-green-100 text-green-700 border-green-200" },
  skipped: { label: "Skipped", icon: SkipForward, className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  duplicate: { label: "Duplicate", icon: SkipForward, className: "bg-gray-100 text-gray-600 border-gray-200" },
  error: { label: "Error", icon: XCircle, className: "bg-red-100 text-red-700 border-red-200" },
};

const FEED_TIPS = [
  {
    platform: "LandWatch",
    tip: "Go to landwatch.com → Search for land in your states → click the RSS icon (📶) in the results page URL bar, or append /rss to the search URL.",
    example: "https://www.landwatch.com/rss/North-Carolina_land",
  },
  {
    platform: "Lands of America",
    tip: "Run a search → look for an RSS link in the footer or use the feed URL format below.",
    example: "https://www.landsofamerica.com/rss/search/?stateCode=NC&propertyTypes=Farm",
  },
  {
    platform: "Realtor.com",
    tip: "Run a land search → add ?feed_type=rss to the URL, or look for the RSS button in saved searches.",
    example: "https://www.realtor.com/realestateandhomes-search/North-Carolina/type-land/feed.rss",
  },
  {
    platform: "LoopNet",
    tip: "Set up a saved search → LoopNet will email you alerts. Forward those emails to your deal submission address instead.",
    example: "(Use email forwarding for LoopNet — no RSS feed available)",
  },
];

interface FeedFormData {
  name: string;
  url: string;
  minAcres: string;
  targetStates: string[];
  pollIntervalHours: string;
}

const defaultForm: FeedFormData = {
  name: "",
  url: "",
  minAcres: "4",
  targetStates: [],
  pollIntervalHours: "6",
};

export default function RssFeedsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editFeed, setEditFeed] = useState<RssFeedSource | null>(null);
  const [form, setForm] = useState<FeedFormData>(defaultForm);
  const [pollingId, setPollingId] = useState<string | null>(null);
  const [selectedFeedId, setSelectedFeedId] = useState<string | "all">("all");

  const { data: feeds = [], isLoading: feedsLoading } = useQuery<RssFeedSource[]>({
    queryKey: ["/api/rss-feeds"],
  });

  const { data: activity = [], isLoading: activityLoading, refetch: refetchActivity } = useQuery<ActivityResult[]>({
    queryKey: ["/api/rss-feeds/results/all"],
    refetchInterval: 10000,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/rss-feeds", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rss-feeds"] });
      toast({ title: "Feed added successfully" });
      setShowAddDialog(false);
      setForm(defaultForm);
    },
    onError: (err: any) => toast({ title: "Error adding feed", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/rss-feeds/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rss-feeds"] });
      setEditFeed(null);
    },
    onError: (err: any) => toast({ title: "Error updating feed", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/rss-feeds/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rss-feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rss-feeds/results/all"] });
      toast({ title: "Feed removed" });
    },
    onError: (err: any) => toast({ title: "Error removing feed", description: err.message, variant: "destructive" }),
  });

  async function handlePollNow(feedId: string) {
    setPollingId(feedId);
    try {
      const res = await apiRequest("POST", `/api/rss-feeds/${feedId}/poll-now`);
      const data = await res.json();
      toast({
        title: "Poll complete",
        description: `${data.dealsCreated} deal(s) created, ${data.skipped} skipped, ${data.newItems} new items processed.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rss-feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rss-feeds/results/all"] });
    } catch (err: any) {
      toast({ title: "Poll failed", description: err.message, variant: "destructive" });
    } finally {
      setPollingId(null);
    }
  }

  function openEdit(feed: RssFeedSource) {
    setEditFeed(feed);
    setForm({
      name: feed.name,
      url: feed.url,
      minAcres: feed.minAcres ? String(feed.minAcres) : "4",
      targetStates: feed.targetStates || [],
      pollIntervalHours: String(feed.pollIntervalHours || 6),
    });
  }

  function handleStateToggle(state: string) {
    setForm(f => ({
      ...f,
      targetStates: f.targetStates.includes(state)
        ? f.targetStates.filter(s => s !== state)
        : [...f.targetStates, state],
    }));
  }

  function handleSave() {
    const payload = {
      name: form.name,
      url: form.url,
      minAcres: form.minAcres ? parseFloat(form.minAcres) : null,
      targetStates: form.targetStates,
      pollIntervalHours: parseInt(form.pollIntervalHours) || 6,
    };
    if (editFeed) {
      updateMutation.mutate({ id: editFeed.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const filteredActivity = selectedFeedId === "all"
    ? activity
    : activity.filter(a => a.feedSourceId === selectedFeedId);

  const feedNameMap = Object.fromEntries(feeds.map(f => [f.id, f.name]));

  const isDialogOpen = showAddDialog || !!editFeed;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navigation />
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Link href="/launchpad">
            <Button variant="ghost" size="sm" className="text-gray-500">
              <ChevronLeft className="w-4 h-4 mr-1" /> Launchpad
            </Button>
          </Link>
        </div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-600 flex items-center justify-center">
              <Rss className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">RSS Feed Importer</h1>
              <p className="text-sm text-gray-500">Auto-import land listings from LoopNet, LandWatch, Realtor.com &amp; more</p>
            </div>
          </div>
          <Button onClick={() => { setForm(defaultForm); setShowAddDialog(true); }} className="bg-orange-600 hover:bg-orange-700">
            <Plus className="w-4 h-4 mr-2" /> Add Feed
          </Button>
        </div>

        {/* How it works */}
        <Card className="mb-6 border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-orange-800 dark:text-orange-200">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-orange-700 dark:text-orange-300 space-y-1">
            <p>1. Get an RSS feed URL from any listing site (LandWatch, Lands of America, Realtor.com, etc.) using a saved land search.</p>
            <p>2. Add the feed here with your acreage minimum and target states.</p>
            <p>3. Every 6 hours, the system automatically checks for new listings and runs them through the same AI deal analysis pipeline.</p>
            <p>4. New deals appear in your Analyst Dashboard just like email or form submissions.</p>
          </CardContent>
        </Card>

        {/* Feed Cards */}
        {feedsLoading ? (
          <div className="text-center py-8 text-gray-400">Loading feeds...</div>
        ) : feeds.length === 0 ? (
          <Card className="mb-6">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Rss className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No feeds configured yet</p>
              <p className="text-gray-400 text-sm mb-4">Add your first RSS feed URL below from LandWatch, Realtor.com, or Lands of America</p>
              <Button onClick={() => { setForm(defaultForm); setShowAddDialog(true); }} className="bg-orange-600 hover:bg-orange-700">
                <Plus className="w-4 h-4 mr-2" /> Add Your First Feed
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 mb-6">
            {feeds.map(feed => (
              <Card key={feed.id} className="border border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">{feed.name}</h3>
                        <Badge variant={feed.enabled ? "default" : "secondary"} className="text-xs">
                          {feed.enabled ? "Active" : "Paused"}
                        </Badge>
                        {feed.totalDealsCreated > 0 && (
                          <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                            {feed.totalDealsCreated} deal{feed.totalDealsCreated !== 1 ? "s" : ""} created
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate mt-0.5 font-mono">{feed.url}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                        {feed.minAcres && <span>Min {feed.minAcres} acres</span>}
                        {feed.targetStates && feed.targetStates.length > 0 && (
                          <span>States: {feed.targetStates.join(", ")}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Every {feed.pollIntervalHours}h
                        </span>
                        {feed.lastPolledAt && (
                          <span>Last polled: {new Date(feed.lastPolledAt).toLocaleString()}</span>
                        )}
                        {feed.lastItemCount !== null && feed.lastItemCount !== undefined && (
                          <span>{feed.lastItemCount} items in last fetch</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Switch
                        checked={feed.enabled}
                        onCheckedChange={(checked) =>
                          updateMutation.mutate({ id: feed.id, data: { enabled: checked } })
                        }
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(feed)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-orange-300 text-orange-600 hover:bg-orange-50"
                        onClick={() => handlePollNow(feed.id)}
                        disabled={pollingId === feed.id}
                      >
                        {pollingId === feed.id ? (
                          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3 mr-1" />
                        )}
                        Poll Now
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => {
                          if (confirm(`Remove feed "${feed.name}"?`)) deleteMutation.mutate(feed.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Activity Log */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <CardDescription>Last 100 listings processed across all feeds</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={selectedFeedId} onValueChange={v => setSelectedFeedId(v as any)}>
                  <SelectTrigger className="w-44 h-8 text-sm">
                    <SelectValue placeholder="All feeds" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All feeds</SelectItem>
                    {feeds.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={() => refetchActivity()}>
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {activityLoading ? (
              <div className="text-center py-8 text-gray-400">Loading activity...</div>
            ) : filteredActivity.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No activity yet — click "Poll Now" on any feed to start</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredActivity.map(row => {
                  const statusMeta = STATUS_BADGE[row.status] || STATUS_BADGE.error;
                  const Icon = statusMeta.icon;
                  return (
                    <div key={row.id} className="flex items-start gap-3 px-4 py-3">
                      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        row.status === 'deal_created' ? 'text-green-500' :
                        row.status === 'skipped' || row.status === 'duplicate' ? 'text-yellow-500' :
                        'text-red-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                            {row.listingTitle || "(no title)"}
                          </span>
                          <Badge className={`text-xs px-1.5 py-0 ${statusMeta.className}`}>
                            {statusMeta.label}
                          </Badge>
                          {feeds.length > 1 && feedNameMap[row.feedSourceId!] && (
                            <span className="text-xs text-gray-400">{feedNameMap[row.feedSourceId!]}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                          <span>{new Date(row.processedAt).toLocaleString()}</span>
                          {row.skipReason && <span className="text-yellow-600">— {row.skipReason}</span>}
                          {row.dealId && (
                            <Link href={`/deals/${row.dealId}`}>
                              <span className="text-blue-500 hover:underline cursor-pointer">View Deal →</span>
                            </Link>
                          )}
                          {row.listingUrl && (
                            <a href={row.listingUrl} target="_blank" rel="noopener noreferrer"
                               className="text-gray-400 hover:text-gray-600 flex items-center gap-0.5">
                              <ExternalLink className="w-3 h-3" /> Source
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Feed URL Tips */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Where to Get RSS Feed URLs</CardTitle>
            <CardDescription>Step-by-step for each major platform</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-gray-100 dark:divide-gray-800">
            {FEED_TIPS.map(tip => (
              <div key={tip.platform} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">{tip.platform}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{tip.tip}</p>
                <code className="text-xs text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 px-2 py-0.5 rounded">
                  {tip.example}
                </code>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) { setShowAddDialog(false); setEditFeed(null); }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editFeed ? "Edit Feed" : "Add RSS Feed"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Feed Name</Label>
              <Input
                placeholder="e.g. LandWatch North Carolina"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>RSS Feed URL</Label>
              <Input
                placeholder="https://www.landwatch.com/rss/..."
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              />
              <p className="text-xs text-gray-400 mt-1">Paste the RSS/Atom feed URL from your saved search</p>
            </div>
            <div>
              <Label>Minimum Acreage (skip smaller listings)</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                placeholder="4"
                value={form.minAcres}
                onChange={e => setForm(f => ({ ...f, minAcres: e.target.value }))}
              />
            </div>
            <div>
              <Label>Target States (leave blank to accept all states)</Label>
              <div className="flex flex-wrap gap-1.5 mt-2 max-h-36 overflow-y-auto border rounded p-2">
                {US_STATES.map(state => (
                  <button
                    key={state}
                    type="button"
                    onClick={() => handleStateToggle(state)}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                      form.targetStates.includes(state)
                        ? "bg-orange-600 text-white border-orange-600"
                        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-orange-400"
                    }`}
                  >
                    {state}
                  </button>
                ))}
              </div>
              {form.targetStates.length > 0 && (
                <p className="text-xs text-orange-600 mt-1">{form.targetStates.length} state(s) selected</p>
              )}
            </div>
            <div>
              <Label>Poll Interval</Label>
              <Select
                value={form.pollIntervalHours}
                onValueChange={v => setForm(f => ({ ...f, pollIntervalHours: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">Every 3 hours</SelectItem>
                  <SelectItem value="6">Every 6 hours</SelectItem>
                  <SelectItem value="12">Every 12 hours</SelectItem>
                  <SelectItem value="24">Once a day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setEditFeed(null); }}>
              Cancel
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700"
              onClick={handleSave}
              disabled={!form.name || !form.url || createMutation.isPending || updateMutation.isPending}
            >
              {editFeed ? "Save Changes" : "Add Feed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
