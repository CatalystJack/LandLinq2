import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Trophy, 
  Star, 
  Gift, 
  Share2, 
  Users, 
  TrendingUp, 
  Award, 
  Zap, 
  Target,
  Facebook,
  Linkedin,
  Twitter,
  Mail,
  Copy,
  CheckCircle
} from 'lucide-react';

interface BrokerStats {
  totalPoints: number;
  currentLevel: number;
  shareCount: number;
  consecutiveDeals: number;
  referralCount: number;
  rank: number;
  pointsToNextLevel: number;
  nextLevelThreshold: number;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  pointsAwarded: number;
  unlockedAt: string;
  isUnlocked: boolean;
}

interface Reward {
  id: string;
  rewardType: string;
  rewardDescription: string;
  pointsCost: number;
  rewardValue: number;
  status: string;
}

const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 4000, 8000, 15000, 30000];
const LEVEL_NAMES = [
  "Newcomer", "Explorer", "Contributor", "Professional", "Expert", 
  "Specialist", "Master", "Elite", "Champion", "Legend"
];

export function BrokerGamification() {
  const [stats, setStats] = useState<BrokerStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchGamificationData();
  }, []);

  const fetchGamificationData = async () => {
    try {
      const [statsRes, achievementsRes, rewardsRes] = await Promise.all([
        fetch('/api/gamification/stats'),
        fetch('/api/gamification/achievements'),
        fetch('/api/gamification/rewards')
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
        setReferralCode(statsData.referralCode);
      }

      if (achievementsRes.ok) {
        const achievementsData = await achievementsRes.json();
        setAchievements(achievementsData);
      }

      if (rewardsRes.ok) {
        const rewardsData = await rewardsRes.json();
        setRewards(rewardsData);
      }
    } catch (error) {
      console.error('Failed to fetch gamification data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateShareUrl = () => {
    return `${window.location.origin}?ref=${referralCode}`;
  };

  const shareOnPlatform = async (platform: string) => {
    const shareUrl = generateShareUrl();
    const message = shareMessage || "Check out LandLinq - the premier platform for land acquisition deals! Join me and start earning rewards for quality submissions.";

    let platformUrl = "";
    
    switch (platform) {
      case 'linkedin':
        platformUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(message)}`;
        break;
      case 'facebook':
        platformUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(message)}`;
        break;
      case 'twitter':
        platformUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'email':
        platformUrl = `mailto:?subject=${encodeURIComponent("Join me on LandLinq")}&body=${encodeURIComponent(`${message}\n\n${shareUrl}`)}`;
        break;
      default:
        return;
    }

    // Track the share
    try {
      await fetch('/api/gamification/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, shareUrl, message })
      });
      
      toast({
        title: "Share Tracked!",
        description: `+10 points for sharing on ${platform}`,
        variant: "default",
      });
    } catch (error) {
      console.error('Failed to track share:', error);
    }

    if (platform !== 'email') {
      window.open(platformUrl, '_blank', 'width=600,height=400');
    } else {
      window.location.href = platformUrl;
    }
    
    setShowShareDialog(false);
  };

  const copyReferralLink = () => {
    const shareUrl = generateShareUrl();
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: "Link Copied!",
      description: "Your referral link has been copied to clipboard",
      variant: "default",
    });
  };

  const claimReward = async (rewardId: string) => {
    try {
      const response = await fetch(`/api/gamification/rewards/${rewardId}/claim`, {
        method: 'POST'
      });

      if (response.ok) {
        toast({
          title: "Reward Claimed!",
          description: "Your reward has been processed and will be delivered soon.",
          variant: "default",
        });
        fetchGamificationData(); // Refresh data
      } else {
        throw new Error('Failed to claim reward');
      }
    } catch (error) {
      toast({
        title: "Claim Failed",
        description: "Unable to claim reward. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getLevelName = (level: number) => {
    return LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)] || "Legend";
  };

  const getProgressPercentage = () => {
    if (!stats) return 0;
    const currentLevelPoints = LEVEL_THRESHOLDS[stats.currentLevel - 1] || 0;
    const nextLevelPoints = LEVEL_THRESHOLDS[stats.currentLevel] || stats.totalPoints;
    const progressInLevel = stats.totalPoints - currentLevelPoints;
    const levelRange = nextLevelPoints - currentLevelPoints;
    return levelRange > 0 ? (progressInLevel / levelRange) * 100 : 100;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Trophy className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Unable to load gamification data</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Level and Progress Overview */}
      <Card className="bg-gradient-to-r from-catalyst-navy to-blue-600 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-catalyst-gold" />
            Level {stats.currentLevel}: {getLevelName(stats.currentLevel)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">{stats.totalPoints} Points</span>
              <Badge variant="secondary" className="bg-catalyst-gold text-black">
                Rank #{stats.rank}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress to Level {stats.currentLevel + 1}</span>
                <span>{stats.pointsToNextLevel} points needed</span>
              </div>
              <Progress value={getProgressPercentage()} className="h-3" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Share2 className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Platform Shares</p>
                <p className="text-2xl font-bold">{stats.shareCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Target className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">Deal Streak</p>
                <p className="text-2xl font-bold">{stats.consecutiveDeals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-gray-600">Referrals</p>
                <p className="text-2xl font-bold">{stats.referralCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-gray-600">Next Level</p>
                <p className="text-2xl font-bold">{stats.pointsToNextLevel}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Share Platform */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share & Earn Points
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Share LandLinq with your network and earn 10 points per share, plus 100 bonus points for each successful referral!
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-catalyst-gold" />
                <span>10 points per share</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Trophy className="h-4 w-4 text-catalyst-gold" />
                <span>100 points per successful referral</span>
              </div>
            </div>
            <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Platform
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Share LandLinq</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="message">Custom Message (Optional)</Label>
                    <Textarea
                      id="message"
                      placeholder="Add a personal message to your share..."
                      value={shareMessage}
                      onChange={(e) => setShareMessage(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label>Your Referral Link</Label>
                    <div className="flex mt-1">
                      <Input
                        value={generateShareUrl()}
                        readOnly
                        className="rounded-r-none"
                      />
                      <Button 
                        onClick={copyReferralLink}
                        variant="outline"
                        className="rounded-l-none border-l-0"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => shareOnPlatform('linkedin')}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Linkedin className="h-4 w-4 mr-2" />
                      LinkedIn
                    </Button>
                    <Button
                      onClick={() => shareOnPlatform('facebook')}
                      className="bg-blue-500 hover:bg-blue-600"
                    >
                      <Facebook className="h-4 w-4 mr-2" />
                      Facebook
                    </Button>
                    <Button
                      onClick={() => shareOnPlatform('twitter')}
                      className="bg-gray-900 hover:bg-gray-800"
                    >
                      <Twitter className="h-4 w-4 mr-2" />
                      Twitter
                    </Button>
                    <Button
                      onClick={() => shareOnPlatform('email')}
                      variant="outline"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Achievements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Recent Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            {achievements.length > 0 ? (
              <div className="space-y-3">
                {achievements.slice(0, 3).map((achievement) => (
                  <div 
                    key={achievement.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="text-2xl">{achievement.icon}</div>
                    <div className="flex-1">
                      <h4 className="font-medium">{achievement.title}</h4>
                      <p className="text-sm text-gray-600">{achievement.description}</p>
                    </div>
                    <Badge variant="secondary">+{achievement.pointsAwarded}</Badge>
                  </div>
                ))}
                {achievements.length > 3 && (
                  <p className="text-sm text-gray-500 text-center">
                    +{achievements.length - 3} more achievements
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Star className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No achievements yet</p>
                <p className="text-sm text-gray-400">Submit your first deal to get started!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rewards Store */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Rewards Store
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rewards.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rewards.map((reward) => (
                <div 
                  key={reward.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium">{reward.rewardDescription}</h4>
                    {reward.status === 'claimed' && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                  </div>
                  <p className="text-2xl font-bold text-catalyst-gold">
                    ${reward.rewardValue}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      {reward.pointsCost} points
                    </span>
                    <Button
                      size="sm"
                      onClick={() => claimReward(reward.id)}
                      disabled={stats.totalPoints < reward.pointsCost || reward.status === 'claimed'}
                    >
                      {reward.status === 'claimed' ? 'Claimed' : 'Claim'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Gift className="h-12 w-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No rewards available</p>
              <p className="text-sm text-gray-400">Check back soon for exciting rewards!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}