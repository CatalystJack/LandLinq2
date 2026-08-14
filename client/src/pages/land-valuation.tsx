import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { MapPin, DollarSign, Calculator, Share2, Mail, Eye, EyeOff, FileText, Download, Plus, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface ValuationData {
  id?: string;
  address: string;
  sizeAcres: string;
  zoning: string;
  pricePerAcre: number;
  totalValue: number;
  marketComps: string;
  notes: string;
}

export default function LandValuation() {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    address: "",
    sizeAcres: "",
    zoning: "",
    marketComps: "",
    notes: "",
  });
  const [valuationResult, setValuationResult] = useState<ValuationData | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [taggedEmails, setTaggedEmails] = useState<string[]>([]);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const valuationMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("POST", "/api/valuation/analyze", data);
    },
    onSuccess: (result: ValuationData) => {
      setValuationResult(result);
      toast({
        title: "Valuation Complete! 📊",
        description: "Land valuation analysis has been generated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Analysis Failed",
        description: "Unable to generate valuation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const shareMutation = useMutation({
    mutationFn: async (data: { valuationId: string; taggedEmails: string[] }) => {
      return await apiRequest("POST", "/api/valuation/share", data);
    },
    onSuccess: () => {
      toast({
        title: "Valuation Shared! 🎉",
        description: `Report shared with ${taggedEmails.length} contacts. You'll earn points for each signup!`,
      });
      setShowShareModal(false);
      setTaggedEmails([]);
    },
    onError: () => {
      toast({
        title: "Share Failed",
        description: "Unable to share valuation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.address || !formData.sizeAcres) {
      toast({
        title: "Missing Information",
        description: "Please provide property address and size.",
        variant: "destructive",
      });
      return;
    }
    valuationMutation.mutate(formData);
  };

  const handleShare = () => {
    if (!valuationResult) return;
    const validEmails = taggedEmails.filter(email => email.trim());
    if (validEmails.length === 0) {
      toast({
        title: "No Recipients",
        description: "Please add at least one email address.",
        variant: "destructive",
      });
      return;
    }
    shareMutation.mutate({
      valuationId: valuationResult.id || "temp-id",
      taggedEmails: validEmails,
    });
  };

  const generatePDF = async () => {
    if (!valuationResult) return;
    setIsGeneratingPDF(true);
    try {
      // Import jsPDF dynamically to avoid SSR issues
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF();
      
      // Add Catalyst branding and header
      pdf.setFillColor(212, 175, 55); // Catalyst gold
      pdf.rect(0, 0, 210, 40, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.text('Land Valuation Report', 20, 25);
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(12);
      
      // Property details
      let yPosition = 60;
      pdf.text('Property Address:', 20, yPosition);
      pdf.text(valuationResult.address, 80, yPosition);
      
      yPosition += 15;
      pdf.text('Size:', 20, yPosition);
      pdf.text(`${valuationResult.sizeAcres} acres`, 80, yPosition);
      
      yPosition += 15;
      pdf.text('Zoning:', 20, yPosition);
      pdf.text(valuationResult.zoning || 'Not specified', 80, yPosition);
      
      yPosition += 20;
      pdf.setFontSize(14);
      pdf.text('Valuation Summary', 20, yPosition);
      
      yPosition += 15;
      pdf.setFontSize(12);
      pdf.text('Price per Acre:', 20, yPosition);
      pdf.text(`$${(valuationResult.pricePerAcre || 0).toLocaleString()}`, 80, yPosition);
      
      yPosition += 15;
      pdf.setFontSize(16);
      pdf.text('Total Estimated Value:', 20, yPosition);
      pdf.text(`$${(valuationResult.totalValue || 0).toLocaleString()}`, 100, yPosition);
      
      if (valuationResult.marketComps) {
        yPosition += 25;
        pdf.setFontSize(14);
        pdf.text('Market Comparables:', 20, yPosition);
        yPosition += 10;
        pdf.setFontSize(10);
        const splitComps = pdf.splitTextToSize(valuationResult.marketComps, 170);
        pdf.text(splitComps, 20, yPosition);
        yPosition += splitComps.length * 5;
      }
      
      if (valuationResult.notes) {
        yPosition += 15;
        pdf.setFontSize(14);
        pdf.text('Additional Notes:', 20, yPosition);
        yPosition += 10;
        pdf.setFontSize(10);
        const splitNotes = pdf.splitTextToSize(valuationResult.notes, 170);
        pdf.text(splitNotes, 20, yPosition);
      }
      
      // Footer
      pdf.setFontSize(8);
      pdf.text('Generated by LandLinq - Catalyst Capital Partners', 20, 280);
      pdf.text(new Date().toLocaleDateString(), 160, 280);
      
      // Download the PDF
      const fileName = `Land_Valuation_${valuationResult.address.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      toast({
        title: "PDF Generated! 📄",
        description: "Your valuation report has been downloaded.",
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "PDF Generation Failed",
        description: "Unable to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-catalyst-navy via-slate-900 to-catalyst-navy flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <Calculator className="h-12 w-12 text-catalyst-gold mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-catalyst-navy mb-4">Land Valuation Snap</h2>
            <p className="text-gray-600 mb-6">
              Please log in to access the Land Valuation tool and generate property reports.
            </p>
            <Button 
              onClick={() => window.location.href = '/api/login'}
              className="w-full bg-catalyst-gold hover:bg-catalyst-gold/90 text-white"
              data-testid="button-login"
            >
              Sign In to Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-catalyst-navy via-slate-900 to-catalyst-navy">
      <Navigation />
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Land Valuation Snap
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Generate instant property valuations with <strong className="text-catalyst-gold">AI-powered analysis</strong> and share with your network.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Form */}
          <Card className="bg-white/95 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-catalyst-navy to-slate-800 text-white">
              <CardTitle className="text-xl">
                Property Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="address" className="text-sm font-medium">Property Address *</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="123 Main Street, Austin, TX 78701"
                    className="mt-1"
                    data-testid="input-address"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="size" className="text-sm font-medium">Size (Acres) *</Label>
                    <Input
                      id="size"
                      type="number"
                      step="0.1"
                      value={formData.sizeAcres}
                      onChange={(e) => setFormData({...formData, sizeAcres: e.target.value})}
                      placeholder="5.5"
                      className="mt-1"
                      data-testid="input-size"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="zoning" className="text-sm font-medium">Zoning</Label>
                    <Select onValueChange={(value) => setFormData({...formData, zoning: value})}>
                      <SelectTrigger className="mt-1" data-testid="select-zoning">
                        <SelectValue placeholder="Select zoning" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="R-1">R-1 (Single Family)</SelectItem>
                        <SelectItem value="R-2">R-2 (Duplex)</SelectItem>
                        <SelectItem value="R-4">R-4 (Multi-Family)</SelectItem>
                        <SelectItem value="C-1">C-1 (Commercial)</SelectItem>
                        <SelectItem value="A-1">A-1 (Agricultural)</SelectItem>
                        <SelectItem value="I-1">I-1 (Industrial)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="comps" className="text-sm font-medium">Market Comparables</Label>
                  <Input
                    id="comps"
                    value={formData.marketComps}
                    onChange={(e) => setFormData({...formData, marketComps: e.target.value})}
                    placeholder="Recent sales, price per acre ranges"
                    className="mt-1"
                    data-testid="input-comps"
                  />
                </div>

                <div>
                  <Label htmlFor="notes" className="text-sm font-medium">Additional Notes</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Special features, restrictions, utilities"
                    className="mt-1"
                    data-testid="input-notes"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={valuationMutation.isPending}
                  className="w-full bg-catalyst-gold hover:bg-white hover:text-catalyst-gold border border-catalyst-gold text-white py-3 transition-colors duration-200"
                  data-testid="button-analyze"
                >
                  {valuationMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <Calculator className="h-4 w-4 animate-spin" />
                      Analyzing...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      Generate Valuation
                    </div>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Results Panel */}
          <Card className="bg-white/95 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-catalyst-gold to-yellow-600 text-white">
              <CardTitle className="text-xl">
                Valuation Results
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {valuationResult ? (
                <div className="space-y-6">
                  {/* Property Summary */}
                  <div className="bg-catalyst-gold/10 border border-catalyst-gold/20 rounded-lg p-4">
                    <h3 className="font-semibold text-catalyst-navy mb-2">{valuationResult.address}</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Size:</span>
                        <span className="font-medium ml-2">{valuationResult.sizeAcres} acres</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Zoning:</span>
                        <span className="font-medium ml-2">{formData.zoning || 'Not specified'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Valuation Details */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-3 border-b">
                      <span className="text-gray-600">Price per Acre:</span>
                      <span className="text-xl font-bold text-catalyst-gold">
                        ${(valuationResult.pricePerAcre || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b">
                      <span className="text-gray-600">Total Property Value:</span>
                      <span className="text-2xl font-bold text-catalyst-navy">
                        ${(valuationResult.totalValue || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button
                      onClick={generatePDF}
                      disabled={isGeneratingPDF}
                      variant="outline"
                      className="flex-1"
                      data-testid="button-generate-pdf"
                    >
                      {isGeneratingPDF ? (
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 animate-spin" />
                          Generating...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Download className="h-4 w-4" />
                          Download PDF
                        </div>
                      )}
                    </Button>
                    <Button
                      onClick={() => setShowShareModal(true)}
                      className="flex-1 bg-catalyst-gold hover:bg-catalyst-gold/90 text-white"
                      data-testid="button-share-valuation"
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Share Report
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-12">
                  <Calculator className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p>Enter property details and click "Generate Valuation" to see results here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Share Modal */}
        {showShareModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="max-w-lg w-full">
              <CardHeader className="bg-gradient-to-r from-catalyst-gold to-yellow-600 text-white">
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5" />
                  Share Valuation Report
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="bg-catalyst-gold/10 border border-catalyst-gold/20 rounded-lg p-4">
                  <h4 className="font-medium text-catalyst-navy mb-2">What happens when you share:</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Recipients get email: "A Land Valuation Report has been shared with you"</li>
                    <li>• They see a locked preview with blurred $/acre data</li>
                    <li>• Must create free account to unlock full report</li>
                    <li>• You earn 50 leaderboard points for each signup</li>
                  </ul>
                </div>

                <div>
                  <Label className="text-sm font-medium">Share with (Email Addresses)</Label>
                  <div className="space-y-2 mt-2">
                    {taggedEmails.map((email, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => {
                            const newEmails = [...taggedEmails];
                            newEmails[index] = e.target.value;
                            setTaggedEmails(newEmails);
                          }}
                          placeholder="colleague@company.com"
                          className="flex-1"
                          data-testid={`input-share-email-${index}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newEmails = taggedEmails.filter((_, i) => i !== index);
                            setTaggedEmails(newEmails);
                          }}
                          className="text-red-500 hover:text-red-700"
                          data-testid={`button-remove-share-email-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTaggedEmails([...taggedEmails, ''])}
                      className="w-full"
                      data-testid="button-add-share-email"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Email
                    </Button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowShareModal(false)}
                    className="flex-1"
                    data-testid="button-cancel-share"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleShare}
                    disabled={shareMutation.isPending}
                    className="flex-1 bg-catalyst-gold hover:bg-catalyst-gold/90 text-white"
                    data-testid="button-confirm-share"
                  >
                    {shareMutation.isPending ? (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 animate-spin" />
                        Sending...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Send Report
                      </div>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}