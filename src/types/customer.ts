export interface Customer {
    CustomerID: number;
    CusName: string;
    CustomerName: string;
    ContactNumber: string;
    ContactPersonName: string;
    Address: string;
    BusinessLineID: number;
    SMSNumber?: string;
    BusinessRegNo?: string;
    CreditLimit?: number;
    Status?: string;
    BankDetails?: string;
    TotalOutstanding?: number;
    CashSale?: number;
    CreditBalance?: number;
    UpcomingCheques?: number;
  }