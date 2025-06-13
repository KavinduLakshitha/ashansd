import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from './ui/date-picker';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import axios from '@/lib/api/axios';
import { AxiosError } from 'axios';

interface PurchasePaymentDetailsProps {
  total: number;
  items: {
    ProductID: number;
    item: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  vendorID: number;
  invoiceNumber: string;
  invoiceDate: Date;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

const formatDateForSQL = (date: Date | null): string | null => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return null;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const PurchasePaymentDetails: React.FC<PurchasePaymentDetailsProps> = ({ 
  total, 
  items, 
  vendorID,
  invoiceNumber,
  invoiceDate,
  onSuccess,
  onError 
}) => {
  const [cashAmount, setCashAmount] = useState<number | ''>(0);
  const [creditAmount, setCreditAmount] = useState<number | ''>(0);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Calculate payment suggestions
  const paymentSuggestions = useMemo(() => {
    const cashTotal = Number(cashAmount) || 0;
    const creditTotal = Number(creditAmount) || 0;
    
    const afterCash = Math.max(0, total - cashTotal);
    
    return {
      suggestedCredit: afterCash,
      remainingAfterAll: total - cashTotal - creditTotal
    };
  }, [cashAmount, creditAmount, total]);

  const isPaymentValid = useMemo(() => {
    const cashTotal = Number(cashAmount) || 0;
    const creditTotal = Number(creditAmount) || 0;    
    const totalEntered = cashTotal + creditTotal;
    const isCreditValid = creditTotal === 0 || (creditTotal > 0 && dueDate !== null);
    const isPaymentComplete = Math.abs(totalEntered - total) < 0.01;
    return isPaymentComplete && isCreditValid;
  }, [cashAmount, creditAmount, dueDate, total]);  

  const handleCashAmountChange = (value: string) => {
    const parsedValue = parseFloat(value);
    setCashAmount(!isNaN(parsedValue) ? parsedValue : '');
  };

  const handleCreditAmountChange = (value: string) => {
    const parsedValue = parseFloat(value);
    setCreditAmount(!isNaN(parsedValue) ? parsedValue : '');
  };

  const resetForm = () => {
    setCashAmount(0);
    setCreditAmount(0);
    setDueDate(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  
    if (!vendorID) {
      onError?.('Vendor is required');
      return;
    }
  
    if (!items || items.length === 0) {
      onError?.('At least one product is required');
      return;
    }

    if (!isPaymentValid) {
      onError?.('Please ensure payment amounts match the total and due date is set for credit payments');
      return;
    }
  
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const formattedInvoiceDate = formatDateForSQL(invoiceDate);
      const formattedDueDate = formatDateForSQL(dueDate);

      // Prepare the purchase data
      const purchaseData = {
        vendorID,
        products: items.map(item => ({
          ProductID: item.ProductID,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total
        })),
        invoiceNumber,
        invoiceDate: formattedInvoiceDate,
        cashAmount: Number(cashAmount) || 0,
        creditPayment: {
          amount: Number(creditAmount) || 0,
          dueDate: formattedDueDate
        }
      };

  
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/purchases`,
        purchaseData,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
  
      if (response.status === 201) {
        toast({
          title: "Success",
          description: "Purchase recorded successfully",
        });
        onSuccess?.();
        resetForm();
      }
    } catch (error: unknown) {
        if (error instanceof AxiosError) {
          const errorMessage = error.response?.data?.message || error.message || 'An error occurred';
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
          onError?.(errorMessage);
        } else if (error instanceof Error) {
          // Handle standard Error objects
          const errorMessage = error.message || 'An error occurred';
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
          onError?.(errorMessage);
        } else {
          console.error('Unknown error:', error);
          toast({
            title: "Error",
            description: 'An unknown error occurred',
            variant: "destructive",
          });
          onError?.('An unknown error occurred');
        }
      } finally {
        setIsSubmitting(false);
      }
  };

  return (
    <Card className="max-w-2xl">
      <CardContent className="mt-4">
        <div className="grid grid-cols-3 gap-2 items-center">
          <Label className="text-xs">Total</Label>
          <p className="text-xs">Rs. {total.toFixed(2)}</p>
          <div></div>

          <div className="col-span-3 border-t mt-0 pt-2 font-bold">Payment Methods</div>
          
          <Label className="text-xs">Cash Amount</Label>
          <Input
            type="number"
            min="0"
            value={cashAmount}
            className="w-[240px]"
            onChange={(e) => handleCashAmountChange(e.target.value)}
            disabled={isSubmitting}
          />
          <div></div>

          <Label className="text-xs">Credit Amount</Label>
          <div className="relative">
            <Input
              type="number"
              min="0"
              value={creditAmount}
              className="w-[240px]"
              onChange={(e) => handleCreditAmountChange(e.target.value)}
              disabled={isSubmitting}
            />
            {paymentSuggestions.suggestedCredit > 0 && (creditAmount === 0 || creditAmount === '') && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
                onClick={() => setCreditAmount(paymentSuggestions.suggestedCredit)}
                disabled={isSubmitting}
              >
                Use {paymentSuggestions.suggestedCredit.toFixed(2)}
              </Button>
            )}
          </div>
          <div></div>
          
          <Label className="text-xs">Due Date</Label>
          <div className="w-96">
            <DatePicker
              selectedDate={dueDate as Date}
              onDateChange={setDueDate}
            />
          </div>
          <div></div>
          
          <div className="text-xs col-span-3 mt-2 p-4 bg-gray-50 rounded-md">
            <h3 className="font-medium mb-2">Payment Summary</h3>
            <div className="grid grid-cols-2 gap-2">
              <span>Cash:</span>
              <span>Rs. {(Number(cashAmount) || 0).toFixed(2)}</span>
              <span>Credit:</span>
              <span>Rs. {(Number(creditAmount) || 0).toFixed(2)}</span>
              <span className="font-medium">Total Entered:</span>
              <span className="font-medium">Rs. {((Number(cashAmount) || 0) + (Number(creditAmount) || 0)).toFixed(2)}</span>
              {Math.abs(paymentSuggestions.remainingAfterAll) > 0.01 && (
                <>
                  <span className={paymentSuggestions.remainingAfterAll > 0 ? "text-red-600" : "text-green-600"}>
                    {paymentSuggestions.remainingAfterAll > 0 ? "Remaining:" : "Excess:"}
                  </span>
                  <span className={paymentSuggestions.remainingAfterAll > 0 ? "text-red-600" : "text-green-600"}>
                    Rs. {Math.abs(paymentSuggestions.remainingAfterAll).toFixed(2)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
      <div className="flex gap-4 justify-end mb-4 mr-4">
        <Button 
          variant="outline" 
          onClick={resetForm}
          disabled={isSubmitting}
        >
          Reset
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={!isPaymentValid || isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </Button>
      </div>        
    </Card>
  );
};

export default PurchasePaymentDetails;