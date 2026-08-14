import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare } from "lucide-react";

export default function CommunicationCenter() {
  const emailTemplates = [
    {
      name: "Deal Received",
      status: "Active",
      preview: "Thank you for submitting your deal. Our team is reviewing the property details and will respond within 48 hours..."
    },
    {
      name: "Deal Approved", 
      status: "Active",
      preview: "Great news! We're interested in moving forward with your property submission. Please use this calendar link to schedule a call..."
    },
    {
      name: "Deal Declined",
      status: "Active", 
      preview: "Thank you for thinking of LandLinq for this opportunity. While this particular deal doesn't align with our current criteria..."
    }
  ];

  const smsMessages = [
    {
      sender: "LandLinq Team",
      message: "Deal received! We're reviewing your Park Road property. Expect an update within 48hrs. - LandLinq Team",
      time: "2 hours ago"
    },
    {
      sender: "LandLinq Team",
      message: "Great news! We want to move forward with your deal. Check your email for next steps. 📧",
      time: "1 day ago"
    },
    {
      sender: "LandLinq Team",
      message: "Thanks for the submission! This one doesn't fit our current criteria, but keep sending deals our way! 💪",
      time: "3 days ago"
    }
  ];

  return (
    <section className="py-20 bg-catalyst-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-catalyst-navy mb-6" data-testid="text-communication-title">
            Automated Communication System
          </h2>
          <p className="text-xl text-catalyst-gray-600">Keep brokers engaged with smart notifications</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Email Templates */}
          <Card className="border-catalyst-gray-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-catalyst-gold rounded-lg flex items-center justify-center mr-4">
                  <Mail className="text-catalyst-white" size={24} />
                </div>
                <div>
                  <CardTitle className="text-xl font-semibold text-catalyst-navy">
                    Email Automation
                  </CardTitle>
                  <p className="text-catalyst-gray-600">Automated responses based on deal status</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {emailTemplates.map((template, index) => (
                  <div 
                    key={index}
                    className="border border-catalyst-gray-200 rounded-lg p-4"
                    data-testid={`email-template-${index}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-catalyst-navy">{template.name}</span>
                      <Badge className="bg-catalyst-gold text-catalyst-white">{template.status}</Badge>
                    </div>
                    <p className="text-sm text-catalyst-gray-600">{template.preview}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* SMS Templates */}
          <Card className="border-catalyst-gray-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-catalyst-gold rounded-lg flex items-center justify-center mr-4">
                  <MessageSquare className="text-catalyst-white" size={24} />
                </div>
                <div>
                  <CardTitle className="text-xl font-semibold text-catalyst-navy">
                    SMS Automation
                  </CardTitle>
                  <p className="text-catalyst-gray-600">Quick notifications and updates</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {smsMessages.map((message, index) => (
                  <div 
                    key={index}
                    className="bg-catalyst-gray-50 rounded-lg p-4"
                    data-testid={`sms-message-${index}`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-catalyst-blue rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">L</span>
                      </div>
                      <div className="flex-1">
                        <div className="bg-white rounded-lg p-3 shadow-sm">
                          <p className="text-sm">{message.message}</p>
                        </div>
                        <p className="text-xs text-catalyst-gray-500 mt-1">{message.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
