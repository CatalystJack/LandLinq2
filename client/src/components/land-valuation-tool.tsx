import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Calculator, MapPin, TrendingUp, AlertCircle, FileText } from "lucide-react";

interface Comparable {
  address: string;
  acres: number;
  salePrice: number;
  pricePerAcre: number;
  saleDate: string;
  distance: string;
  zoning?: string;
  utilities?: string[];
  topography?: string;
  developmentPotential?: string;
  daysOnMarket?: number;
  sellerType?: string;
  propertyType?: string;
  accessType?: string;
  marketConditions?: string;
  priceAdjustment?: number;
  proximityFeatures?: string[];
}

interface ValuationResult {
  address: string;
  acres: number;
  pricePerAcreRange: {
    low: number;
    high: number;
    midpoint: number;
  };
  estimatedValue: number;
  comparables: Comparable[];
  marketArea: string;
}

export default function LandValuationTool() {
  const [address, setAddress] = useState("");
  const [acreage, setAcreage] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ValuationResult | null>(null);
  const { toast } = useToast();

  // Read URL parameters on component mount to pre-fill form
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const quickEval = urlParams.get('quick-eval');
    const urlAddress = urlParams.get('address');
    const urlAcres = urlParams.get('acres');
    
    if (quickEval === 'true' && urlAddress) {
      setAddress(decodeURIComponent(urlAddress));
      if (urlAcres) {
        const parsedAcres = parseFloat(urlAcres);
        if (!isNaN(parsedAcres) && parsedAcres > 0) {
          setAcreage(urlAcres);
        }
      }
    }
  }, []);

  const handleAnalyze = async () => {
    if (!address.trim() || !acreage || parseFloat(acreage) <= 0) {
      toast({
        title: "Missing Information",
        description: "Please enter both property address and acreage",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    
    // Simulate API call with mock data
    setTimeout(() => {
      const acres = parseFloat(acreage);
      const mockResult: ValuationResult = {
        address: address,
        acres: acres,
        pricePerAcreRange: {
          low: 28000,
          high: 45000,
          midpoint: 36500
        },
        estimatedValue: acres * 36500,
        marketArea: address.includes(",") ? address.split(",")[1].trim() : "Greater Charlotte Area",
        comparables: [
          {
            address: "1247 Pine Ridge Rd, Matthews, NC",
            acres: 4.2,
            salePrice: 168000,
            pricePerAcre: 40000,
            saleDate: "2024-01-15",
            distance: "1.2 miles",
            zoning: "R-40 Residential",
            utilities: ["Water", "Sewer", "Electric", "Gas"],
            topography: "Gently Rolling",
            developmentPotential: "Residential Subdivision (8-12 lots)",
            daysOnMarket: 45,
            sellerType: "Individual Owner",
            propertyType: "Vacant Land",
            accessType: "Paved Road Frontage",
            marketConditions: "Strong Seller's Market",
            priceAdjustment: 0,
            proximityFeatures: ["Schools", "Shopping", "Highway Access"]
          },
          {
            address: "856 Oak Valley Dr, Mint Hill, NC", 
            acres: 2.8,
            salePrice: 95200,
            pricePerAcre: 34000,
            saleDate: "2023-11-22",
            distance: "2.1 miles",
            zoning: "R-22 Residential",
            utilities: ["Water", "Electric"],
            topography: "Level to Gently Sloping",
            developmentPotential: "Single Family Home or Duplex",
            daysOnMarket: 78,
            sellerType: "Estate Sale",
            propertyType: "Vacant Land",
            accessType: "Gravel Road Access",
            marketConditions: "Balanced Market",
            priceAdjustment: -8,
            proximityFeatures: ["Rural Setting", "Creek Frontage"]
          },
          {
            address: "2901 Heritage Lane, Stallings, NC",
            acres: 5.1,
            salePrice: 178500,
            pricePerAcre: 35000,
            saleDate: "2023-09-08", 
            distance: "3.4 miles",
            zoning: "R-80 Residential",
            utilities: ["Water", "Sewer", "Electric"],
            topography: "Mixed Rolling Hills",
            developmentPotential: "Custom Home Development (3-5 lots)",
            daysOnMarket: 124,
            sellerType: "Developer",
            propertyType: "Partially Developed",
            accessType: "Private Road",
            marketConditions: "Cooling Market",
            priceAdjustment: -12,
            proximityFeatures: ["Golf Course", "Lake Access", "Mature Trees"]
          }
        ]
      };
      
      setResult(mockResult);
      setIsAnalyzing(false);
    }, 2000);
  };

  const handleSubmitToCatalyst = () => {
    toast({
      title: "Redirecting to Deal Submission",
      description: "Pre-filling your property details for deeper analysis..."
    });
    // In a real app, this would redirect to submit-deal with pre-filled data
    window.location.href = `/submit-deal?address=${encodeURIComponent(address)}&acres=${acreage}`;
  };

  const resetTool = () => {
    setResult(null);
    setAddress("");
    setAcreage("");
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="border-2 border-catalyst-gold/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-catalyst-navy to-catalyst-navy/90 text-white">
          <CardTitle className="flex items-center gap-3">
            <Calculator className="h-6 w-6" />
            Land Valuation Snap Tool
          </CardTitle>
          <p className="text-catalyst-gold/90 text-sm">
            Quick land value estimates based on recent comparable sales
          </p>
        </CardHeader>
        
        <CardContent className="p-6">
          {!result ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="address" className="text-sm font-medium mb-2 block">
                    Property Address or Closest City/Market
                  </Label>
                  <Input
                    id="address"
                    placeholder="123 Main St, Charlotte, NC or Charlotte, NC"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="h-12"
                    data-testid="input-address"
                  />
                </div>
                
                <div>
                  <Label htmlFor="acreage" className="text-sm font-medium mb-2 block">
                    Acreage
                  </Label>
                  <Input
                    id="acreage"
                    type="number"
                    step="0.1"
                    min="0.1"
                    placeholder="5.0"
                    value={acreage}
                    onChange={(e) => setAcreage(e.target.value)}
                    className="h-12"
                    data-testid="input-acreage"
                  />
                </div>
              </div>

              <Button 
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full h-12 bg-catalyst-navy hover:bg-catalyst-navy/90 text-white font-semibold"
                data-testid="button-analyze"
              >
                {isAnalyzing ? (
                  <>
                    <TrendingUp className="h-5 w-5 mr-2 animate-pulse" />
                    Analyzing Comparable Sales...
                  </>
                ) : (
                  <>
                    <Calculator className="h-5 w-5 mr-2" />
                    Get Quick Value Estimate
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Property Summary */}
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-5 w-5 text-catalyst-navy" />
                  <h3 className="font-semibold text-catalyst-gray-900">Property Summary</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Address:</span> {result.address}
                  </div>
                  <div>
                    <span className="font-medium">Size:</span> {result.acres} acres
                  </div>
                  <div>
                    <span className="font-medium">Market:</span> {result.marketArea}
                  </div>
                </div>
              </div>

              {/* Value Estimate */}
              <div className="bg-catalyst-navy/5 rounded-lg p-6 text-center">
                <h3 className="text-lg font-semibold text-catalyst-gray-900 mb-4">
                  Estimated Property Value
                </h3>
                <div className="text-4xl font-bold text-catalyst-navy mb-2">
                  ${result.estimatedValue.toLocaleString()}
                </div>
                <div className="text-sm text-catalyst-gray-600">
                  Based on ${result.pricePerAcreRange.low.toLocaleString()} - ${result.pricePerAcreRange.high.toLocaleString()} per acre
                  <br />
                  (${result.pricePerAcreRange.midpoint.toLocaleString()}/acre × {result.acres} acres)
                </div>
              </div>

              {/* Comparable Sales */}
              <div>
                <h3 className="font-semibold text-catalyst-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-catalyst-navy" />
                  Recent Comparable Sales
                </h3>
                <div className="space-y-6">
                  {result.comparables.map((comp, index) => (
                    <div key={index} className="border border-slate-200 rounded-lg p-6 bg-white shadow-sm">
                      {/* Header with address and pricing */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="font-semibold text-lg text-catalyst-gray-900">{comp.address}</div>
                          <div className="text-sm text-catalyst-gray-600 mt-1">
                            {comp.acres} acres • {comp.distance} away • Sold {comp.saleDate}
                            {comp.daysOnMarket && (
                              <span> • {comp.daysOnMarket} days on market</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-catalyst-navy">
                            ${comp.pricePerAcre.toLocaleString()}/acre
                            {comp.priceAdjustment && comp.priceAdjustment !== 0 && (
                              <span className={`text-sm ml-2 ${comp.priceAdjustment > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ({comp.priceAdjustment > 0 ? '+' : ''}{comp.priceAdjustment}%)
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-catalyst-gray-600">
                            ${comp.salePrice.toLocaleString()} total
                          </div>
                        </div>
                      </div>

                      {/* Property Details Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                        {comp.zoning && (
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <div className="text-xs text-blue-600 font-medium uppercase tracking-wide">Zoning</div>
                            <div className="text-sm font-semibold text-blue-900">{comp.zoning}</div>
                          </div>
                        )}
                        
                        {comp.topography && (
                          <div className="bg-green-50 p-3 rounded-lg">
                            <div className="text-xs text-green-600 font-medium uppercase tracking-wide">Topography</div>
                            <div className="text-sm font-semibold text-green-900">{comp.topography}</div>
                          </div>
                        )}
                        
                        {comp.accessType && (
                          <div className="bg-purple-50 p-3 rounded-lg">
                            <div className="text-xs text-purple-600 font-medium uppercase tracking-wide">Access</div>
                            <div className="text-sm font-semibold text-purple-900">{comp.accessType}</div>
                          </div>
                        )}
                        
                        {comp.sellerType && (
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-xs text-gray-600 font-medium uppercase tracking-wide">Seller Type</div>
                            <div className="text-sm font-semibold text-gray-900">{comp.sellerType}</div>
                          </div>
                        )}
                        
                        {comp.marketConditions && (
                          <div className="bg-yellow-50 p-3 rounded-lg">
                            <div className="text-xs text-yellow-600 font-medium uppercase tracking-wide">Market Conditions</div>
                            <div className="text-sm font-semibold text-yellow-900">{comp.marketConditions}</div>
                          </div>
                        )}
                        
                        {comp.propertyType && (
                          <div className="bg-indigo-50 p-3 rounded-lg">
                            <div className="text-xs text-indigo-600 font-medium uppercase tracking-wide">Property Type</div>
                            <div className="text-sm font-semibold text-indigo-900">{comp.propertyType}</div>
                          </div>
                        )}
                      </div>

                      {/* Development Potential */}
                      {comp.developmentPotential && (
                        <div className="bg-catalyst-navy/5 rounded-lg p-4 mb-4">
                          <div className="text-xs text-catalyst-navy font-medium uppercase tracking-wide mb-1">Development Potential</div>
                          <div className="text-sm font-semibold text-catalyst-navy">{comp.developmentPotential}</div>
                        </div>
                      )}

                      {/* Utilities */}
                      {comp.utilities && comp.utilities.length > 0 && (
                        <div className="mb-4">
                          <div className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-2">Available Utilities</div>
                          <div className="flex flex-wrap gap-2">
                            {comp.utilities.map((utility, idx) => (
                              <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {utility}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Proximity Features */}
                      {comp.proximityFeatures && comp.proximityFeatures.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-2">Nearby Features</div>
                          <div className="flex flex-wrap gap-2">
                            {comp.proximityFeatures.map((feature, idx) => (
                              <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-catalyst-gold/20 text-catalyst-navy">
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Disclaimer */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-yellow-800">
                    <strong>Important:</strong> This is a quick estimate only, not a professional appraisal. 
                    Actual value may vary based on zoning, utilities, topography, market conditions, and other factors.
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <Button 
                  onClick={handleSubmitToCatalyst}
                  className="flex-1 bg-catalyst-gold hover:bg-catalyst-gold/90 text-catalyst-navy font-semibold"
                  data-testid="button-submit-deal"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Submit Deal to Catalyst for Deeper Analysis
                </Button>
                <Button 
                  onClick={resetTool}
                  variant="outline"
                  className="px-8"
                  data-testid="button-reset"
                >
                  New Analysis
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}