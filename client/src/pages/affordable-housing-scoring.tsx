import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Navigation from "@/components/navigation";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Calculator, MapPin, Building2, Home, CheckCircle, XCircle, AlertTriangle, Loader2, Droplets, Factory, Mountain, Bus, Plane } from "lucide-react";
import { Helmet } from "react-helmet-async";

const formSchema = z.object({
  address: z.string().min(5, "Please enter a valid address"),
  countyIncomeLevel: z.enum(["High", "Moderate", "Low"]),
  redevelopment: z.boolean().default(false),
  neighborhoodQuality: z.enum(["Good", "Fair", "Poor"]),
  negativeSiteFeatures: z.boolean().default(false),
  incompatibleUses: z.boolean().default(false),
  units30AMI: z.number().min(0).default(0),
  units40AMI: z.number().min(0).default(0),
  units50AMI: z.number().min(0).default(0),
});

type FormData = z.infer<typeof formSchema>;

interface ScoringResult {
  neighborhoodCharacter: number;
  primaryAmenities: number;
  secondaryAmenities: number;
  siteSuitability: number;
  transitPoints: number;
  negativePoints: number;
  incomeRPP: number;
  totalScore: number;
  amenityDetails?: {
    name: string;
    distance: number | null;
    points: number;
  }[];
  geocodedAddress?: string;
  coordinates?: { lat: number; lng: number };
  censusData?: {
    tract: string | null;
    isQCT: boolean;
    medianIncome: number | null;
    povertyRate: number | null;
    county: string | null;
    state: string | null;
    city: string | null;
  };
  marketInsights?: {
    totalDealsInMarket: number;
    greenDealsInMarket: number;
    affordableDealsInMarket: number;
    successRate: number;
    avgPricePerAcre: number | null;
  };
  similarDeals?: {
    propertyName: string;
    classification: string;
    pricePerAcre: number | null;
    proposedUnits: number;
    acreage: number | null;
  }[];
  siteEvaluation?: {
    floodZone: {
      isInFloodZone: boolean;
      floodZone: string | null;
      floodZoneDescription: string | null;
      source: string;
    };
    hazardousSites: {
      hasNearbyHazards: boolean;
      hazardCount: number;
      nearestHazard: { name: string; type: string; distance: number } | null;
      hazards: Array<{ name: string; type: string; distance: number }>;
    };
    slope: {
      hasSteepSlope: boolean;
      avgSlope: number | null;
      maxSlope: number | null;
    };
    transit: {
      hasNearbyTransit: boolean;
      nearestStopDistance: number | null;
      transitScore: number;
      stops: Array<{ name: string; distance: number; types: string[] }>;
    };
    incompatibleUses: {
      hasIncompatibleUses: boolean;
      issues: string[];
      nearbyAirports: Array<{ name: string; distance: number }>;
      nearbyIndustrial: Array<{ name: string; distance: number }>;
    };
  };
}

