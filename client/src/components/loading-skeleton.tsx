import { Skeleton } from '@/components/ui/skeleton';

interface LoadingSkeletonProps {
  type?: 'dashboard' | 'form' | 'table' | 'card';
  count?: number;
}

export function LoadingSkeleton({ type = 'card', count = 1 }: LoadingSkeletonProps) {
  const skeletons = Array.from({ length: count }, (_, index) => {
    switch (type) {
      case 'dashboard':
        return (
          <div key={index} className="space-y-4 p-6 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        );
      
      case 'form':
        return (
          <div key={index} className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        );
      
      case 'table':
        return (
          <div key={index} className="space-y-3">
            <div className="flex gap-4">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-20" />
            </div>
            {Array.from({ length: 5 }, (_, rowIndex) => (
              <div key={rowIndex} className="flex gap-4">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        );
      
      default: // card
        return (
          <div key={index} className="space-y-3 p-4 border border-gray-200 rounded-lg">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-24" />
          </div>
        );
    }
  });

  return <div className="space-y-4">{skeletons}</div>;
}