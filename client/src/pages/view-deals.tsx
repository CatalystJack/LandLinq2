import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, FileText, MapPin, Calendar, X } from "lucide-react";
import Footer from "@/components/footer";
import { Deal } from "@shared/schema";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

const getStatusColor = (classification: string, status: string) => {
  if (classification === "yellow" || status === "approved") return "default";
  if (classification === "red" || status === "rejected") return "destructive";
  return "secondary";
};

const getDisplayStatus = (deal: Deal) => {
  if (deal.classification === "yellow" || deal.status === "approved") return "REVIEWING";
  if (deal.classification === "red" || deal.status === "rejected") return "PASSED";
  if (deal.classification === "unclassified") return "Unclassified";
  return "Pending";
};

const getBrokerName = (deal: Deal) => {
  if (deal.broker?.firstName || deal.broker?.lastName)
    return `${deal.broker.firstName ?? ""} ${deal.broker.lastName ?? ""}`.trim();
  return null;
};

function DealCard({ deal, testPrefix }: { deal: Deal; testPrefix: string }) {
  const brokerName = getBrokerName(deal);
  const hasNoteWarning =
    deal.comparableNotes &&
    (deal.comparableNotes.toLowerCase().includes("error") ||
      deal.comparableNotes.toLowerCase().includes("unavailable") ||
      deal.comparableNotes.toLowerCase().includes("failed"));

  return (
    <div
      key={deal.id}
      className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
      data-testid={`${testPrefix}-${deal.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-2">
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <h4 className="font-medium truncate">{deal.address || "Address not provided"}</h4>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm text-muted-foreground">
            <div>
              <span className="font-medium">Broker:</span>{" "}
              {brokerName || (
                <span className="text-slate-400 italic">N/A</span>
              )}
            </div>
            <div>
              <span className="font-medium">Value:</span>{" "}
              {deal.askingPrice ? formatCurrency(Number(deal.askingPrice)) : "TBD"}
            </div>
            <div>
              <span className="font-medium">Size:</span>{" "}
              {deal.sizeAcres ? `${deal.sizeAcres} acres` : "TBD"}
            </div>
            <div>
              <span className="font-medium">QCT:</span>{" "}
              {deal.qctStatus === "YES" ? (
                <Badge variant="outline" className="bg-green-50 text-green-700">YES</Badge>
              ) : deal.qctStatus === "NO" ? (
                <Badge variant="outline" className="bg-gray-50 text-gray-700">NO</Badge>
              ) : (
                "N/A"
              )}
            </div>
            <div className="flex items-center">
              <Calendar className="h-3 w-3 mr-1" />
              {deal.createdAt ? new Date(deal.createdAt).toLocaleDateString() : "N/A"}
            </div>
          </div>

          {deal.comparableCount !== undefined && deal.comparableCount !== null && (
            <div className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium">Comparables:</span> {deal.comparableCount} found
              {deal.comparableNotes && (
                <span className={`ml-2 text-xs ${hasNoteWarning ? "text-amber-600 font-medium" : ""}`}>
                  {hasNoteWarning ? "⚠️ " : ""}({deal.comparableNotes})
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <Badge variant={getStatusColor(deal.classification || "", deal.status || "")}>
            {getDisplayStatus(deal)}
          </Badge>
          <Button variant="outline" size="sm" data-testid={`button-view-${testPrefix}-${deal.id}`}>
            <FileText className="h-4 w-4 mr-1" />
            View Details
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground">{label}</div>
  );
}

export default function ViewDeals() {
  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchTerm(val), 200);
  }, []);

  const clearSearch = useCallback(() => {
    setInputValue("");
    setSearchTerm("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const { data: dealsData, isLoading, error } = useQuery({
    queryKey: ["/api/deals"],
    select: (data: any) => data,
  });

  const allDeals: Deal[] = dealsData?.deals || [];

  const filteredDeals = useMemo(() => {
    if (!searchTerm.trim()) return allDeals;
    const q = searchTerm.toLowerCase();
    return allDeals.filter((deal) => {
      const brokerName = getBrokerName(deal)?.toLowerCase() ?? "";
      const brokerEmail = (deal.broker?.email ?? "").toLowerCase();
      const brokerPhone = (deal.broker?.phone ?? "").toLowerCase();
      const address = (deal.address ?? "").toLowerCase();
      const city = (deal.city ?? "").toLowerCase();
      const state = (deal.state ?? "").toLowerCase();
      const county = (deal.county ?? "").toLowerCase();
      return (
        address.includes(q) ||
        brokerName.includes(q) ||
        brokerEmail.includes(q) ||
        brokerPhone.includes(q) ||
        city.includes(q) ||
        state.includes(q) ||
        county.includes(q)
      );
    });
  }, [allDeals, searchTerm]);

  const unclassified = useMemo(
    () => filteredDeals.filter((d) => d.classification === "unclassified"),
    [filteredDeals]
  );
  const reviewing = useMemo(
    () => filteredDeals.filter((d) => d.classification === "yellow" || d.status === "approved"),
    [filteredDeals]
  );
  const passed = useMemo(
    () => filteredDeals.filter((d) => d.classification === "red" || d.status === "rejected"),
    [filteredDeals]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-slate-900">View Deals</h1>
          <p className="text-slate-600 mt-2">Loading deals...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-slate-900">View Deals</h1>
          <p className="text-red-600 mt-2">Error loading deals. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">View Deals</h1>
            <p className="text-slate-600 mt-1">Browse and review all submitted deals</p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search address, broker, city..."
              value={inputValue}
              onChange={handleSearchChange}
              className="pl-10 pr-8"
            />
            {inputValue && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {searchTerm && (
          <p className="text-sm text-muted-foreground mb-4">
            {filteredDeals.length === 0
              ? `No deals match "${searchTerm}"`
              : `Showing ${filteredDeals.length} deal${filteredDeals.length !== 1 ? "s" : ""} matching "${searchTerm}"`}
          </p>
        )}

        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all" data-testid="button-all">
              ALL ({filteredDeals.length})
            </TabsTrigger>
            <TabsTrigger value="pending" data-testid="button-unclassified">
              UNCLASSIFIED ({unclassified.length})
            </TabsTrigger>
            <TabsTrigger value="approved" data-testid="button-approved">
              REVIEWING ({reviewing.length})
            </TabsTrigger>
            <TabsTrigger value="rejected" data-testid="button-rejected">
              PASSED ({passed.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>All Deals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredDeals.map((deal) => (
                    <DealCard key={deal.id} deal={deal} testPrefix="deal" />
                  ))}
                  {filteredDeals.length === 0 && (
                    <EmptyState label={searchTerm ? `No deals match "${searchTerm}"` : "No deals found."} />
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Unclassified Deals</CardTitle>
                <p className="text-sm text-muted-foreground">Deals currently being evaluated</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {unclassified.map((deal) => (
                    <DealCard key={deal.id} deal={deal} testPrefix="unclassified-deal" />
                  ))}
                  {unclassified.length === 0 && (
                    <EmptyState label={searchTerm ? `No unclassified deals match "${searchTerm}"` : "No unclassified deals found."} />
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approved">
            <Card>
              <CardHeader>
                <CardTitle>Reviewing Deals</CardTitle>
                <p className="text-sm text-muted-foreground">Deals that meet criteria and are under review</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reviewing.map((deal) => (
                    <DealCard key={deal.id} deal={deal} testPrefix="approved-deal" />
                  ))}
                  {reviewing.length === 0 && (
                    <EmptyState label={searchTerm ? `No reviewing deals match "${searchTerm}"` : "No deals under review found."} />
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rejected">
            <Card>
              <CardHeader>
                <CardTitle>Passed Deals</CardTitle>
                <p className="text-sm text-muted-foreground">Deals that did not meet criteria</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {passed.map((deal) => (
                    <DealCard key={deal.id} deal={deal} testPrefix="rejected-deal" />
                  ))}
                  {passed.length === 0 && (
                    <EmptyState label={searchTerm ? `No passed deals match "${searchTerm}"` : "No passed deals found."} />
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <Footer />
      </div>
    </div>
  );
}
