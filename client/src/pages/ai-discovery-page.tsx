import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Brain,
  Search,
  MapPin,
  TrendingUp,
  Target,
  Zap,
  Filter,
  Map,
  BarChart3,
  PieChart,
  Eye,
  Settings,
  Layers,
  Activity,
  Globe,
  Building,
  TreePine,
  Home,
  Calculator,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Percent,
  RefreshCw,
  Download,
  Play,
  Pause,
  Square
} from "lucide-react";

interface PropertyOpportunity {
  id: string;
  address: string;
  size: number;
  currentZoning: string;
  proposedZoning: string;
  aiScore: number;
  opportunityType: 'rezoning' | 'assemblage' | 'dual_zoning' | 'underutilized';
  estimatedValue: number;
  estimatedProfit: number;
  riskLevel: 'low' | 'medium' | 'high';
  timeToComplete: number;
  confidence: number;
  marketTrend: 'hot' | 'warm' | 'cool';
  infrastructure: {
    sewer: boolean;
    water: boolean;
    utilities: boolean;
  };
  insights: string[];
  location: {
    lat: number;
    lng: number;
  };
}

interface SearchCriteria {
  minSize: number;
  maxSize: number;
  minPrice: number;
  maxPrice: number;
  opportunityTypes: string[];
  minAiScore: number;
  maxRiskLevel: string;
  markets: string[];
  infrastructure: {
    sewerRequired: boolean;
    waterRequired: boolean;
    utilitiesRequired: boolean;
  };
}

interface AIAnalysis {
  marketTrends: {
    hotSpots: string[];
    emergingAreas: string[];
    priceAppreciation: number;
    demandIndicators: string[];
  };
  rezoningProbability: {
    averageSuccess: number;
    factorsInfluencing: string[];
    timelineEstimate: string;
  };
  investment: {
    roiProjection: number;
    paybackPeriod: number;
    riskFactors: string[];
  };
  recommendations: {
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    actionItems: string[];
  }[];
}

