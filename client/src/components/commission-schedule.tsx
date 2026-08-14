import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calculator, TrendingUp } from "lucide-react";

interface CommissionTier {
  dealNumber: number;
  atRezoningRate: number;
  atClosingRate: number;
  gpPromoteRate: number;
}

interface CommissionScheduleProps {
  schedule: CommissionTier[];
  currentDealCount: number;
}

export function CommissionSchedule({ schedule, currentDealCount }: CommissionScheduleProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-catalyst-dark-blue">
          <Calculator className="h-5 w-5" />
          Commission Rate Schedule
        </CardTitle>
        <p className="text-sm text-catalyst-gray-600">
          Commission rates climb 0.1% every 5 deals from base rates
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-2">
            {schedule.slice(0, 25).map((tier, index) => {
              const isCurrentTier = tier.dealNumber === currentDealCount + 1;
              const isPastTier = tier.dealNumber <= currentDealCount;
              
              return (
                <div
                  key={tier.dealNumber}
                  className={`p-3 rounded-lg border transition-colors ${
                    isCurrentTier
                      ? "bg-catalyst-gold/10 border-catalyst-gold"
                      : isPastTier
                      ? "bg-green-50 border-green-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                  data-testid={`commission-tier-${tier.dealNumber}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium text-catalyst-gray-800">
                        Deal #{tier.dealNumber}
                        {index === 0 && <span className="text-catalyst-gray-500"> (Starting)</span>}
                      </div>
                      {isCurrentTier && (
                        <Badge className="bg-catalyst-gold text-white">
                          Current Tier
                        </Badge>
                      )}
                      {isPastTier && !isCurrentTier && (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          Achieved
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-xs text-catalyst-gray-500">Rezoning</div>
                        <div className="font-medium text-green-600">
                          +{tier.atRezoningRate.toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-catalyst-gray-500">Closing</div>
                        <div className="font-medium text-blue-600">
                          +{tier.atClosingRate.toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-catalyst-gray-500">GP Promote</div>
                        <div className="font-bold text-catalyst-dark-blue">
                          {tier.gpPromoteRate.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Show increment for non-first tiers */}
                  {index > 0 && tier.dealNumber % 5 === 1 && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-catalyst-gray-600">
                      <TrendingUp className="h-3 w-3" />
                      <span>Rate increase: +0.1% at each stage</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
        
        <div className="mt-4 p-3 bg-catalyst-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-catalyst-gray-800 mb-2">How Commission Climbing Works:</h4>
          <ul className="text-xs text-catalyst-gray-600 space-y-1">
            <li>• <strong>Base Rates:</strong> +1% at rezoning, +1% at closing, 2.0% GP Promote</li>
            <li>• <strong>Additional:</strong> All percentages are in addition to your standard commission</li>
            <li>• <strong>Increments:</strong> +0.1% at each stage every 5 completed deals</li>
            <li>• <strong>Example:</strong> After 10 deals, earn +1.2% rezoning, +1.2% closing, 2.2% GP Promote</li>
            <li>• <strong>No Cap:</strong> Rates continue climbing with deal volume</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}