export default function AffordableHousingScoring() {
  const { toast } = useToast();
  const [result, setResult] = useState<ScoringResult | null>(null);
  const [quickAddress, setQuickAddress] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      address: "",
      countyIncomeLevel: "Moderate",
      redevelopment: false,
      neighborhoodQuality: "Good",
      negativeSiteFeatures: false,
      incompatibleUses: false,
      units30AMI: 0,
      units40AMI: 0,
      units50AMI: 0,
    },
  });

  const scoringMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("POST", "/api/affordable-housing/score", data);
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: "Score Calculated",
        description: `Total QAP Score: ${data.totalScore} points`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Scoring Error",
        description: error.message || "Failed to calculate score",
        variant: "destructive",
      });
    },
  });

  // Quick Score - just address with auto-defaults
  const quickScoreMutation = useMutation({
    mutationFn: async (address: string) => {
      const response = await apiRequest("POST", "/api/affordable-housing/score", {
        address,
        countyIncomeLevel: "Moderate",
        redevelopment: false,
        neighborhoodQuality: "Good",
        negativeSiteFeatures: false,
        incompatibleUses: false,
        units30AMI: 0,
        units40AMI: 0,
        units50AMI: 0,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: "Quick Score Complete",
        description: `Total QAP Score: ${data.totalScore} points`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Scoring Error",
        description: error.message || "Failed to calculate score",
        variant: "destructive",
      });
    },
  });

  const handleQuickScore = () => {
    if (quickAddress.length < 5) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid address",
        variant: "destructive",
      });
      return;
    }
    quickScoreMutation.mutate(quickAddress);
  };

  const onSubmit = (data: FormData) => {
    scoringMutation.mutate(data);
  };

  const getScoreColor = (score: number) => {
    if (score >= 60) return "text-green-600";
    if (score >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 60) return { variant: "default" as const, label: "Strong Candidate", icon: CheckCircle };
    if (score >= 40) return { variant: "secondary" as const, label: "Moderate Candidate", icon: AlertTriangle };
    return { variant: "destructive" as const, label: "Weak Candidate", icon: XCircle };
  };

  return (
    <>
      <Helmet>
        <title>Affordable Housing Scoring - NC LIHTC Pre-Scorer | LandLinq</title>
        <meta name="description" content="Calculate QAP scores for affordable housing developments based on NC LIHTC 2026 rules. Analyze neighborhood amenities, site suitability, and income targeting." />
      </Helmet>
      <Navigation />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 pt-20 pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          <header className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="h-8 w-8 text-[#4A90E2]" />
              <h1 className="text-3xl md:text-4xl font-bold text-[#07172A] tracking-tight">
                NC LIHTC Pre-Scorer
              </h1>
            </div>
            <p className="text-base md:text-lg text-gray-600">
              Calculate predicted QAP scores for affordable housing developments using 2026 NC rules
            </p>
          </header>

          {/* Quick Score - Address Only */}
          <Card className="mb-6 bg-gradient-to-r from-[#07172A] to-[#0a2540] text-white border-0">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <Calculator className="h-6 w-6 text-[#4A90E2]" />
                <h2 className="text-xl font-semibold">Quick Score</h2>
                <Badge variant="secondary" className="bg-[#4A90E2] text-white hover:bg-[#4A90E2]">
                  Address Only
                </Badge>
              </div>
              <p className="text-gray-300 mb-4">
                Enter any address to instantly get a LIHTC score using automated site evaluation from FEMA, EPA, USGS, and Google Transit APIs.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  placeholder="Enter property address (e.g., 123 Main St, Charlotte, NC 28202)"
                  value={quickAddress}
                  onChange={(e) => setQuickAddress(e.target.value)}
                  className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                  data-testid="input-quick-address"
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickScore()}
                />
                <Button
                  onClick={handleQuickScore}
                  disabled={quickScoreMutation.isPending}
                  className="bg-[#4A90E2] hover:bg-[#3a7bc8] text-white min-w-[140px]"
                  data-testid="button-quick-score"
                >
                  {quickScoreMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scoring...
                    </>
                  ) : (
                    <>
                      <Calculator className="mr-2 h-4 w-4" />
                      Get Score
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Uses: Geocodio (census/demographics) • Google Places (amenities) • FEMA (flood zones) • EPA (hazards) • USGS (slopes) • Google Transit (bus stops)
              </p>
            </CardContent>
          </Card>

          {/* Advanced Options Toggle */}
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full sm:w-auto"
              data-testid="button-toggle-advanced"
            >
              {showAdvanced ? "Hide Advanced Options" : "Show Advanced Options"}
            </Button>
          </div>

          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${!showAdvanced && !result ? 'hidden' : ''}`}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Property Details
                </CardTitle>
                <CardDescription>
                  Enter the property address and site characteristics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Property Address</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="123 Main St, Charlotte, NC 28202" 
                              {...field}
                              data-testid="input-address"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="countyIncomeLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>County Income Level</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-income-level">
                                <SelectValue placeholder="Select income level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="High">High Income County</SelectItem>
                              <SelectItem value="Moderate">Moderate Income County</SelectItem>
                              <SelectItem value="Low">Low Income County</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="neighborhoodQuality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Neighborhood Character</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-neighborhood">
                                <SelectValue placeholder="Select neighborhood quality" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Good">Good</SelectItem>
                              <SelectItem value="Fair">Fair</SelectItem>
                              <SelectItem value="Poor">Poor</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="redevelopment"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-redevelopment"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Redevelopment Project</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="negativeSiteFeatures"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-negative-features"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Negative Site Features Present</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="incompatibleUses"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-incompatible"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Incompatible Uses Present</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-medium mb-4 flex items-center gap-2">
                        <Home className="h-4 w-4" />
                        Income Targeting (Unit Mix)
                      </h3>
                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="units30AMI"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Units ≤30% AMI</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min={0}
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  data-testid="input-units-30"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="units40AMI"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Units ≤40% AMI</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min={0}
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  data-testid="input-units-40"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="units50AMI"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Units ≤50% AMI</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min={0}
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  data-testid="input-units-50"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full bg-[#4A90E2] hover:bg-[#357ABD]"
                      disabled={scoringMutation.isPending}
                      data-testid="button-calculate"
                    >
                      {scoringMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Calculating...
                        </>
                      ) : (
                        <>
                          <Calculator className="mr-2 h-4 w-4" />
                          Calculate Score
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  QAP Score Results
                </CardTitle>
                <CardDescription>
                  Predicted score based on 2026 NC LIHTC rules
                </CardDescription>
              </CardHeader>
              <CardContent>
                {result ? (
                  <div className="space-y-6">
                    <div className="text-center p-6 bg-slate-50 rounded-lg">
                      <div className={`text-5xl font-bold ${getScoreColor(result.totalScore)}`}>
                        {result.totalScore}
                      </div>
                      <div className="text-gray-600 mt-1">Total Points</div>
                      <div className="mt-3">
                        {(() => {
                          const badge = getScoreBadge(result.totalScore);
                          const Icon = badge.icon;
                          return (
                            <Badge variant={badge.variant} className="text-sm px-3 py-1">
                              <Icon className="h-4 w-4 mr-1" />
                              {badge.label}
                            </Badge>
                          );
                        })()}
                      </div>
                    </div>

                    {result.geocodedAddress && (
                      <div className="text-sm text-gray-600 flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {result.geocodedAddress}
                      </div>
                    )}

                    <div className="space-y-4">
                      <ScoreRow 
                        label="Neighborhood Character" 
                        points={result.neighborhoodCharacter} 
                        maxPoints={10}
                      />
                      <ScoreRow 
                        label="Primary Amenities" 
                        points={result.primaryAmenities} 
                        maxPoints={26}
                      />
                      <ScoreRow 
                        label="Secondary Amenities" 
                        points={result.secondaryAmenities} 
                        maxPoints={18}
                      />
                      <ScoreRow 
                        label="Site Suitability" 
                        points={result.siteSuitability} 
                        maxPoints={12}
                      />
                      <ScoreRow 
                        label="Transit Access" 
                        points={result.transitPoints || 0} 
                        maxPoints={6}
                      />
                      <ScoreRow 
                        label="Income / RPP" 
                        points={result.incomeRPP} 
                        maxPoints={2}
                      />
                      {result.negativePoints < 0 && (
                        <ScoreRow 
                          label="Negative Points" 
                          points={result.negativePoints} 
                          maxPoints={0}
                          isNegative
                        />
                      )}
                    </div>

                    {result.amenityDetails && result.amenityDetails.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-medium mb-3">Amenity Distance Details</h4>
                          <div className="space-y-2 text-sm">
                            {result.amenityDetails.map((amenity, idx) => (
                              <div key={idx} className="flex justify-between items-center py-1">
                                <span className="text-gray-600">{amenity.name}</span>
                                <div className="flex items-center gap-3">
                                  <span className="text-gray-500">
                                    {amenity.distance !== null 
                                      ? `${amenity.distance.toFixed(2)} mi` 
                                      : 'Not found'}
                                  </span>
                                  <Badge variant={amenity.points > 0 ? "default" : "secondary"}>
                                    {amenity.points} pts
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {result.censusData && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Census & Demographics (Geocodio)
                          </h4>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            {result.censusData.city && (
                              <div>
                                <span className="text-gray-500">Location:</span>
                                <span className="ml-2 font-medium">{result.censusData.city}, {result.censusData.state}</span>
                              </div>
                            )}
                            {result.censusData.county && (
                              <div>
                                <span className="text-gray-500">County:</span>
                                <span className="ml-2 font-medium">{result.censusData.county}</span>
                              </div>
                            )}
                            {result.censusData.tract && (
                              <div>
                                <span className="text-gray-500">Census Tract:</span>
                                <span className="ml-2 font-medium">{result.censusData.tract}</span>
                              </div>
                            )}
                            {result.censusData.medianIncome && (
                              <div>
                                <span className="text-gray-500">Median Income:</span>
                                <span className="ml-2 font-medium">${result.censusData.medianIncome.toLocaleString()}</span>
                              </div>
                            )}
                            {result.censusData.povertyRate !== null && (
                              <div>
                                <span className="text-gray-500">Poverty Rate:</span>
                                <span className="ml-2 font-medium">{result.censusData.povertyRate.toFixed(1)}%</span>
                              </div>
                            )}
                            {result.censusData.isQCT && (
                              <div className="col-span-2">
                                <Badge className="bg-green-600">Qualified Census Tract (QCT)</Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {result.siteEvaluation && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Site Evaluation (Government APIs)
                          </h4>
                          <div className="space-y-3 text-sm">
                            <div className="flex items-center justify-between p-2 rounded bg-slate-50">
                              <div className="flex items-center gap-2">
                                <Droplets className="h-4 w-4 text-blue-500" />
                                <span>Flood Zone (FEMA)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {result.siteEvaluation.floodZone.isInFloodZone ? (
                                  <>
                                    <XCircle className="h-4 w-4 text-red-500" />
                                    <span className="text-red-600 font-medium">
                                      Zone {result.siteEvaluation.floodZone.floodZone}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    <span className="text-green-600 font-medium">Clear</span>
                                  </>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between p-2 rounded bg-slate-50">
                              <div className="flex items-center gap-2">
                                <Factory className="h-4 w-4 text-orange-500" />
                                <span>Hazardous Sites (EPA)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {result.siteEvaluation.hazardousSites.hasNearbyHazards ? (
                                  <>
                                    <XCircle className="h-4 w-4 text-red-500" />
                                    <span className="text-red-600 font-medium">
                                      {result.siteEvaluation.hazardousSites.hazardCount} found
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    <span className="text-green-600 font-medium">None nearby</span>
                                  </>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between p-2 rounded bg-slate-50">
                              <div className="flex items-center gap-2">
                                <Mountain className="h-4 w-4 text-amber-600" />
                                <span>Steep Slopes (USGS)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {result.siteEvaluation.slope.hasSteepSlope ? (
                                  <>
                                    <XCircle className="h-4 w-4 text-red-500" />
                                    <span className="text-red-600 font-medium">
                                      {result.siteEvaluation.slope.maxSlope}% max
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    <span className="text-green-600 font-medium">
                                      {result.siteEvaluation.slope.maxSlope !== null 
                                        ? `${result.siteEvaluation.slope.maxSlope}% max` 
                                        : 'Level terrain'}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between p-2 rounded bg-slate-50">
                              <div className="flex items-center gap-2">
                                <Bus className="h-4 w-4 text-purple-500" />
                                <span>Transit Access (Google)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {result.siteEvaluation.transit.hasNearbyTransit ? (
                                  <>
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    <span className="text-green-600 font-medium">
                                      {result.siteEvaluation.transit.nearestStopDistance?.toFixed(2)} mi
                                    </span>
                                    <Badge variant="outline">{result.siteEvaluation.transit.transitScore} pts</Badge>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-4 w-4 text-gray-400" />
                                    <span className="text-gray-500">None within 0.5 mi</span>
                                  </>
                                )}
                              </div>
                            </div>
                            
                            {result.siteEvaluation.incompatibleUses.nearbyAirports.length > 0 && (
                              <div className="flex items-center justify-between p-2 rounded bg-slate-50">
                                <div className="flex items-center gap-2">
                                  <Plane className="h-4 w-4 text-gray-500" />
                                  <span>Nearby Airport</span>
                                </div>
                                <span className="text-gray-600">
                                  {result.siteEvaluation.incompatibleUses.nearbyAirports[0].name} ({result.siteEvaluation.incompatibleUses.nearbyAirports[0].distance} mi)
                                </span>
                              </div>
                            )}
                            
                            {result.siteEvaluation.hazardousSites.nearestHazard && (
                              <div className="text-xs text-gray-500 mt-2">
                                Nearest hazard: {result.siteEvaluation.hazardousSites.nearestHazard.name} 
                                ({result.siteEvaluation.hazardousSites.nearestHazard.type}) - {result.siteEvaluation.hazardousSites.nearestHazard.distance} mi
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {result.marketInsights && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            LandLinq Market Intelligence
                          </h4>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-gray-500">Deals in Market:</span>
                              <span className="ml-2 font-medium">{result.marketInsights.totalDealsInMarket}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Green Deals:</span>
                              <span className="ml-2 font-medium text-green-600">{result.marketInsights.greenDealsInMarket}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Affordable Deals:</span>
                              <span className="ml-2 font-medium">{result.marketInsights.affordableDealsInMarket}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Success Rate:</span>
                              <span className="ml-2 font-medium">{result.marketInsights.successRate}%</span>
                            </div>
                            {result.marketInsights.avgPricePerAcre && (
                              <div className="col-span-2">
                                <span className="text-gray-500">Avg Price/Acre:</span>
                                <span className="ml-2 font-medium">${result.marketInsights.avgPricePerAcre.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {result.similarDeals && result.similarDeals.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <Home className="h-4 w-4" />
                            Similar Affordable Deals
                          </h4>
                          <div className="space-y-2 text-sm">
                            {result.similarDeals.map((deal, idx) => (
                              <div key={idx} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0">
                                <span className="text-gray-700 truncate max-w-[200px]">{deal.propertyName}</span>
                                <div className="flex items-center gap-2">
                                  {deal.proposedUnits && <span className="text-gray-500">{deal.proposedUnits} units</span>}
                                  <Badge variant={deal.classification === 'green' ? 'default' : 'secondary'}>
                                    {deal.classification}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Enter property details and click "Calculate Score" to see results</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>About NC LIHTC Scoring</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-2">
              <p>
                This tool provides an estimated QAP (Qualified Allocation Plan) score based on the 
                2026 North Carolina Housing Finance Agency LIHTC guidelines. The score helps predict 
                competitiveness for Low-Income Housing Tax Credit applications.
              </p>
              <p>
                <strong>Scoring Categories:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Neighborhood Character (10 pts):</strong> Based on quality and redevelopment status</li>
                <li><strong>Primary Amenities (26 pts):</strong> Grocery, Shopping, Pharmacy within distance thresholds</li>
                <li><strong>Secondary Amenities (18 pts):</strong> Healthcare, Public Facilities, Schools, etc.</li>
                <li><strong>Site Suitability (12 pts):</strong> No incompatible uses, visibility, traffic safety</li>
                <li><strong>Transit Access (6 pts):</strong> Bus/transit stops within 0.5 miles</li>
                <li><strong>Income/RPP (2 pts):</strong> Based on unit mix targeting lower AMI levels</li>
              </ul>
              <p className="text-sm mt-4"><strong>Government API Sources:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
                <li><strong>FEMA NFHL:</strong> National Flood Hazard Layer for flood zone detection</li>
                <li><strong>EPA Envirofacts:</strong> Toxic Release Inventory and RCRA facilities</li>
                <li><strong>USGS Elevation:</strong> National Map Elevation Point Query for slope analysis</li>
                <li><strong>Google Places:</strong> Amenity proximity and transit stop detection</li>
              </ul>
              <p className="text-xs text-gray-400 mt-4">
                Note: This is a comprehensive pre-scorer using official government data sources.
                Actual QAP scoring may vary based on additional factors and official review.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function ScoreRow({ 
  label, 
  points, 
  maxPoints,
  isNegative = false 
}: { 
  label: string; 
  points: number; 
  maxPoints: number;
  isNegative?: boolean;
}) {
  const percentage = isNegative ? 0 : (points / maxPoints) * 100;
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className={`font-medium ${isNegative ? 'text-red-600' : ''}`}>
          {points} {!isNegative && `/ ${maxPoints}`} pts
        </span>
      </div>
      {!isNegative && (
        <Progress value={percentage} className="h-2" />
      )}
    </div>
  );
}