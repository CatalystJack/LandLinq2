import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface SettingsSkeletonProps {
  variant?: 'default' | 'tabs' | 'forms' | 'metrics';
}

export function SettingsLoadingSkeleton({ variant = 'default' }: SettingsSkeletonProps) {
  if (variant === 'metrics') {
    return (
      <div className="space-y-6">
        {/* Metrics cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Main content card */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (variant === 'tabs') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent>
            {/* Tabs skeleton */}
            <div className="flex space-x-1 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-9 w-24" />
              ))}
            </div>
            
            {/* Tab content skeleton */}
            <div className="space-y-6">
              <div className="text-center py-8">
                <Skeleton className="h-12 w-12 rounded mx-auto mb-4" />
                <Skeleton className="h-5 w-64 mx-auto mb-2" />
                <Skeleton className="h-10 w-32 mx-auto" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (variant === 'forms') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Form fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            
            {/* Toggle switches */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            ))}
            
            <Skeleton className="h-10 w-32" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default variant
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}