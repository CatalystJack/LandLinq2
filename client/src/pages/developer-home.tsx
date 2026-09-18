import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import DeveloperNavigation from "@/components/developer-navigation";
import Footer from "@/components/footer";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";

interface MarketRate {
  name: string;
  value: number | null;
  date: string | null;
  unit: string;
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
}

interface DeveloperQuickLink {
  id: string;
  label: string;
  url: string;
}

async function fetchQuickLinks(): Promise<{ links: DeveloperQuickLink[] }> {
  const response = await fetch("/api/developer/quick-links", { credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || "Unable to load your tools");
  return data;
}

export default function DeveloperHome() {
  const { user } = useAuth();
  const profile = (user as any)?.developerProfile;
  const firstName = String((user as any)?.firstName || "").trim() || "there";
  const companyName = profile?.companyName || "Investment Company";
  const primaryColor = profile?.primaryColor || "#0A2B4A";
  const secondaryColor = profile?.secondaryColor || "#4A90E2";
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Good morning" : currentHour < 18 ? "Good afternoon" : "Good evening";

  const { data: marketMetrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery<MarketMetrics>({
    queryKey: ["/api/market-metrics"],
    refetchInterval: 1000 * 60 * 15,
  });
  const { data: pipelineStats, isLoading: statsLoading } = useQuery<PipelineStats>({
    queryKey: ["/api/deals/stats"],
    refetchInterval: 1000 * 60 * 5,
  });
  const quickLinksQuery = useQuery<{ links: DeveloperQuickLink[] }>({
    queryKey: ["/api/developer/quick-links"],
    queryFn: fetchQuickLinks,
  });

  const statCards = [
    { label: "Total Deals", value: pipelineStats?.totalDeals || 0 },
    {
      label: "Total Pipeline Value",
      value: pipelineStats?.totalValue ? `$${(pipelineStats.totalValue / 1000000).toFixed(1)}M` : "$0",
    },
    {
      label: "Avg Deal Size",
      value: pipelineStats?.avgDealSize ? `$${(pipelineStats.avgDealSize / 1000000).toFixed(1)}M` : "$0",
    },
    { label: "Conversion Rate", value: `${pipelineStats?.conversionRate || 0}%` },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <DeveloperNavigation />
      <main className="mx-auto max-w-[1680px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em]" style={{ color: secondaryColor }}>
            {companyName}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {greeting}, {firstName}
          </h1>
          <p className="mt-2 text-slate-500">Your company workspace at a glance.</p>
        </div>

        <section className="mb-8" aria-labelledby="market-rates-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="market-rates-heading" className="text-lg font-semibold text-slate-900">Market Rates</h2>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {marketMetrics?.lastUpdated && (
                <span>Updated: {new Date(marketMetrics.lastUpdated).toLocaleString()}</span>
              )}
              <button
                type="button"
                onClick={() => refetchMetrics()}
                className="rounded p-1 transition-colors hover:bg-slate-200"
                title="Refresh rates"
                aria-label="Refresh market rates"
              >
                <RefreshCw className={`h-4 w-4 ${metricsLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {metricsLoading ? (
              [1, 2, 3, 4].map((item) => (
                <Card key={item} className="border-slate-200 bg-white p-4 shadow-sm">
                  <div className="animate-pulse">
                    <div className="mb-2 h-4 w-24 rounded bg-slate-200" />
                    <div className="h-8 w-16 rounded bg-slate-200" />
                  </div>
                </Card>
              ))
            ) : (
              (marketMetrics?.rates || []).map((rate) => (
                <a
                  key={rate.name}
                  href={rate.link || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Card className="h-full border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-400 hover:shadow-md">
                    <div className="mb-1 text-sm text-slate-500">{rate.name}</div>
                    {rate.value !== null ? (
                      <>
                        <div className="text-2xl font-bold text-slate-900">
                          {rate.value.toFixed(2)}{rate.unit}
                        </div>
                        {rate.date && <div className="mt-1 text-xs text-slate-400">As of {rate.date}</div>}
                        <div className="mt-1 text-xs text-emerald-600">{rate.source || "Live data"}</div>
                      </>
                    ) : (
                      <div className="text-lg text-slate-400">--</div>
                    )}
                  </Card>
                </a>
              ))
            )}
          </div>
          {marketMetrics?.note && <p className="mt-2 text-xs text-slate-500">{marketMetrics.note}</p>}
        </section>

        <section className="mb-8" aria-labelledby="pipeline-heading">
          <h2 id="pipeline-heading" className="mb-4 text-lg font-semibold text-slate-900">Pipeline Overview</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {statsLoading ? (
              [1, 2, 3, 4].map((item) => (
                <Card key={item} className="border-slate-200 bg-white p-4 shadow-sm">
                  <div className="animate-pulse">
                    <div className="mb-2 h-4 w-24 rounded bg-slate-200" />
                    <div className="h-8 w-16 rounded bg-slate-200" />
                  </div>
                </Card>
              ))
            ) : (
              statCards.map((stat) => (
                <Card key={stat.label} className="border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-1 text-sm text-slate-500">{stat.label}</div>
                  <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                  <div className="mt-1 text-xs text-slate-400">Based on filtered data</div>
                </Card>
              ))
            )}
          </div>
        </section>

        <section aria-labelledby="tools-heading">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 id="tools-heading" className="text-lg font-semibold text-slate-900">Your Tools</h2>
              <p className="mt-1 text-sm text-slate-500">Saved software and resources for your team.</p>
            </div>
            <Link
              href="/developer/settings"
              className="text-sm font-semibold hover:underline"
              style={{ color: secondaryColor }}
            >
              Manage tools
            </Link>
          </div>
          {quickLinksQuery.isLoading ? (
            <Card className="flex items-center justify-center border-slate-200 bg-white p-10 shadow-sm">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </Card>
          ) : quickLinksQuery.isError ? (
            <Card className="border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm">
              Unable to load your saved tools. Try refreshing the page.
            </Card>
          ) : (quickLinksQuery.data?.links || []).length === 0 ? (
            <Card className="border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-slate-600">You have not saved any tools yet.</p>
              <Link
                href="/developer/settings"
                className="mt-3 inline-flex font-semibold hover:underline"
                style={{ color: secondaryColor }}
              >
                Add your first tool in Settings
              </Link>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(quickLinksQuery.data?.links || []).map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                >
                  <Card className="flex h-full items-center justify-between gap-4 border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
                    <span className="min-w-0 truncate font-semibold text-slate-900">{link.label}</span>
                    <ExternalLink className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-slate-700" />
                  </Card>
                </a>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}