import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  DollarSign, 
  Save, 
  AlertTriangle, 
  Info,
  Calculator,
  Upload,
  Database,
  CheckCircle
} from "lucide-react";

interface ManualRentalInputProps {
  dealId: string;
  address: string;
  currentRentData?: {
    estimatedMonthlyRent?: number;
    rentPerSqFt?: number;
    rentBasis?: string;
    confidence?: string;
    lastUpdated?: string;
  };
  onUpdate?: () => void;
  showOnlyWhenApisDown?: boolean;
}

interface ManualRentalData {
  estimatedMonthlyRent: number;
  rentPerSqFt?: number;
  rentBasis: string;
  confidence: string;
  source: string;
  notes?: string;
  localComparables?: string;
  marketConditions?: string;
}

export default function ManualRentalInput({ 
  dealId, 
  address, 
  currentRentData,
  onUpdate,
  showOnlyWhenApisDown = false
}: ManualRentalInputProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [formData, setFormData] = useState<ManualRentalData>({
    estimatedMonthlyRent: currentRentData?.estimatedMonthlyRent || 0,
    rentPerSqFt: currentRentData?.rentPerSqFt || 0,
    rentBasis: currentRentData?.rentBasis || 'manual_estimate',
    confidence: currentRentData?.confidence || 'medium',
    source: 'manual_input',
    notes: '',
    localComparables: '',
    marketConditions: ''
  });

  const updateRentalDataMutation = useMutation({
    mutationFn: async (data: ManualRentalData) => {
      const res = await apiRequest('POST', `/api/deals/${dealId}/rental-data/manual`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Rental Data Updated",
        description: "Manual rental estimates have been saved successfully.",
      });
      
      // Invalidate relevant queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}`] });
      
      if (onUpdate) {
        onUpdate();
      }
      
      setIsExpanded(false);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: `Failed to save rental data: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.estimatedMonthlyRent || formData.estimatedMonthlyRent <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid monthly rent amount greater than $0.",
        variant: "destructive",
      });
      return;
    }

    updateRentalDataMutation.mutate(formData);
  };

  const handleInputChange = (field: keyof ManualRentalData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Auto-calculate rent per sq ft when monthly rent changes
  const handleMonthlyRentChange = (value: string) => {
    const monthlyRent = parseFloat(value) || 0;
    handleInputChange('estimatedMonthlyRent', monthlyRent);
    
    // If we have square footage from other sources, auto-calculate rent per sq ft
    // This would need property data to calculate, but we'll leave it for manual entry for now
  };

  if (showOnlyWhenApisDown && currentRentData?.estimatedMonthlyRent) {
    // Only show this component when APIs are down AND no rental data exists
    return null;
  }

  const hasExistingData = currentRentData?.estimatedMonthlyRent && currentRentData.estimatedMonthlyRent > 0;

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <DollarSign className="h-5 w-5" />
          Manual Rental Data Input
          {hasExistingData && (
            <span className="text-sm font-normal text-orange-600">
              (Override Current: ${currentRentData?.estimatedMonthlyRent?.toLocaleString()}/month)
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isExpanded ? (
          <div className="space-y-3">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {hasExistingData ? (
                  <>
                    Current rental estimate: <strong>${currentRentData?.estimatedMonthlyRent?.toLocaleString()}/month</strong> 
                    {currentRentData?.confidence && (
                      <span className="text-sm"> (Confidence: {currentRentData.confidence})</span>
                    )}
                    <br />Click "Manual Override" to enter updated rental data based on local market knowledge.
                  </>
                ) : (
                  <>
                    No rental data available from automated sources. 
                    Enter manual estimates based on local market knowledge, comparable properties, or professional appraisals.
                  </>
                )}
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button
                onClick={() => setIsExpanded(true)}
                variant="outline"
                className="flex-1"
                data-testid="button-expand-manual-rental-input"
              >
                <Calculator className="h-4 w-4 mr-2" />
                {hasExistingData ? 'Manual Override' : 'Enter Rental Data'}
              </Button>
              
              {hasExistingData && (
                <div className="text-sm text-gray-600 flex items-center">
                  Last updated: {currentRentData?.lastUpdated ? 
                    new Date(currentRentData.lastUpdated).toLocaleDateString() : 
                    'Unknown'
                  }
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Monthly Rent */}
              <div>
                <Label htmlFor="monthlyRent" className="text-sm font-medium">
                  Estimated Monthly Rent *
                </Label>
                <div className="relative mt-1">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="monthlyRent"
                    type="number"
                    placeholder="2500"
                    value={formData.estimatedMonthlyRent || ''}
                    onChange={(e) => handleMonthlyRentChange(e.target.value)}
                    className="pl-10"
                    required
                    data-testid="input-monthly-rent"
                  />
                </div>
              </div>

              {/* Rent Per Sq Ft */}
              <div>
                <Label htmlFor="rentPerSqFt" className="text-sm font-medium">
                  Rent Per Sq Ft (Optional)
                </Label>
                <Input
                  id="rentPerSqFt"
                  type="number"
                  step="0.01"
                  placeholder="1.25"
                  value={formData.rentPerSqFt || ''}
                  onChange={(e) => handleInputChange('rentPerSqFt', parseFloat(e.target.value) || 0)}
                  data-testid="input-rent-per-sqft"
                />
              </div>

              {/* Confidence Level */}
              <div>
                <Label htmlFor="confidence" className="text-sm font-medium">
                  Confidence Level
                </Label>
                <select
                  id="confidence"
                  value={formData.confidence}
                  onChange={(e) => handleInputChange('confidence', e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="select-confidence-level"
                >
                  <option value="high">High - Based on recent comparables or professional appraisal</option>
                  <option value="medium">Medium - Based on local market knowledge</option>
                  <option value="low">Low - Rough estimate requiring verification</option>
                </select>
              </div>

              {/* Rent Basis */}
              <div>
                <Label htmlFor="rentBasis" className="text-sm font-medium">
                  Estimate Basis
                </Label>
                <select
                  id="rentBasis"
                  value={formData.rentBasis}
                  onChange={(e) => handleInputChange('rentBasis', e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="select-rent-basis"
                >
                  <option value="manual_estimate">Manual Estimate</option>
                  <option value="comparable_analysis">Comparable Properties Analysis</option>
                  <option value="professional_appraisal">Professional Appraisal</option>
                  <option value="current_lease">Current Lease Agreement</option>
                  <option value="market_analysis">Local Market Analysis</option>
                </select>
              </div>
            </div>

            {/* Local Comparables */}
            <div>
              <Label htmlFor="localComparables" className="text-sm font-medium">
                Local Comparables (Optional)
              </Label>
              <Textarea
                id="localComparables"
                placeholder="List similar properties and their rental rates in the area..."
                value={formData.localComparables}
                onChange={(e) => handleInputChange('localComparables', e.target.value)}
                rows={3}
                data-testid="textarea-local-comparables"
              />
            </div>

            {/* Market Conditions */}
            <div>
              <Label htmlFor="marketConditions" className="text-sm font-medium">
                Market Conditions & Notes (Optional)
              </Label>
              <Textarea
                id="marketConditions"
                placeholder="Note any market conditions, upcoming developments, or factors affecting rental rates..."
                value={formData.marketConditions}
                onChange={(e) => handleInputChange('marketConditions', e.target.value)}
                rows={3}
                data-testid="textarea-market-conditions"
              />
            </div>

            {/* General Notes */}
            <div>
              <Label htmlFor="notes" className="text-sm font-medium">
                Additional Notes (Optional)
              </Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes about the rental estimate..."
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={2}
                data-testid="textarea-notes"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                type="submit"
                disabled={updateRentalDataMutation.isPending}
                className="flex-1"
                data-testid="button-save-rental-data"
              >
                {updateRentalDataMutation.isPending ? (
                  <>
                    <Upload className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Rental Data
                  </>
                )}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsExpanded(false)}
                disabled={updateRentalDataMutation.isPending}
                data-testid="button-cancel-rental-input"
              >
                Cancel
              </Button>
            </div>

            {/* Data Source Indicator */}
            <Alert>
              <Database className="h-4 w-4" />
              <AlertDescription className="text-xs">
                This data will be marked as manually entered and will take precedence over automated estimates. 
                Include your confidence level and sources for future reference.
              </AlertDescription>
            </Alert>
          </form>
        )}
      </CardContent>
    </Card>
  );
}