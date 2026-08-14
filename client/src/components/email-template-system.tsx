import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Mail, Plus, Edit, Copy, Send, Star, Clock, CheckCircle, XCircle, AlertCircle, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: 'initial_response' | 'follow_up' | 'rejection' | 'approval' | 'request_info' | 'closing';
  tags: string[];
  variables: string[];
  lastUsed?: Date;
  useCount: number;
  isFavorite: boolean;
}

// Backend template interface
interface BackendTemplate {
  event: string;
  name: string;
  subject: string;
}

interface EmailTemplateSystemProps {
  dealData?: any;
  brokerData?: any;
  onSendEmail?: (subject: string, body: string, recipient: string) => void;
}

export default function EmailTemplateSystem({ dealData, brokerData, onSendEmail }: EmailTemplateSystemProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<BackendTemplate | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showPreview, setShowPreview] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [showTestDialog, setShowTestDialog] = useState(false);
  const { toast } = useToast();

  // Fetch available template types from backend
  const { data: templateTypesData, isLoading: templatesLoading } = useQuery<{templates: BackendTemplate[]}>({
    queryKey: ['/api/email-template-types'],
    refetchOnWindowFocus: false
  });

  const templates = templateTypesData?.templates || [];

  // Template variables for the preview
  const templateVariables = {
    brokerName: brokerData?.firstName + ' ' + brokerData?.lastName || 'John Smith',
    address: dealData?.address || '123 Main Street, Austin, TX',
    dealId: dealData?.id || 'DEAL-12345',
    classification: dealData?.classification || 'Under Review',
    analystName: 'Sarah Johnson',
    analystEmail: 'sarah@landlinq.ai',
    developerName: 'Mike Chen',
    partnerName: 'Alex Rodriguez',
    rejectionReason: 'Property size does not meet minimum requirements',
    missingFields: 'Property surveys, zoning documentation',
    brokerEmail: brokerData?.email || 'broker@example.com'
  };

  // Generate email preview using backend template service
  const { data: previewData, isLoading: previewLoading, refetch: refreshPreview } = useQuery<{subject: string; content: string; html: string}>({
    queryKey: ['/api/email-preview', selectedTemplate?.event, templateVariables],
    queryFn: async () => {
      if (!selectedTemplate?.event) {
        throw new Error('No template selected');
      }
      
      return await apiRequest(`/api/email-preview`, {
        method: 'POST',
        body: JSON.stringify({
          templateType: selectedTemplate.event,
          variables: templateVariables
        })
      });
    },
    enabled: !!selectedTemplate?.event,
    refetchOnWindowFocus: false
  });

  // Test email sending mutation
  const testEmailMutation = useMutation({
    mutationFn: async ({ templateType, testEmail }: { templateType: string; testEmail: string }) => {
      return await apiRequest(`/api/send-test-email`, {
        method: 'POST',
        body: JSON.stringify({
          templateType,
          testEmail,
          variables: templateVariables
        })
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Test Email Sent",
        description: `Test email sent successfully to ${testEmail}`,
      });
      setShowTestDialog(false);
      setTestEmail('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send test email",
        variant: "destructive"
      });
    }
  });

  const selectTemplate = (template: BackendTemplate) => {
    setSelectedTemplate(template);
    // Refresh preview when template is selected
    setTimeout(() => refreshPreview(), 100);
  };

  const handleSendTestEmail = () => {
    if (!selectedTemplate) {
      toast({
        title: "No Template Selected",
        description: "Please select a template first",
        variant: "destructive"
      });
      return;
    }
    setShowTestDialog(true);
  };

  const copyToClipboard = () => {
    if (!previewData) {
      toast({
        title: "No Preview Available",
        description: "Please select a template first",
        variant: "destructive"
      });
      return;
    }

    const emailContent = `Subject: ${previewData.subject}\n\n${previewData.content}`;
    navigator.clipboard.writeText(emailContent);
    toast({
      title: "Copied to Clipboard",
      description: "Email content copied to clipboard",
    });
  };

  const filteredTemplates = templates.filter((template: BackendTemplate) => {
    const matchesSearch = searchQuery === '' || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.event.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 lg:grid-cols-2 gap-6 h-full">
      {/* Template Selection Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Templates
          </CardTitle>
          
          {/* Filters */}
          <div className="space-y-4">
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            
            <div className="flex gap-2">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="initial_response">Initial Response</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="approval">Approval</SelectItem>
                  <SelectItem value="rejection">Rejection</SelectItem>
                  <SelectItem value="request_info">Request Info</SelectItem>
                  <SelectItem value="closing">Closing</SelectItem>
                </SelectContent>
              </Select>
              
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    New Template
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Template</DialogTitle>
                  </DialogHeader>
                  {/* Template creation form would go here */}
                  <p className="text-sm text-catalyst-gray-600">Template creation form coming soon...</p>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            {templatesLoading ? (
              <div className="p-4 text-center text-catalyst-gray-500">
                Loading templates...
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="p-4 text-center text-catalyst-gray-500">
                No templates found. Configure templates in outreach management.
              </div>
            ) : (
              filteredTemplates.map((template: BackendTemplate) => (
                <div
                  key={template.event}
                  className={`p-4 border-b border-catalyst-gray-100 cursor-pointer hover:bg-catalyst-gray-50 transition-colors ${
                    selectedTemplate?.event === template.event ? 'bg-catalyst-gold/10 border-l-4 border-l-catalyst-gold' : ''
                  }`}
                  onClick={() => selectTemplate(template)}
                  data-testid={`template-${template.event}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium text-catalyst-navy" data-testid={`text-template-name-${template.event}`}>
                          {template.name}
                        </h4>
                      </div>
                      
                      <p className="text-sm text-catalyst-gray-600 mb-2 line-clamp-2" data-testid={`text-template-subject-${template.event}`}>
                        {template.subject}
                      </p>
                      
                      <div className="flex items-center gap-2">
                        <Badge className="text-xs bg-blue-100 text-blue-800">
                          <Mail className="h-3 w-3 mr-1" />
                          <span className="capitalize">{template.event.replace('_', ' ')}</span>
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email Composer Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Compose Email
            {selectedTemplate && (
              <Badge variant="outline" className="ml-2">
                {selectedTemplate.name}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {selectedTemplate ? (
            <>
              {/* Template Info */}
              <div className="bg-catalyst-gray-50 p-3 rounded-lg">
                <h5 className="text-sm font-medium text-catalyst-gray-700 mb-1">Selected Template:</h5>
                <p className="text-sm text-catalyst-gray-600" data-testid="text-selected-template">
                  {selectedTemplate.name} ({selectedTemplate.event})
                </p>
                <p className="text-xs text-catalyst-gray-500 mt-1">
                  Preview below shows exactly what recipients will see
                </p>
              </div>

              {previewLoading && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-700">Generating preview...</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 flex-wrap">
                <Button
                  onClick={handleSendTestEmail}
                  className="bg-catalyst-gold text-white hover:bg-white hover:text-catalyst-gold border border-catalyst-gold hover:border-catalyst-gold"
                  data-testid="button-send-test-email"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Test Email
                </Button>
                
                <Button variant="outline" onClick={copyToClipboard} data-testid="button-copy-email">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Content
                </Button>

                {/* Mobile Preview Toggle */}
                <Button 
                  variant="outline" 
                  onClick={() => setShowPreview(!showPreview)}
                  className="xl:hidden"
                  data-testid="button-toggle-preview"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {showPreview ? 'Hide' : 'Show'} Preview
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-catalyst-gray-500">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a template to see preview</p>
              <p className="text-xs mt-2">Templates are managed in outreach settings</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Preview Panel */}
      <Card className={`${showPreview ? 'block' : 'xl:block hidden'}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Live Preview
            <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
              Real-time
            </Badge>
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          {selectedTemplate && previewData ? (
            <div className="border rounded-lg bg-white shadow-sm" data-testid="email-preview-container">
              {/* Email Header */}
              <div className="border-b p-4 bg-gray-50">
                <div className="space-y-2 text-sm">
                  <div className="flex">
                    <span className="font-medium text-gray-600 w-16">From:</span>
                    <a href="mailto:catalyst@landlinq.ai" className="text-gray-900 hover:text-catalyst-navy transition-colors" data-testid="text-from-email">catalyst@landlinq.ai</a>
                  </div>
                  <div className="flex">
                    <span className="font-medium text-gray-600 w-16">To:</span>
                    <span className="text-gray-900" data-testid="text-to-email">{templateVariables.brokerEmail}</span>
                  </div>
                  <div className="flex">
                    <span className="font-medium text-gray-600 w-16">Subject:</span>
                    <span className="text-gray-900 font-medium" data-testid="text-email-subject">
                      {previewData.subject}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Email Body - Show HTML or Plain Text */}
              <div className="p-4">
                {previewData.html ? (
                  <div 
                    className="email-preview-content"
                    dangerouslySetInnerHTML={{ __html: previewData.html }}
                    data-testid="email-html-content"
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed" data-testid="email-text-content">
                    {previewData.content}
                  </div>
                )}
                
                {/* Notice */}
                <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-400">
                  <div className="bg-green-50 p-3 rounded border border-green-200">
                    <div className="flex items-center text-green-700">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      <span className="font-medium">Real Email Preview</span>
                    </div>
                    <p className="text-green-600 mt-1">
                      This shows exactly what recipients will see, including all styling and branding from your outreach management settings.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : previewLoading ? (
            <div className="text-center py-12 text-catalyst-gray-500">
              <div className="animate-spin h-8 w-8 border-2 border-catalyst-gold border-t-transparent rounded-full mx-auto mb-4"></div>
              <p>Loading email preview...</p>
            </div>
          ) : selectedTemplate ? (
            <div className="text-center py-12 text-catalyst-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Preview not available</p>
              <p className="text-xs mt-2">Configure templates in outreach management</p>
            </div>
          ) : (
            <div className="text-center py-12 text-catalyst-gray-500">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a template to see preview</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Email Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-catalyst-gray-600 mb-4">
                Send a test email using the <strong>{selectedTemplate?.name}</strong> template to verify it displays correctly.
              </p>
              <Input
                placeholder="Enter test email address"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                type="email"
                data-testid="input-test-email"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (selectedTemplate && testEmail) {
                    testEmailMutation.mutate({
                      templateType: selectedTemplate.event,
                      testEmail: testEmail
                    });
                  }
                }}
                disabled={!testEmail || testEmailMutation.isPending}
                className="bg-catalyst-gold text-white hover:bg-white hover:text-catalyst-gold border border-catalyst-gold hover:border-catalyst-gold"
                data-testid="button-confirm-test-email"
              >
                {testEmailMutation.isPending ? 'Sending...' : 'Send Test Email'}
              </Button>
              <Button variant="outline" onClick={() => setShowTestDialog(false)} data-testid="button-cancel-test-email">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}