import Footer from "@/components/footer";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Mail, MessageSquare } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

export default function UnsubscribePage() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Get email from URL params if provided
  useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email');
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam));
    }
  });

  const handleUnsubscribe = async () => {
    if (!email && !phone) {
      setStatus('error');
      setMessage('Please provide either an email address or phone number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiRequest('POST', '/api/brokers/opt-out', {
        email: email || undefined,
        phone: phone || undefined
      });

      setStatus('success');
      setMessage(response.message || 'You have been successfully unsubscribed from all communications.');
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'An error occurred while processing your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-xl">Unsubscribed Successfully</CardTitle>
            <CardDescription>
              You have been removed from our communications
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {message}
              </AlertDescription>
            </Alert>
            <div className="mt-6 text-sm text-gray-600 dark:text-gray-400">
              <p>If you change your mind in the future, you can always contact us at:</p>
              <p className="mt-2">
                📧 deals@catalyst.landlinq.ai<br />
                📱 (704) 610-1549
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Unsubscribe from LandLinq.ai</CardTitle>
          <CardDescription>
            We're sorry to see you go. Enter your information below to unsubscribe from all email and SMS communications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'error' && (
            <Alert variant="destructive">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  data-testid="input-unsubscribe-email"
                />
              </div>
            </div>

            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
              — OR —
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Enter your phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10"
                  data-testid="input-unsubscribe-phone"
                />
              </div>
            </div>

            <Button
              onClick={handleUnsubscribe}
              disabled={isSubmitting || (!email && !phone)}
              className="w-full"
              data-testid="button-unsubscribe"
            >
              {isSubmitting ? 'Unsubscribing...' : 'Unsubscribe'}
            </Button>

            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              <p>This will remove you from all email newsletters, deal notifications, and SMS messages.</p>
              <p className="mt-2">You can always resubscribe by contacting us directly.</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Footer />
    </div>
  );
}
