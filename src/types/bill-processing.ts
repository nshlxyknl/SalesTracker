/**
 * Bill Processing Type Definitions
 * 
 * This file contains TypeScript interfaces for bill processing functionality
 * including image uploads, item selection, and bill submissions.
 */

// Bill Processor Types
export interface BillProcessor {
  uploadBill(userId: string, billData: BillUpload): Promise<BillUploadResult>;
  selectItems(billId: string, selectedItems: SelectedItem[]): Promise<void>;
  getBillSubmissions(userId?: string, date?: Date): Promise<BillSubmission[]>;
  processBillImage(imageData: string): Promise<ProcessedBill>;
}

export interface BillUpload {
  imageData: string;
  imageName: string;
  billNumber?: string;
  timestamp: Date;
}

export interface BillUploadResult {
  billId: string;
  success: boolean;
  message: string;
  availableItems: AvailableItem[];
}

export interface SelectedItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: string;
}

export interface BillSubmission {
  id: string;
  userId: string;
  billNumber: string;
  imageData: string;
  imageName: string;
  selectedItems: SelectedItem[];
  timestamp: Date;
  processed: boolean;
}

export interface AvailableItem {
  name: string;
  variants: PriceVariant[];
}

export interface PriceVariant {
  label: string;
  price: number;
}

export interface ProcessedBill {
  billId: string;
  extractedText?: string;
  suggestedItems?: string[];
  confidence: number;
}

// Bill Image Processing Types
export interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export interface ImageProcessingResult {
  processedImageData: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

// Bill Validation Types
export interface BillValidation {
  isValid: boolean;
  errors: BillValidationError[];
  warnings: BillValidationWarning[];
}

export interface BillValidationError {
  field: string;
  message: string;
  code: string;
}

export interface BillValidationWarning {
  field: string;
  message: string;
  code: string;
}