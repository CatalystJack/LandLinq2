import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Check for Jack's ultimate power role override
  const jackRole = localStorage.getItem("jack-ultimate-role");
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  if (jackRole) {
    headers["X-Jack-Ultimate-Role"] = jackRole;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey, signal }) => {
    // Check for Jack's ultimate power role override
    const jackRole = localStorage.getItem("jack-ultimate-role");
    const headers: Record<string, string> = {};
    
    if (jackRole) {
      headers["X-Jack-Ultimate-Role"] = jackRole;
    }

    try {
      // Use React Query's signal directly without creating competing AbortControllers
      const res = await fetch(queryKey.join("/") as string, {
        credentials: "include",
        headers,
        signal: signal, // Use React Query's signal directly
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      // Handle AbortErrors gracefully to prevent spurious console errors
      if (error instanceof Error && error.name === 'AbortError') {
        // Only throw AbortError if the signal was actually aborted for a legitimate reason
        if (signal?.aborted && signal?.reason) {
          throw error;
        }
        // Suppress spurious abort errors without reasons - return null for graceful handling
        console.warn('Suppressed spurious AbortError for query:', queryKey.join('/'));
        return null;
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      // Critical: Prevent unnecessary refetches on mount to avoid race conditions
      refetchOnMount: false,
      // Disable refetch behaviors that cause competing requests
      refetchOnWindowFocus: false,
      refetchOnReconnect: false, // Disable to prevent race conditions
      refetchInterval: false,
      refetchIntervalInBackground: false,
      // Optimize for large datasets like deals - longer cache times
      staleTime: 10 * 60 * 1000, // 10 minutes - data stays fresh longer
      gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache longer
      // More conservative retry strategy to prevent query storms
      retry: (failureCount, error) => {
        // Don't retry on AbortErrors, 401/403, or network errors
        if (error?.name === 'AbortError' || 
            error?.message?.includes('401') || 
            error?.message?.includes('403') ||
            error?.message?.includes('NetworkError')) {
          return false;
        }
        // Only retry once for other errors to prevent query storms
        return failureCount < 1;
      },
      retryDelay: (attemptIndex) => Math.min(2000 * 2 ** attemptIndex, 10000), // Longer delays, max 10s
      // Enable query deduplication to prevent multiple simultaneous requests
      structuralSharing: true,
      // Prevent multiple queries with same key from running simultaneously 
      networkMode: "online",
    },
    mutations: {
      retry: false,
      // Disable mutation retries completely to avoid duplicates
      networkMode: "online",
    },
  },
});
