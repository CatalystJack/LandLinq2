import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import Navigation from "@/components/navigation";
import { Helmet } from "react-helmet-async";
import { useToast } from "@/hooks/use-toast";
import { 
  Database, 
  TrendingUp, 
  MapPin, 
  Users, 
  Building2, 
  DollarSign,
  Download,
  Search,
  BarChart3,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Home,
  Filter,
  Globe,
  CheckCircle,
  Zap,
  ExternalLink,
  List,
  Building
} from "lucide-react";

interface DealInsights {
  totalDeals: number;
  deals: any[];
  priceMetrics?: { byState: any[] };
  classificationCounts?: { green: number; yellow: number; red: number };
  productTypeCounts?: any[];
}

interface MarketData {
  uniqueMarkets: number;
  markets: any[];
}

interface BrokerAnalytics {
  activeBrokers: number;
  topBrokers: any[];
}

interface ComparablesCache {
  totalComparables: number;
  comparables: any[];
}

interface ApiSource {
  id: string;
  name: string;
  description: string;
  type: string;
  cost: string;
  endpoint: string;
  dataPoints: string[];
  usedIn: string[];
}

interface ApiSourcesData {
  totalSources: number;
  sources: ApiSource[];
  freeApis: number;
  paidApis: number;
  apiUsageStats: Array<{ service: string; calls: number; cost: number }>;
}

type LoopNetListing = {
  listingId: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  propertyType: string;
  listingPrice: number | null;
  sizeAcres: number | null;
  squareFootage: number | null;
  daysOnMarket: number | null;
  description: string;
  listingBroker: string;
  brokerCompany: string;
  brokerEmail: string;
  sourceUrl: string;
  thumbnail: string;
  listingType: string;
};

function formatNumber(value: unknown, fractionDigits = 0): string {
  if (value === null || value === undefined || value === '') return '-';
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString(undefined, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      })
    : '-';
}

