import Footer from "@/components/footer";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Navigation from "@/components/navigation";

export default function AnalystLogin() {
  const [selectedAnalyst, setSelectedAnalyst] = useState("");
  const [password, setPassword] = useState("");

  const analysts = [
    { name: "AJ", email: "aj@catalystcp.com" },
    { name: "Austin", email: "austin@catalystcp.com" },
    { name: "Davis", email: "davis@catalystcp.com" },
    { name: "Brian", email: "brian@catalystcp.com" },
    { name: "Steve", email: "steve@catalystcp.com" },
    { name: "Mallie", email: "mallie@catalystcp.com" },
    { name: "Jack", email: "jack@catalystcp.com" },
  ];

  const handleLogin = async () => {
    if (!selectedAnalyst) return;

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: selectedAnalyst,
          password: password,
        }),
      });

      if (response.ok) {
        window.location.href = '/analyst-dashboard';
      } else {
        alert('Login failed');
      }
    } catch (error) {
      // console.error('Login error:', error);
      alert('Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-catalyst-gray-50">
      <Navigation />
      <div className="pt-20 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center text-catalyst-navy">
              Analyst Login
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="analyst">Select Analyst</Label>
              <Select value={selectedAnalyst} onValueChange={setSelectedAnalyst}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an analyst account" />
                </SelectTrigger>
                <SelectContent>
                  {analysts.map((analyst) => (
                    <SelectItem key={analyst.email} value={analyst.email}>
                      {analyst.name} ({analyst.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            <Button 
              onClick={handleLogin}
              className="w-full bg-catalyst-navy text-white hover:bg-catalyst-navy/90"
              disabled={!selectedAnalyst}
            >
              Login as Analyst
            </Button>
            
            <div className="text-center">
              <Button 
                onClick={() => window.location.href = '/analyst-dashboard'}
                className="text-catalyst-navy underline bg-transparent hover:bg-transparent"
              >
                Go directly to Analyst Dashboard →
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
