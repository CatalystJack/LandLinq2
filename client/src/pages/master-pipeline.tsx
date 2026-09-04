import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Building2, ExternalLink, Filter, MapPin, RefreshCw, Search } from "lucide-react";
import Navigation from "@/components/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isPlatformAdminEmail } from "@shared/admin-auth";

type PipelineStatus = "passed" | "review" | "pursuing" | "not_sent";

type PipelineRow = {
  id: string;
  pipelineStatus: PipelineStatus;
  classification: string | null;
  dealClassification: string | null;
  sent: boolean;
  deal: {
    id: string;
    dealNumber: number | null;
    propertyName: string | null;
    address: string;
    city: string | null;
    county: string | null;
    state: string | null;
    askingPrice: string | null;
    sizeAcres: string | null;
    unitCount: number | null;
    maxUnitsByZoning: number | null;
    dealType: string | null;
    productTypes: unknown;
    status: string | null;
    classification: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  send: {
    id: string;
    status: string | null;
    classification: string | null;
    sentAt: string | null;
    matchedAt: string | null;
    greenFlaggedByDeveloper: boolean | null;
    greenFlaggedAt: string | null;
  } | null;
  profile: {
    id: string;
    companyName: string;
    slug: string;
    isActive: boolean;
  } | null;
};

type MasterPipelineResponse = {
  deals: PipelineRow[];
  total: number;
  profiles: Array<{ id: string; companyName: string; slug: string; isActive: boolean }>;
  filters: { states: string[]; counties: string[] };
};

const initialFilters = {
  profileId: "all",
  state: "all",
  county: "all",
  classification: "all",
  search: "",
};

function formatMoney(value: string | null) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount)
    : "—";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusLabel(status: PipelineStatus) {
  return {
    pursuing: "Pursuing",
    review: "Review",
    passed: "Passed",
    not_sent: "Not sent",
  }[status];
}

function StatusBadge({ status }: { status: PipelineStatus }) {
  const classes = {
    pursuing: "border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
    review: "border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100",
    passed: "border-blue-200 bg-blue-100 text-blue-800 hover:bg-blue-100",
    not_sent: "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100",
  };
  return <Badge className={classes[status]}>{statusLabel(status)}</Badge>;
}

