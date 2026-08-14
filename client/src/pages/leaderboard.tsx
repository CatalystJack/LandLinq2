import Footer from "@/components/footer";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal, Award, TrendingUp, Users, Share2, Building2, MapPin, ExternalLink } from "lucide-react";
import { FaLinkedin, FaTwitter } from "react-icons/fa";
import Navigation from "@/components/navigation";

interface LeaderboardEntry {
  id: string;
  name: string;
  brokerage: string;
  totalDeals?: number;
  approvedDeals?: number;
  totalReferrals?: number;
  totalPoints: number;
  marketsCovered: string;
  currentLevel: number;
  referralCode?: string;
}

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState("submitters");

  const { data: topSubmitters, isLoading: loadingSubmitters, error: submittersError } = useQuery({
    queryKey: ["/api/leaderboards/top-submitters"],
    refetchInterval: 30000, // Refresh every 30 seconds for live rankings
    queryFn: async () => {
      try {
        const response = await fetch("/api/leaderboards/top-submitters");
        if (!response.ok) {
          throw new Error("Failed to fetch submitters leaderboard");
        }
        const data = await response.json();
        // Ensure data is an array and has proper structure
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching submitters:", error);
        return [];
      }
    },
    retry: false,
  });

  const { data: topReferrers, isLoading: loadingReferrers, error: referrersError } = useQuery({
    queryKey: ["/api/leaderboards/top-referrers"],
    refetchInterval: 30000,
    queryFn: async () => {
      try {
        const response = await fetch("/api/leaderboards/top-referrers");
        if (!response.ok) {
          throw new Error("Failed to fetch referrers leaderboard");
        }
        const data = await response.json();
        // Ensure data is an array and has proper structure
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching referrers:", error);
        return [];
      }
    },
    retry: false,
  });


  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-6 w-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-400" />;
    if (rank === 3) return <Award className="h-6 w-6 text-amber-600" />;
    return <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-catalyst-gray-600">#{rank}</span>;
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    if (rank === 2) return "bg-gray-100 text-gray-800 border-gray-200";
    if (rank === 3) return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-catalyst-gray-100 text-catalyst-gray-800 border-catalyst-gray-200";
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: "LandLinq Broker Leaderboards",
        text: "Check out the top-performing brokers on LandLinq!",
        url: url,
      });
    } else {
      navigator.clipboard.writeText(url);
      // Could add a toast notification here
    }
  };

  const shareToLinkedIn = (broker: LeaderboardEntry, rank: number, isSubmitter: boolean) => {
    const achievementText = isSubmitter 
      ? `I'm ranked #${rank} on the LandLinq broker leaderboard with ${broker.totalDeals} deals submitted and ${broker.approvedDeals} approved! 🏆`
      : `I'm ranked #${rank} for growing the LandLinq broker network with ${broker.totalReferrals} successful referrals! 🌟`;
    
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${encodeURIComponent(`${achievementText}\n\nJoin me on LandLinq - the premier platform where brokers submit land deals to Catalyst Capital Partners and get ranked for their success! 💪\n\n#RealEstate #LandDeals #BrokerLife #LandLinq`)}`;
    window.open(url, '_blank');
  };

  const shareToTwitter = (broker: LeaderboardEntry, rank: number, isSubmitter: boolean) => {
    const achievementText = isSubmitter 
      ? `Ranked #${rank} on @LandLinq leaderboard! ${broker.totalDeals} deals submitted, ${broker.approvedDeals} approved 🏆`
      : `Ranked #${rank} for growing @LandLinq network! ${broker.totalReferrals} referrals 🌟`;
    
    const text = `${achievementText}\n\nJoin the top brokers submitting land deals to @CatalystCP! 💪\n\n#RealEstate #LandDeals #BrokerLife`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-catalyst-gray-50 to-white">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8 px-4">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-catalyst-gold" />
            <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-catalyst-gold to-amber-600 bg-clip-text text-transparent whitespace-nowrap">
              Broker Leaderboards
            </h1>
          </div>
          <p className="text-sm sm:text-lg text-catalyst-gray-600 max-w-2xl mx-auto px-2">
            Celebrating our top-performing real estate brokers who are leading the way in land acquisition deals
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 mt-4">
            <Badge variant="outline" className="text-catalyst-gray-600">
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Updated Live
            </Badge>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleShare}
              className="border-catalyst-gold text-catalyst-gold hover:bg-catalyst-gold hover:text-white text-sm"
            >
              <Share2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Share
            </Button>
          </div>
        </div>

        {/* Performance Tabs */}
        <div className="w-full mb-6 sm:mb-8">
          <div className="flex bg-catalyst-gray-100 rounded-lg p-1 max-w-2xl mx-auto">
            <Button
              onClick={() => setActiveTab('submitters')}
              className={`flex items-center gap-1 sm:gap-2 rounded-md px-3 py-3 transition-all duration-200 flex-1 text-xs sm:text-sm font-medium ${
                activeTab === 'submitters'
                  ? 'bg-catalyst-navy text-white border border-catalyst-navy'
                  : 'bg-transparent text-catalyst-gray-700 hover:bg-catalyst-gray-200'
              }`}
              data-testid="button-submitters-tab"
            >
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="whitespace-nowrap">Deal Submitters</span>
            </Button>
            <Button
              onClick={() => setActiveTab('referrers')}
              className={`flex items-center gap-1 sm:gap-2 rounded-md px-3 py-3 transition-all duration-200 flex-1 text-xs sm:text-sm font-medium ${
                activeTab === 'referrers'
                  ? 'bg-catalyst-navy text-white border border-catalyst-navy'
                  : 'bg-transparent text-catalyst-gray-700 hover:bg-catalyst-gray-200'
              }`}
              data-testid="button-referrers-tab"
            >
              <Users className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="whitespace-nowrap">Referrers</span>
            </Button>
          </div>
        </div>

        <div className="w-full">
          {/* Top Deal Submitters */}
          {activeTab === "submitters" && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl sm:text-2xl font-semibold text-catalyst-gray-900 mb-2">Most Active Deal Submitters</h2>
              <p className="text-sm sm:text-base text-catalyst-gray-600 px-4">Brokers who consistently bring us the best opportunities</p>
            </div>

            {loadingSubmitters ? (
              <div className="grid gap-4">
                {[...Array(5)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-catalyst-gray-200 rounded-full" />
                        <div className="flex-1">
                          <div className="h-4 bg-catalyst-gray-200 rounded mb-2" />
                          <div className="h-3 bg-catalyst-gray-200 rounded w-2/3" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : submittersError ? (
              <Card className="text-center p-8">
                <CardContent>
                  <p className="text-catalyst-gray-600">Unable to load leaderboard data. Please try again later.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {Array.isArray(topSubmitters) && topSubmitters.length > 0 ? topSubmitters.map((broker: LeaderboardEntry, index: number) => {
                  // Safely handle potential data issues
                  const safeBroker = {
                    id: broker?.id || `broker-${index}`,
                    name: broker?.name || 'Unknown Broker',
                    brokerage: broker?.brokerage || 'Unknown Brokerage',
                    totalDeals: broker?.totalDeals || 0,
                    approvedDeals: broker?.approvedDeals || 0,
                    totalPoints: broker?.totalPoints || 0,
                    marketsCovered: typeof broker?.marketsCovered === 'string' ? broker.marketsCovered : 'Not specified',
                    currentLevel: broker?.currentLevel || 1,
                    totalReferrals: broker?.totalReferrals || 0,
                    referralCode: broker?.referralCode || ''
                  };
                  
                  return (
                  <Card 
                    key={safeBroker.id} 
                    className={`transition-all duration-200 hover:shadow-lg ${
                      index < 3 ? 'border-2 border-catalyst-gold shadow-md' : ''
                    }`}
                    data-testid={`leaderboard-submitter-${index + 1}`}
                  >
                    <CardContent className="p-4 sm:p-6">
                      {/* Mobile-first layout: stacked vertically */}
                      <div className="space-y-4">
                        {/* Header with rank and name */}
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            {getRankIcon(index + 1)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg sm:text-xl font-semibold text-catalyst-gray-900 truncate">
                              {safeBroker.name}
                            </h3>
                            <div className="flex flex-wrap gap-2 mt-1">
                              <Badge className={getRankBadgeColor(index + 1)} data-testid={`rank-badge-${index + 1}`}>
                                Rank #{index + 1}
                              </Badge>
                              {index < 3 && (
                                <Badge className="bg-catalyst-gold text-white">
                                  Top Performer
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Broker details */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-catalyst-gray-600">
                          <div className="flex items-center gap-1">
                            <Building2 className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{safeBroker.brokerage}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{safeBroker.marketsCovered}</span>
                          </div>
                        </div>

                        {/* Stats - responsive grid */}
                        <div className="flex justify-between items-center pt-2 border-t border-catalyst-gray-100">
                          <div className="grid grid-cols-2 gap-3 flex-1">
                            <div className="text-center p-2 sm:p-3 bg-catalyst-gray-50 rounded-lg">
                              <div className="text-xl sm:text-2xl font-bold text-catalyst-gold">
                                {safeBroker.totalDeals}
                              </div>
                              <div className="text-xs text-catalyst-gray-600 whitespace-nowrap">
                                Total Deals
                              </div>
                            </div>
                            <div className="text-center p-2 sm:p-3 bg-green-50 rounded-lg">
                              <div className="text-xl sm:text-2xl font-bold text-green-600">
                                {safeBroker.approvedDeals}
                              </div>
                              <div className="text-xs text-catalyst-gray-600 whitespace-nowrap">
                                Approved
                              </div>
                            </div>
                          </div>
                          <div className="ml-4 text-right">
                            <div className="text-xs sm:text-sm text-catalyst-gray-500 whitespace-nowrap">
                              Level {safeBroker.currentLevel}
                            </div>
                            <div className="text-xs text-catalyst-gray-400 whitespace-nowrap">
                              {safeBroker.totalPoints} pts
                            </div>
                          </div>
                        </div>

                        {/* Share buttons - only show for top 3 */}
                        {index < 3 && (
                          <div className="flex justify-center gap-2 pt-3 border-t border-catalyst-gray-100">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2 text-xs hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                              onClick={() => shareToLinkedIn(safeBroker, index + 1, true)}
                              data-testid={`share-linkedin-${index + 1}`}
                            >
                              <FaLinkedin className="h-3 w-3" />
                              Share Achievement
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2 text-xs hover:bg-blue-400 hover:text-white hover:border-blue-400"
                              onClick={() => shareToTwitter(safeBroker, index + 1, true)}
                              data-testid={`share-twitter-${index + 1}`}
                            >
                              <FaTwitter className="h-3 w-3" />
                              Tweet
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  );
                }) : (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <TrendingUp className="h-12 w-12 text-catalyst-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-catalyst-gray-600 mb-2">
                        No submissions yet
                      </h3>
                      <p className="text-catalyst-gray-500">
                        Be the first to submit a deal and claim the top spot!
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {!loadingSubmitters && !submittersError && (!Array.isArray(topSubmitters) || topSubmitters.length === 0) && (
              <Card>
                <CardContent className="p-12 text-center">
                  <TrendingUp className="h-12 w-12 text-catalyst-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-catalyst-gray-600 mb-2">
                    No submissions yet
                  </h3>
                  <p className="text-catalyst-gray-500">
                    Be the first to submit a deal and claim the top spot!
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
          )}

          {/* Top Referring Brokers */}
          {activeTab === "referrers" && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl sm:text-2xl font-semibold text-catalyst-gray-900 mb-2">Top Network Builders</h2>
              <p className="text-sm sm:text-base text-catalyst-gray-600 px-4">Brokers who are growing our community by bringing in new talent</p>
            </div>

            {loadingReferrers ? (
              <div className="grid gap-4">
                {[...Array(5)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-catalyst-gray-200 rounded-full" />
                        <div className="flex-1">
                          <div className="h-4 bg-catalyst-gray-200 rounded mb-2" />
                          <div className="h-3 bg-catalyst-gray-200 rounded w-2/3" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : referrersError ? (
              <Card className="text-center p-8">
                <CardContent>
                  <p className="text-catalyst-gray-600">Unable to load referrers data. Please try again later.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {Array.isArray(topReferrers) && topReferrers.length > 0 ? topReferrers.map((broker: LeaderboardEntry, index: number) => (
                  <Card 
                    key={broker.id} 
                    className={`transition-all duration-200 hover:shadow-lg ${
                      index < 3 ? 'border-2 border-catalyst-gold shadow-md' : ''
                    }`}
                    data-testid={`leaderboard-referrer-${index + 1}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center">
                            {getRankIcon(index + 1)}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold text-catalyst-gray-900">
                                {broker.name}
                              </h3>
                              <Badge className={getRankBadgeColor(index + 1)}>
                                Rank #{index + 1}
                              </Badge>
                              {index < 3 && (
                                <Badge className="bg-catalyst-gold text-white">
                                  Network Leader
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-catalyst-gray-600">
                              <div className="flex items-center gap-1">
                                <Building2 className="h-4 w-4" />
                                {broker.brokerage}
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {broker.marketsCovered}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="grid grid-cols-2 gap-4 text-center">
                            <div className="p-3 bg-blue-50 rounded-lg">
                              <div className="text-2xl font-bold text-blue-600">
                                {broker.totalReferrals}
                              </div>
                              <div className="text-xs text-catalyst-gray-600">
                                Referrals
                              </div>
                            </div>
                            <div className="p-3 bg-catalyst-gray-50 rounded-lg">
                              <div className="text-lg font-bold text-catalyst-gray-700">
                                {broker.referralCode}
                              </div>
                              <div className="text-xs text-catalyst-gray-600">
                                Referral Code
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-catalyst-gray-500">
                            Level {broker.currentLevel} • {broker.totalPoints} pts
                          </div>
                        </div>
                      </div>

                      {/* Share buttons - only show for top 3 */}
                      {index < 3 && (
                        <div className="flex justify-center gap-2 mt-4 pt-3 border-t border-catalyst-gray-100">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2 text-xs hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                            onClick={() => shareToLinkedIn(broker, index + 1, false)}
                            data-testid={`share-linkedin-referrer-${index + 1}`}
                          >
                            <FaLinkedin className="h-3 w-3" />
                            Share Achievement
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2 text-xs hover:bg-blue-400 hover:text-white hover:border-blue-400"
                            onClick={() => shareToTwitter(broker, index + 1, false)}
                            data-testid={`share-twitter-referrer-${index + 1}`}
                          >
                            <FaTwitter className="h-3 w-3" />
                            Tweet
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )) : (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Users className="h-12 w-12 text-catalyst-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-catalyst-gray-600 mb-2">
                        No referrals yet
                      </h3>
                      <p className="text-catalyst-gray-500">
                        Start referring other brokers to build your network and earn rewards!
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {!loadingReferrers && !referrersError && (!Array.isArray(topReferrers) || topReferrers.length === 0) && (
              <Card>
                <CardContent className="p-12 text-center">
                  <Users className="h-12 w-12 text-catalyst-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-catalyst-gray-600 mb-2">
                    No referrals yet
                  </h3>
                  <p className="text-catalyst-gray-500">
                    Start referring other brokers to build your network and earn rewards!
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
          )}

        </div>

        {/* Call to Action */}
        <Card className="mt-6 sm:mt-8 mx-2 sm:mx-0 bg-gradient-to-r from-catalyst-gold/10 to-amber-500/10 border-catalyst-gold">
          <CardContent className="p-4 sm:p-8 text-center">
            <h3 className="text-xl sm:text-2xl font-semibold text-catalyst-gray-900 mb-3 sm:mb-4">
              Want to see your name here?
            </h3>
            <p className="text-sm sm:text-base text-catalyst-gray-600 mb-4 sm:mb-6 max-w-2xl mx-auto px-2">
              Join our community of top-performing brokers. Submit quality deals, refer other professionals, 
              and climb the leaderboards to earn exclusive rewards and recognition.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Button 
                onClick={() => window.location.href = '/submit-deal'}
                className="w-full sm:w-auto bg-catalyst-gold text-white hover:bg-white hover:text-catalyst-gold border border-catalyst-gold hover:border-catalyst-gold"
                data-testid="button-submit-deal"
              >
                Submit Your First Deal
              </Button>
              <Button 
                variant="outline"
                onClick={() => window.location.href = '/signup'}
                className="w-full sm:w-auto border-catalyst-gold text-catalyst-gold hover:bg-catalyst-gold hover:text-white"
                data-testid="button-join-platform"
              >
                Join LandLinq
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
