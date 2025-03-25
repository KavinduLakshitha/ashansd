"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from './ui/date-picker';
import { Button } from './ui/button';
import { X } from 'lucide-react';
import axios from '@/lib/api/axios';
import { isAxiosError } from 'axios';
import { Checkbox } from '@/components/ui/checkbox';

interface ChequeDetails {
  amount: number | '';
  chequeNumber: string;
  realizeDate: Date | null;
  bank: string;
}

interface PaymentDetailsProps {
  total: number;
  items: {
    ProductID: number;
    item: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  customerID?: number;
  salesPersonID: number | string | undefined;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

const PaymentDetails: React.FC<PaymentDetailsProps> = ({ 
  total, 
  items, 
  customerID, 
  salesPersonID,
  onSuccess,
  onError 
}) => {
  const pathname = usePathname();
  const [discount, setDiscount] = useState<number | ''>(0);
  const [cashAmount, setCashAmount] = useState<number | ''>(0);
  const [cheques, setCheques] = useState<ChequeDetails[]>([]);
  const [creditAmount, setCreditAmount] = useState<number | ''>(0);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [sendSMS, setSendSMS] = useState(false);

  const isStockIn = pathname.includes('purchase-management');
  const totalPayableAmount = total - (discount || 0);
  
  // Calculate the total number of items and unique items
  const itemsSummary = useMemo(() => {
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const uniqueItemsCount = new Set(items.map(item => item.ProductID)).size;
    
    return {
      totalQuantity,
      uniqueItemsCount
    };
  }, [items]);

  const getTotalChequeAmount = useCallback(() => {
    return cheques.reduce((sum, cheque) => sum + (cheque.amount || 0), 0);
  }, [cheques]);

  const isPaymentValid = useMemo(() => {
    const cashTotal = Number(cashAmount) || 0;
    const chequeTotal = getTotalChequeAmount();
    const creditTotal = Number(creditAmount) || 0;    

    const totalEntered = cashTotal + chequeTotal + creditTotal;
    
    const areChequeDetailsValid = cheques.length === 0 || !cheques.some(cheque => 
      !cheque.amount || !cheque.chequeNumber || !cheque.realizeDate || !cheque.bank
    );
    
    const isCreditValid = creditTotal === 0 || (creditTotal > 0 && dueDate !== null);
    
    const isPaymentComplete = Math.abs(totalEntered - totalPayableAmount) < 0.01;
    
    return isPaymentComplete && areChequeDetailsValid && isCreditValid;
  }, [cashAmount, cheques, creditAmount, dueDate, totalPayableAmount, getTotalChequeAmount]);

  const handleInputChange = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<number | ''>>
  ) => {
    const parsedValue = parseFloat(value);
    setter(!isNaN(parsedValue) ? parsedValue : '');
  };

  const addCheque = () => {
    setCheques([...cheques, {
      amount: '',
      chequeNumber: '',
      realizeDate: null,
      bank: ''
    }]);
  };

  const removeCheque = (index: number) => {
    setCheques(cheques.filter((_, i) => i !== index));
  };

  const updateCheque = (
    index: number,
    field: keyof ChequeDetails,
    value: ChequeDetails[keyof ChequeDetails]
  ) => {
    const updatedCheques = [...cheques];
    if (field === 'amount') {
      const parsedValue = parseFloat(value as string);
      updatedCheques[index][field] = !isNaN(parsedValue) ? parsedValue : '' as ChequeDetails['amount'];
    } else if (field === 'realizeDate') {
      updatedCheques[index][field] = value as Date | null;
    } else {
      updatedCheques[index][field] = value as string;
    }
    setCheques(updatedCheques);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  
    // Validate required fields
    if (!customerID) {
      onError?.('Customer is required');
      return;
    }
  
    if (!salesPersonID) {
      onError?.('Sales person is required');
      return;
    }
  
    if (!items || items.length === 0) {
      onError?.('At least one product is required');
      return;
    }
  
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
  
      const chequePayments = cheques.map(cheque => ({
        amount: cheque.amount,
        chequeNumber: cheque.chequeNumber,
        realizeDate: cheque.realizeDate,
        bank: cheque.bank
      }));
  
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/sales`,
        {
          customerID,
          salesPersonID,
          products: items,
          date: new Date(),
          cashAmount,
          chequePayments,
          creditPayment: {
            amount: creditAmount,
            dueDate
          },
          sendSMS // Add the sendSMS flag to the API request
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
  
      if (response.status === 201) {
        onSuccess?.();
      }
    } catch (error: unknown) {
      const errorMessage = isAxiosError(error) && error.response?.data && 'message' in error.response?.data
        ? error.response.data.message
        : (error as Error).message || 'An error occurred';
      onError?.(errorMessage);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardContent className="mt-4">
        <div className="grid grid-cols-3 gap-2 items-center">
          <Label className='text-xs'>Items</Label>
          <div className='text-xs'>
            <span className="font-medium">{itemsSummary.uniqueItemsCount}</span> types | <span className="font-medium">{itemsSummary.totalQuantity}</span> units
          </div>
          <div></div>

          <Label className='text-xs'>Total</Label>
          <p className='text-xs'>{total.toFixed(2)}</p>
          <div></div>


          {!isStockIn && (
            <>
              <Label className='text-xs'>Discount</Label>
              <Input
                type="number"
                min="0"
                max={total}
                value={discount}
                className='w-52'
                onChange={(e) => handleInputChange(e.target.value, setDiscount)}
              />
              <div></div>
              <Label className='text-xs'>Total Payable Amount</Label>
              <p className='text-xs'>{totalPayableAmount.toFixed(2)}</p>
              <div></div>
            </>
          )}
          <div className="col-span-3 border-t mt-0 pt-2 font-bold">Payment Methods</div>
          <Label className='text-xs'>Cash Amount</Label>
          <Input
            type="number"
            min="0"
            placeholder="Cash Amount"
            value={cashAmount}
            className="w-[240px]"
            onChange={(e) => handleInputChange(e.target.value, setCashAmount)}
          />
          <div></div>

          <Label className='text-xs'>Credit Amount</Label>
          <Input
            type="number"
            min="0"
            placeholder="Credit Amount"
            value={creditAmount}
            className="w-[240px]"
            onChange={(e) => handleInputChange(e.target.value, setCreditAmount)}
          />
          <div></div>
          <Label className='text-xs'>Due Date</Label>
          <div className='w-96'>
            <DatePicker
              selectedDate={dueDate as Date}
              onDateChange={setDueDate}
            />
          </div>
          <div></div>

          {!isStockIn && cheques.map((cheque, index) => (
            <React.Fragment key={index}>
              <div className="col-span-3 flex items-center gap-1 mt-0">
                <h3 className="text-md font-medium">Cheque {index + 1}</h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="ml-auto"
                  onClick={() => removeCheque(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <Label className='text-xs'>Amount</Label>
              <Input
                type="number"
                min="0"
                placeholder="Cheque Amount"
                value={cheque.amount}
                className="w-[240px]"
                onChange={(e) => updateCheque(index, 'amount', e.target.value)}
              />
              <div></div>
              <Label className='text-xs'>Cheque Number</Label>
              <Input
                type="text"
                placeholder="Cheque Number"
                value={cheque.chequeNumber}
                className="w-[240px]"
                onChange={(e) => updateCheque(index, 'chequeNumber', e.target.value)}
              />
              <div></div>
              <Label className='text-xs'>Realize Date</Label>
              <div className='w-96'>
                <DatePicker
                  selectedDate={cheque.realizeDate as Date}
                  onDateChange={(date) => updateCheque(index, 'realizeDate', date)}
                />
              </div>
              <div></div>
              <Label className='text-xs'>Bank</Label>
              <Input
                type="text"
                placeholder="Bank"
                value={cheque.bank}
                className="w-[240px]"
                onChange={(e) => updateCheque(index, 'bank', e.target.value)}
              />
              <div></div>
            </React.Fragment>
          ))}

          {!isStockIn && (
            <div className="col-span-3">
              <Button 
                variant="outline" 
                onClick={addCheque}
                className="mt-0"
              >
                Add Cheque Payment
              </Button>
            </div>
          )}          
          
          {/* Payment summary section */}
          <div className="text-xs col-span-3 mt-2 p-4 bg-gray-50 rounded-md">
            <h3 className="font-medium mb-2">Payment Summary</h3>
            <div className="grid grid-cols-2 gap-2">
              <span>Cash:</span>
              <span>Rs. {(Number(cashAmount) || 0).toFixed(2)}</span>
              <span>Cheques:</span>
              <span>Rs. {getTotalChequeAmount().toFixed(2)}</span>
              <span>Credit:</span>
              <span>Rs. {(Number(creditAmount) || 0).toFixed(2)}</span>
              <span className="font-medium">Total Entered:</span>
              <span className="font-medium">Rs. {((Number(cashAmount) || 0) + getTotalChequeAmount() + (Number(creditAmount) || 0)).toFixed(2)}</span>
            </div>
          </div>
          
          {/* SMS Notification Checkbox */}
          <div className="col-span-3 flex items-center space-x-2 mt-2">
            <Checkbox 
              id="sendSMS" 
              checked={sendSMS} 
              onCheckedChange={(checked) => setSendSMS(checked === true)}
            />
            <Label htmlFor="sendSMS" className="text-sm font-medium cursor-pointer">
              Notify customer via SMS
            </Label>
          </div>
        </div>
      </CardContent>
      <div className="flex gap-4 justify-end mb-4 mr-4">
        <Button variant="outline">Cancel</Button>
        <Button onClick={handleSubmit} disabled={!isPaymentValid}>Submit</Button>
      </div>        
    </Card>
  );
};

export default PaymentDetails;