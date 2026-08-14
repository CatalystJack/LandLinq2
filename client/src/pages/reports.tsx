import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, Download, Calendar } from "lucide-react";
import Footer from "@/components/footer";

export default function Reports() {
  const reports = [
    {
      id: 1,
      name: "Monthly Deal Summary",
      type: "Summary",
      generated: "2024-03-15",
      format: "PDF",
      status: "Ready"
    },
    {
      id: 2,
      name: "Broker Performance",
      type: "Performance",
      generated: "2024-03-10",
      format: "Excel",
      status: "Ready"
    },
    {
      id: 3,
      name: "Market Analysis",
      type: "Analysis",
      generated: "2024-03-05",
      format: "PDF",
      status: "Generating"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
          <p className="text-slate-600 mt-2">View and generate business reports and analytics</p>
        </div>

        <Tabs defaultValue="available" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3" data-testid="tabs-reports">
            <TabsTrigger value="available" data-testid="tab-available">Available Reports</TabsTrigger>
            <TabsTrigger value="generate" data-testid="tab-generate">Generate Report</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">24</div>
                  <p className="text-xs text-muted-foreground">Generated this month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Downloads</CardTitle>
                  <Download className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">156</div>
                  <p className="text-xs text-muted-foreground">This month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">Today</div>
                  <p className="text-xs text-muted-foreground">2 hours ago</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Reports</CardTitle>
                <p className="text-sm text-muted-foreground">Download or view your latest reports</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reports.map((report) => (
                    <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <BarChart3 className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium">{report.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {report.type} • Generated {report.generated} • {report.format}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge variant={report.status === "Ready" ? "default" : "secondary"}>
                          {report.status}
                        </Badge>
                        {report.status === "Ready" && (
                          <Button variant="outline" size="sm" data-testid={`button-download-${report.id}`}>
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="generate">
            <Card>
              <CardHeader>
                <CardTitle>Generate New Report</CardTitle>
                <p className="text-sm text-muted-foreground">Create custom reports based on your requirements</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 border rounded-lg hover:bg-gray-50 cursor-pointer" data-testid="card-deal-performance">
                    <BarChart3 className="h-8 w-8 text-blue-600 mb-3" />
                    <h3 className="font-medium mb-2">Deal Performance Report</h3>
                    <p className="text-sm text-muted-foreground">Analyze deal submission and approval rates</p>
                  </div>
                  
                  <div className="p-6 border rounded-lg hover:bg-gray-50 cursor-pointer" data-testid="card-broker-analytics">
                    <TrendingUp className="h-8 w-8 text-green-600 mb-3" />
                    <h3 className="font-medium mb-2">Broker Analytics Report</h3>
                    <p className="text-sm text-muted-foreground">Track broker performance and commission data</p>
                  </div>
                  
                  <div className="p-6 border rounded-lg hover:bg-gray-50 cursor-pointer" data-testid="card-monthly-summary">
                    <Calendar className="h-8 w-8 text-purple-600 mb-3" />
                    <h3 className="font-medium mb-2">Monthly Summary Report</h3>
                    <p className="text-sm text-muted-foreground">Comprehensive monthly business overview</p>
                  </div>
                  
                  <div className="p-6 border rounded-lg hover:bg-gray-50 cursor-pointer" data-testid="card-custom-report">
                    <Download className="h-8 w-8 text-orange-600 mb-3" />
                    <h3 className="font-medium mb-2">Custom Report</h3>
                    <p className="text-sm text-muted-foreground">Build a custom report with specific metrics</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Analytics Dashboard</CardTitle>
                <p className="text-sm text-muted-foreground">Real-time business analytics and insights</p>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Advanced Analytics</h3>
                  <p className="text-muted-foreground">Detailed analytics dashboard coming soon</p>
                  <Button className="mt-4" data-testid="button-go-analytics">Go to Analytics</Button>
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