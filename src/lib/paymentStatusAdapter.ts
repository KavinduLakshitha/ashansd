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
  // Add these fields that should come from the backend
  ChequePaymentID?: number | string;
  CreditPaymentID?: number | string;
}

export interface PaymentStatusChange {
  paymentId: string | number;
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
  chequePaymentId?: string | number;
  creditPaymentId?: string | number;
}

/**
 * Transforms API payment data into status changes
 * 
 * Fixed: Now properly assigns chequePaymentId and creditPaymentId for deletions
 */
export function transformPaymentsToStatusChanges(
  payments: APIPayment[]
): PaymentStatusChange[] {
  const statusChanges: PaymentStatusChange[] = [];

  payments.forEach(payment => {
    if (payment.PaymentMethod === 'CHEQUE' && payment.paymentDetails) {
      if (payment.paymentDetails.status === 'REALIZED') {
        statusChanges.push({
          id: `${payment.PaymentID}-realized`,
          paymentId: payment.PaymentID,
          date: payment.PaymentDate,
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
          },
          // FIXED: Use ChequePaymentID for deletion endpoint
          chequePaymentId: payment.ChequePaymentID
        });
      } else if (payment.paymentDetails.status === 'BOUNCED') {
        statusChanges.push({
          id: `${payment.PaymentID}-bounced`,
          paymentId: payment.PaymentID,
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
            bouncedDate: payment.PaymentDate,
          },
          // FIXED: Use ChequePaymentID for deletion endpoint
          chequePaymentId: payment.ChequePaymentID
        });
      }
    } else if (payment.PaymentMethod === 'CREDIT' && payment.paymentDetails) {
      if (payment.paymentDetails.status === 'SETTLED') {
        statusChanges.push({
          id: `${payment.PaymentID}-settled`,
          paymentId: payment.PaymentID,
          date: payment.PaymentDate,
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
            settledDate: payment.PaymentDate,
          },
          // FIXED: Use CreditPaymentID for deletion endpoint
          creditPaymentId: payment.CreditPaymentID
        });
      }
    }
  });

  return statusChanges;
}