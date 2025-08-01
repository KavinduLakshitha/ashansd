import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableHead, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/app/auth/auth-context";
import axios from '@/lib/api/axios';
import { format } from 'date-fns';
import { AxiosError } from 'axios';
import { toast } from '@/hooks/use-toast';
import { Customer } from '@/types/customer';
import DialogCustomerSelect from './DialogCustomerSelect';

interface Credit {
  CreditPaymentID: string | number;
  DueDate: string;
  Amount: number;
  CustomerName?: string;
  CustomerID?: number;
  CreditLimit?: number;
  SaleID?: number;
}

interface CustomerWithCredits {
  customerDetails: {
    CustomerID: number;
    CusName: string;
    CreditLimit: number;
  };
  pendingCredits: Credit[];
  totalOutstanding: number;
}

interface CustomCreditSettlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CustomCreditSettlementDialog: React.FC<CustomCreditSettlementDialogProps> = ({ 
  open, 
  onOpenChange, 
  onSuccess 
}) => {
  const { getBusinessLineID } = useAuth();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("");
  const [customerCredits, setCustomerCredits] = useState<CustomerWithCredits | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [chequeDetails, setChequeDetails] = useState({
    chequeNumber: '',
    bank: '',
    realizeDate: ''
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedCustomerId("");
      setSelectedCustomerName("");
      setCustomerCredits(null);
      setPaymentAmount("");
      setError("");
      setPaymentMethod('CASH');
      setChequeDetails({
          chequeNumber: '',
          bank: '',
          realizeDate: ''
      });
    }
  }, [open]);

  // Fetch customer's pending credits when selected
  useEffect(() => {
    const fetchCustomerCredits = async () => {
      if (!selectedCustomerId || !open) {
        setCustomerCredits(null);
        return;
      }
      
      setLoading(true);
      setError('');
      
      try {
        // First, get the customer's pending payments
        const businessLineId = getBusinessLineID();
        const pendingResponse = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/payments/pending/${businessLineId}?customerId=${selectedCustomerId}`
        );
        
        // Get customer details
        const customerResponse = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/customers/${selectedCustomerId}`
        );
        
        // Get customer's outstanding amount
        const outstandingResponse = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/payments/customer/${selectedCustomerId}/outstanding`
        );
        
        setCustomerCredits({
          customerDetails: customerResponse.data,
          pendingCredits: pendingResponse.data.pendingCredits,
          totalOutstanding: outstandingResponse.data.TotalOutstanding
        });
      } catch (err) {
        console.error('Error fetching customer credits:', err);
        setError('Failed to load customer credit data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCustomerCredits();
  }, [selectedCustomerId, getBusinessLineID, open]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow only numbers and decimal point
    const value = e.target.value.replace(/[^0-9.]/g, '');
    
    // Ensure only one decimal point
    const parts = value.split('.');
    if (parts.length > 2) {
      return;
    }
    
    setPaymentAmount(value);
  };

  const handleOpenConfirmDialog = () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid payment amount greater than zero.",
        duration: 3000,
      });
      return;
    }
    
    setConfirmDialogOpen(true);
  };

  const handleCloseConfirmDialog = () => {
    setConfirmDialogOpen(false);
  };

  const handleSettleAmount = async () => {
    if (!selectedCustomerId || !paymentAmount) return;
    
    setProcessing(true);
    setError('');

    const requestData = {
      amount: parseFloat(paymentAmount),
      paymentMethod,
      ...(paymentMethod === 'CHEQUE' && { chequeDetails })
    };
    
    try {
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/payments/customer/${selectedCustomerId}/settle-amount`,
          requestData
        );
      
      // Close dialogs
      setConfirmDialogOpen(false);
      onOpenChange(false);
      
      // Show success message
      toast({
        title: "Success",
        description: "Payment successfully applied to credits",
        duration: 3000,
      });
      
      // Notify parent component to refresh its data
      onSuccess();
      
    } catch (err) {
      console.error('Error settling credits:', err);
      if (err instanceof AxiosError) {
        setError(err.response?.data?.message || 'Failed to apply payment. Please try again.');
        toast({
          variant: "destructive",
          title: "Error",
          description: err.response?.data?.message || 'Failed to apply payment',
          duration: 3000,
        });
      } else {
        setError('An unexpected error occurred. Please try again.');
        toast({
          variant: "destructive",
          title: "Error",
          description: 'An unexpected error occurred',
          duration: 3000,
        });
      }
    } finally {
      setProcessing(false);
    }
  };

  // Handle customer selection
  const handleCustomerChange = (value: string, customerId?: number) => {
    setSelectedCustomerName(value);
    if (customerId) {
      setSelectedCustomerId(customerId.toString());
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.CustomerID.toString());
    setSelectedCustomerName(customer.CusName);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Custom Credit Settlement</DialogTitle>
            <DialogDescription>
              Apply a custom payment amount to a customer&apos;s pending credits.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
          <Label>Payment Method</Label>
          <div className="flex space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                value="CASH"
                checked={paymentMethod === 'CASH'}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <span>Cash</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                value="CHEQUE"
                checked={paymentMethod === 'CHEQUE'}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <span>Cheque</span>
            </label>
          </div>
        </div>

        {/* Cheque details - show only when CHEQUE is selected */}
        {paymentMethod === 'CHEQUE' && (
            <div className="space-y-3 border p-3 rounded">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="cheque-number">Cheque Number</Label>
                  <Input
                    id="cheque-number"
                    value={chequeDetails.chequeNumber}
                    onChange={(e) => setChequeDetails(prev => ({
                      ...prev,
                      chequeNumber: e.target.value
                    }))}
                    placeholder="Enter cheque number"
                  />
                </div>
                <div>
                  <Label htmlFor="bank">Bank</Label>
                  <Input
                    id="bank"
                    value={chequeDetails.bank}
                    onChange={(e) => setChequeDetails(prev => ({
                      ...prev,
                      bank: e.target.value
                    }))}
                    placeholder="Enter bank name"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="realize-date">Realize Date</Label>
                <Input
                  id="realize-date"
                  type="date"
                  value={chequeDetails.realizeDate}
                  onChange={(e) => setChequeDetails(prev => ({
                    ...prev,
                    realizeDate: e.target.value
                  }))}
                  className="w-full"
                />
              </div>
            </div>
          )}
          
          <div className="py-4 space-y-4">
            {/* Custom Customer Selection */}
            <div className="space-y-2">
              <DialogCustomerSelect
                value={selectedCustomerName}
                onChange={handleCustomerChange}
                onSelectCustomer={handleSelectCustomer}
              />
            </div>
            
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {loading ? (
              <div className="flex justify-center py-4">
                <p>Loading customer data...</p>
              </div>
            ) : customerCredits && customerCredits.pendingCredits.length > 0 ? (
              <>
                {/* Customer Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-md">
                  <div>
                    <p className="text-sm text-gray-500">Customer</p>
                    <p className="font-medium">{customerCredits.customerDetails.CusName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Credit Limit</p>
                    <p className="font-medium">Rs. {Number(customerCredits.customerDetails.CreditLimit).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Outstanding</p>
                    <p className="font-medium">Rs. {Number(customerCredits.totalOutstanding).toFixed(2)}</p>
                  </div>
                </div>
                
                {/* Pending Credits Table */}
                <div className="max-h-[200px] overflow-y-auto">
                  <h3 className="text-md font-medium mb-2">Pending Credits</h3>
                  <Table className="border">
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="w-1/3">Due Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerCredits.pendingCredits.map((credit) => (
                        <TableRow key={credit.CreditPaymentID}>
                          <TableCell>
                            {format(new Date(credit.DueDate), 'yyyy-MM-dd')}
                          </TableCell>
                          <TableCell className="text-right">
                            Rs. {Number(credit.Amount).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Payment Entry */}
                <div className="space-y-3 mt-4">
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="payment-amount">Payment Amount (Rs.)</Label>
                    <Input
                      id="payment-amount"
                      type="text"
                      placeholder="Enter amount"
                      value={paymentAmount}
                      onChange={handleAmountChange}
                    />
                  </div>
                  
                  <p className="text-sm text-gray-500 italic">
                    Payment will be applied to the oldest credits first. 
                    A partial payment will be applied to the oldest credit and any remaining amount will be applied to subsequent credits.
                  </p>
                </div>
              </>
            ) : selectedCustomerId ? (
              <div className="py-2 text-center text-sm">
                <p className="text-gray-500">No pending credits found for this customer.</p>
              </div>
            ) : (
              <div className="py-2 text-center text-sm">
                <p className="text-gray-500">Please select a customer to view their pending credits.</p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="mt-2"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleOpenConfirmDialog}
              disabled={!selectedCustomerId || !paymentAmount || 
                        parseFloat(paymentAmount) <= 0 || 
                        !customerCredits || 
                        customerCredits.pendingCredits.length === 0}
              className="mt-2"
            >
              Apply Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
            <DialogDescription>
              You are about to apply a payment of Rs. {paymentAmount} 
              {customerCredits && ` for ${customerCredits.customerDetails.CusName}`}.
              This will settle credits starting from the oldest first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={handleCloseConfirmDialog}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button 
              variant="default"
              onClick={handleSettleAmount}
              disabled={processing}
            >
              {processing ? 'Processing...' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CustomCreditSettlementDialog;