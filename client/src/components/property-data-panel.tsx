import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, DollarSign, Home, TrendingUp, AlertCircle, Zap } from "lucide-react";

interface PropertyDataPanelProps {
  dealId: string;
  address: string;
}

interface PropertyData {
  rentEstimate?: any;
  property?: any;
  marketData?: any;
}

interface DevelopmentAnalysis {
  property?: any;
  development?: any;
}

interface ComparableProperty {
  address: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  yearBuilt?: number;
  rent?: number;
  rentPerSqFt?: number;
  distance?: number;
  propertyType?: string;
  qualityScore?: number;
  managementCompany?: string;
  units?: number;
}

interface ComparablesData {
  comparables?: ComparableProperty[];
  metadata?: {
    averageRent?: number;
    averageAge?: number;
    searchRadius?: number;
  };
}

export default function PropertyDataPanel({ dealId, address }: PropertyDataPanelProps) {
  // PERFORMANCE OPTIMIZATION: Use single comprehensive API call instead of 3 separate calls
  // This reduces HelloData rate limiting and improves load times
  console.log('🏠 PropertyDataPanel props:', { dealId, address, dealIdType: typeof dealId, addressLength: address?.length });
  
  const { data: propertyAnalysis, isLoading, error } = useQuery<any>({
    queryKey: ['/api/property-analysis', dealId],
    enabled: !!dealId && !!address,
    staleTime: 30 * 60 * 1000, // OPTIMIZED: Cache for 30 minutes (data rarely changes)
    gcTime: 60 * 60 * 1000,    // OPTIMIZED: Keep in cache for 1 hour
    refetchOnWindowFocus: false, // Prevent unnecessary API calls
    retry: 1, // OPTIMIZED: Only retry once instead of 3 times
    retryDelay: 1000, // OPTIMIZED: Faster retry (1 second)
  });

  console.log('🏠 PropertyDataPanel query state:', { 
    dealId, 
    address, 
    enabled: !!dealId && !!address,
    isLoading, 
    hasData: !!propertyAnalysis,
    error: error?.message 
  });

  // Extract data from comprehensive property analysis response
  const propertyData = propertyAnalysis?.propertyData;
  const developmentAnalysis = propertyAnalysis?.developmentAnalysis;
  const comparables = propertyAnalysis?.marketAnalysis;

  if (!address) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p>Property address required for market analysis</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-600">Loading property data...</p>
        </CardContent>
      </Card>
    );
  }

  const rentEstimate = propertyData?.rentEstimate;
  const property = propertyData?.property || developmentAnalysis?.property;
  const development = developmentAnalysis?.development;
  const marketData = propertyData?.marketData;

  // Show only rental comparables
  return (
    <div className="space-y-4">
      {/* Enhanced Rent Comparables */}
      {comparables?.comparables && comparables.comparables.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Rent Comparables Analysis
              <Badge variant="outline" className="ml-auto">
                {comparables.comparables.length} properties
              </Badge>
            </CardTitle>
            {comparables.metadata && (
              <div className="flex gap-4 text-sm text-gray-600">
                {comparables.metadata.averageRent && (
                  <span>Avg Rent: ${comparables.metadata.averageRent.toLocaleString()}/mo</span>
                )}
                {comparables.metadata.averageAge && (
                  <span>Avg Age: {Math.round(comparables.metadata.averageAge)} years</span>
                )}
                {comparables.metadata.searchRadius && (
                  <span>Within {comparables.metadata.searchRadius} miles</span>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {/* Simple table showing only requested fields */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium text-gray-900">Property Name</th>
                    <th className="text-left p-3 font-medium text-gray-900">Address</th>
                    <th className="text-right p-3 font-medium text-gray-900">Average Rent</th>
                    <th className="text-right p-3 font-medium text-gray-900">Rent per Sq Ft</th>
                    <th className="text-center p-3 font-medium text-gray-900">Year Built</th>
                    <th className="text-center p-3 font-medium text-gray-900">Distance (Miles)</th>
                  </tr>
                </thead>
                <tbody>
                  {comparables.comparables.map((comp: ComparableProperty, index: number) => (
                    <tr key={index} className="border-b hover:bg-gray-50" data-testid={`comparable-row-${index}`}>
                      <td className="p-3 text-gray-700 font-medium" data-testid={`comparable-name-${index}`}>
                        {(comp as any).propertyName || (comp as any).name || '-'}
                      </td>
                      <td className="p-3 text-gray-900" data-testid={`comparable-address-${index}`}>
                        {comp.address || 'Address not available'}
                      </td>
                      <td className="p-3 text-right font-medium text-green-600" data-testid={`comparable-rent-${index}`}>
                        {comp.rent ? `$${comp.rent.toLocaleString()}/mo` : 'N/A'}
                      </td>
                      <td className="p-3 text-right text-gray-700" data-testid={`comparable-rent-psf-${index}`}>
                        {comp.rentPerSqFt ? `$${comp.rentPerSqFt.toFixed(2)}/sf` : 'N/A'}
                      </td>
                      <td className="p-3 text-center text-gray-700" data-testid={`comparable-year-built-${index}`}>
                        {comp.yearBuilt || 'N/A'}
                      </td>
                      <td className="p-3 text-center text-gray-600" data-testid={`comparable-distance-${index}`}>
                        {comp.distance ? `${comp.distance.toFixed(1)} mi` : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Show All Button if more than 8 comparables */}
            {comparables.comparables.length > 8 && (
              <div className="text-center mt-4">
                <Button variant="outline" size="sm">
                  View All {comparables.comparables.length} Comparables
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>No rental comparables found for this location</p>
            <p className="text-sm">No comparable properties found for this address</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}