export default function DataHub() {
  const [activeTab, setActiveTab] = useState("deals");
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const { toast } = useToast();

  // Live Listings state
  const [listingCity, setListingCity] = useState("");
  const [listingState, setListingState] = useState("");
  const [listingZip, setListingZip] = useState("");
  const [listingType, setListingType] = useState("sale");
  const [listingResults, setListingResults] = useState<LoopNetListing[] | null>(null);
  const [listingTotal, setListingTotal] = useState(0);
  const [listingSearching, setListingSearching] = useState(false);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [rawFirst, setRawFirst] = useState<any>(null);

  async function searchLoopNet() {
    if (!listingCity && !listingState && !listingZip) {
      toast({ title: "Enter a city + state, zip code, or state", variant: "destructive" });
      return;
    }
    setListingSearching(true);
    try {
      const res = await fetch('/api/listings/loopnet-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ city: listingCity, state: listingState, zipCode: listingZip, listingType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setListingResults(data.listings || []);
      setListingTotal(data.total || 0);
      setRawFirst(data.rawFirst);
    } catch (e: any) {
      toast({ title: "Search failed", description: e.message, variant: "destructive" });
    } finally {
      setListingSearching(false);
    }
  }

  async function importListing(l: LoopNetListing) {
    try {
      const res = await fetch('/api/listings/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(l),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setImportedIds(prev => new Set([...prev, l.listingId || l.address]));
      toast({
        title: "Staged for review",
        description: `${l.address} added to your review queue.`,
        action: (
          <a href="/listing-review" className="text-[#4A90E2] underline text-xs font-medium whitespace-nowrap">
            Review now →
          </a>
        ) as any,
      });
    } catch (e: any) {
      toast({ title: "Failed to stage listing", description: e.message, variant: "destructive" });
    }
  }

  const { data: dealInsights, isLoading: dealsLoading } = useQuery<DealInsights>({
    queryKey: ["/api/data-hub/deal-insights"],
  });

  const { data: marketData, isLoading: marketLoading } = useQuery<MarketData>({
    queryKey: ["/api/data-hub/market-intelligence"],
  });

  const { data: brokerAnalytics, isLoading: brokersLoading } = useQuery<BrokerAnalytics>({
    queryKey: ["/api/data-hub/broker-analytics"],
  });

  const { data: comparablesCache, isLoading: comparablesLoading } = useQuery<ComparablesCache>({
    queryKey: ["/api/data-hub/comparables-cache"],
  });

  const { data: apiSources, isLoading: apiSourcesLoading } = useQuery<ApiSourcesData>({
    queryKey: ["/api/data-hub/api-sources"],
  });

  return (
    <>
      <Helmet>
        <title>Data Hub - Proprietary Intelligence | LandLinq</title>
        <meta name="description" content="Access proprietary deal data, market intelligence, broker analytics, and comparable properties for informed development decisions." />
      </Helmet>
      <Navigation />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 pt-20 pb-16 px-4">
        <div className="max-w-[1800px] mx-auto">
          <header className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Database className="h-8 w-8 text-[#4A90E2]" />
              <h1 className="text-3xl md:text-4xl font-bold text-[#07172A] tracking-tight">
                Data Hub
              </h1>
            </div>
            <p className="text-base md:text-lg text-gray-600">
              Proprietary intelligence from your deals, markets, and broker network
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Deals Analyzed</p>
                    <p className="text-2xl font-bold text-[#07172A]">
                      {dealInsights?.totalDeals || 0}
                    </p>
                  </div>
                  <Building2 className="h-10 w-10 text-[#4A90E2] opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Markets Covered</p>
                    <p className="text-2xl font-bold text-[#07172A]">
                      {marketData?.uniqueMarkets || 0}
                    </p>
                  </div>
                  <MapPin className="h-10 w-10 text-green-500 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Active Brokers</p>
                    <p className="text-2xl font-bold text-[#07172A]">
                      {brokerAnalytics?.activeBrokers || 0}
                    </p>
                  </div>
                  <Users className="h-10 w-10 text-purple-500 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Comparables Cached</p>
                    <p className="text-2xl font-bold text-[#07172A]">
                      {comparablesCache?.totalComparables || 0}
                    </p>
                  </div>
                  <Home className="h-10 w-10 text-orange-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid grid-cols-7 w-full max-w-5xl">
              <TabsTrigger value="deals" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">Deal History</span>
              </TabsTrigger>
              <TabsTrigger value="markets" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Markets</span>
              </TabsTrigger>
              <TabsTrigger value="brokers" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Brokers</span>
              </TabsTrigger>
              <TabsTrigger value="comparables" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Comparables</span>
              </TabsTrigger>
              <TabsTrigger value="listings" className="flex items-center gap-2">
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">Live Listings</span>
              </TabsTrigger>
              <TabsTrigger value="apis" className="flex items-center gap-2" data-testid="tab-api-sources">
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">API Sources</span>
              </TabsTrigger>
              <TabsTrigger value="export" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="deals">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Deal Intelligence</CardTitle>
                      <CardDescription>Historical deals with pricing, acreage, and classification data</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input 
                        placeholder="Search deals..." 
                        className="w-64"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        data-testid="input-search-deals"
                      />
                      <Select value={stateFilter} onValueChange={setStateFilter}>
                        <SelectTrigger className="w-32" data-testid="select-state-filter">
                          <SelectValue placeholder="State" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All States</SelectItem>
                          <SelectItem value="NC">North Carolina</SelectItem>
                          <SelectItem value="SC">South Carolina</SelectItem>
                          <SelectItem value="GA">Georgia</SelectItem>
                          <SelectItem value="FL">Florida</SelectItem>
                          <SelectItem value="TX">Texas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {dealsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : dealInsights?.deals?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Property</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Product Type</TableHead>
                            <TableHead className="text-right">Acreage</TableHead>
                            <TableHead className="text-right">Price/Acre</TableHead>
                            <TableHead className="text-right">Units</TableHead>
                            <TableHead>Classification</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dealInsights.deals
                            .filter((deal: any) => {
                              if (stateFilter !== "all" && deal.state !== stateFilter) return false;
                              if (searchQuery && !deal.propertyName?.toLowerCase().includes(searchQuery.toLowerCase()) && 
                                  !deal.city?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                              return true;
                            })
                            .slice(0, 50)
                            .map((deal: any) => (
                            <TableRow key={deal.id} data-testid={`row-deal-${deal.id}`}>
                              <TableCell className="font-medium">{deal.propertyName || 'Unnamed'}</TableCell>
                              <TableCell>{deal.city}, {deal.state}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{deal.productType || 'N/A'}</Badge>
                              </TableCell>
                              <TableCell className="text-right">{formatNumber(deal.acreage, 2)}</TableCell>
                              <TableCell className="text-right">
                                {deal.pricePerAcre ? `$${formatNumber(deal.pricePerAcre)}` : '-'}
                              </TableCell>
                              <TableCell className="text-right">{deal.proposedUnits || '-'}</TableCell>
                              <TableCell>
                                <Badge 
                                  variant={deal.classification === 'green' ? 'default' : deal.classification === 'yellow' ? 'secondary' : 'destructive'}
                                >
                                  {deal.classification || 'pending'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-gray-500">
                                {deal.createdAt ? new Date(deal.createdAt).toLocaleDateString() : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No deal data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {dealInsights?.priceMetrics && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Avg Price/Acre by State</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {dealInsights.priceMetrics.byState?.slice(0, 5).map((item: any) => (
                          <div key={item.state} className="flex justify-between items-center">
                            <span className="font-medium">{item.state}</span>
                            <span className="text-[#4A90E2]">${formatNumber(item.avgPricePerAcre)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Classification Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                            Pursuing (Green)
                          </span>
                          <span className="font-bold">{dealInsights.classificationCounts?.green || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-yellow-500" />
                            Reviewing (Yellow)
                          </span>
                          <span className="font-bold">{dealInsights.classificationCounts?.yellow || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            Passed (Red)
                          </span>
                          <span className="font-bold">{dealInsights.classificationCounts?.red || 0}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Top Product Types</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {dealInsights.productTypeCounts?.slice(0, 5).map((item: any) => (
                          <div key={item.type} className="flex justify-between items-center">
                            <span>{item.type}</span>
                            <Badge variant="outline">{item.count} deals</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="markets">
              <Card>
                <CardHeader>
                  <CardTitle>Market Intelligence</CardTitle>
                  <CardDescription>Deal activity and pricing trends by market</CardDescription>
                </CardHeader>
                <CardContent>
                  {marketLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : marketData?.markets?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Market (City, State)</TableHead>
                            <TableHead className="text-right">Total Deals</TableHead>
                            <TableHead className="text-right">Green Deals</TableHead>
                            <TableHead className="text-right">Avg Price/Acre</TableHead>
                            <TableHead className="text-right">Avg Units</TableHead>
                            <TableHead>Win Rate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {marketData.markets.map((market: any) => (
                            <TableRow key={`${market.city}-${market.state}`}>
                              <TableCell className="font-medium">{market.city}, {market.state}</TableCell>
                              <TableCell className="text-right">{market.dealCount}</TableCell>
                              <TableCell className="text-right text-green-600">{market.greenCount}</TableCell>
                              <TableCell className="text-right">
                                {market.avgPricePerAcre ? `$${formatNumber(market.avgPricePerAcre)}` : '-'}
                              </TableCell>
                              <TableCell className="text-right">{formatNumber(market.avgUnits)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={market.winRate || 0} className="h-2 w-20" />
                                  <span className="text-sm">{formatNumber(market.winRate) === '-' ? '0' : formatNumber(market.winRate)}%</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No market data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="brokers">
              <Card>
                <CardHeader>
                  <CardTitle>Broker Network Analytics</CardTitle>
                  <CardDescription>Deal sources and broker engagement metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  {brokersLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : brokerAnalytics?.topBrokers?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Broker</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead className="text-right">Total Deals</TableHead>
                            <TableHead className="text-right">Green Deals</TableHead>
                            <TableHead>Success Rate</TableHead>
                            <TableHead>Markets</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {brokerAnalytics.topBrokers.map((broker: any) => (
                            <TableRow key={broker.id}>
                              <TableCell className="font-medium">{broker.name || broker.email}</TableCell>
                              <TableCell>{broker.company || '-'}</TableCell>
                              <TableCell className="text-right">{broker.dealCount}</TableCell>
                              <TableCell className="text-right text-green-600">{broker.greenCount}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={broker.successRate || 0} className="h-2 w-20" />
                                  <span className="text-sm">{formatNumber(broker.successRate) === '-' ? '0' : formatNumber(broker.successRate)}%</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {broker.markets?.slice(0, 3).map((m: string) => (
                                    <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                                  ))}
                                  {broker.markets?.length > 3 && (
                                    <Badge variant="secondary" className="text-xs">+{broker.markets.length - 3}</Badge>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No broker analytics available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="comparables">
              <Card>
                <CardHeader>
                  <CardTitle>Cached Comparables</CardTitle>
                  <CardDescription>Property comparables from HelloData analysis within the last 3 months</CardDescription>
                </CardHeader>
                <CardContent>
                  {comparablesLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : comparablesCache?.comparables?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Property Name</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead className="text-right">Units</TableHead>
                            <TableHead className="text-right">Year Built</TableHead>
                            <TableHead className="text-right">Rent PSF</TableHead>
                            <TableHead className="text-right">Distance (mi)</TableHead>
                            <TableHead>Source Deal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {comparablesCache.comparables.slice(0, 100).map((comp: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{comp.propertyName}</TableCell>
                              <TableCell>{comp.city}, {comp.state}</TableCell>
                              <TableCell className="text-right">{comp.units}</TableCell>
                              <TableCell className="text-right">{comp.yearBuilt}</TableCell>
                              <TableCell className="text-right">
                                {comp.rentPsf ? `$${formatNumber(comp.rentPsf, 2)}` : '-'}
                              </TableCell>
                              <TableCell className="text-right">{formatNumber(comp.distance, 1)}</TableCell>
                              <TableCell className="text-gray-500 text-sm">{comp.sourceDeal || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Home className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No cached comparables available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="apis">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5" />
                        Data API Sources
                      </CardTitle>
                      <CardDescription>Government and commercial APIs integrated into the platform</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {apiSources?.freeApis || 0} Free APIs
                      </Badge>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        <Zap className="h-3 w-3 mr-1" />
                        {apiSources?.paidApis || 0} Paid APIs
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {apiSourcesLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : apiSources?.sources?.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {apiSources.sources.map((source) => (
                        <Card key={source.id} className="border-2" data-testid={`api-source-${source.id}`}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">{source.name}</CardTitle>
                              <Badge variant={source.cost === 'Free' ? 'default' : 'secondary'}>
                                {source.cost}
                              </Badge>
                            </div>
                            <CardDescription>{source.description}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Type</p>
                              <Badge variant="outline">{source.type}</Badge>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Data Points</p>
                              <div className="flex flex-wrap gap-1">
                                {source.dataPoints.map((point, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {point}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Used In</p>
                              <div className="flex flex-wrap gap-1">
                                {source.usedIn.map((use, idx) => (
                                  <span key={idx} className="text-xs text-blue-600">
                                    {use}{idx < source.usedIn.length - 1 ? ', ' : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Endpoint</p>
                              <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all">
                                {source.endpoint}
                              </code>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No API sources found</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="export">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5" />
                      Export Deal Data
                    </CardTitle>
                    <CardDescription>Download comprehensive deal history with all metadata</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Export includes: Property details, pricing, acreage, classifications, broker info, and analysis results
                    </p>
                    <Button className="w-full" data-testid="button-export-deals">
                      <Download className="h-4 w-4 mr-2" />
                      Export Deals to Excel
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Export Market Analysis
                    </CardTitle>
                    <CardDescription>Market-level aggregations and trends</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Export includes: Market summaries, pricing trends, deal volume, and success rates by geography
                    </p>
                    <Button className="w-full" variant="outline" data-testid="button-export-markets">
                      <Download className="h-4 w-4 mr-2" />
                      Export Market Data
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Export Broker Analytics
                    </CardTitle>
                    <CardDescription>Broker performance and engagement metrics</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Export includes: Broker profiles, deal counts, success rates, and market coverage
                    </p>
                    <Button className="w-full" variant="outline" data-testid="button-export-brokers">
                      <Download className="h-4 w-4 mr-2" />
                      Export Broker Data
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Home className="h-5 w-5" />
                      Export Comparables
                    </CardTitle>
                    <CardDescription>All cached property comparables</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Export includes: Property names, locations, units, year built, rent PSF, and distance data
                    </p>
                    <Button className="w-full" variant="outline" data-testid="button-export-comparables">
                      <Download className="h-4 w-4 mr-2" />
                      Export Comparables
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ─── Live Listings Tab ─── */}
            <TabsContent value="listings">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building className="h-5 w-5 text-[#4A90E2]" />
                        Live LoopNet Listings
                      </CardTitle>
                      <CardDescription>Search active for-sale and lease listings via LoopNet</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {listingResults !== null && (
                        <Badge variant="outline" className="text-sm">
                          {listingTotal.toLocaleString()} total results
                        </Badge>
                      )}
                      <a
                        href="/listing-review"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#4A90E2] hover:text-[#357abd] border border-[#4A90E2] rounded-md px-3 py-1.5 hover:bg-blue-50 transition-colors"
                      >
                        <span>Review Queue</span>
                        <span className="text-xs opacity-70">→</span>
                      </a>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Search form */}
                  <div className="flex flex-wrap gap-3 mb-6">
                    <Input
                      placeholder="City"
                      value={listingCity}
                      onChange={e => setListingCity(e.target.value)}
                      className="w-40"
                      onKeyDown={e => e.key === 'Enter' && searchLoopNet()}
                    />
                    <Input
                      placeholder="State (e.g. NC)"
                      value={listingState}
                      onChange={e => setListingState(e.target.value.toUpperCase())}
                      className="w-32"
                      maxLength={2}
                      onKeyDown={e => e.key === 'Enter' && searchLoopNet()}
                    />
                    <Input
                      placeholder="Zip Code"
                      value={listingZip}
                      onChange={e => setListingZip(e.target.value)}
                      className="w-32"
                      onKeyDown={e => e.key === 'Enter' && searchLoopNet()}
                    />
                    <Select value={listingType} onValueChange={setListingType}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sale">For Sale</SelectItem>
                        <SelectItem value="lease">For Lease</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={searchLoopNet} disabled={listingSearching} className="bg-[#4A90E2] hover:bg-[#357abd]">
                      {listingSearching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                      Search
                    </Button>
                  </div>

                  {/* Results */}
                  {listingSearching && (
                    <div className="flex items-center justify-center py-20 text-gray-400">
                      <Loader2 className="h-8 w-8 animate-spin mr-3" />
                      Searching LoopNet…
                    </div>
                  )}

                  {!listingSearching && listingResults !== null && listingResults.length === 0 && (
                    <div className="text-center py-16 text-gray-400">
                      <Building className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No listings found</p>
                      <p className="text-sm mt-1">Try a different city, state, or zip code</p>
                      {rawFirst !== null && (
                        <details className="mt-4 text-left text-xs max-w-lg mx-auto">
                          <summary className="cursor-pointer text-blue-500">Debug: raw API response shape</summary>
                          <pre className="bg-gray-50 p-3 rounded mt-2 overflow-x-auto">{JSON.stringify(rawFirst, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                  )}

                  {!listingSearching && listingResults && listingResults.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {listingResults.map((l, i) => {
                        const isImported = importedIds.has(l.listingId || l.address);
                        return (
                          <div key={l.listingId || i} className="border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white">
                            {/* Thumbnail */}
                            {l.thumbnail ? (
                              <img src={l.thumbnail} alt={l.address} className="w-full h-36 object-cover" />
                            ) : (
                              <div className="w-full h-36 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                                <Building className="h-10 w-10 text-slate-300" />
                              </div>
                            )}
                            <div className="p-4">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                  <p className="font-semibold text-sm text-gray-900 leading-tight line-clamp-2">{l.address || 'Address not available'}</p>
                                  <p className="text-xs text-gray-500">{[l.city, l.state, l.zipCode].filter(Boolean).join(', ')}</p>
                                </div>
                                {l.propertyType && (
                                  <Badge variant="outline" className="text-xs shrink-0">{l.propertyType}</Badge>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3 text-sm">
                                <div>
                                  <span className="text-gray-400 text-xs">Price</span>
                                  <p className="font-semibold text-[#07172A]">
                                    {l.listingPrice ? `$${(l.listingPrice / 1_000_000).toFixed(2)}M` : '—'}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-gray-400 text-xs">Size</span>
                                  <p className="font-medium text-gray-700">
                                    {l.sizeAcres ? `${l.sizeAcres.toFixed(1)} ac` : l.squareFootage ? `${l.squareFootage.toLocaleString()} sf` : '—'}
                                  </p>
                                </div>
                                {l.daysOnMarket != null && (
                                  <div>
                                    <span className="text-gray-400 text-xs">Days on Market</span>
                                    <p className="font-medium text-gray-700">{l.daysOnMarket}d</p>
                                  </div>
                                )}
                                {l.listingBroker && (
                                  <div className="col-span-2">
                                    <span className="text-gray-400 text-xs">Broker</span>
                                    <p className="font-medium text-gray-700 text-xs truncate">{l.listingBroker}{l.brokerCompany ? ` · ${l.brokerCompany}` : ''}</p>
                                  </div>
                                )}
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant={isImported ? "outline" : "default"}
                                  className={`flex-1 text-xs ${isImported ? "text-green-600 border-green-300" : "bg-[#4A90E2] hover:bg-[#357abd]"}`}
                                  disabled={isImported}
                                  onClick={() => importListing(l)}
                                >
                                  {isImported ? (
                                    <><CheckCircle className="h-3 w-3 mr-1" /> Staged</>
                                  ) : (
                                    <><Download className="h-3 w-3 mr-1" /> Stage for Review</>
                                  )}
                                </Button>
                                {l.sourceUrl && (
                                  <Button size="sm" variant="outline" className="text-xs" asChild>
                                    <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  </Button>
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
            </TabsContent>

          </Tabs>
        </div>
      </div>
    </>
  );
}