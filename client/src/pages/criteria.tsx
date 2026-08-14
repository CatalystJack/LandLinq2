import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, MapPin, Home, DollarSign, Ruler, Building2, Users, Trees, HandshakeIcon, LayoutGrid, TrendingUp, Eye, X, Search, Map as MapIcon, XCircle, AlertTriangle, Calendar, Hash } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import MSAMap from "@/components/msa-map";

interface AcquisitionMarket {
  id: string;
  msaName: string;
  county: string;
  state: string;
  productTypes: string[];
  isActive: boolean;
  latitude?: string | null;
  longitude?: string | null;
}

export default function CriteriaPage() {
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch MSA markets
  const { data: marketsData } = useQuery<{ success: boolean; markets: AcquisitionMarket[] }>({
    queryKey: ["/api/msa/markets"],
    staleTime: 0,
    gcTime: 0,
  });

  const markets = marketsData?.markets || [];
  const [stateFilter, setStateFilter] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState("");

  // Get unique states, product types, and MSA count
  const uniqueStates = Array.from(new Set(markets.map(m => m.state))).sort();
  const uniqueProductTypes = Array.from(
    new Set(markets.flatMap(m => m.productTypes || []))
  ).sort();
  const uniqueMSACount = new Set(markets.map(m => m.msaName)).size;

  // Filter markets based on search query, state, and product type
  const filteredMarkets = markets.filter(market => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      market.msaName.toLowerCase().includes(query) ||
      market.county.toLowerCase().includes(query) ||
      market.state.toLowerCase().includes(query);
    
    const matchesState = !stateFilter || market.state === stateFilter;
    const matchesProductType = !productTypeFilter || 
      market.productTypes?.includes(productTypeFilter);
    
    return matchesSearch && matchesState && matchesProductType;
  });

  // Group markets by MSA name
  const groupedMarkets = filteredMarkets.reduce((acc, market) => {
    if (!acc[market.msaName]) {
      acc[market.msaName] = [];
    }
    acc[market.msaName].push(market);
    return acc;
  }, {} as Record<string, AcquisitionMarket[]>);

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative py-16 sm:py-20 lg:py-24 bg-gradient-to-br from-[#081729] to-[#0a2540] overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight" data-testid="text-criteria-title">
            What We Look For
          </h1>
          <p className="text-xl sm:text-2xl text-gray-200 leading-relaxed max-w-3xl mx-auto">
            Understanding our acquisition criteria helps you identify and submit the perfect opportunities.
          </p>
        </div>
      </section>

      {/* Section 1.5: Site Acquisition Criteria - White Background */}
      <section className="py-20 bg-white" data-testid="section-site-criteria">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[#081729] mb-4">
              Site Acquisition Criteria
            </h2>
              <p className="text-base text-gray-600 max-w-2xl mx-auto">
                To ensure development viability, properties must meet the following requirements:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {/* Minimum Acreage */}
              <div className="bg-white border-2 border-gray-200 rounded-lg p-6" data-testid="criteria-acreage">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#4A90E2] rounded-lg flex items-center justify-center flex-shrink-0">
                    <Ruler className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-[#081729] mb-2">Minimum 4 Acres</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Properties must be at least 4 acres to support viable development density. Multi-parcel assemblages are acceptable if combined acreage meets the threshold.
                    </p>
                  </div>
                </div>
              </div>

              {/* Target Markets */}
              <div className="bg-white border-2 border-gray-200 rounded-lg p-6" data-testid="criteria-markets">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#4A90E2] rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-[#081729] mb-2">Target Markets</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Property must be in one of our {uniqueMSACount > 0 ? uniqueMSACount : ''} target MSAs for Active Adult, BTR/Conventional, and Lot Development. <strong className="text-green-700">Exception:</strong> Affordable housing is accepted in ANY MSA if located in a Qualified Census Tract.
                    </p>
                  </div>
                </div>
              </div>

              {/* Strong Comparables */}
              <div className="bg-white border-2 border-gray-200 rounded-lg p-6" data-testid="criteria-comparables">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#4A90E2] rounded-lg flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-[#081729] mb-2">Strong Rent Comparables</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Must have qualifying comparable properties nearby (built 2020+, 150+ units, rent ≥$1.75/sqft) to validate market strength and rental demand.
                    </p>
                  </div>
                </div>
              </div>

              {/* QCT Opportunity */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-6" data-testid="criteria-qct">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-green-800 mb-2">QCT Special Consideration</h4>
                    <p className="text-sm text-green-900 leading-relaxed">
                      Properties in Qualified Census Tracts receive special consideration and may override standard criteria due to federal tax incentives. <strong>Affordable housing in QCTs is accepted nationwide, regardless of MSA.</strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>

          {/* Note about criteria */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500 max-w-3xl mx-auto">
              <strong>Note:</strong> These criteria help us quickly identify high-potential opportunities. Properties that don't meet all criteria may still be considered on a case-by-case basis.
            </p>
          </div>
        </div>
      </section>

      {/* Section 1.75: Target Markets Map - Grey Background */}
      <section className="py-16 bg-gray-100" data-testid="section-msa-search">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-[#081729] mb-6">
              Interactive Market Map
            </h2>
            <p className="text-base text-gray-600 max-w-2xl mx-auto mb-8">
              Explore our {uniqueMSACount} target acquisition markets across the United States. Use filters to find specific states or product types.
            </p>
            
            {/* Condensed Search & Filters */}
            <div className="max-w-4xl mx-auto mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Search Input */}
                <div className="relative md:col-span-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search city, county, MSA..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-2 text-sm border-2 border-gray-300 focus:border-[#4A90E2] rounded-lg"
                    data-testid="input-msa-search"
                  />
                </div>

                {/* State Filter */}
                <div>
                  <select
                    value={stateFilter}
                    onChange={(e) => setStateFilter(e.target.value)}
                    className="w-full px-3 py-2 text-sm border-2 border-gray-300 focus:border-[#4A90E2] rounded-lg bg-white"
                    data-testid="select-state-filter"
                  >
                    <option value="">All States</option>
                    {uniqueStates.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>

                {/* Product Type Filter */}
                <div>
                  <select
                    value={productTypeFilter}
                    onChange={(e) => setProductTypeFilter(e.target.value)}
                    className="w-full px-3 py-2 text-sm border-2 border-gray-300 focus:border-[#4A90E2] rounded-lg bg-white"
                    data-testid="select-product-type-filter"
                  >
                    <option value="">All Product Types</option>
                    <option value="Active Adult">Active Adult</option>
                    <option value="BTR">BTR</option>
                    <option value="Conventional Apartments">Conventional</option>
                    <option value="Lot Development">Lot Development</option>
                  </select>
                </div>
              </div>

              {/* Results Count */}
              <p className="text-sm text-gray-600 mt-3">
                Showing {filteredMarkets.length} of {markets.length} target markets
                {stateFilter && ` in ${stateFilter}`}
                {productTypeFilter && ` for ${productTypeFilter}`}
              </p>
            </div>
          </div>

          {/* Interactive Map */}
          <div className="max-w-6xl mx-auto">
            <MSAMap 
              markets={filteredMarkets
                .filter(m => m.latitude && m.longitude)
                .map(m => {
                  const lat = typeof m.latitude === 'string' ? parseFloat(m.latitude) : m.latitude;
                  const lng = typeof m.longitude === 'string' ? parseFloat(m.longitude) : m.longitude;
                  
                  return {
                    id: m.id,
                    msaName: m.msaName,
                    county: m.county,
                    state: m.state,
                    productTypes: m.productTypes,
                    latitude: lat as number,
                    longitude: lng as number
                  };
                })
                .filter(m => !isNaN(m.latitude) && !isNaN(m.longitude))}
            />
          </div>

          {/* QCT Notice */}
          <div className="mt-6 max-w-4xl mx-auto">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-900">
                  <strong>Special Note:</strong> Affordable housing deals in Qualified Census Tracts (QCTs) are accepted in ANY MSA nationwide, regardless of the markets shown on this map.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Classification Criteria - White Background */}
      <section className="py-20 bg-white" data-testid="section-classification">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#081729] mb-5">
              How We Classify Deals
            </h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Our AI-powered system evaluates every deal based on comparable property data and market analysis.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Pursuing (Green) */}
            <div className="text-center" data-testid="card-status-pursuing">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
              </div>
              <h3 className="text-3xl font-bold text-green-600 mb-3">Pursuing</h3>
              <p className="text-[#081729] text-base">
                High-priority deals with strong development potential
              </p>
            </div>

            {/* Reviewing (Yellow/Gold) */}
            <div className="text-center" data-testid="card-status-reviewing">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-amber-500 rounded-full flex items-center justify-center shadow-lg">
                  <Eye className="w-10 h-10 text-white" />
                </div>
              </div>
              <h3 className="text-3xl font-bold text-amber-600 mb-3">Reviewing</h3>
              <p className="text-[#081729] text-base">
                Moderate potential requiring detailed analysis
              </p>
            </div>

            {/* Passed (Red) */}
            <div className="text-center" data-testid="card-status-passed">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                  <X className="w-10 h-10 text-white" />
                </div>
              </div>
              <h3 className="text-3xl font-bold text-red-600 mb-3">Passed</h3>
              <p className="text-[#081729] text-base">
                Doesn't meet current acquisition criteria
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Automatic RED Criteria Section */}
      <section className="py-20 bg-gray-50" data-testid="section-red-criteria">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
              <XCircle className="h-4 w-4" />
              Automatic Pass Criteria
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-[#081729] mb-4">
              What Gets an Automatic Pass
            </h2>
            <p className="text-base text-gray-600 max-w-2xl mx-auto">
              These hard rules are evaluated by our AI the moment a deal is submitted. Any one of them results in an immediate RED / Passed classification.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Land Deals Column */}
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-[#081729] rounded-lg flex items-center justify-center flex-shrink-0">
                  <Trees className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-[#081729]">Land / Development Deals</h3>
              </div>
              <div className="space-y-4">

                <div className="bg-white border-l-4 border-red-500 rounded-lg p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <Ruler className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-[#081729]">Under 4 Acres</p>
                      <p className="text-sm text-gray-600 mt-1">The parcel is too small to support viable development density. Multi-parcel assemblages that meet the combined threshold are accepted.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border-l-4 border-red-500 rounded-lg p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-[#081729]">Outside Target MSA</p>
                      <p className="text-sm text-gray-600 mt-1">The property is not located in one of our {uniqueMSACount > 0 ? uniqueMSACount : 'active'} target markets. Exception: QCT properties are accepted nationwide for affordable housing.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border-l-4 border-red-500 rounded-lg p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-[#081729]">No Qualifying Comparables</p>
                      <p className="text-sm text-gray-600 mt-1">No nearby multifamily properties found within 3 miles that meet our benchmark (built 2020+, 150+ units, rents ≥ $1.75/sqft). Market is too thin to validate development returns.</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Acquisition Deals Column */}
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-[#081729] rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-[#081729]">Acquisition Deals</h3>
              </div>
              <div className="space-y-4">

                <div className="bg-white border-l-4 border-red-500 rounded-lg p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-[#081729]">Outside Target MSA</p>
                      <p className="text-sm text-gray-600 mt-1">Property must be in one of our active acquisition markets (BTR, Conventional, or Lot MSAs). QCT exception applies for affordable housing.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border-l-4 border-red-500 rounded-lg p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <Hash className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-[#081729]">Below Minimum Unit Count</p>
                      <p className="text-sm text-gray-600 mt-1">Conventional / Active Adult acquisitions require 100+ units. BTR acquisitions require 80+ units. Smaller assets don't meet institutional scale requirements.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border-l-4 border-red-500 rounded-lg p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-[#081729]">Pre-2000 Vintage</p>
                      <p className="text-sm text-gray-600 mt-1">Acquisitions must be built in 2000 or later. Older assets carry deferred maintenance risk and don't align with our value-add strategy.</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* QCT Override Note */}
          <div className="mt-10 max-w-4xl mx-auto">
            <div className="bg-green-50 border border-green-200 rounded-lg p-5 flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-900">
                <strong>QCT Override:</strong> For both land and acquisition deals, properties located in a Qualified Census Tract (QCT) may be upgraded from RED to YELLOW even if they fail the MSA or comparable criteria — due to the federal tax incentives available for affordable housing development in QCTs.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* Call to Action */}
      <section className="relative py-12 sm:py-16 bg-gradient-to-br from-[#081729] to-[#0a2540] overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Submit Your Deal?
          </h2>
          <p className="text-lg sm:text-xl text-gray-200 mb-8 max-w-2xl mx-auto leading-relaxed">
            Now that you know what we're looking for, let's evaluate your property.
          </p>
          <Link href="/submit-deal">
            <Button 
              className="bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border-2 border-[#4A90E2] transition-all duration-300 text-base px-8 py-3 font-semibold" 
              data-testid="button-submit-deal-criteria"
            >
              Submit Your First Deal
            </Button>
          </Link>
        </div>
      </section>
      
      <Footer />
    </div>
  );
}
