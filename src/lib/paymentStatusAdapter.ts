interface APIPayment {
  PaymentID: number | string;
  SaleID: number | string;
  InvoiceID?: string;
  CustomerID: number | string;
  CustomerName: string;
  PaymentMethod: 'CASH' | 'CREDIT' | 'CHEQUE';
  Amount: number;
  PaymentDate: string;
  paymentDetails?: {
    chequeNumber?: string;
    bank?: string;
    realizeDate?: string;
    dueDate?: string;
    status?: string;
  };
}

export interface PaymentStatusChange {
  id: string | number;
  date: string;
  customerId: number | string;
  customerName: string;
  invoiceId?: string;
  saleId: number | string;
  paymentMethod: 'CHEQUE' | 'CREDIT';
  amount: number;
  fromStatus: string;
  toStatus: string;
  details: {
    chequeNumber?: string;
    bank?: string;
    realizeDate?: string;
    dueDate?: string;
    settledDate?: string;
    bouncedDate?: string;
    notes?: string;
  };
}

/**
 * Transforms API payment data into status changes
 * 
 * Note: This is a temporary adapter function to simulate payment status changes
 * It should be replaced by actual API endpoints that track status changes directly
 */
export function transformPaymentsToStatusChanges(
  payments: APIPayment[]
): PaymentStatusChange[] {
  const statusChanges: PaymentStatusChange[] = [];

  // In a real implementation, we would have actual status change dates and events
  // Here we're simulating by inferring status changes from payment statuses
  payments.forEach(payment => {
    if (payment.PaymentMethod === 'CHEQUE' && payment.paymentDetails) {
      if (payment.paymentDetails.status === 'REALIZED') {
        // When a cheque is realized
        statusChanges.push({
          id: `${payment.PaymentID}-realized`,
          date: payment.PaymentDate, // This should be the actual realized date in production
          customerId: payment.CustomerID,
          customerName: payment.CustomerName,
          invoiceId: payment.InvoiceID,
          saleId: payment.SaleID,
          paymentMethod: 'CHEQUE',
          amount: payment.Amount,
          fromStatus: 'PENDING',
          toStatus: 'REALIZED',
          details: {
            chequeNumber: payment.paymentDetails.chequeNumber,
            bank: payment.paymentDetails.bank,
            realizeDate: payment.paymentDetails.realizeDate,
          }
        });
      } else if (payment.paymentDetails.status === 'BOUNCED') {
        statusChanges.push({
          id: `${payment.PaymentID}-bounced`,
          date: payment.PaymentDate,
          customerId: payment.CustomerID,
          customerName: payment.CustomerName,
          invoiceId: payment.InvoiceID,
          saleId: payment.SaleID,
          paymentMethod: 'CHEQUE',
          amount: payment.Amount,
          fromStatus: 'PENDING',
          toStatus: 'BOUNCED',
          details: {
            chequeNumber: payment.paymentDetails.chequeNumber,
            bank: payment.paymentDetails.bank,
            bouncedDate: payment.PaymentDate, // Mock date, should be actual in production
          }
        });
      }
    } else if (payment.PaymentMethod === 'CREDIT' && payment.paymentDetails) {
      if (payment.paymentDetails.status === 'SETTLED') {
        // When a credit is settled
        statusChanges.push({
          id: `${payment.PaymentID}-settled`,
          date: payment.PaymentDate, // This should be the actual settled date in production
          customerId: payment.CustomerID,
          customerName: payment.CustomerName,
          invoiceId: payment.InvoiceID,
          saleId: payment.SaleID,
          paymentMethod: 'CREDIT',
          amount: payment.Amount,
          fromStatus: 'PENDING',
          toStatus: 'SETTLED',
          details: {
            dueDate: payment.paymentDetails.dueDate,
            settledDate: payment.PaymentDate, // Mock date, should be actual in production
          }
        });
      }
    }
  });

  return statusChanges;
}