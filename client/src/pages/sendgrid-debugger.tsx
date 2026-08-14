import Footer from "@/components/footer";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Trash2, RefreshCw, AlertCircle, CheckCircle, XCircle, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function SendGridDebugger() {
  const { toast } = useToast();
  const [selectedPayload, setSelectedPayload] = useState<any>(null);

  // Fetch recent payloads
  const { data: payloadsData, isLoading } = useQuery({
    queryKey: ["/api/sendgrid/debug/recent"],
    refetchInterval: 5000 // Auto-refresh every 5 seconds
  });

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ["/api/sendgrid/debug/stats"],
    refetchInterval: 5000
  });

  // Clear payloads mutation
  const clearMutation = useMutation({
    mutationFn: () => apiRequest("/api/sendgrid/debug/clear", "POST", {}),
    onSuccess: () => {
      toast({
        title: "Debug data cleared",
        description: "All captured webhook payloads have been deleted"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sendgrid/debug/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sendgrid/debug/stats"] });
      setSelectedPayload(null);
    }
  });

  const payloads = payloadsData?.payloads || [];
  const stats = statsData || {};

  const getFormatBadge = (format: string) => {
    const variants: Record<string, any> = {
      raw_mime: { variant: "default", icon: CheckCircle, label: "Raw MIME ✅" },
      multipart: { variant: "secondary", icon: AlertCircle, label: "Multipart ⚠️" },
      json: { variant: "outline", icon: FileText, label: "JSON" },
      unknown: { variant: "destructive", icon: XCircle, label: "Unknown ❌" }
    };
    const config = variants[format] || variants.unknown;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon size={14} />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">SendGrid Webhook Debugger</h1>
          <p className="text-slate-600 mt-2">
            Monitor and diagnose SendGrid webhook payloads in real-time
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Payloads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPayloads || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">With Raw MIME</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.withRawMime || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">With Attachments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.withAttachments || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Most Recent Format</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-semibold uppercase">{stats.mostRecentFormat || 'None'}</div>
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>How to use:</strong> Send a test email with PDF attachment to <code className="bg-slate-200 px-2 py-1 rounded">deals@catalyst.landlinq.ai</code>. 
            The webhook payload will appear below within seconds. Check if SendGrid is sending Raw MIME format or Multipart format.
          </AlertDescription>
        </Alert>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/sendgrid/debug/recent"] });
              queryClient.invalidateQueries({ queryKey: ["/api/sendgrid/debug/stats"] });
            }}
            variant="outline"
            data-testid="button-refresh"
          >
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => clearMutation.mutate()}
            variant="destructive"
            disabled={clearMutation.isPending}
            data-testid="button-clear"
          >
            <Trash2 size={16} className="mr-2" />
            Clear All
          </Button>
        </div>

        {/* Payloads List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Webhook Payloads</CardTitle>
              <CardDescription>Click to view details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
              {isLoading && <p className="text-slate-500">Loading...</p>}
              {!isLoading && payloads.length === 0 && (
                <p className="text-slate-500 text-center py-8">
                  No payloads captured yet. Send a test email to start debugging.
                </p>
              )}
              {payloads.map((payload: any, idx: number) => (
                <div
                  key={idx}
                  onClick={() => setSelectedPayload(payload)}
                  className={`p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors ${
                    selectedPayload === payload ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                  }`}
                  data-testid={`payload-item-${idx}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-600">
                      {new Date(payload.timestamp).toLocaleString()}
                    </span>
                    {getFormatBadge(payload.parsedFormat)}
                  </div>
                  <div className="text-sm text-slate-700 space-y-1">
                    <div>📧 From: {payload.body?.from || 'Unknown'}</div>
                    <div>📝 Keys: {payload.bodyKeys.length}</div>
                    <div className="flex gap-2 mt-2">
                      {payload.hasRawMime && (
                        <Badge variant="default" className="text-xs">Raw MIME</Badge>
                      )}
                      {payload.hasAttachments && (
                        <Badge variant="secondary" className="text-xs">
                          {payload.attachmentInfo.length} Attachment(s)
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Payload Details */}
          <Card>
            <CardHeader>
              <CardTitle>Payload Details</CardTitle>
              <CardDescription>
                {selectedPayload ? 'Examining webhook structure' : 'Select a payload to view details'}
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[600px] overflow-y-auto">
              {!selectedPayload && (
                <p className="text-slate-500 text-center py-8">
                  Click on a payload from the list to view its details
                </p>
              )}
              {selectedPayload && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Format Analysis</h3>
                    <div className="bg-slate-50 p-3 rounded space-y-2">
                      <div className="flex justify-between">
                        <span>Format:</span>
                        {getFormatBadge(selectedPayload.parsedFormat)}
                      </div>
                      <div className="flex justify-between">
                        <span>Has Raw MIME:</span>
                        <span>{selectedPayload.hasRawMime ? '✅ Yes' : '❌ No'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Has Attachments:</span>
                        <span>{selectedPayload.hasAttachments ? '✅ Yes' : '❌ No'}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-semibold mb-2">Body Keys ({selectedPayload.bodyKeys.length})</h3>
                    <div className="bg-slate-50 p-3 rounded">
                      <code className="text-xs">
                        {selectedPayload.bodyKeys.join(', ')}
                      </code>
                    </div>
                  </div>

                  {selectedPayload.attachmentInfo.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="font-semibold mb-2">Attachments ({selectedPayload.attachmentInfo.length})</h3>
                        <div className="space-y-2">
                          {selectedPayload.attachmentInfo.map((att: any, idx: number) => (
                            <div key={idx} className="bg-slate-50 p-3 rounded">
                              <div className="font-medium">{att.filename}</div>
                              <div className="text-sm text-slate-600 space-y-1 mt-1">
                                <div>Type: {att.contentType}</div>
                                <div>Size: {att.size.toLocaleString()} bytes</div>
                                <div>Has Content: {att.hasContent ? '✅' : '❌'}</div>
                                <div>Has URL: {att.hasUrl ? '✅' : '❌'}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <Separator />

                  <div>
                    <h3 className="font-semibold mb-2">Raw Body (Preview)</h3>
                    <div className="bg-slate-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
                      <pre>{typeof selectedPayload.body === 'string' 
                        ? selectedPayload.body 
                        : JSON.stringify(selectedPayload.body, null, 2).substring(0, 2000)
                      }</pre>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Diagnosis Guide */}
        <Card>
          <CardHeader>
            <CardTitle>🔍 Diagnosis Guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle className="text-green-600 mt-1" size={20} />
                <div>
                  <strong>Raw MIME Format (Good):</strong> If you see "Raw MIME ✅", attachments are properly embedded and the parser should work.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <AlertCircle className="text-orange-600 mt-1" size={20} />
                <div>
                  <strong>Multipart Format (Issue):</strong> If you see "Multipart ⚠️", SendGrid is sending form data instead of raw MIME. 
                  Check your SendGrid webhook settings and enable "Post the raw, full MIME message".
                </div>
              </div>
              <div className="flex items-start gap-2">
                <XCircle className="text-red-600 mt-1" size={20} />
                <div>
                  <strong>Unknown Format (Problem):</strong> If you see "Unknown ❌", the webhook format is not recognized. 
                  This needs custom parser logic.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Footer />
    </div>
    </div>
  );
}
