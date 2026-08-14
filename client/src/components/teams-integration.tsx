/**
 * Microsoft Teams Integration Component
 * Allows admins to configure Teams webhook for notifications
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Settings, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TeamsIntegrationProps {
  className?: string;
}

export function TeamsIntegration({ className }: TeamsIntegrationProps) {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channelName, setChannelName] = useState('LandLinq Notifications');
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const { toast } = useToast();

  const handleConfigure = async () => {
    if (!webhookUrl) {
      toast({
        title: "Webhook URL Required",
        description: "Please enter a valid Teams webhook URL",
        variant: "destructive"
      });
      return;
    }

    if (!webhookUrl.includes('outlook.office.com/webhook')) {
      toast({
        title: "Invalid URL Format", 
        description: "Please enter a valid Teams webhook URL from Microsoft Teams",
        variant: "destructive"
      });
      return;
    }

    setIsConfiguring(true);
    try {
      const response = await fetch('/api/teams/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl, channelName })
      });

      if (response.ok) {
        setIsConfigured(true);
        toast({
          title: "Teams Integration Configured",
          description: `Successfully connected to ${channelName}`,
        });
      } else {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (error: any) {
      toast({
        title: "Configuration Failed",
        description: error.message || "Failed to configure Teams integration",
        variant: "destructive"
      });
    } finally {
      setIsConfiguring(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const response = await fetch('/api/teams/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        toast({
          title: "Test Notification Sent",
          description: "Check your Teams channel for the test message",
        });
      } else {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (error: any) {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to send test notification",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className={className} data-testid="teams-integration-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Microsoft Teams Integration
        </CardTitle>
        <CardDescription>
          Configure Teams notifications for internal deal alerts and team communications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Indicator */}
        <Alert className={isConfigured ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
          <div className="flex items-center gap-2">
            {isConfigured ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            )}
            <AlertDescription className={isConfigured ? "text-green-800" : "text-yellow-800"}>
              {isConfigured 
                ? `Teams integration is active for "${channelName}"`
                : "Teams integration not configured"
              }
            </AlertDescription>
          </div>
        </Alert>

        {/* Setup Instructions */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-gray-900">Setup Instructions:</h4>
          <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
            <li>Go to your Microsoft Teams channel</li>
            <li>Click the three dots (...) → Connectors → Incoming Webhook</li>
            <li>Click "Configure" → Enter name "LandLinq" → Create</li>
            <li>Copy the webhook URL and paste it below</li>
          </ol>
        </div>

        {/* Configuration Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Teams Webhook URL</Label>
            <Input
              id="webhook-url"
              type="url"
              placeholder="https://outlook.office.com/webhook/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              data-testid="input-webhook-url"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-name">Channel Name (Optional)</Label>
            <Input
              id="channel-name"
              placeholder="LandLinq Notifications"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              data-testid="input-channel-name"
            />
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={handleConfigure}
              disabled={isConfiguring || !webhookUrl}
              className="flex-1"
              data-testid="button-configure-teams"
            >
              {isConfiguring ? 'Configuring...' : 'Configure Teams'}
            </Button>

            {isConfigured && (
              <Button 
                variant="outline"
                onClick={handleTest}
                disabled={isTesting}
                className="flex items-center gap-2"
                data-testid="button-test-teams"
              >
                <Send className="h-4 w-4" />
                {isTesting ? 'Testing...' : 'Test'}
              </Button>
            )}
          </div>
        </div>

        {/* Notification Types */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-gray-900">You'll receive notifications for:</h4>
          <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="text-green-600">🔥</span>
              High priority deal submissions
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-600">📝</span>
              New deal analysis results
            </div>
            <div className="flex items-center gap-2">
              <span className="text-purple-600">👥</span>
              Team assignments
            </div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-600">💰</span>
              Commission milestones
            </div>
          </div>
        </div>

        {/* Privacy Note */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Privacy:</strong> Only internal team notifications are sent to Teams. 
            Broker information is limited to names and deal summaries.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}