export default function MasterPipeline() {
  const { user, isAuthenticated } = useAuth();
  const email = String((user as any)?.claims?.email || (user as any)?.email || "").toLowerCase();
  const isPlatformAdmin = isAuthenticated && isPlatformAdminEmail(email);
  const [filters, setFilters] = useState(initialFilters);

  const queryKey = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "all") params.set(key, value);
    });
    return `/api/admin/master-pipeline?${params.toString()}`;
  }, [filters]);

  const pipelineQuery = useQuery<MasterPipelineResponse>({
    queryKey: [queryKey],
    queryFn: async () => {
      const response = await fetch(queryKey, { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Failed to load the master pipeline");
      return body;
    },
    enabled: isPlatformAdmin,
  });

  const rows = pipelineQuery.data?.deals || [];
  const counts = {
    total: pipelineQuery.data?.total || 0,
    pursuing: rows.filter((row) => row.pipelineStatus === "pursuing").length,
    review: rows.filter((row) => row.pipelineStatus === "review").length,
    passed: rows.filter((row) => row.pipelineStatus === "passed").length,
  };

  const setFilter = (key: keyof typeof initialFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  if (!isPlatformAdmin) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <main className="mx-auto max-w-xl px-6 py-24 text-center">
          <Building2 className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <h1 className="text-2xl font-bold text-slate-900">Platform administrators only</h1>
          <p className="mt-2 text-slate-500">This view is restricted to authenticated platform administrators.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <Navigation />
      <main className="mx-auto max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-600">
              <Building2 className="h-4 w-4" />
              Platform administration
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[#081729]">Master Pipeline</h1>
            <p className="mt-1 text-slate-500">See how every deal is moving across all Investment Company portals.</p>
          </div>
          <Button variant="outline" className="gap-2 self-start md:self-auto" onClick={() => pipelineQuery.refetch()} disabled={pipelineQuery.isFetching}>
            <RefreshCw className={`h-4 w-4 ${pipelineQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Pipeline rows", value: counts.total, tone: "text-slate-900" },
            { label: "Pursuing", value: counts.pursuing, tone: "text-emerald-700" },
            { label: "Review", value: counts.review, tone: "text-amber-700" },
            { label: "Passed", value: counts.passed, tone: "text-blue-700" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                <p className={`mt-1 text-3xl font-bold ${stat.tone}`}>{pipelineQuery.isLoading ? "—" : stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4 text-blue-600" />
              Filter pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="relative xl:col-span-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={filters.search}
                  onChange={(event) => setFilter("search", event.target.value)}
                  placeholder="Search address or property"
                  className="pl-9"
                />
              </div>
              <Select value={filters.profileId} onValueChange={(value) => setFilter("profileId", value)}>
                <SelectTrigger><SelectValue placeholder="All Investment Companies" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Investment Companies</SelectItem>
                  {(pipelineQuery.data?.profiles || []).map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>{profile.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.state} onValueChange={(value) => setFilter("state", value)}>
                <SelectTrigger><SelectValue placeholder="All states" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All states</SelectItem>
                  {(pipelineQuery.data?.filters.states || []).map((state) => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filters.county} onValueChange={(value) => setFilter("county", value)}>
                <SelectTrigger><SelectValue placeholder="All counties" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All counties</SelectItem>
                  {(pipelineQuery.data?.filters.counties || []).map((county) => <SelectItem key={county} value={county}>{county}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filters.classification} onValueChange={(value) => setFilter("classification", value)}>
                <SelectTrigger><SelectValue placeholder="All classifications" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classifications</SelectItem>
                  <SelectItem value="passed">Passed</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="pursuing">Pursuing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {Object.values(filters).some((value) => value !== "all" && value !== "") && (
              <Button variant="ghost" className="mt-3 px-0 text-sm text-blue-600 hover:text-blue-700" onClick={() => setFilters(initialFilters)}>
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Deal activity by Investment Company</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Each sent deal/profile relationship appears as its own row.</p>
            </div>
            <span className="text-sm text-slate-500">{pipelineQuery.isFetching ? "Updating…" : `${rows.length} rows`}</span>
          </CardHeader>
          <CardContent className="p-0">
            {pipelineQuery.isLoading ? (
              <div className="space-y-3 p-6">
                {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-12 w-full" />)}
              </div>
            ) : pipelineQuery.isError ? (
              <div className="p-10 text-center">
                <p className="font-medium text-red-700">Unable to load the master pipeline.</p>
                <p className="mt-1 text-sm text-slate-500">{(pipelineQuery.error as Error).message}</p>
                <Button variant="outline" className="mt-4" onClick={() => pipelineQuery.refetch()}>Try again</Button>
              </div>
            ) : rows.length === 0 ? (
              <div className="p-12 text-center">
                <MapPin className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                <p className="font-medium text-slate-700">No pipeline rows match these filters.</p>
                <p className="mt-1 text-sm text-slate-500">Try clearing a filter or searching a different address.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80">
                      <TableHead>Deal</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Investment Company</TableHead>
                      <TableHead>Classification</TableHead>
                      <TableHead>Deal details</TableHead>
                      <TableHead>Sent / matched</TableHead>
                      <TableHead className="text-right">Open</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id} className="align-top">
                        <TableCell className="min-w-[220px]">
                          <div className="font-semibold text-slate-900">{row.deal.propertyName || row.deal.address}</div>
                          {row.deal.propertyName && <div className="mt-1 text-xs text-slate-500">{row.deal.address}</div>}
                          {row.deal.dealNumber && <div className="mt-1 text-xs text-slate-400">Deal #{row.deal.dealNumber}</div>}
                        </TableCell>
                        <TableCell className="min-w-[150px]">
                          <div className="flex items-start gap-1.5 text-sm text-slate-700">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span>{[row.deal.city, row.deal.county, row.deal.state].filter(Boolean).join(", ") || "Location pending"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          {row.profile ? (
                            <>
                              <div className="font-medium text-slate-800">{row.profile.companyName}</div>
                              <div className="mt-1 text-xs text-slate-500">{row.profile.isActive ? "Active portal" : "Inactive portal"}</div>
                            </>
                          ) : <span className="text-sm text-slate-400">Not sent to a profile</span>}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={row.pipelineStatus} />
                          {row.send?.status && row.send.status !== "sent" && <div className="mt-1 text-xs capitalize text-slate-400">{row.send.status}</div>}
                        </TableCell>
                        <TableCell className="min-w-[150px] text-sm text-slate-600">
                          <div>{formatMoney(row.deal.askingPrice)}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {row.deal.sizeAcres ? `${row.deal.sizeAcres} acres` : "Acreage —"}
                            {row.deal.unitCount || row.deal.maxUnitsByZoning ? ` · ${row.deal.unitCount || row.deal.maxUnitsByZoning} units` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[140px] text-xs text-slate-500">
                          <div>{row.send ? formatDate(row.send.sentAt || row.send.matchedAt) : "—"}</div>
                          <div className="mt-1">{row.send ? "Last activity" : `Added ${formatDate(row.deal.createdAt)}`}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/deals/${row.deal.id}`}>
                            <Button variant="ghost" size="sm" className="gap-1 text-blue-600 hover:text-blue-700">
                              View <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}