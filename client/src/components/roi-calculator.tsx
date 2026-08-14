import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calculator, TrendingUp, DollarSign, Target, AlertTriangle, CheckCircle } from 'lucide-react';

interface ROICalculation {
  acquisitionCost: number;
  developmentCost: number;
  totalInvestment: number;
  projectedSalePrice: number;
  grossProfit: number;
  profitMargin: number;
  roi: number;
  breakEvenPrice: number;
  timeToBreakEven: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: string;
}

interface ROIInputs {
  landPrice: number;
  acreage: number;
  zoningType: string;
  developmentType: string;
  marketComps: number;
  timeHorizon: number;
}

export function ROICalculator() {
  const [inputs, setInputs] = useState<ROIInputs>({
    landPrice: 0,
    acreage: 0,
    zoningType: 'residential',
    developmentType: 'Lot Development',
    marketComps: 0,
    timeHorizon: 24
  });

  const [calculation, setCalculation] = useState<ROICalculation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Development cost estimates per acre based on type
  const developmentCosts = {
    'Lot Development': {
      base: 45000, // Base cost per acre
      infrastructure: 25000,
      permits: 8000,
      contingency: 0.15
    },
    'BTR': {
      base: 65000,
      infrastructure: 35000,
      permits: 12000,
      contingency: 0.18
    },
    'Active Adult': {
      base: 75000,
      infrastructure: 40000,
      permits: 15000,
      contingency: 0.18
    },
    'Conventional Apartments': {
      base: 85000,
      infrastructure: 45000,
      permits: 18000,
      contingency: 0.20
    }
  };

  // Market multipliers based on zoning
  const zoningMultipliers = {
    'residential': 1.0,
    'commercial': 1.3,
    'industrial': 0.9,
    'mixed-use': 1.2,
    'agricultural': 0.7
  };

  const calculateROI = () => {
    setIsCalculating(true);
    
    setTimeout(() => {
      const devType = inputs.developmentType as keyof typeof developmentCosts;
      const zoneType = inputs.zoningType as keyof typeof zoningMultipliers;
      
      const costs = developmentCosts[devType] || developmentCosts['Lot Development'];
      const zoneMultiplier = zoningMultipliers[zoneType] || 1.0;
      
      // Calculate development costs
      const baseCost = costs.base * inputs.acreage;
      const infraCost = costs.infrastructure * inputs.acreage;
      const permitCost = costs.permits * inputs.acreage;
      const subtotal = baseCost + infraCost + permitCost;
      const contingency = subtotal * costs.contingency;
      const developmentCost = subtotal + contingency;
      
      // Apply zoning multiplier
      const adjustedDevelopmentCost = developmentCost * zoneMultiplier;
      
      // Total investment
      const acquisitionCost = inputs.landPrice;
      const totalInvestment = acquisitionCost + adjustedDevelopmentCost;
      
      // Projected sale price (using market comps with development potential)
      const projectedSalePrice = inputs.marketComps * inputs.acreage * 1.15; // 15% premium for development potential
      
      // Calculate returns
      const grossProfit = projectedSalePrice - totalInvestment;
      const profitMargin = (grossProfit / projectedSalePrice) * 100;
      const roi = (grossProfit / totalInvestment) * 100;
      
      // Break-even analysis
      const breakEvenPrice = totalInvestment / inputs.acreage;
      const timeToBreakEven = Math.max(inputs.timeHorizon - 6, 12); // Conservative estimate
      
      // Risk assessment
      let riskLevel: 'low' | 'medium' | 'high' = 'medium';
      let recommendation = '';
      
      if (roi > 25 && profitMargin > 20) {
        riskLevel = 'low';
        recommendation = 'Excellent deal - Strong ROI with healthy profit margins';
      } else if (roi > 15 && profitMargin > 15) {
        riskLevel = 'medium';
        recommendation = 'Good opportunity - Solid returns with manageable risk';
      } else if (roi > 8 && profitMargin > 10) {
        riskLevel = 'medium';
        recommendation = 'Fair deal - Modest returns, evaluate market conditions';
      } else {
        riskLevel = 'high';
        recommendation = 'High risk - Low margins, consider alternative strategies';
      }
      
      setCalculation({
        acquisitionCost,
        developmentCost: adjustedDevelopmentCost,
        totalInvestment,
        projectedSalePrice,
        grossProfit,
        profitMargin,
        roi,
        breakEvenPrice,
        timeToBreakEven,
        riskLevel,
        recommendation
      });
      
      setIsCalculating(false);
    }, 1000);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (percent: number) => {
    return `${percent.toFixed(1)}%`;
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getROIIcon = (roi: number) => {
    if (roi > 20) return <CheckCircle className="text-green-600" size={20} />;
    if (roi > 10) return <TrendingUp className="text-yellow-600" size={20} />;
    return <AlertTriangle className="text-red-600" size={20} />;
  };

  return (
    <div className="space-y-6" data-testid="roi-calculator">
      <Card className="border-catalyst-gray-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-catalyst-gold bg-opacity-10 flex items-center justify-center rounded-lg">
              <Calculator className="text-catalyst-gold" size={20} />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold text-catalyst-gray-900 tracking-tight">
                <span className="allow-wrap">Quick ROI Calculator</span>
              </CardTitle>
              <p className="text-sm text-catalyst-gray-500 mt-1">
                <span className="allow-wrap">Instantly analyze deal profitability and development potential</span>
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Input Form */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-catalyst-gray-900 mb-4">
                <span className="allow-wrap">Property Details</span>
              </h3>
              
              <div className="space-y-2">
                <Label htmlFor="land-price" className="text-sm font-medium text-catalyst-gray-700">
                  <span className="allow-wrap">Land Acquisition Price</span>
                </Label>
                <Input
                  id="land-price"
                  type="number"
                  placeholder="$500,000"
                  value={inputs.landPrice || ''}
                  onChange={(e) => setInputs({...inputs, landPrice: Number(e.target.value)})}
                  data-testid="input-land-price"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="acreage" className="text-sm font-medium text-catalyst-gray-700">
                  <span className="allow-wrap">Total Acreage</span>
                </Label>
                <Input
                  id="acreage"
                  type="number"
                  step="0.1"
                  placeholder="5.0"
                  value={inputs.acreage || ''}
                  onChange={(e) => setInputs({...inputs, acreage: Number(e.target.value)})}
                  data-testid="input-acreage"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zoning" className="text-sm font-medium text-catalyst-gray-700">
                  <span className="allow-wrap">Current Zoning</span>
                </Label>
                <select
                  id="zoning"
                  className="w-full px-3 py-2 border border-catalyst-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-catalyst-gold"
                  value={inputs.zoningType}
                  onChange={(e) => setInputs({...inputs, zoningType: e.target.value})}
                  data-testid="select-zoning"
                >
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                  <option value="mixed-use">Mixed Use</option>
                  <option value="agricultural">Agricultural</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="development-type" className="text-sm font-medium text-catalyst-gray-700">
                  <span className="allow-wrap">Development Type</span>
                </Label>
                <select
                  id="development-type"
                  className="w-full px-3 py-2 border border-catalyst-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-catalyst-gold"
                  value={inputs.developmentType}
                  onChange={(e) => setInputs({...inputs, developmentType: e.target.value})}
                  data-testid="select-development-type"
                >
                  <option value="Active Adult">Active Adult</option>
                  <option value="BTR">BTR</option>
                  <option value="Conventional Apartments">Conventional Apartments</option>
                  <option value="Lot Development">Lot Development</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="market-comps" className="text-sm font-medium text-catalyst-gray-700">
                  <span className="allow-wrap">Market Comps (per acre)</span>
                </Label>
                <Input
                  id="market-comps"
                  type="number"
                  placeholder="$150,000"
                  value={inputs.marketComps || ''}
                  onChange={(e) => setInputs({...inputs, marketComps: Number(e.target.value)})}
                  data-testid="input-market-comps"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time-horizon" className="text-sm font-medium text-catalyst-gray-700">
                  <span className="allow-wrap">Development Timeline (months)</span>
                </Label>
                <Input
                  id="time-horizon"
                  type="number"
                  placeholder="24"
                  value={inputs.timeHorizon || ''}
                  onChange={(e) => setInputs({...inputs, timeHorizon: Number(e.target.value)})}
                  data-testid="input-time-horizon"
                />
              </div>

              <Button
                onClick={calculateROI}
                disabled={isCalculating || !inputs.landPrice || !inputs.acreage || !inputs.marketComps}
                className="w-full bg-catalyst-gold hover:bg-catalyst-gold-dark text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
                data-testid="button-calculate-roi"
              >
                {isCalculating ? (
                  <span className="allow-wrap">Calculating...</span>
                ) : (
                  <span className="allow-wrap">Calculate ROI</span>
                )}
              </Button>
            </div>

            {/* Results */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-catalyst-gray-900 mb-4">
                <span className="allow-wrap">Financial Analysis</span>
              </h3>
              
              {calculation ? (
                <div className="space-y-4">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-catalyst-gray-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <TrendingUp className="text-catalyst-gold" size={16} />
                        <span className="text-sm font-medium text-catalyst-gray-700">
                          <span className="allow-wrap">ROI</span>
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getROIIcon(calculation.roi)}
                        <span className="text-xl font-bold text-catalyst-gray-900" data-testid="result-roi">
                          {formatPercentage(calculation.roi)}
                        </span>
                      </div>
                    </div>

                    <div className="bg-catalyst-gray-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <DollarSign className="text-catalyst-gold" size={16} />
                        <span className="text-sm font-medium text-catalyst-gray-700">
                          <span className="allow-wrap">Profit Margin</span>
                        </span>
                      </div>
                      <span className="text-xl font-bold text-catalyst-gray-900" data-testid="result-profit-margin">
                        {formatPercentage(calculation.profitMargin)}
                      </span>
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="bg-white border border-catalyst-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-catalyst-gray-900 mb-3">
                      <span className="allow-wrap">Financial Breakdown</span>
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-catalyst-gray-600">
                          <span className="allow-wrap">Land Acquisition:</span>
                        </span>
                        <span className="font-medium" data-testid="result-acquisition-cost">
                          {formatCurrency(calculation.acquisitionCost)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-catalyst-gray-600">
                          <span className="allow-wrap">Development Costs:</span>
                        </span>
                        <span className="font-medium" data-testid="result-development-cost">
                          {formatCurrency(calculation.developmentCost)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-catalyst-gray-100 pt-2">
                        <span className="font-medium text-catalyst-gray-900">
                          <span className="allow-wrap">Total Investment:</span>
                        </span>
                        <span className="font-bold" data-testid="result-total-investment">
                          {formatCurrency(calculation.totalInvestment)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-catalyst-gray-600">
                          <span className="allow-wrap">Projected Sale Price:</span>
                        </span>
                        <span className="font-medium" data-testid="result-sale-price">
                          {formatCurrency(calculation.projectedSalePrice)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-catalyst-gray-100 pt-2">
                        <span className="font-medium text-green-700">
                          <span className="allow-wrap">Gross Profit:</span>
                        </span>
                        <span className="font-bold text-green-700" data-testid="result-gross-profit">
                          {formatCurrency(calculation.grossProfit)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Risk Assessment */}
                  <div className="bg-white border border-catalyst-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-catalyst-gray-900 mb-3">
                      <span className="allow-wrap">Risk Assessment</span>
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-catalyst-gray-600">
                          <span className="allow-wrap">Risk Level:</span>
                        </span>
                        <Badge className={`${getRiskColor(calculation.riskLevel)} border-none`} data-testid="result-risk-level">
                          {calculation.riskLevel.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-catalyst-gray-600">
                          <span className="allow-wrap">Break-Even Price:</span>
                        </span>
                        <span className="font-medium" data-testid="result-breakeven-price">
                          {formatCurrency(calculation.breakEvenPrice)}/acre
                        </span>
                      </div>
                      <div className="bg-catalyst-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-catalyst-gray-700" data-testid="result-recommendation">
                          <span className="allow-wrap">{calculation.recommendation}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-catalyst-gray-300 text-catalyst-gray-700 hover:bg-catalyst-gray-50"
                      data-testid="button-share-analysis"
                    >
                      <span className="allow-wrap">Share Analysis</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-catalyst-gray-300 text-catalyst-gray-700 hover:bg-catalyst-gray-50"
                      data-testid="button-save-calculation"
                    >
                      <span className="allow-wrap">Save Calculation</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-catalyst-gray-500">
                  <Target className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-sm text-center">
                    <span className="allow-wrap">Enter property details to see financial analysis and ROI calculations</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}