export default function AIDiscoveryPage() {
  const [activeTab, setActiveTab] = useState("discovery");
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>({
    minSize: 5,
    maxSize: 500,
    minPrice: 500000,
    maxPrice: 50000000,
    opportunityTypes: ['rezoning', 'assemblage', 'dual_zoning', 'underutilized'],
    minAiScore: 70,
    maxRiskLevel: 'medium',
    markets: [],
    infrastructure: {
      sewerRequired: true,
      waterRequired: true,
      utilitiesRequired: false
    }
  });
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PropertyOpportunity | null>(null);
  const [mapView, setMapView] = useState<'satellite' | 'terrain' | 'hybrid'>('hybrid');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mock data for demonstration
  const [discoveredProperties] = useState<PropertyOpportunity[]>([
    {
      id: '1',
      address: '2847 Peachtree Industrial Blvd, Duluth, GA 30096',
      size: 24.5,
      currentZoning: 'R-2',
      proposedZoning: 'R-4',
      aiScore: 87,
      opportunityType: 'rezoning',
      estimatedValue: 8500000,
      estimatedProfit: 2800000,
      riskLevel: 'low',
      timeToComplete: 18,
      confidence: 92,
      marketTrend: 'hot',
      infrastructure: { sewer: true, water: true, utilities: true },
      insights: [
        'High growth corridor with new infrastructure projects',
        'Municipal master plan supports higher density',
        'Strong rental demand in adjacent areas',
        'No environmental constraints identified'
      ],
      location: { lat: 34.0022, lng: -84.1447 }
    },
    {
      id: '2',
      address: '1425 Cedar Grove Rd, Marietta, GA 30062',
      size: 18.2,
      currentZoning: 'AG',
      proposedZoning: 'R-3',
      aiScore: 94,
      opportunityType: 'assemblage',
      estimatedValue: 12300000,
      estimatedProfit: 4100000,
      riskLevel: 'medium',
      timeToComplete: 24,
      confidence: 89,
      marketTrend: 'hot',
      infrastructure: { sewer: false, water: true, utilities: true },
      insights: [
        'Adjacent properties available for assemblage',
        'Sewer extension planned for 2025',
        'School district ratings improving',
        'Transportation corridor improvements'
      ],
      location: { lat: 33.9526, lng: -84.5499 }
    },
    {
      id: '3',
      address: '892 Old Alpharetta Rd, Alpharetta, GA 30009',
      size: 31.7,
      currentZoning: 'R-1/R-3',
      proposedZoning: 'Mixed Use',
      aiScore: 96,
      opportunityType: 'dual_zoning',
      estimatedValue: 18700000,
      estimatedProfit: 6200000,
      riskLevel: 'low',
      timeToComplete: 15,
      confidence: 95,
      marketTrend: 'hot',
      infrastructure: { sewer: true, water: true, utilities: true },
      insights: [
        'Unique dual zoning allows flexible development',
        'Tech corridor expansion nearby',
        'Premium location with highway access',
        'Strong demographic trends support development'
      ],
      location: { lat: 34.0754, lng: -84.2941 }
    }
  ]);

  const [aiAnalysis] = useState<AIAnalysis>({
    marketTrends: {
      hotSpots: ['Alpharetta', 'Duluth', 'Johns Creek', 'Roswell'],
      emergingAreas: ['Buford', 'Sugar Hill', 'Cumming'],
      priceAppreciation: 15.4,
      demandIndicators: ['Tech job growth', 'Population influx', 'Infrastructure investment']
    },
    rezoningProbability: {
      averageSuccess: 73,
      factorsInfluencing: ['Municipal growth plans', 'Infrastructure capacity', 'Community support'],
      timelineEstimate: '12-24 months'
    },
    investment: {
      roiProjection: 28.5,
      paybackPeriod: 3.2,
      riskFactors: ['Regulatory changes', 'Market cycles', 'Infrastructure delays']
    },
    recommendations: [
      {
        title: 'Focus on Tech Corridor Properties',
        description: 'Properties within 2 miles of major tech employers showing 40% higher appreciation',
        priority: 'high',
        actionItems: ['Target Alpharetta/Johns Creek area', 'Analyze transportation access', 'Review zoning flexibility']
      },
      {
        title: 'Leverage Dual Zoning Opportunities',
        description: 'Properties with existing dual zoning reduce risk and timeline by 35%',
        priority: 'high',
        actionItems: ['Search for R-1/R-3 combinations', 'Verify development flexibility', 'Check municipal support']
      },
      {
        title: 'Monitor Infrastructure Projects',
        description: 'Sewer and transportation projects create significant value uplift opportunities',
        priority: 'medium',
        actionItems: ['Track municipal project timelines', 'Identify pre-infrastructure properties', 'Calculate uplift potential']
      }
    ]
  });

  const handleSearch = async () => {
    setIsSearching(true);
    toast({
      title: "AI Discovery Search Started",
      description: "Analyzing market data and identifying opportunities...",
    });

    // Simulate AI search process
    setTimeout(() => {
      setIsSearching(false);
      toast({
        title: "Discovery Complete",
        description: `Found ${discoveredProperties.length} high-probability opportunities`,
      });
    }, 3000);
  };

  const handleCriteriaChange = (key: string, value: any) => {
    setSearchCriteria(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleInfrastructureChange = (key: string, value: boolean) => {
    setSearchCriteria(prev => ({
      ...prev,
      infrastructure: {
        ...prev.infrastructure,
        [key]: value
      }
    }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(amount);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 80) return 'text-blue-600 bg-blue-100';
    if (score >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getOpportunityIcon = (type: string) => {
    switch (type) {
      case 'rezoning': return <RefreshCw className="h-4 w-4" />;
      case 'assemblage': return <Layers className="h-4 w-4" />;
      case 'dual_zoning': return <Target className="h-4 w-4" />;
      case 'underutilized': return <TrendingUp className="h-4 w-4" />;
      default: return <Building className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-12">
        {/* Enhanced Page Header */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-xl blur opacity-30"></div>
                <div className="relative p-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-xl">
                  <Brain className="h-10 w-10 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-5xl font-extrabold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                  Discovery
                </h1>
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span className="font-semibold">50-70% faster than traditional methods</span>
                </div>
              </div>
            </div>
            <p className="text-xl text-slate-700 max-w-4xl mx-auto leading-relaxed mb-8">
              Advanced property intelligence platform identifying optimal development sites with 
              strategic analysis, rezoning potential, and market advantages.
            </p>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-4xl mx-auto mb-8">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-blue-100">
                <div className="text-3xl font-bold text-blue-600 mb-1">60-96%</div>
                <div className="text-sm text-slate-600">Analysis Confidence</div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-green-100">
                <div className="text-3xl font-bold text-green-600 mb-1">24hr</div>
                <div className="text-sm text-slate-600">Deal Evaluation</div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-purple-100">
                <div className="text-3xl font-bold text-purple-600 mb-1">5min</div>
                <div className="text-sm text-slate-600">Initial Analysis</div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-amber-100">
                <div className="text-3xl font-bold text-amber-600 mb-1">73%</div>
                <div className="text-sm text-slate-600">Rezoning Success</div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="text-left">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Property Intelligence Dashboard
              </h2>
              <p className="text-slate-600">
                Find high-value opportunities before your competition
              </p>
            </div>
            <div className="mt-4 sm:mt-0 flex gap-2">
              <Button 
                onClick={handleSearch} 
                disabled={isSearching}
                className="flex items-center gap-2"
                data-testid="button-ai-search"
              >
                {isSearching ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Start AI Discovery
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm" className="flex items-center gap-2 border-catalyst-gold text-catalyst-gold hover:bg-catalyst-gold hover:text-white" data-testid="button-export-results">
                <Download className="h-4 w-4" />
                Export Results
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="mb-8">
            <TabsList className="grid w-full grid-cols-5 h-auto p-2 bg-white/80 backdrop-blur-sm border border-slate-200 shadow-lg rounded-xl">
              <TabsTrigger 
                value="discovery" 
                className="flex flex-col items-center gap-2 p-4 rounded-lg data-[state=active]:bg-catalyst-gold data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200"
              >
                <Search className="h-5 w-5" />
                <span className="text-sm font-medium">Smart Search</span>
              </TabsTrigger>
              <TabsTrigger 
                value="opportunities" 
                className="flex flex-col items-center gap-2 p-4 rounded-lg data-[state=active]:bg-catalyst-navy data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200"
              >
                <Target className="h-5 w-5" />
                <span className="text-sm font-medium">Results</span>
              </TabsTrigger>
              <TabsTrigger 
                value="analysis" 
                className="flex flex-col items-center gap-2 p-4 rounded-lg data-[state=active]:bg-catalyst-gold data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200"
              >
                <BarChart3 className="h-5 w-5" />
                <span className="text-sm font-medium">Analysis</span>
              </TabsTrigger>
              <TabsTrigger 
                value="mapping" 
                className="flex flex-col items-center gap-2 p-4 rounded-lg data-[state=active]:bg-catalyst-navy data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200"
              >
                <Map className="h-5 w-5" />
                <span className="text-sm font-medium">Smart Mapping</span>
              </TabsTrigger>
              <TabsTrigger 
                value="insights" 
                className="flex flex-col items-center gap-2 p-4 rounded-lg data-[state=active]:bg-catalyst-gold data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200"
              >
                <TrendingUp className="h-5 w-5" />
                <span className="text-sm font-medium">Market Intel</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Discovery Tab - Search Criteria */}
          <TabsContent value="discovery" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Search Criteria Panel */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Filter className="h-5 w-5" />
                      AI Search Criteria
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Property Size */}
                    <div className="space-y-3">
                      <Label>Property Size (Acres)</Label>
                      <div className="px-3">
                        <Slider
                          value={[searchCriteria.minSize, searchCriteria.maxSize]}
                          onValueChange={([min, max]) => {
                            handleCriteriaChange('minSize', min);
                            handleCriteriaChange('maxSize', max);
                          }}
                          max={500}
                          min={1}
                          step={1}
                          className="w-full"
                        />
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>{searchCriteria.minSize} acres</span>
                        <span>{searchCriteria.maxSize} acres</span>
                      </div>
                    </div>

                    {/* Price Range */}
                    <div className="space-y-3">
                      <Label>Price Range</Label>
                      <div className="px-3">
                        <Slider
                          value={[searchCriteria.minPrice, searchCriteria.maxPrice]}
                          onValueChange={([min, max]) => {
                            handleCriteriaChange('minPrice', min);
                            handleCriteriaChange('maxPrice', max);
                          }}
                          max={50000000}
                          min={100000}
                          step={100000}
                          className="w-full"
                        />
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>{formatCurrency(searchCriteria.minPrice)}</span>
                        <span>{formatCurrency(searchCriteria.maxPrice)}</span>
                      </div>
                    </div>

                    {/* AI Score Threshold */}
                    <div className="space-y-3">
                      <Label>Minimum AI Score</Label>
                      <div className="px-3">
                        <Slider
                          value={[searchCriteria.minAiScore]}
                          onValueChange={([value]) => handleCriteriaChange('minAiScore', value)}
                          max={100}
                          min={50}
                          step={5}
                          className="w-full"
                        />
                      </div>
                      <div className="text-center text-sm text-gray-600">
                        {searchCriteria.minAiScore}% minimum score
                      </div>
                    </div>

                    {/* Opportunity Types */}
                    <div className="space-y-3">
                      <Label>Opportunity Types</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { key: 'rezoning', label: 'Rezoning', icon: <RefreshCw className="h-4 w-4" /> },
                          { key: 'assemblage', label: 'Assemblage', icon: <Layers className="h-4 w-4" /> },
                          { key: 'dual_zoning', label: 'Dual Zoning', icon: <Target className="h-4 w-4" /> },
                          { key: 'underutilized', label: 'Underutilized', icon: <TrendingUp className="h-4 w-4" /> }
                        ].map(type => (
                          <div key={type.key} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={type.key}
                              checked={searchCriteria.opportunityTypes.includes(type.key)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  handleCriteriaChange('opportunityTypes', [...searchCriteria.opportunityTypes, type.key]);
                                } else {
                                  handleCriteriaChange('opportunityTypes', searchCriteria.opportunityTypes.filter(t => t !== type.key));
                                }
                              }}
                              className="rounded border-gray-300"
                            />
                            <label htmlFor={type.key} className="text-sm flex items-center gap-1">
                              {type.icon}
                              {type.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Infrastructure Requirements */}
                    <div className="space-y-3">
                      <Label>Infrastructure Requirements</Label>
                      <div className="space-y-2">
                        {[
                          { key: 'sewerRequired', label: 'Sewer Access', icon: <Home className="h-4 w-4" /> },
                          { key: 'waterRequired', label: 'Water Access', icon: <TreePine className="h-4 w-4" /> },
                          { key: 'utilitiesRequired', label: 'Full Utilities', icon: <Zap className="h-4 w-4" /> }
                        ].map(item => (
                          <div key={item.key} className="flex items-center justify-between">
                            <label className="text-sm flex items-center gap-2">
                              {item.icon}
                              {item.label}
                            </label>
                            <Switch
                              checked={searchCriteria.infrastructure[item.key as keyof typeof searchCriteria.infrastructure]}
                              onCheckedChange={(checked) => handleInfrastructureChange(item.key, checked)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* AI Discovery Dashboard */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      AI Discovery Dashboard
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Search Status */}
                      <Card className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-gray-900">Search Status</h3>
                          {isSearching ? (
                            <div className="flex items-center gap-2 text-blue-600">
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              <span className="text-sm">Analyzing...</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-sm">Ready</span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Market Data Sources</span>
                            <span className="font-medium">247 Active</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>AI Models Running</span>
                            <span className="font-medium">12 Systems</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Last Updated</span>
                            <span className="font-medium">2 min ago</span>
                          </div>
                        </div>
                      </Card>

                      {/* Quick Stats */}
                      <Card className="p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">Discovery Metrics</h3>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Properties Analyzed Today</span>
                            <span className="font-medium text-blue-600">1,247</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>High-Value Opportunities</span>
                            <span className="font-medium text-green-600">23</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Avg AI Confidence</span>
                            <span className="font-medium text-purple-600">89%</span>
                          </div>
                        </div>
                      </Card>

                      {/* Recent Discoveries */}
                      <Card className="p-4 md:col-span-2">
                        <h3 className="font-semibold text-gray-900 mb-3">Recent AI Discoveries</h3>
                        <div className="space-y-3">
                          {discoveredProperties.slice(0, 3).map((property) => (
                            <div key={property.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getScoreColor(property.aiScore)}`}>
                                  <span className="text-xs font-bold">{property.aiScore}</span>
                                </div>
                                <div>
                                  <div className="font-medium text-sm">{property.address.split(',')[0]}</div>
                                  <div className="text-xs text-gray-600">{property.size} acres • {property.opportunityType}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium text-sm">{formatCurrency(property.estimatedProfit)}</div>
                                <div className="text-xs text-gray-600">Est. Profit</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Opportunities Tab - Property Results */}
          <TabsContent value="opportunities" className="space-y-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Discovered Properties</h3>
                <p className="text-slate-600 mt-1">{discoveredProperties.length} high-potential opportunities identified</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" className="border-slate-300 hover:border-blue-400">
                  <Download className="h-4 w-4 mr-2" />
                  Export Results
                </Button>
                <Button variant="outline" size="sm" className="border-slate-300 hover:border-purple-400">
                  <Filter className="h-4 w-4 mr-2" />
                  Advanced Filters
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
              {discoveredProperties.map((property) => (
                <Card key={property.id} className="group cursor-pointer transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:bg-white/95" onClick={() => setSelectedProperty(property)}>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3 p-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                        {getOpportunityIcon(property.opportunityType)}
                        <span className="font-semibold text-slate-900 capitalize">{property.opportunityType.replace('_', ' ')}</span>
                      </div>
                      <Badge className={`px-3 py-1 font-bold text-white shadow-lg ${
                        property.aiScore >= 80 
                          ? "bg-gradient-to-r from-green-500 to-emerald-600" 
                          : property.aiScore >= 60 
                            ? "bg-gradient-to-r from-yellow-500 to-amber-500" 
                            : "bg-gradient-to-r from-red-500 to-pink-600"
                      }`}>
                        {property.aiScore}% Score
                      </Badge>
                    </div>
                    <CardTitle className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {property.address.split(',')[0]}
                    </CardTitle>
                    <p className="text-slate-600 font-medium">{property.address.split(',').slice(1).join(',')}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Key Metrics */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-gray-500">Size</div>
                          <div className="font-semibold">{property.size} acres</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Est. Profit</div>
                          <div className="font-semibold text-green-600">{formatCurrency(property.estimatedProfit)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Timeline</div>
                          <div className="font-semibold">{property.timeToComplete} months</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Risk Level</div>
                          <Badge className={`text-xs ${getRiskColor(property.riskLevel)}`}>
                            {property.riskLevel}
                          </Badge>
                        </div>
                      </div>

                      {/* Zoning Information */}
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Zoning Opportunity</div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{property.currentZoning}</span>
                          <span className="text-gray-400">→</span>
                          <span className="text-sm font-semibold text-blue-600">{property.proposedZoning}</span>
                        </div>
                      </div>

                      {/* Infrastructure Status */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Home className={`h-4 w-4 ${property.infrastructure.sewer ? 'text-green-500' : 'text-gray-400'}`} />
                          <span className="text-xs">Sewer</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <TreePine className={`h-4 w-4 ${property.infrastructure.water ? 'text-green-500' : 'text-gray-400'}`} />
                          <span className="text-xs">Water</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className={`h-4 w-4 ${property.infrastructure.utilities ? 'text-green-500' : 'text-gray-400'}`} />
                          <span className="text-xs">Utilities</span>
                        </div>
                      </div>

                      {/* Market Trend */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TrendingUp className={`h-4 w-4 ${
                            property.marketTrend === 'hot' ? 'text-red-500' :
                            property.marketTrend === 'warm' ? 'text-amber-500' : 'text-blue-500'
                          }`} />
                          <span className="text-sm capitalize">{property.marketTrend} Market</span>
                        </div>
                        <div className="text-sm text-gray-600">{property.confidence}% confidence</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* AI Analysis Tab */}
          <TabsContent value="analysis" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Market Trends Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Market Trends Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Price Appreciation Rate</span>
                      <span className="text-lg font-bold text-green-600">+{aiAnalysis.marketTrends.priceAppreciation}%</span>
                    </div>
                    <Progress value={aiAnalysis.marketTrends.priceAppreciation} className="h-2" />
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Hot Spot Markets</h4>
                    <div className="flex flex-wrap gap-2">
                      {aiAnalysis.marketTrends.hotSpots.map((market, index) => (
                        <Badge key={index} variant="secondary" className="bg-red-100 text-red-700">
                          {market}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Emerging Areas</h4>
                    <div className="flex flex-wrap gap-2">
                      {aiAnalysis.marketTrends.emergingAreas.map((area, index) => (
                        <Badge key={index} variant="secondary" className="bg-yellow-100 text-yellow-700">
                          {area}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Demand Indicators</h4>
                    <ul className="space-y-1">
                      {aiAnalysis.marketTrends.demandIndicators.map((indicator, index) => (
                        <li key={index} className="text-sm flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          {indicator}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Rezoning Probability */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5" />
                    Rezoning Probability Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-1">
                      {aiAnalysis.rezoningProbability.averageSuccess}%
                    </div>
                    <div className="text-sm text-gray-600">Average Success Rate</div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Timeline Estimate</span>
                      <span className="text-sm font-semibold">{aiAnalysis.rezoningProbability.timelineEstimate}</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Key Success Factors</h4>
                    <ul className="space-y-1">
                      {aiAnalysis.rezoningProbability.factorsInfluencing.map((factor, index) => (
                        <li key={index} className="text-sm flex items-center gap-2">
                          <Target className="h-4 w-4 text-blue-500" />
                          {factor}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Investment Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Investment Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{aiAnalysis.investment.roiProjection}%</div>
                      <div className="text-sm text-gray-600">Projected ROI</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{aiAnalysis.investment.paybackPeriod}</div>
                      <div className="text-sm text-gray-600">Years Payback</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Risk Factors</h4>
                    <ul className="space-y-1">
                      {aiAnalysis.investment.riskFactors.map((risk, index) => (
                        <li key={index} className="text-sm flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* AI Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    AI Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {aiAnalysis.recommendations.map((rec, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{rec.title}</h4>
                        <Badge className={`${
                          rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                          rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {rec.priority} priority
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{rec.description}</p>
                      <div className="space-y-1">
                        {rec.actionItems.map((action, actionIndex) => (
                          <div key={actionIndex} className="text-sm flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                            {action}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Smart Mapping Tab */}
          <TabsContent value="mapping" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Map className="h-5 w-5" />
                  AI-Powered Mapping & Visualization
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={mapView} onValueChange={(value: any) => setMapView(value)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="satellite">Satellite</SelectItem>
                      <SelectItem value="terrain">Terrain</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative bg-gray-100 rounded-lg h-96 flex items-center justify-center">
                  <div className="text-center">
                    <Map className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">Interactive AI Mapping</h3>
                    <p className="text-gray-500 mb-4">Advanced geographic analysis and opportunity visualization</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="p-3 bg-white rounded border">
                        <div className="font-medium">Heat Map Layers</div>
                        <div className="text-gray-600">Price trends, zoning, demographics</div>
                      </div>
                      <div className="p-3 bg-white rounded border">
                        <div className="font-medium">Opportunity Zones</div>
                        <div className="text-gray-600">AI-identified high-value areas</div>
                      </div>
                      <div className="p-3 bg-white rounded border">
                        <div className="font-medium">Infrastructure</div>
                        <div className="text-gray-600">Sewer, utilities, transportation</div>
                      </div>
                      <div className="p-3 bg-white rounded border">
                        <div className="font-medium">Market Data</div>
                        <div className="text-gray-600">Comparables, trends, forecasts</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Market Insights Tab */}
          <TabsContent value="insights" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Market Intelligence */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Real-Time Market Intelligence
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Market Activity Feed */}
                    <div>
                      <h4 className="font-medium mb-3">Live Market Activity</h4>
                      <div className="space-y-3">
                        {[
                          { time: '2m ago', type: 'Rezoning Approved', location: 'Alpharetta', impact: 'High' },
                          { time: '15m ago', type: 'Infrastructure Project', location: 'Johns Creek', impact: 'Medium' },
                          { time: '1h ago', type: 'Price Appreciation', location: 'Roswell', impact: 'Medium' },
                          { time: '3h ago', type: 'New Development', location: 'Duluth', impact: 'High' }
                        ].map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${
                                item.impact === 'High' ? 'bg-red-500' : 
                                item.impact === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                              }`}></div>
                              <div>
                                <div className="font-medium text-sm">{item.type}</div>
                                <div className="text-xs text-gray-600">{item.location}</div>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">{item.time}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Predictive Analytics */}
                    <div>
                      <h4 className="font-medium mb-3">Predictive Analytics</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            <span className="font-medium">Growth Forecast</span>
                          </div>
                          <div className="text-2xl font-bold text-green-600">+23%</div>
                          <div className="text-sm text-gray-600">Next 12 months</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">Best Timing</span>
                          </div>
                          <div className="text-lg font-bold text-blue-600">Q2 2025</div>
                          <div className="text-sm text-gray-600">Optimal entry point</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* AI Insights Panel */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    AI Insights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Key Metrics */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">AI Confidence</span>
                        <span className="font-semibold">94%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Market Score</span>
                        <span className="font-semibold text-green-600">8.7/10</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Risk Level</span>
                        <Badge className="bg-green-100 text-green-700">Low</Badge>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="pt-4 border-t">
                      <h4 className="font-medium mb-3">Recommended Actions</h4>
                      <div className="space-y-2">
                        <Button size="sm" variant="outline" className="w-full justify-start">
                          <Target className="h-4 w-4 mr-2" />
                          Focus on Alpharetta
                        </Button>
                        <Button size="sm" variant="outline" className="w-full justify-start">
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Track Rezoning
                        </Button>
                        <Button size="sm" variant="outline" className="w-full justify-start">
                          <Eye className="h-4 w-4 mr-2" />
                          Monitor Infrastructure
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Property Detail Modal */}
        <Dialog open={!!selectedProperty} onOpenChange={() => setSelectedProperty(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {selectedProperty && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {getOpportunityIcon(selectedProperty.opportunityType)}
                    {selectedProperty.address}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                  {/* Property Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4">
                      <div className="text-center">
                        <div className={`text-3xl font-bold ${getScoreColor(selectedProperty.aiScore).split(' ')[0]}`}>
                          {selectedProperty.aiScore}
                        </div>
                        <div className="text-sm text-gray-600">AI Score</div>
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(selectedProperty.estimatedProfit)}
                        </div>
                        <div className="text-sm text-gray-600">Est. Profit</div>
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {selectedProperty.timeToComplete}
                        </div>
                        <div className="text-sm text-gray-600">Months</div>
                      </div>
                    </Card>
                  </div>

                  {/* AI Insights */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3">AI-Generated Insights</h3>
                    <div className="space-y-2">
                      {selectedProperty.insights.map((insight, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{insight}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
      
      <Footer />
    </div>
  );
}