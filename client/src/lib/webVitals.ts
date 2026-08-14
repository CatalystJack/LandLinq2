import { onCLS, onINP, onFCP, onLCP, onTTFB, Metric } from 'web-vitals';

interface PerformanceMetrics {
  CLS: number | null;
  INP: number | null;
  FCP: number | null;
  LCP: number | null;
  TTFB: number | null;
  timestamp: number;
  url: string;
  componentName?: string;
}

class WebVitalsCollector {
  private metrics: PerformanceMetrics = {
    CLS: null,
    INP: null,
    FCP: null,
    LCP: null,
    TTFB: null,
    timestamp: Date.now(),
    url: window.location.href
  };

  private callbacks: Array<(metrics: PerformanceMetrics) => void> = [];

  constructor() {
    this.initializeWebVitals();
  }

  private initializeWebVitals() {
    // Core Web Vitals
    onCLS((metric: Metric) => {
      this.updateMetric('CLS', metric.value);
    });

    onINP((metric: Metric) => {
      this.updateMetric('INP', metric.value);
    });

    onLCP((metric: Metric) => {
      this.updateMetric('LCP', metric.value);
    });

    // Additional metrics
    onFCP((metric: Metric) => {
      this.updateMetric('FCP', metric.value);
    });

    onTTFB((metric: Metric) => {
      this.updateMetric('TTFB', metric.value);
    });
  }

  private updateMetric(name: keyof Omit<PerformanceMetrics, 'timestamp' | 'url' | 'componentName'>, value: number) {
    this.metrics[name] = value;
    this.metrics.timestamp = Date.now();
    
    // Notify all callbacks
    this.callbacks.forEach(callback => callback({ ...this.metrics }));
    
    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Web Vitals] ${name}:`, value);
    }
  }

  public onMetricsUpdate(callback: (metrics: PerformanceMetrics) => void) {
    this.callbacks.push(callback);
    
    // Return cleanup function
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public createComponentMetrics(componentName: string): PerformanceMetrics {
    return {
      ...this.metrics,
      componentName,
      timestamp: Date.now(),
      url: window.location.href
    };
  }

  // Method to send metrics to backend
  public async sendMetricsToBackend(additionalData?: Record<string, any>) {
    try {
      const payload = {
        ...this.metrics,
        ...additionalData,
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        viewportSize: `${window.innerWidth}x${window.innerHeight}`,
        timestamp: Date.now()
      };

      // In development, just log to console
      if (process.env.NODE_ENV === 'development') {
        console.log('[Web Vitals] Performance Metrics:', payload);
        return;
      }

      // Send to backend in production (if endpoint exists)
      await fetch('/api/performance-metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
    } catch (error) {
      console.warn('[Web Vitals] Failed to send metrics:', error);
    }
  }
}

// Singleton instance
export const webVitalsCollector = new WebVitalsCollector();

// Hook for React components
export function useWebVitals(componentName?: string) {
  const sendComponentMetrics = () => {
    const metrics = webVitalsCollector.createComponentMetrics(componentName || 'UnknownComponent');
    webVitalsCollector.sendMetricsToBackend({ componentName });
    return metrics;
  };

  return {
    sendComponentMetrics,
    getMetrics: () => webVitalsCollector.getMetrics(),
    onMetricsUpdate: (callback: (metrics: PerformanceMetrics) => void) => 
      webVitalsCollector.onMetricsUpdate(callback)
  };
}

// Performance measurement utilities
export function measurePerformance<T>(
  operation: () => T | Promise<T>,
  operationName: string
): Promise<{ result: T; duration: number }> {
  return new Promise(async (resolve) => {
    const startTime = performance.now();
    
    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Performance] ${operationName} took ${duration.toFixed(2)}ms`);
      }
      
      resolve({ result, duration });
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error(`[Performance] ${operationName} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  });
}

// Bundle size tracking utility
export function getBundleInfo() {
  const scripts = Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[];
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
  
  const bundleInfo = {
    scriptCount: scripts.length,
    styleCount: styles.length,
    scripts: scripts.map(script => ({
      src: script.src,
      size: script.src.length // Rough estimate
    })),
    styles: styles.map(style => ({
      href: style.href,
      size: style.href.length // Rough estimate
    })),
    timestamp: Date.now()
  };

  if (process.env.NODE_ENV === 'development') {
    console.log('[Bundle Info]', bundleInfo);
  }

  return bundleInfo;
}