/**
 * Batch API Utilities for LandLinq
 * Optimizes API calls by batching multiple operations together
 */

import { apiRequest } from './queryClient';

export interface BatchOperation<T = any> {
  id: string;
  operation: string;
  data: T;
}

export interface BatchResult<T = any> {
  success: boolean;
  id: string;
  data?: T;
  error?: string;
}

export interface BatchOptions {
  batchSize?: number;
  delayBetweenBatches?: number;
  retryFailedOperations?: boolean;
  maxRetries?: number;
}

/**
 * Default batch configuration
 */
const DEFAULT_BATCH_OPTIONS: Required<BatchOptions> = {
  batchSize: 10,
  delayBetweenBatches: 100,
  retryFailedOperations: true,
  maxRetries: 3
};

/**
 * Generic batch processor for API operations
 */
export class BatchProcessor {
  private options: Required<BatchOptions>;

  constructor(options: BatchOptions = {}) {
    this.options = { ...DEFAULT_BATCH_OPTIONS, ...options };
  }

  /**
   * Process multiple operations in batches
   */
  async processBatch<T, R>(
    operations: BatchOperation<T>[],
    endpoint: string,
    options?: Partial<BatchOptions>
  ): Promise<BatchResult<R>[]> {
    const config = { ...this.options, ...options };
    const results: BatchResult<R>[] = [];
    
    // Split operations into batches
    const batches = this.chunkArray(operations, config.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      try {
        console.log(`Processing batch ${i + 1}/${batches.length} with ${batch.length} operations`);
        
        const batchResults = await this.processSingleBatch<T, R>(batch, endpoint);
        results.push(...batchResults);
        
        // Add delay between batches to avoid overwhelming the server
        if (i < batches.length - 1 && config.delayBetweenBatches > 0) {
          await this.delay(config.delayBetweenBatches);
        }
      } catch (error) {
        console.error(`Batch ${i + 1} failed:`, error);
        
        // Add failed results for this batch
        batch.forEach(operation => {
          results.push({
            success: false,
            id: operation.id,
            error: error instanceof Error ? error.message : 'Batch processing failed'
          });
        });
      }
    }
    
    return results;
  }

  /**
   * Process a single batch of operations
   */
  private async processSingleBatch<T, R>(
    operations: BatchOperation<T>[],
    endpoint: string
  ): Promise<BatchResult<R>[]> {
    const response = await apiRequest('POST', endpoint, {
      operations: operations.map(op => ({
        id: op.id,
        operation: op.operation,
        data: op.data
      }))
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      throw new Error(responseData.message || 'Batch operation failed');
    }

    return responseData.results || [];
  }

  /**
   * Utility to split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Utility to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Predefined batch processors for common operations
 */
export const batchProcessors = {
  deals: new BatchProcessor({ batchSize: 5, delayBetweenBatches: 200 }),
  brokers: new BatchProcessor({ batchSize: 10, delayBetweenBatches: 100 }),
  communications: new BatchProcessor({ batchSize: 20, delayBetweenBatches: 50 })
};

/**
 * High-level batch operation functions
 */

/**
 * Batch create deals
 */
export async function batchCreateDeals(deals: any[]): Promise<BatchResult[]> {
  const operations = deals.map((deal, index) => ({
    id: `deal-${index}`,
    operation: 'create',
    data: deal
  }));

  return batchProcessors.deals.processBatch(operations, '/api/deals/batch');
}

/**
 * Batch update deals
 */
export async function batchUpdateDeals(updates: Array<{ id: string; [key: string]: any }>): Promise<BatchResult[]> {
  const operations = updates.map((update, index) => ({
    id: `update-${index}`,
    operation: 'update',
    data: { updates: [update] }
  }));

  return batchProcessors.deals.processBatch(operations, '/api/deals/batch');
}

/**
 * Batch classify deals
 */
export async function batchClassifyDeals(
  dealIds: string[], 
  classification: 'red' | 'yellow' | 'green',
  status?: string
): Promise<BatchResult[]> {
  const operation = {
    id: 'classify-batch',
    operation: 'classify',
    data: { dealIds, classification, status }
  };

  return batchProcessors.deals.processBatch([operation], '/api/deals/batch');
}

/**
 * Batch create brokers
 */
export async function batchCreateBrokers(brokers: any[]): Promise<BatchResult[]> {
  const operations = brokers.map((broker, index) => ({
    id: `broker-${index}`,
    operation: 'create',
    data: broker
  }));

  return batchProcessors.brokers.processBatch(operations, '/api/brokers/batch');
}

/**
 * Batch activate/deactivate brokers
 */
export async function batchToggleBrokers(
  brokerIds: string[], 
  activate: boolean
): Promise<BatchResult[]> {
  const operation = {
    id: 'toggle-batch',
    operation: activate ? 'activate' : 'deactivate',
    data: { brokerIds }
  };

  return batchProcessors.brokers.processBatch([operation], '/api/brokers/batch');
}

/**
 * Batch send communications
 */
export async function batchSendNotifications(
  brokerIds: string[],
  template: {
    type: 'email' | 'sms';
    subject?: string;
    message: string;
    recipientEmail?: string;
  }
): Promise<BatchResult[]> {
  const operation = {
    id: 'notify-batch',
    operation: 'bulk-notify',
    data: { brokerIds, template }
  };

  return batchProcessors.communications.processBatch([operation], '/api/communications/batch');
}

/**
 * React hook for batch operations with loading state
 */
export function useBatchOperation() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const executeBatch = async <T, R>(
    processor: BatchProcessor,
    operations: BatchOperation<T>[],
    endpoint: string
  ): Promise<BatchResult<R>[]> => {
    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const batchResults = await processor.processBatch<T, R>(operations, endpoint);
      setResults(batchResults);
      return batchResults;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Batch operation failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    results,
    error,
    executeBatch
  };
}

// Import React for the hook
import { useState } from 'react';