import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Zap, Search, CheckCircle2, AlertCircle } from "lucide-react";

interface AIProgressProps {
  isProcessing: boolean;
  onComplete?: () => void;
  className?: string;
}

const processingSteps = [
  { 
    id: "analyzing", 
    label: "Analyzing zoning requirements...", 
    icon: Search,
    duration: 2000 
  },
  { 
    id: "processing", 
    label: "Processing comparables...", 
    icon: Brain,
    duration: 1800 
  },
  { 
    id: "evaluating", 
    label: "AI evaluation in progress...", 
    icon: Zap,
    duration: 1500 
  },
  { 
    id: "complete", 
    label: "Intelligent Classification complete!", 
    icon: CheckCircle2,
    duration: 0 
  }
];

export default function AIProgress({ isProcessing, onComplete, className }: AIProgressProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [typingText, setTypingText] = useState("");

  useEffect(() => {
    if (!isProcessing) {
      setCurrentStep(0);
      setProgress(0);
      setTypingText("");
      return;
    }

    let stepTimer: NodeJS.Timeout;
    let progressTimer: NodeJS.Timeout;
    let typingTimer: NodeJS.Timeout;

    const runStep = (stepIndex: number) => {
      if (stepIndex >= processingSteps.length - 1) {
        setCurrentStep(stepIndex);
        setProgress(100);
        onComplete?.();
        return;
      }

      setCurrentStep(stepIndex);
      const step = processingSteps[stepIndex];
      const stepProgress = ((stepIndex + 1) / processingSteps.length) * 100;

      // Animate typing effect
      let charIndex = 0;
      const typeStep = () => {
        if (charIndex <= step.label.length) {
          setTypingText(step.label.substring(0, charIndex));
          charIndex++;
          typingTimer = setTimeout(typeStep, 50);
        }
      };
      typeStep();

      // Animate progress
      const startProgress = (stepIndex / processingSteps.length) * 100;
      let currentProgress = startProgress;
      const progressStep = () => {
        if (currentProgress < stepProgress) {
          currentProgress += 2;
          setProgress(Math.min(currentProgress, stepProgress));
          progressTimer = setTimeout(progressStep, 50);
        }
      };
      progressStep();

      // Move to next step
      stepTimer = setTimeout(() => runStep(stepIndex + 1), step.duration);
    };

    runStep(0);

    return () => {
      clearTimeout(stepTimer);
      clearTimeout(progressTimer);
      clearTimeout(typingTimer);
    };
  }, [isProcessing, onComplete]);

  if (!isProcessing && currentStep === 0) return null;

  const CurrentIcon = processingSteps[currentStep]?.icon || Brain;
  const isComplete = currentStep === processingSteps.length - 1;

  return (
    <Card className={`ai-scan tech-overlay ${className}`} data-testid="ai-progress">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="ai-pulse">
            <CurrentIcon 
              className={`h-5 w-5 ${isComplete ? 'text-green-500' : 'text-blue-400'}`}
              data-testid="ai-progress-icon"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span 
              className={`text-sm font-medium ai-typing ${isComplete ? 'text-green-600' : 'text-blue-600'}`}
              data-testid="ai-progress-text"
            >
              {typingText}
            </span>
            <span className="text-xs text-muted-foreground" data-testid="ai-progress-percentage">
              {Math.round(progress)}%
            </span>
          </div>
          
          <Progress 
            value={progress} 
            className="h-2"
            data-testid="ai-progress-bar"
          />
        </div>

        {isComplete && (
          <div className="mt-3 text-xs text-green-600 font-medium" data-testid="ai-complete-message">
            ✨ Automated Screening completed successfully!
          </div>
        )}
      </CardContent>
    </Card>
  );
}