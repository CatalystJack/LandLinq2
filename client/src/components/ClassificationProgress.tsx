import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, CheckCircle2, XCircle, Building2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClassificationJob {
  dealId: string;
  dealNumber: number | null;
  address: string;
  step: number;
  totalSteps: number;
  stepName: string;
  status: 'running' | 'completed' | 'failed';
  classification?: string;
  startedAt: number;
}

interface ClassificationProgressData {
  activeJobs: ClassificationJob[];
}

export function ClassificationProgress() {
  const [visible, setVisible] = useState(true);
  const [recentlyCompleted, setRecentlyCompleted] = useState<ClassificationJob[]>([]);

  const { data } = useQuery<ClassificationProgressData>({
    queryKey: ['/api/classification-progress'],
    refetchInterval: 1000,
    staleTime: 500,
  });

  const activeJobs = data?.activeJobs || [];

  useEffect(() => {
    if (activeJobs.length > 0) {
      setVisible(true);
    }
  }, [activeJobs.length]);

  useEffect(() => {
    const completedJobs = activeJobs.filter(job => job.status === 'completed' || job.status === 'failed');
    if (completedJobs.length > 0) {
      setRecentlyCompleted(prev => [...prev, ...completedJobs]);
      setTimeout(() => {
        setRecentlyCompleted(prev => prev.filter(j => !completedJobs.includes(j)));
      }, 3000);
    }
  }, [activeJobs]);

  const runningJobs = activeJobs.filter(job => job.status === 'running');
  const allJobs = [...runningJobs, ...recentlyCompleted];

  if (allJobs.length === 0) {
    return null;
  }

  return (
    <div 
      className={cn(
        "fixed bottom-4 right-4 z-50 transition-all duration-300",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}
      data-testid="classification-progress-container"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-[320px] max-w-[400px]">
        <div className="bg-slate-800 px-4 py-2 flex items-center gap-2 border-b border-slate-700">
          <Building2 className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-medium text-white">Deal Classification</span>
          <span className="ml-auto text-xs text-slate-400">
            {runningJobs.length} active
          </span>
          <button 
            onClick={() => setVisible(false)}
            className="ml-2 p-1 hover:bg-slate-700 rounded transition-colors"
            aria-label="Close classification panel"
          >
            <X className="h-3.5 w-3.5 text-slate-400 hover:text-white" />
          </button>
        </div>
        
        <div className="max-h-[300px] overflow-y-auto">
          {allJobs.map((job) => (
            <ClassificationJobItem key={job.dealId} job={job} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ClassificationJobItem({ job }: { job: ClassificationJob }) {
  const progress = Math.round((job.step / job.totalSteps) * 100);
  
  const getStatusIcon = () => {
    switch (job.status) {
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-400" />;
    }
  };

  const getClassificationBadge = () => {
    if (!job.classification) return null;
    const colors: Record<string, string> = {
      green: 'bg-green-500/20 text-green-400 border-green-500/30',
      yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      red: 'bg-red-500/20 text-red-400 border-red-500/30',
      unclassified: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    };
    return (
      <span className={cn(
        "text-xs px-1.5 py-0.5 rounded border",
        colors[job.classification] || colors.unclassified
      )}>
        {job.classification.toUpperCase()}
      </span>
    );
  };

  return (
    <div 
      className={cn(
        "px-4 py-3 border-b border-slate-700/50 last:border-b-0",
        job.status === 'completed' && "bg-green-900/10",
        job.status === 'failed' && "bg-red-900/10"
      )}
      data-testid={`classification-job-${job.dealId}`}
    >
      <div className="flex items-start gap-3">
        {getStatusIcon()}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-white truncate">
              Deal #{job.dealNumber || '...'}
            </span>
            {getClassificationBadge()}
          </div>
          <div className="text-xs text-slate-400 truncate mb-2">
            {job.address}
          </div>
          {job.status === 'running' && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400 font-mono w-8 text-right">
                  {progress}%
                </span>
              </div>
              <div className="text-xs text-slate-500">
                Step {job.step}/{job.totalSteps}: {job.stepName}
              </div>
            </>
          )}
          {job.status === 'completed' && (
            <div className="text-xs text-green-400">Classification complete</div>
          )}
          {job.status === 'failed' && (
            <div className="text-xs text-red-400">Classification failed</div>
          )}
        </div>
      </div>
    </div>
  );
}
