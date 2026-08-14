import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Save, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function TemplateEditor() {
  const { toast } = useToast();
  
  // Spacing controls
  const [logoSpacing, setLogoSpacing] = useState(20);
  const [logoSize, setLogoSize] = useState(100);
  const [separatorSpacing, setSeparatorSpacing] = useState(30);
  const [contentPadding, setContentPadding] = useState(40);
  const [footerSpacing, setFooterSpacing] = useState(30);
  
  // Text styling
  const [headingSize, setHeadingSize] = useState(24);
  const [bodySize, setBodySize] = useState(16);
  const [headingBold, setHeadingBold] = useState(true);
  const [bodyBold, setBodyBold] = useState(false);
  
  // Signature styling
  const [signatureSize, setSignatureSize] = useState(13);
  const [signatureBold, setSignatureBold] = useState(false);
  const [signatureColor, setSignatureColor] = useState('#6b7280');
  
  // Sample content
  const [heading, setHeading] = useState("Welcome to LandLinq!");
  const [bodyText, setBodyText] = useState("Thank you for your submission. We've received your property and our team will review it shortly.");

  const generatePreview = () => {
    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; padding: 20px;">
        <div style="text-align: center; background-color: #ffffff; padding: ${logoSpacing}px; margin-bottom: 0; border-radius: 8px 8px 0 0;">
          <img src="https://landlinq.ai/landlinq-logo.png" alt="LandLinq" style="max-height: ${logoSize}px; width: auto; display: block; margin-left: auto; margin-right: auto;" />
        </div>
        <div style="border-bottom: 1px solid #4A90E2; margin-bottom: ${separatorSpacing}px;"></div>
        <div style="background-color: #ffffff; padding: ${contentPadding}px 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h2 style="color: #081729; font-size: ${headingSize}px; font-weight: ${headingBold ? 'bold' : 'normal'}; margin: 0 0 20px 0;">${heading}</h2>
          <p style="color: #374151; font-size: ${bodySize}px; font-weight: ${bodyBold ? 'bold' : 'normal'}; line-height: 1.6; margin: 0;">${bodyText}</p>
        </div>
        <div style="text-align: center; margin-top: ${footerSpacing}px; padding: 20px; font-size: ${signatureSize}px; color: ${signatureColor}; font-weight: ${signatureBold ? 'bold' : 'normal'}; line-height: 1.6;">
          <p style="margin: 0 0 8px 0;">© 2025 LandLinq</p>
          <p style="margin: 0 0 8px 0;">
            <a href="mailto:catalyst@landlinq.ai" style="color: #d4af37; text-decoration: none;">catalyst@landlinq.ai</a> | 
            <a href="tel:7046101549" style="color: #d4af37; text-decoration: none;">(704) 610-1549</a>
          </p>
        </div>
      </div>
    `;
  };

  const handleSave = () => {
    const settings = {
      logoSpacing,
      logoSize,
      separatorSpacing,
      contentPadding,
      footerSpacing,
      headingSize,
      bodySize,
      headingBold,
      bodyBold,
      signatureSize,
      signatureBold,
      signatureColor
    };
    
    console.log('Template settings saved:', settings);
    localStorage.setItem('emailTemplateSettings', JSON.stringify(settings));
    
    toast({
      title: "Template Settings Saved",
      description: "Your email template styling has been saved successfully."
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Email Template Editor</h1>
          <p className="text-gray-600 mt-2">Customize spacing, text sizes, and styling for your email templates</p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Controls Panel */}
          <div className="col-span-4">
            <Card className="p-6 sticky top-6">
              <Tabs defaultValue="spacing" className="w-full">
                <TabsList className="w-full mb-4 grid grid-cols-3">
                  <TabsTrigger value="spacing">Spacing</TabsTrigger>
                  <TabsTrigger value="text">Text</TabsTrigger>
                  <TabsTrigger value="signature">Signature</TabsTrigger>
                </TabsList>

                <TabsContent value="spacing" className="space-y-6">
                  <div>
                    <Label className="text-sm font-medium">Logo Size: {logoSize}px</Label>
                    <Slider
                      value={[logoSize]}
                      onValueChange={([value]) => setLogoSize(value)}
                      min={40}
                      max={200}
                      step={10}
                      className="mt-2"
                      data-testid="slider-logo-size"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Logo Padding: {logoSpacing}px</Label>
                    <Slider
                      value={[logoSpacing]}
                      onValueChange={([value]) => setLogoSpacing(value)}
                      min={0}
                      max={60}
                      step={5}
                      className="mt-2"
                      data-testid="slider-logo-spacing"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Separator Spacing: {separatorSpacing}px</Label>
                    <Slider
                      value={[separatorSpacing]}
                      onValueChange={([value]) => setSeparatorSpacing(value)}
                      min={0}
                      max={60}
                      step={5}
                      className="mt-2"
                      data-testid="slider-separator-spacing"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Content Padding: {contentPadding}px</Label>
                    <Slider
                      value={[contentPadding]}
                      onValueChange={([value]) => setContentPadding(value)}
                      min={10}
                      max={80}
                      step={5}
                      className="mt-2"
                      data-testid="slider-content-padding"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Footer Spacing: {footerSpacing}px</Label>
                    <Slider
                      value={[footerSpacing]}
                      onValueChange={([value]) => setFooterSpacing(value)}
                      min={0}
                      max={60}
                      step={5}
                      className="mt-2"
                      data-testid="slider-footer-spacing"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="text" className="space-y-6">
                  <div>
                    <Label className="text-sm font-medium">Heading Text</Label>
                    <Input
                      value={heading}
                      onChange={(e) => setHeading(e.target.value)}
                      className="mt-2"
                      data-testid="input-heading"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Heading Size: {headingSize}px</Label>
                    <Slider
                      value={[headingSize]}
                      onValueChange={([value]) => setHeadingSize(value)}
                      min={16}
                      max={36}
                      step={2}
                      className="mt-2"
                      data-testid="slider-heading-size"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Heading Bold</Label>
                    <Switch
                      checked={headingBold}
                      onCheckedChange={setHeadingBold}
                      data-testid="switch-heading-bold"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Body Text</Label>
                    <Input
                      value={bodyText}
                      onChange={(e) => setBodyText(e.target.value)}
                      className="mt-2"
                      data-testid="input-body"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Body Size: {bodySize}px</Label>
                    <Slider
                      value={[bodySize]}
                      onValueChange={([value]) => setBodySize(value)}
                      min={12}
                      max={24}
                      step={1}
                      className="mt-2"
                      data-testid="slider-body-size"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Body Bold</Label>
                    <Switch
                      checked={bodyBold}
                      onCheckedChange={setBodyBold}
                      data-testid="switch-body-bold"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="signature" className="space-y-6">
                  <div>
                    <Label className="text-sm font-medium">Signature Font Size: {signatureSize}px</Label>
                    <Slider
                      value={[signatureSize]}
                      onValueChange={([value]) => setSignatureSize(value)}
                      min={10}
                      max={20}
                      step={1}
                      className="mt-2"
                      data-testid="slider-signature-size"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Signature Bold</Label>
                    <Switch
                      checked={signatureBold}
                      onCheckedChange={setSignatureBold}
                      data-testid="switch-signature-bold"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Signature Color</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        type="color"
                        value={signatureColor}
                        onChange={(e) => setSignatureColor(e.target.value)}
                        className="w-16 h-10 p-1"
                        data-testid="input-signature-color"
                      />
                      <Input
                        type="text"
                        value={signatureColor}
                        onChange={(e) => setSignatureColor(e.target.value)}
                        placeholder="#6b7280"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <Button onClick={handleSave} className="w-full mt-6" data-testid="button-save">
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </Card>
          </div>

          {/* Live Preview */}
          <div className="col-span-8">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Live Preview</h2>
                <Eye className="h-5 w-5 text-gray-400" />
              </div>
              <div 
                className="border-2 border-gray-200 rounded-lg p-4 bg-white overflow-auto"
                dangerouslySetInnerHTML={{ __html: generatePreview() }}
              />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
