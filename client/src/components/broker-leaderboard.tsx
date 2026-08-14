import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Star, TrendingUp, Award } from "lucide-react";

interface BrokerStats {
  id: string;
  name: string;
  email: string;
  totalDeals: number;
  approvedDeals: number;
  totalValue: number;
  successRate: number;
  avgResponseTime: number;
  lastDealDate: string;
  rank: number;
}

export function BrokerLeaderboard() {
  const [brokers, setBrokers] = useState<BrokerStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch('/api/brokers/leaderboard');
      if (response.ok) {
        const data = await response.json();
        setBrokers(data);
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Award className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <Star className="w-5 h-5 text-gray-300" />;
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-yellow-500 text-white">TOP PERFORMER</Badge>;
    if (rank <= 3) return <Badge className="bg-blue-500 text-white">TOP 3</Badge>;
    if (rank <= 10) return <Badge variant="secondary">TOP 10</Badge>;
    return null;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Broker Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Broker Leaderboard
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Rankings based on deal approval rate, total value, and activity
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {brokers.map((broker, index) => (
              <div 
                key={broker.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  broker.rank === 1 ? 'bg-yellow-50 border-yellow-200' :
                  broker.rank <= 3 ? 'bg-blue-50 border-blue-200' :
                  'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-2xl text-gray-400">#{broker.rank}</span>
                    {getRankIcon(broker.rank)}
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-lg">{broker.name}</h3>
                    <p className="text-sm text-muted-foreground">{broker.email}</p>
                    {getRankBadge(broker.rank)}
                  </div>
                </div>

                <div className="text-right">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Deals</p>
                      <p className="font-semibold text-lg">{broker.totalDeals}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Success Rate</p>
                      <p className="font-semibold text-lg text-green-600">
                        {broker.successRate}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Value</p>
                      <p className="font-semibold text-lg">
                        ${broker.totalValue.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Approved</p>
                      <p className="font-semibold text-lg text-blue-600">
                        {broker.approvedDeals}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {brokers.length === 0 && (
            <div className="text-center py-8">
              <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-muted-foreground">No broker activity yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}