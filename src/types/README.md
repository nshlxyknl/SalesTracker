# TypeScript Types for PWA-Enhanced Van Stock Management

This directory contains comprehensive TypeScript interfaces and types for the PWA-enhanced van stock management system.

## File Structure

### Core Type Files

- **`index.ts`** - Main export file that re-exports all types with conflict resolution
- **`pwa.ts`** - PWA core types including manifest, offline storage, and sync management
- **`service-worker.ts`** - Service worker specific types for caching and background sync
- **`van-stock.ts`** - Van stock management types for reconciliation and discrepancy detection
- **`bill-processing.ts`** - Bill processing types for image uploads and item selection
- **`database.ts`** - Database model types extending the Prisma schema
- **`error-handling.ts`** - Comprehensive error handling types for all system components

## Key Type Categories

### PWA Types
- `WebAppManifest` - PWA manifest configuration
- `ServiceWorkerConfig` - Service worker caching strategies
- `OfflineStorageManager` - IndexedDB offline storage interface
- `SyncManager` - Data synchronization management
- `SyncOperation` - Individual sync operations

### Van Stock Management Types
- `VanStockManager` - Core van stock operations interface
- `ReconciliationEngine` - Discrepancy calculation and reporting
- `VanLoadItem` - Stock loading data structure
- `ReconciliationReport` - Complete reconciliation results
- `DiscrepancyAlert` - Discrepancy detection and alerting
- `PaymentRecord` - Payment validation structure

### Bill Processing Types
- `BillProcessor` - Bill image processing interface
- `BillUpload` - Bill image upload data
- `SelectedItem` - Item selection from bills
- `BillSubmission` - Complete bill submission data
- `AvailableItem` - Available stock items for selection

### Database Types
- Extended Prisma model types with PWA functionality
- Create/Update data types for all models
- Query filter types for database operations
- Relationship types for joined queries

### Service Worker Types
- `ServiceWorkerGlobalScope` - Service worker global context
- Event types for install, activate, fetch, sync, and push
- Cache management and strategy types
- Background sync and push notification types

### Error Handling Types
- PWA-specific error handlers
- Sync conflict resolution types
- Network and API error handling
- Recovery strategy definitions

## Usage Examples

### Importing Types

```typescript
// Import specific types
import type { VanStockManager, ReconciliationEngine } from '@/types';

// Import database types with aliases to avoid conflicts
import type { DatabaseUser, DatabaseSale } from '@/types';

// Import PWA types
import type { WebAppManifest, ServiceWorkerConfig } from '@/types';
```

### Using Van Stock Types

```typescript
import type { VanLoadItem, PaymentRecord, ReconciliationReport } from '@/types';

const vanLoad: VanLoadItem = {
  itemName: 'NP-250 ml',
  loaded: 100,
  returned: 10
};

const payments: PaymentRecord = {
  cash: 1000,
  credit: 500,
  cheque: 200,
  total: 1700
};
```

### Using PWA Types

```typescript
import type { SyncOperation, OfflineStorageManager } from '@/types';

const syncOp: SyncOperation = {
  id: 'sync123',
  type: 'CREATE',
  endpoint: '/api/van-load',
  data: vanLoad,
  timestamp: Date.now(),
  retryCount: 0,
  maxRetries: 3
};
```

## Type Safety Features

### Conflict Resolution
- Database types are explicitly exported with `Database` prefix to avoid conflicts
- Service worker events are prefixed to distinguish from DOM events
- PWA sync events are renamed to avoid conflicts with service worker sync events

### Strict Typing
- All interfaces use strict typing with required and optional properties clearly defined
- Union types are used for enums and status values
- Generic types are provided for API responses and paginated data

### Extensibility
- Interfaces are designed to be extended for future functionality
- Optional properties allow for gradual implementation
- Generic types support various data structures

## Requirements Mapping

These types implement the interfaces specified in the design document and support:

- **Requirement 3.2**: Van stock management data structures
- **Requirement 4.5**: Bill processing and submission types
- **Requirement 7.1**: Offline storage and sync operation types
- **Requirements 1.1-1.7**: PWA manifest and service worker types
- **Requirements 5.1-5.8**: Reconciliation and discrepancy detection types

## Validation

All types have been validated to:
- Compile without TypeScript errors
- Work together without conflicts
- Support the complete PWA-enhanced van stock management workflow
- Maintain compatibility with existing codebase structures