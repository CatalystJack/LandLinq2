import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, TrendingUp, Award, Calendar } from "lucide-react";
import Footer from "@/components/footer";

export default function MyCommissions() {
  const commissions = [
    { id: 1, deal: "Peachtree Industrial", amount: 25000, date: "2024-03-15", status: "Paid" },
    { id: 2, deal: "Cedar Grove Assembly", amount: 18500, date: "2024-03-01", status: "Pending" },
    { id: 3, deal: "Alpharetta Commons", amount: 32000, date: "2024-02-20", status: "Paid" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">My Commissions</h1>
          <p className="text-slate-600 mt-2">Track your earnings and commission tier progress</p>
          
          {/* Commission Structure Highlight */}
          <div className="bg-gradient-to-r from-yellow-50 to-yellow-25 rounded-xl p-6 mt-6 border border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  💰 Your Commission Structure
                </h3>
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-yellow-600">1.0%</span>
                    <span className="text-slate-600">At Rezoning</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-yellow-600">1.0%</span>
                    <span className="text-slate-600">At Closing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-yellow-600">2.5%</span>
                    <span className="text-slate-600">GP Promote</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-600">Manual Processing</p>
                <p className="text-xs text-slate-500">Handled by our team</p>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="tier">Tier Progress</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
                  <DollarSign className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$75,500</div>
                  <p className="text-xs text-muted-foreground">+$18,500 this month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Current Tier</CardTitle>
                  <Award className="h-4 w-4 text-catalyst-gold" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-catalyst-gold">Gold</div>
                  <p className="text-xs text-muted-foreground">3.5% commission rate</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">This Month</CardTitle>
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$18,500</div>
                  <p className="text-xs text-muted-foreground">1 deal closed</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Commission Payments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {commissions.slice(0, 3).map((commission) => (
                    <div key={commission.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{commission.deal}</h4>
                        <p className="text-sm text-muted-foreground">{commission.date}</p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="font-medium">${commission.amount.toLocaleString()}</span>
                        <Badge variant={commission.status === "Paid" ? "default" : "secondary"}>
                          {commission.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Commission History</CardTitle>
                <p className="text-sm text-muted-foreground">Complete history of your commission payments</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {commissions.map((commission) => (
                    <div key={commission.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-catalyst-gold rounded-full flex items-center justify-center">
                          <DollarSign className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h4 className="font-medium">{commission.deal}</h4>
                          <p className="text-sm text-muted-foreground">{commission.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="font-medium">${commission.amount.toLocaleString()}</span>
                        <Badge variant={commission.status === "Paid" ? "default" : "secondary"}>
                          {commission.status}
                        </Badge>
                        <Button variant="outline" size="sm">Details</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tier">
            <Card>
              <CardHeader>
                <CardTitle>Tier Progress</CardTitle>
                <p className="text-sm text-muted-foreground">Track your progress towards the next commission tier</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-catalyst-gold mb-2">Gold Tier</div>
                    <p className="text-muted-foreground">You've achieved the highest tier!</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50">
                      <div>
                        <h4 className="font-medium text-green-800">Bronze Tier</h4>
                        <p className="text-sm text-green-600">2.5% commission rate</p>
                      </div>
                      <Badge variant="default" className="bg-green-600">Achieved</Badge>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50">
                      <div>
                        <h4 className="font-medium text-blue-800">Silver Tier</h4>
                        <p className="text-sm text-blue-600">3.0% commission rate</p>
                      </div>
                      <Badge variant="default" className="bg-blue-600">Achieved</Badge>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg bg-catalyst-gold bg-opacity-10">
                      <div>
                        <h4 className="font-medium text-catalyst-gold">Gold Tier</h4>
                        <p className="text-sm text-catalyst-gold">3.5% commission rate</p>
                      </div>
                      <Badge variant="default" className="bg-catalyst-gold">Current</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <Footer />
    </div>
    </div>
  );
}