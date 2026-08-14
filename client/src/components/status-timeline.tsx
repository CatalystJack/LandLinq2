import { CheckCircle2, Clock, Zap, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TimelineStep {
  id: string;
  title: string;
  description: string;
  status: "completed" | "active" | "pending";
  timestamp?: string;
  icon: React.ElementType;
}

interface StatusTimelineProps {
  dealId: string;
  currentStatus: "pending" | "processing" | "analyzed" | "classified";
  classification?: "pursuing" | "reviewing" | "passed";
  submittedAt?: string;
  analyzedAt?: string;
  className?: string;
}

export default function StatusTimeline({ 
  dealId, 
  currentStatus, 
  classification, 
  submittedAt, 
  analyzedAt,
  className 
}: StatusTimelineProps) {
  
  const getSteps = (): TimelineStep[] => {
    const baseSteps: TimelineStep[] = [
      {
        id: "received",
        title: "Received",
        description: "Deal submitted to platform",
        status: "completed",
        timestamp: submittedAt,
        icon: CheckCircle2
      },
      {
        id: "ai-processing",
        title: "AI Processing",
        description: "Automated Screening in progress",
        status: currentStatus === "processing" ? "active" : 
                currentStatus === "pending" ? "pending" : "completed",
        icon: Zap
      },
      {
        id: "market-analysis", 
        title: "Market Analysis",
        description: "Smart Analysis of comparables",
        status: currentStatus === "analyzed" ? "active" :
                ["pending", "processing"].includes(currentStatus) ? "pending" : "completed",
        icon: BarChart3
      },
      {
        id: "classification",
        title: "Intelligent Classification", 
        description: classification ? `Classified as ${classification}` : "Final AI evaluation",
        status: currentStatus === "classified" ? "completed" :
                ["pending", "processing", "analyzed"].includes(currentStatus) ? "pending" : "completed",
        timestamp: analyzedAt,
        icon: CheckCircle2
      }
    ];

    return baseSteps;
  };

  const steps = getSteps();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-green-500";
      case "active": return "text-blue-500";
      default: return "text-gray-400";
    }
  };

  const getStatusIcon = (status: string, Icon: React.ElementType) => {
    const colorClass = getStatusColor(status);
    const pulseClass = status === "active" ? "ai-pulse" : "";
    
    return (
      <div className={`${pulseClass} ${colorClass}`}>
        <Icon className="h-4 w-4" />
      </div>
    );
  };

  return (
    <Card className={`tech-overlay ${className}`} data-testid="status-timeline">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4 text-blue-500" />
          Automated Processing Pipeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="status-timeline space-y-4" data-testid="timeline-steps">
          {steps.map((step, index) => (
            <div 
              key={step.id}
              className={`timeline-step ${step.status}`}
              data-testid={`timeline-step-${step.id}`}
            >
              <div className="flex items-start gap-3">
                {getStatusIcon(step.status, step.icon)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className={`text-sm font-medium ${getStatusColor(step.status)}`}>
                      {step.title}
                    </h4>
                    {step.timestamp && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(step.timestamp).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {step.description}
                    {step.status === "active" && (
                      <span className="ai-typing ml-1"></span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
          <p className="text-xs text-blue-600 dark:text-blue-400">
            <strong>Smart Analysis:</strong> Our AI automatically evaluates zoning, infrastructure, and market conditions to provide instant deal classification.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}