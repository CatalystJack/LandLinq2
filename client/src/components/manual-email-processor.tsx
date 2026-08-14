/**
 * Manual Email Processor - IMMEDIATE SOLUTION
 * 
 * This component allows users to copy/paste emails directly into the system
 * while DNS propagation is in progress. Perfect for immediate email processing.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, Mail, Copy, ArrowRight } from 'lucide-react';
import { formatDealNumber } from "@shared/schema";
import { apiRequest } from '@/lib/queryClient';

interface ProcessResult {
  success: boolean;
  dealId?: string;
  dealNumber?: number;
  message?: string;
  error?: string;
}

export function ManualEmailProcessor() {
  const [emailText, setEmailText] = useState('');
  const [forwarderEmail, setForwarderEmail] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);

  const handleProcess = async () => {
    if (!emailText.trim()) return;

    setProcessing(true);
    setResult(null);

    try {
      const res = await apiRequest('POST', '/api/emails/manual', {
        emailText: emailText.trim(),
        forwarderEmail: forwarderEmail || 'manual@landlinq.ai'
      });
      
      const response = await res.json();

      setResult({
        success: true,
        dealId: response.dealId,
        dealNumber: response.dealNumber,
        message: response.message
      });

      // Clear form on success
      setEmailText('');
      setForwarderEmail('');

    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process email'
      });
    } finally {
      setProcessing(false);
    }
  };

  const exampleEmail = `From: john.broker@realty.com
Subject: New Development Opportunity in Atlanta

Hi there,

I have a great multifamily development opportunity:

Property: 1234 Peachtree Street, Atlanta, GA 30309
Size: 5.2 acres
Zoning: RM-4 (Residential Mixed Use)
Price: $2,500,000
Units: 250 units potential
Sewer: Municipal sewer available
Rent estimate: $1,800-2,200/month

This property is perfectly positioned for your conventional apartment development. Great location near MARTA station.

Let me know if you're interested!

Best regards,
John Broker
john.broker@realty.com
(404) 555-0123`;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Manual Email Processor
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          <strong>Immediate Solution:</strong> Process emails instantly while DNS propagates
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Processing Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Process Email
            </CardTitle>
            <CardDescription>
              Copy and paste any deal email below to process immediately
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forwarder-email">Your Email (Optional)</Label>
              <Input
                id="forwarder-email"
                type="email"
                placeholder="your.email@company.com"
                value={forwarderEmail}
                onChange={(e) => setForwarderEmail(e.target.value)}
                data-testid="input-forwarder-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-text">Email Content</Label>
              <Textarea
                id="email-text"
                placeholder="Paste the entire email content here..."
                className="min-h-[300px] font-mono text-sm"
                value={emailText}
                onChange={(e) => setEmailText(e.target.value)}
                data-testid="textarea-email-content"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleProcess}
                disabled={!emailText.trim() || processing}
                className="flex-1"
                data-testid="button-process-email"
              >
                {processing ? (
                  <>Processing...</>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Process Email
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setEmailText(exampleEmail)}
                data-testid="button-load-example"
              >
                Load Example
              </Button>
            </div>

            {result && (
              <Alert className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription className={result.success ? 'text-green-800' : 'text-red-800'}>
                    {result.success ? (
                      <>
                        <strong>Success!</strong> {result.message}
                        {result.dealId && (
                          <div className="mt-1 text-sm">
                            Deal ID: <code className="bg-green-100 px-1 rounded">{result.dealNumber ? formatDealNumber(result.dealNumber) : result.dealId}</code>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <strong>Error:</strong> {result.error}
                      </>
                    )}
                  </AlertDescription>
                </div>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Instructions & Alternative Solutions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>🚀 Immediate Solutions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-semibold">
                    #1
                  </div>
                  <div>
                    <p className="font-semibold">Use Working Subdomain</p>
                    <p className="text-sm text-gray-600">
                      Send emails to: <code className="bg-gray-100 px-1 rounded">deals@inbound.landlinq.ai</code>
                    </p>
                    <p className="text-xs text-green-600 mt-1">✅ Works immediately</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-semibold">
                    #2
                  </div>
                  <div>
                    <p className="font-semibold">Microsoft 365 Forwarding</p>
                    <p className="text-sm text-gray-600">
                      Set up email rule to forward catalyst@landlinq.ai → deals@inbound.landlinq.ai
                    </p>
                    <p className="text-xs text-blue-600 mt-1">⚡ 10 minute setup</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm font-semibold">
                    #3
                  </div>
                  <div>
                    <p className="font-semibold">Manual Processing</p>
                    <p className="text-sm text-gray-600">
                      Copy/paste emails here for instant processing
                    </p>
                    <p className="text-xs text-purple-600 mt-1">📧 This form</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📋 How to Use</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-semibold">1.</span>
                <span>Copy the entire email (including headers if possible)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-semibold">2.</span>
                <span>Paste into the text area above</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-semibold">3.</span>
                <span>Click "Process Email" - deal will be created instantly</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-semibold">4.</span>
                <span>Broker gets automatic confirmation email</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    DNS Propagation in Progress
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Your MX record change is taking effect. Normal email processing will resume automatically once DNS propagates (usually 15-60 minutes).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}