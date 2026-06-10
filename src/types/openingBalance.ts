export interface OpeningBalance {
  OpeningBalanceID: number;
  CustomerID: number;
  CustomerName: string;
  BusinessLineID: number;
  Amount: number;
  BalanceDate: string;
  Status: 'PENDING' | 'SETTLED';
  Notes?: string;
  CreatedBy?: number;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export interface BulkImportResult {
  message: string;
  success: Array<{
    row: number;
    customerId: number;
    customerName: string;
    action: 'created' | 'updated';
  }>;
  errors: Array<{
    row: number;
    customerCode?: string;
    customerName?: string;
    message: string;
  }>;
}
