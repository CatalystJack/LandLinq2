import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { isPlatformAdminEmail } from "@shared/admin-auth";
import { 
  LayoutDashboard, 
  MessageSquare, 
  Users, 
  Mail, 
  Settings,
  BarChart3, 
  Building2, 
  ExternalLink,
  Database,
  MonitorCheck,
  RefreshCw,
  Calculator,
  BookUser,
  Rss,
  Search,
  Inbox,
  Brain
} from "lucide-react";

interface LaunchpadTile {
  name: string;
  description: string;
  icon: any;
  href: string;
  color: string;
  external?: boolean;
  category: 'internal' | 'external' | 'underwriting';
}

interface MarketRate {
  name: string;
  value: number | null;
  date: string | null;
  unit: string;
  status?: string;
  link?: string;
  source?: string;
}

interface MarketMetrics {
  lastUpdated: string;
  rates: MarketRate[];
  note?: string;
}

interface PipelineStats {
  totalDeals: number;
  totalValue: number;
  avgDealSize: number;
  conversionRate: number;
  highPriorityDeals: number;
  pendingDeals: number;
}

export default function Launchpad() {
  const { user } = useAuth();
  const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
  const isPlatformAdmin = isPlatformAdminEmail(userEmail);
  const firstName = userEmail.split('@')[0].split('.')[0];
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  // Role-based access control
  const isCatalystUser = userEmail.toLowerCase().includes('@catalystcp.com') || userEmail.toLowerCase().includes('@catalyst');
  const isSuperAdmin = userEmail.toLowerCase() === 'jack@catalystcp.com';
  
  // Allowed tiles for non-super-admin Catalyst users
  const limitedAccessTiles = ['Deal Dashboard', 'Messaging', 'LIHTC Scoring', 'Data Hub', 'LoopNet Review', 'Analytics', 'CRM', 'Tax Scraper'];

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';

  const { data: marketMetrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery<MarketMetrics>({
    queryKey: ['/api/market-metrics'],
    refetchInterval: 1000 * 60 * 15, // Refresh every 15 minutes
  });

  const { data: pipelineStats, isLoading: statsLoading } = useQuery<PipelineStats>({
    queryKey: ['/api/deals/stats'],
    refetchInterval: 1000 * 60 * 5, // Refresh every 5 minutes
  });

  const internalTools: LaunchpadTile[] = [
    {
      name: "Deal Dashboard",
      description: "Review and manage incoming deals",
      icon: LayoutDashboard,
      href: "/dashboard",
      color: "bg-blue-600",
      category: 'internal'
    },
    {
      name: "Email Intake",
      description: "Review broker emails before creating deals",
      icon: Inbox,
      href: "/email-intake",
      color: "bg-emerald-600",
      category: 'internal'
    },
    {
      name: "Messaging",
      description: "Two-way SMS conversations",
      icon: MessageSquare,
      href: "/messaging",
      color: "bg-green-600",
      category: 'internal'
    },
    ...(isPlatformAdmin ? [{
      name: "People",
      description: "Manage users and brokers",
      icon: Users,
      href: "/user-management",
      color: "bg-purple-600",
      category: 'internal' as const
    }] : []),
    {
      name: "CRM",
      description: "Contacts, deals & outreach pipeline",
      icon: BookUser,
      href: "/crm",
      color: "bg-cyan-600",
      category: 'internal'
    },
    {
      name: "Outreach",
      description: "Email & SMS campaign templates",
      icon: Mail,
      href: "/outreach-management",
      color: "bg-orange-500",
      category: 'internal'
    },
    {
      name: "Outreach Setup",
      description: "Configure senders & campaigns",
      icon: Settings,
      href: "/outreach-onboarding",
      color: "bg-amber-600",
      category: 'internal'
    },
    {
      name: "LIHTC Scoring",
      description: "NC affordable housing pre-scorer",
      icon: Building2,
      href: "/affordable-housing",
      color: "bg-teal-600",
      category: 'internal'
    },
    {
      name: "Data Hub",
      description: "Market intelligence & insights",
      icon: Database,
      href: "/data-hub",
      color: "bg-indigo-600",
      category: 'internal'
    },
    {
      name: "LoopNet Review",
      description: "Review for-sale listings in your markets",
      icon: Search,
      href: "/listing-review",
      color: "bg-blue-600",
      category: 'internal'
    },
    {
      name: "Analytics",
      description: "Performance metrics & charts",
      icon: BarChart3,
      href: "/analytics",
      color: "bg-pink-600",
      category: 'internal'
    },
    {
      name: "API Monitoring",
      description: "Track API health & costs",
      icon: MonitorCheck,
      href: "/api-monitoring",
      color: "bg-slate-600",
      category: 'internal'
    },
    {
      name: "Tax Scraper",
      description: "Mecklenburg County 2024 tax bills",
      icon: Calculator,
      href: "/tax-scraper",
      color: "bg-red-700",
      category: 'internal'
    },
    {
      name: "RSS Feed Importer",
      description: "Auto-import land listings from LoopNet, LandWatch, Realtor.com",
      icon: Rss,
      href: "/rss-feeds",
      color: "bg-orange-600",
      category: 'internal'
    },
    {
      name: "Off-Market Sourcing",
      description: "Score private owners from county permit data",
      icon: BookUser,
      href: "/off-market-sourcing",
      color: "bg-teal-700",
      category: 'internal'
    },
    {
      name: "Market Intelligence",
      description: "AI-powered zoning, listings, permits & news for NC markets",
      icon: Brain,
      href: "/market-intelligence",
      color: "bg-blue-700",
      category: 'internal'
    }
  ];

  const TileCard = ({ tile }: { tile: LaunchpadTile }) => {
    const Icon = tile.icon;
    
    const content = (
      <Card className="group relative h-full p-6 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:border-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col h-full">
          <div className={`w-12 h-12 rounded-lg ${tile.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-1 flex items-center gap-2">
            {tile.name}
            {tile.external && <ExternalLink className="w-4 h-4 text-gray-400" />}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{tile.description}</p>
        </div>
      </Card>
    );

    if (tile.external) {
      return (
        <a href={tile.href} target="_blank" rel="noopener noreferrer" className="block">
          {content}
        </a>
      );
    }

    return (
      <Link href={tile.href} className="block">
        {content}
      </Link>
    );
  };

  const ListItem = ({ tile }: { tile: LaunchpadTile }) => {
    const Icon = tile.icon;
    
    const content = (
      <div className="group flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-800 last:border-b-0">
        <div className={`w-10 h-10 rounded-lg ${tile.color} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 dark:text-white text-sm flex items-center gap-2">
            {tile.name}
            {tile.external && <ExternalLink className="w-3 h-3 text-gray-400" />}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{tile.description}</p>
        </div>
      </div>
    );

    if (tile.external) {
      return (
        <a href={tile.href} target="_blank" rel="noopener noreferrer" className="block">
          {content}
        </a>
      );
    }

    return (
      <Link href={tile.href} className="block">
        {content}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {greeting}, {displayName}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Access all your tools and resources in one place
          </p>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Market Rates</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {marketMetrics?.lastUpdated && (
                <span>Updated: {new Date(marketMetrics.lastUpdated).toLocaleString()}</span>
              )}
              <button 
                onClick={() => refetchMetrics()} 
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Refresh rates"
              >
                <RefreshCw className={`w-4 h-4 ${metricsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {metricsLoading ? (
              <>
                {[1,2,3,4].map(i => (
                  <Card key={i} className="p-4 bg-white dark:bg-gray-900 border border-gray-200">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                      <div className="h-8 bg-gray-200 rounded w-16"></div>
                    </div>
                  </Card>
                ))}
              </>
            ) : (
              marketMetrics?.rates.map((rate) => (
                <a 
                  key={rate.name} 
                  href={rate.link || '#'} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Card className="p-4 bg-white dark:bg-gray-900 border border-gray-200 hover:border-green-400 hover:shadow-md transition-all cursor-pointer">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">{rate.name}</div>
                    {rate.value !== null ? (
                      <>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {rate.value.toFixed(2)}{rate.unit}
                        </div>
                        {rate.date && (
                          <div className="text-xs text-gray-400 mt-1">
                            As of {rate.date}
                          </div>
                        )}
                        <div className="text-xs text-green-600 mt-1">
                          {rate.source || 'Live data'}
                        </div>
                      </>
                    ) : (
                      <div className="text-lg text-gray-400">--</div>
                    )}
                  </Card>
                </a>
              ))
            )}
          </div>
          {marketMetrics?.note && (
            <p className="text-xs text-gray-500 mt-2">{marketMetrics.note}</p>
          )}
        </div>

        {/* Pipeline Stats Section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pipeline Overview</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {statsLoading ? (
              <>
                {[1,2,3,4].map(i => (
                  <Card key={i} className="p-4 bg-white dark:bg-gray-900 border border-gray-200">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                      <div className="h-8 bg-gray-200 rounded w-16"></div>
                    </div>
                  </Card>
                ))}
              </>
            ) : (
              <>
                <Card className="p-4 bg-white dark:bg-gray-900 border border-gray-200">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Deals</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {pipelineStats?.totalDeals || 0}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Based on filtered data</div>
                </Card>
                
                <Card className="p-4 bg-white dark:bg-gray-900 border border-gray-200">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Pipeline Value</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    ${pipelineStats?.totalValue ? (pipelineStats.totalValue / 1000000).toFixed(1) + 'M' : '0'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Based on filtered data</div>
                </Card>
                
                <Card className="p-4 bg-white dark:bg-gray-900 border border-gray-200">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Avg Deal Size</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    ${pipelineStats?.avgDealSize ? (pipelineStats.avgDealSize / 1000000).toFixed(1) + 'M' : '0'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Based on filtered data</div>
                </Card>
                
                <Card className="p-4 bg-white dark:bg-gray-900 border border-gray-200">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Conversion Rate</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {pipelineStats?.conversionRate || 0}%
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Based on filtered data</div>
                </Card>
              </>
            )}
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">LandLinq Platform</h2>
          </div>
          <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {internalTools
                .filter((tile) => {
                  // Super admin (Jack) sees everything
                  if (isSuperAdmin) return true;
                  // Other Catalyst users see limited tiles
                  if (isCatalystUser) return limitedAccessTiles.includes(tile.name);
                  // Non-Catalyst users see everything (external users)
                  return true;
                })
                .map((tile) => (
                  <ListItem key={tile.name} tile={tile} />
                ))}
            </div>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
}
