import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Target } from "lucide-react";

interface CommissionTier {
  dealNumber: number;
  atRezoningRate: number;
  atClosingRate: number;
  gpPromoteRate: number;
}

interface CommissionTierDisplayProps {
  currentTier: CommissionTier;
  nextTier: CommissionTier;
  dealsToNext: number;
  progressPercent: number;
  description: string;
  totalDeals: number;
}

export function CommissionTierDisplay({
  currentTier,
  nextTier,
  dealsToNext,
  progressPercent,
  description,
  totalDeals
}: CommissionTierDisplayProps) {
  return (
    <Card className="bg-gradient-to-br from-catalyst-dark-blue/5 to-catalyst-gold/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-catalyst-dark-blue">
          <TrendingUp className="h-5 w-5" />
          Commission Structure
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Tier Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-catalyst-gray-600">At Rezoning</span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              +{currentTier.atRezoningRate.toFixed(1)}%
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-catalyst-gray-600">At Closing</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              +{currentTier.atClosingRate.toFixed(1)}%
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-catalyst-gold" />
              <span className="text-sm font-medium text-catalyst-gray-600">GP Promote</span>
            </div>
            <div className="text-2xl font-bold text-catalyst-gold">
              {currentTier.gpPromoteRate.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Progress to Next Tier */}
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-catalyst-gray-600">
              Progress to Next Tier
            </span>
            <Badge variant="outline" className="text-catalyst-dark-blue border-catalyst-dark-blue">
              {totalDeals} deals completed
            </Badge>
          </div>
          
          <Progress 
            value={progressPercent} 
            className="mb-3 h-3"
            data-testid="progress-commission-tier"
          />
          
          <div className="flex justify-between items-center text-sm">
            <span className="text-catalyst-gray-600">
              {dealsToNext} more deals for next tier
            </span>
            <span className="font-medium text-catalyst-dark-blue">
              Next: {nextTier.gpPromoteRate.toFixed(1)}% GP Promote
            </span>
          </div>
        </div>

        {/* Commission Rates Comparison */}
        <div className="bg-white p-4 rounded-lg border">
          <h4 className="font-medium text-catalyst-gray-800 mb-3">Next Tier Benefits</h4>
          <div className="grid grid-cols-1 gap-4 text-sm">
            <div>
              <span className="text-catalyst-gray-600">Rezoning Rate:</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">+{currentTier.atRezoningRate.toFixed(1)}%</span>
                <span className="text-catalyst-gray-400">→</span>
                <span className="font-medium text-green-600">
                  +{nextTier.atRezoningRate.toFixed(1)}%
                </span>
                <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                  +{(nextTier.atRezoningRate - currentTier.atRezoningRate).toFixed(1)}%
                </Badge>
              </div>
            </div>
            
            <div>
              <span className="text-catalyst-gray-600">Closing Rate:</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">+{currentTier.atClosingRate.toFixed(1)}%</span>
                <span className="text-catalyst-gray-400">→</span>
                <span className="font-medium text-blue-600">
                  +{nextTier.atClosingRate.toFixed(1)}%
                </span>
                <Badge variant="outline" className="text-xs text-blue-600 border-blue-600">
                  +{(nextTier.atClosingRate - currentTier.atClosingRate).toFixed(1)}%
                </Badge>
              </div>
            </div>
            
            <div>
              <span className="text-catalyst-gray-600">GP Promote:</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{currentTier.gpPromoteRate.toFixed(1)}%</span>
                <span className="text-catalyst-gray-400">→</span>
                <span className="font-medium text-catalyst-gold">
                  {nextTier.gpPromoteRate.toFixed(1)}%
                </span>
                <Badge variant="outline" className="text-xs text-catalyst-gold border-catalyst-gold">
                  +{(nextTier.gpPromoteRate - currentTier.gpPromoteRate).toFixed(1)}%
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Commission Structure Description */}
        <div className="text-xs text-catalyst-gray-600 bg-catalyst-gray-50 p-3 rounded-lg">
          <p className="font-medium mb-1">How it works:</p>
          <p>Commission rates climb in 0.1% increments every 5 completed deals. All percentages are <strong>in addition to your standard commission</strong>. Start with +1% at rezoning, +1% at closing, and 2.0% GP Promote.</p>
        </div>
      </CardContent>
    </Card>
  );
}