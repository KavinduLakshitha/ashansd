import React, { useState, useEffect, useMemo } from 'react';
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
  SaleDate?: string;
  InvoiceID?: string;
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
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [chequeDetails, setChequeDetails] = useState({
    chequeNumber: '',
    bank: '',
    realizeDate: ''
  });
  const [selectedCredits, setSelectedCredits] = useState<
    Array<{ credit: Credit; amount: string; suggestedAmount?: string }>
  >([]);
  const [totalPaymentAmount, setTotalPaymentAmount] = useState<string>("");
  const [suggestedTotalPayment, setSuggestedTotalPayment] = useState<string>("");
  const [distributionMode, setDistributionMode] = useState<'manual' | 'auto'>('auto');

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedCustomerId("");
      setSelectedCustomerName("");
      setCustomerCredits(null);
      setError("");
      setPaymentMethod('CASH');
      setChequeDetails({
          chequeNumber: '',
          bank: '',
          realizeDate: ''
      });
      setSelectedCredits([]);
      setTotalPaymentAmount("");
      setSuggestedTotalPayment("");
      setDistributionMode('auto');
    }
  }, [open]);

  // Fetch customer's pending credits when selected
  useEffect(() => {
    const fetchCustomerCredits = async () => {
      if (!selectedCustomerId || !open) {
        setCustomerCredits(null);
        setSelectedCredits([]);
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

  const toggleCreditSelection = (credit: Credit) => {
    setSelectedCredits((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.credit.CreditPaymentID === credit.CreditPaymentID
      );

      if (existingIndex > -1) {
        // Unselecting - remove from list and update suggested total
        const removedCredit = prev[existingIndex];
        const newCredits = prev.filter(
          (item) => item.credit.CreditPaymentID !== credit.CreditPaymentID
        );
        
        // Update suggested total payment
        const removedAmount = parseFloat(removedCredit.suggestedAmount || removedCredit.amount || '0');
        if (!isNaN(removedAmount)) {
          const currentSuggested = parseFloat(suggestedTotalPayment || '0');
          const newSuggested = Math.max(0, currentSuggested - removedAmount);
          setSuggestedTotalPayment(newSuggested > 0 ? newSuggested.toFixed(2) : '');
        }
        
        // Re-distribute if in auto mode and total payment is set
        if (distributionMode === 'auto' && totalPaymentAmount) {
          const totalAmount = parseFloat(totalPaymentAmount);
          if (!isNaN(totalAmount) && totalAmount > 0) {
            return distributePaymentAmount(newCredits, totalAmount);
          }
        }
        return newCredits;
      }

      // Selecting - add to list with suggested amount
      const suggestedAmount = Number(credit.Amount).toFixed(2);
      const newCredits = [
        ...prev,
        {
          credit,
          amount: '', // Start with empty amount
          suggestedAmount: suggestedAmount, // Suggest full outstanding amount
        },
      ];
      
      // Update suggested total payment
      const creditAmount = parseFloat(suggestedAmount);
      if (!isNaN(creditAmount)) {
        const currentSuggested = parseFloat(suggestedTotalPayment || '0');
        const newSuggested = currentSuggested + creditAmount;
        setSuggestedTotalPayment(newSuggested.toFixed(2));
      }
      
      // Re-distribute if in auto mode and total payment is set
      if (distributionMode === 'auto' && totalPaymentAmount) {
        const totalAmount = parseFloat(totalPaymentAmount);
        if (!isNaN(totalAmount) && totalAmount > 0) {
          return distributePaymentAmount(newCredits, totalAmount);
        }
      }
      return newCredits;
    });
  };

  // Function to automatically distribute payment across selected credits
  const distributePaymentAmount = (
    credits: Array<{ credit: Credit; amount: string; suggestedAmount?: string }>,
    totalAmount: number
  ): Array<{ credit: Credit; amount: string; suggestedAmount?: string }> => {
    if (isNaN(totalAmount) || totalAmount <= 0 || credits.length === 0) {
      return credits.map(item => ({ ...item, amount: '' }));
    }

    let remainingAmount = totalAmount;
    const distributed = credits.map((item) => {
      const creditAmount = Number(item.credit.Amount);
      if (remainingAmount <= 0) {
        return { ...item, amount: '', suggestedAmount: item.suggestedAmount };
      }
      
      if (remainingAmount >= creditAmount) {
        // Fully settle this credit
        remainingAmount -= creditAmount;
        return { ...item, amount: creditAmount.toFixed(2), suggestedAmount: item.suggestedAmount };
      } else {
        // Partially settle this credit
        const partialAmount = remainingAmount;
        remainingAmount = 0;
        return { ...item, amount: partialAmount.toFixed(2), suggestedAmount: item.suggestedAmount };
      }
    });

    return distributed;
  };

  // Handle accepting suggested amount for a credit
  const acceptSuggestedAmount = (credit: Credit) => {
    setSelectedCredits((prev) =>
      prev.map((item) =>
        item.credit.CreditPaymentID === credit.CreditPaymentID
          ? { ...item, amount: item.suggestedAmount || '' }
          : item
      )
    );
    setDistributionMode('manual');
  };

  // Handle accepting suggested total payment
  const acceptSuggestedTotalPayment = () => {
    setTotalPaymentAmount(suggestedTotalPayment);
    setDistributionMode('auto');
    if (selectedCredits.length > 0) {
      const totalAmount = parseFloat(suggestedTotalPayment);
      if (!isNaN(totalAmount) && totalAmount > 0) {
        const distributed = distributePaymentAmount(selectedCredits, totalAmount);
        setSelectedCredits(distributed);
      }
    }
  };

  // Handle total payment amount change
  const handleTotalPaymentChange = (value: string) => {
    const sanitized = value.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      return;
    }
    const normalized =
      parts.length === 2
        ? `${parts[0]}.${parts[1].slice(0, 2)}`
        : sanitized;

    setTotalPaymentAmount(normalized);
    setDistributionMode('auto');

    // Automatically distribute when user enters amount
    if (selectedCredits.length > 0) {
      const totalAmount = parseFloat(normalized);
      if (!isNaN(totalAmount) && totalAmount > 0) {
        const distributed = distributePaymentAmount(selectedCredits, totalAmount);
        setSelectedCredits(distributed);
      } else {
        setSelectedCredits(selectedCredits.map(item => ({ ...item, amount: '' })));
      }
    }
  };

  const handleCreditAmountChange = (
    credit: Credit,
    rawValue: string
  ) => {
    // If in auto mode, switch to manual mode when user edits individual amounts
    if (distributionMode === 'auto') {
      setDistributionMode('manual');
      setTotalPaymentAmount("");
    }

    const sanitized = rawValue.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      return;
    }
    const normalized =
      parts.length === 2
        ? `${parts[0]}.${parts[1].slice(0, 2)}`
        : sanitized;

    setSelectedCredits((prev) =>
      prev.map((item) =>
        item.credit.CreditPaymentID === credit.CreditPaymentID
          ? { ...item, amount: normalized }
          : item
      )
    );
  };

  const handleCreditAmountBlur = (credit: Credit, value: string) => {
    const numeric = parseFloat(value);
    const maxAmount = Number(credit.Amount);

    if (!value || isNaN(numeric) || numeric <= 0) {
      setSelectedCredits((prev) =>
        prev.map((item) =>
          item.credit.CreditPaymentID === credit.CreditPaymentID
            ? { ...item, amount: '' }
            : item
        )
      );
      return;
    }

    const clamped = Math.min(numeric, maxAmount);
    setSelectedCredits((prev) =>
      prev.map((item) =>
        item.credit.CreditPaymentID === credit.CreditPaymentID
          ? { ...item, amount: clamped.toFixed(2) }
          : item
      )
    );
  };

  const selectedCreditMap = useMemo(() => {
    const map = new Map<
      string,
      { index: number; amount: string; credit: Credit & { suggestedAmount?: string } }
    >();

    selectedCredits.forEach((item, index) => {
      map.set(item.credit.CreditPaymentID.toString(), {
        index,
        amount: item.amount,
        credit: { ...item.credit, suggestedAmount: item.suggestedAmount },
      });
    });

    return map;
  }, [selectedCredits]);

  const totalSelectedAmount = useMemo(() => {
    return selectedCredits.reduce((sum, item) => {
      const value = parseFloat(item.amount);
      if (isNaN(value)) {
        return sum;
      }
      return sum + value;
    }, 0);
  }, [selectedCredits]);

  const hasInvalidSelection = useMemo(() => {
    if (selectedCredits.length === 0) {
      return true;
    }

    // In auto mode, check if total payment is valid
    if (distributionMode === 'auto' && totalPaymentAmount) {
      const totalAmount = parseFloat(totalPaymentAmount);
      if (isNaN(totalAmount) || totalAmount <= 0) {
        return true;
      }
      return false;
    }

    // In manual mode, check individual amounts
    return selectedCredits.some((item) => {
      const value = parseFloat(item.amount);
      if (!item.amount || isNaN(value) || value <= 0) {
        return true;
      }
      return value - Number(item.credit.Amount) > 0.009;
    });
  }, [selectedCredits, distributionMode, totalPaymentAmount]);

  const handleOpenConfirmDialog = () => {
    if (selectedCredits.length === 0) {
      toast({
        variant: "destructive",
        title: "No Credits Selected",
        description: "Please select at least one credit to settle.",
        duration: 3000,
      });
      return;
    }

    if (distributionMode === 'auto' && (!totalPaymentAmount || parseFloat(totalPaymentAmount) <= 0)) {
      toast({
        variant: "destructive",
        title: "Invalid Payment Amount",
        description: "Please enter a valid total payment amount.",
        duration: 3000,
      });
      return;
    }

    if (totalSelectedAmount <= 0 || hasInvalidSelection) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter valid amounts for the selected credits.",
        duration: 3000,
      });
      return;
    }

    if (
      paymentMethod === 'CHEQUE' &&
      (!chequeDetails.chequeNumber || !chequeDetails.bank || !chequeDetails.realizeDate)
    ) {
      toast({
        variant: "destructive",
        title: "Missing Cheque Details",
        description: "Cheque number, bank and realize date are required for cheque payments.",
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
    if (
      !selectedCustomerId ||
      selectedCredits.length === 0 ||
      totalSelectedAmount <= 0 ||
      hasInvalidSelection
    ) {
      return;
    }
    
    setProcessing(true);
    setError('');

    const requestData = {
      amount: parseFloat(totalSelectedAmount.toFixed(2)),
      paymentMethod,
      selectedCredits: selectedCredits.map((item) => ({
        creditPaymentId: item.credit.CreditPaymentID,
        amount: parseFloat(item.amount),
      })),
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
      setSelectedCredits([]);
      
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
      setSelectedCredits([]);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.CustomerID.toString());
    setSelectedCustomerName(customer.CusName);
    setSelectedCredits([]);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[1000px]">
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
                <div className="max-h-[300px] overflow-x-auto overflow-y-auto">
                  <h3 className="text-md font-medium mb-2">Pending Credits</h3>
                  <Table className="border min-w-[900px]">
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="w-12 text-center">Select</TableHead>
                        <TableHead className="w-16 text-center">Order</TableHead>
                        <TableHead className="min-w-[150px]">Invoice ID</TableHead>
                        <TableHead className="min-w-[100px]">Sale Date</TableHead>
                        <TableHead className="min-w-[100px]">Due Date</TableHead>
                        <TableHead className="text-right min-w-[120px]">Outstanding</TableHead>
                        <TableHead className="text-right min-w-[150px]">Settle Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerCredits.pendingCredits.map((credit) => {
                        const selection = selectedCreditMap.get(
                          credit.CreditPaymentID?.toString() ?? ''
                        );
                        const isSelected = Boolean(selection);
                        const amountValue = selection?.amount ?? '';
                        const outstanding = Number(credit.Amount);
                        // const amountNumeric = parseFloat(amountValue);
                        // const isAmountInvalid =
                        //   isSelected &&
                        //   (!amountValue ||
                        //     isNaN(amountNumeric) ||
                        //     amountNumeric <= 0 ||
                        //     amountNumeric - outstanding > 0.009);

                        return (
                          <TableRow
                            key={credit.CreditPaymentID}
                            className={isSelected ? "bg-blue-50/50" : undefined}
                          >
                            <TableCell className="text-center">
                              <Checkbox
                                aria-label="Select credit"
                                checked={isSelected}
                                onCheckedChange={() => toggleCreditSelection(credit)}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              {isSelected ? (
                                <Badge variant="secondary">
                                  {(selection?.index ?? 0) + 1}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  -
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {credit.InvoiceID || '-'}
                            </TableCell>
                            <TableCell>
                              {credit.SaleDate ? format(new Date(credit.SaleDate), 'yyyy-MM-dd') : '-'}
                            </TableCell>
                            <TableCell>
                              {format(new Date(credit.DueDate), 'yyyy-MM-dd')}
                            </TableCell>
                            <TableCell className="text-right">
                              Rs. {outstanding.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {isSelected ? (
                                <div className="flex flex-col gap-1 items-end">
                                  <Input
                                    inputMode="decimal"
                                    value={amountValue}
                                    onChange={(e) =>
                                      handleCreditAmountChange(credit, e.target.value)
                                    }
                                    onBlur={(e) =>
                                      handleCreditAmountBlur(credit, e.target.value)
                                    }
                                    className="text-right"
                                  />
                                  {selection && selection.credit.suggestedAmount && !amountValue && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => acceptSuggestedAmount(credit)}
                                      className="h-6 text-xs px-2"
                                    >
                                      Use Rs. {parseFloat(selection.credit.suggestedAmount || '0').toFixed(2)}
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Not selected
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Payment Entry */}
                <div className="space-y-3 mt-4 border-t pt-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="total-payment">Total Payment Amount</Label>
                      {suggestedTotalPayment && !totalPaymentAmount && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={acceptSuggestedTotalPayment}
                          className="h-7 text-xs"
                        >
                          Use Suggested: Rs. {parseFloat(suggestedTotalPayment).toFixed(2)}
                        </Button>
                      )}
                    </div>
                    <Input
                      id="total-payment"
                      inputMode="decimal"
                      value={totalPaymentAmount}
                      onChange={(e) => handleTotalPaymentChange(e.target.value)}
                      placeholder="Enter total payment amount"
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500">
                      Enter the total payment amount and it will be automatically distributed across selected bills in order.
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-sm font-medium text-gray-700">
                      Total Selected Amount
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      Rs. {totalSelectedAmount.toFixed(2)}
                    </p>
                  </div>
                  
                  {totalPaymentAmount && parseFloat(totalPaymentAmount) > totalSelectedAmount && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                      <p className="text-xs text-yellow-800">
                        Payment amount (Rs. {parseFloat(totalPaymentAmount).toFixed(2)}) exceeds total selected amount. 
                        Remaining Rs. {(parseFloat(totalPaymentAmount) - totalSelectedAmount).toFixed(2)} will not be applied.
                      </p>
                    </div>
                  )}
                  
                  {hasInvalidSelection && selectedCredits.length > 0 && distributionMode === 'manual' && (
                    <p className="text-xs text-red-500">
                      Please enter a valid amount (greater than zero and not exceeding the outstanding amount) for each selected credit.
                    </p>
                  )}
                  <p className="text-sm text-gray-500 italic">
                    Credits will be settled in the order selected. Partial settlements create a new pending credit for the remaining balance.
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
              disabled={
                !selectedCustomerId ||
                !customerCredits ||
                customerCredits.pendingCredits.length === 0 ||
                selectedCredits.length === 0 ||
                hasInvalidSelection ||
                totalSelectedAmount <= 0 ||
                (paymentMethod === 'CHEQUE' &&
                  (!chequeDetails.chequeNumber ||
                    !chequeDetails.bank ||
                    !chequeDetails.realizeDate))
              }
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
              You are about to settle Rs. {totalSelectedAmount.toFixed(2)} 
              {customerCredits && ` for ${customerCredits.customerDetails.CusName}`}.
              Credits will be settled in the exact order they were selected.
            </DialogDescription>
          </DialogHeader>
          {selectedCredits.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-gray-700">Selected Credits</p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                {selectedCredits
                  .filter(item => item.amount && parseFloat(item.amount) > 0)
                  .map((item, index) => {
                    const amount = parseFloat(item.amount || '0');
                    const creditAmount = Number(item.credit.Amount);
                    const isPartial = amount < creditAmount;
                    return (
                      <li key={item.credit.CreditPaymentID}>
                        <span className="font-medium">#{index + 1}</span> · Invoice: {item.credit.InvoiceID || 'N/A'} · Due{" "}
                        {format(new Date(item.credit.DueDate), 'yyyy-MM-dd')} · Settling Rs.{" "}
                        {amount.toFixed(2)}
                        {isPartial && (
                          <span className="text-orange-600"> (Partial - Remaining: Rs. {(creditAmount - amount).toFixed(2)})</span>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}
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