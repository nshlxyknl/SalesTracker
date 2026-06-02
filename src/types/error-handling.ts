/**
 * Error Handling Type Definitions
 * 
 * This file contains TypeScript interfaces for comprehensive error handling
 * across PWA, sync, and van stock management functionality.
 */

// PWA-Specific Error Handling
export interface ServiceWorkerErrorHandler {
  handleRegistrationFailure(error: Error): void;
  handleCacheFailure(error: Error, resource: string): void;
  handleSyncFailure(error: Error, operation: Record<string, unknown>): void;
  handleUpdateAvailable(): void;
}

export interface OfflineStorageErrorHandler {
  handleQuotaExceeded(error: DOMException): void;
  handleDatabaseCorruption(error: Error): void;
  handleSyncQueueFailure(error: Error): void;
  handleDataIntegrityError(error: Error): void;
}

// Sync Conflict Resolution
export interface SyncConflictResolver {
  resolveConflict(localData: Record<string, unknown>, serverData: Record<string, unknown>): ConflictResolution;
  handleMergeFailure(error: Error): void;
  notifyUser(conflict: SyncConflict): void;
}

export interface ConflictResolution {
  strategy: 'server_wins' | 'client_wins' | 'merge' | 'user_choice';
  resolvedData: Record<string, unknown>;
  requiresUserInput: boolean;
}

export interface SyncConflict {
  id: string;
  type: 'data_conflict' | 'version_conflict' | 'deletion_conflict';
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  timestamp: Date;
  description: string;
}

// Van Stock Management Error Handling
export interface ReconciliationErrorHandler {
  handleCalculationError(error: Error, data: Record<string, unknown>): void;
  handleMissingData(missingFields: string[]): void;
  handleInvalidQuantities(invalidItems: string[]): void;
  handlePaymentValidationError(error: PaymentValidationError): void;
}

export interface PaymentValidationError extends Error {
  code: 'INVALID_AMOUNT' | 'NEGATIVE_VALUE' | 'CALCULATION_ERROR' | 'MISSING_PAYMENT_METHOD';
  field: string;
  value: unknown;
}

export interface BillProcessingErrorHandler {
  handleImageUploadFailure(error: Error): void;
  handleImageProcessingError(error: Error): void;
  handleInvalidImageFormat(format: string): void;
  handleStorageFailure(error: Error): void;
}

// Network and Connectivity Error Handling
export interface NetworkErrorHandler {
  handleConnectionLoss(): void;
  handleSlowConnection(): void;
  handleServerError(status: number, error: Error): void;
  handleTimeoutError(operation: string): void;
}

export interface APIErrorHandler {
  handleAuthenticationError(): void;
  handleAuthorizationError(): void;
  handleValidationError(errors: ValidationError[]): void;
  handleRateLimitError(retryAfter: number): void;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: unknown;
}

// Generic Error Types
export interface AppError extends Error {
  code: string;
  category: 'PWA' | 'SYNC' | 'VAN_STOCK' | 'BILL_PROCESSING' | 'NETWORK' | 'API';
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  context?: Record<string, unknown>;
}

export interface ErrorContext {
  userId?: string;
  operation: string;
  timestamp: Date;
  userAgent?: string;
  url?: string;
  additionalData?: Record<string, unknown>;
}

export interface ErrorRecoveryStrategy {
  type: 'retry' | 'fallback' | 'user_action' | 'ignore';
  maxRetries?: number;
  retryDelay?: number;
  fallbackAction?: () => Promise<void>;
  userMessage?: string;
}