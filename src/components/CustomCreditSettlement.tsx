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

interface OpeningBalance {
  OpeningBalanceID: number;
  Amount: number;
  BalanceDate: string;
  CustomerName: string;
  CustomerID: number;
  ReferenceID: string;
}

interface CustomerWithCredits {
  customerDetails: {
    CustomerID: number;
    CusName: string;
    CreditLimit: number;
  };
  pendingCredits: Credit[];
  pendingOpeningBalances: OpeningBalance[];
  totalOutstanding: number;
  openingBalanceOutstanding: number;
}

interface ChequeEntry {
  chequeNumber: string;
  bank: string;
  realizeDate: string;
  amount: string;
  receivedInHand: boolean;
}

const createEmptyCheque = (): ChequeEntry => ({
  chequeNumber: '',
  bank: '',
  realizeDate: '',
  amount: '',
  receivedInHand: true,
});

const formatCurrency = (amount: number) =>
  `Rs. ${Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

type SelectedSettlementItem =
  | { type: 'credit'; credit: Credit; amount: string; suggestedAmount?: string }
  | { type: 'opening_balance'; openingBalance: OpeningBalance; amount: string; suggestedAmount?: string };

const getSettlementItemKey = (item: SelectedSettlementItem) =>
  item.type === 'credit'
    ? `credit-${item.credit.CreditPaymentID}`
    : `ob-${item.openingBalance.OpeningBalanceID}`;

const getSettlementOutstanding = (item: SelectedSettlementItem) =>
  item.type === 'credit'
    ? Number(item.credit.Amount)
    : Number(item.openingBalance.Amount);

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
  const [cheques, setCheques] = useState<ChequeEntry[]>([createEmptyCheque()]);
  const chequeDetails = cheques[0] ?? createEmptyCheque();
  const setChequeDetails = (updater: ChequeEntry | ((prev: ChequeEntry) => ChequeEntry)) => {
    setCheques((prev) => {
      const current = prev[0] ?? createEmptyCheque();
      const next = typeof updater === 'function' ? updater(current) : updater;
      return [next, ...prev.slice(1)];
    });
  };
  const [selectedItems, setSelectedItems] = useState<SelectedSettlementItem[]>([]);
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
      setCheques([createEmptyCheque()]);
      setSelectedItems([]);
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
        setSelectedItems([]);
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
          pendingCredits: pendingResponse.data.pendingCredits || [],
          pendingOpeningBalances: pendingResponse.data.pendingOpeningBalances || [],
          totalOutstanding: outstandingResponse.data.TotalOutstanding,
          openingBalanceOutstanding: outstandingResponse.data.OpeningBalanceOutstanding || 0,
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

  const toggleItemSelection = (item: Credit | OpeningBalance, itemType: 'credit' | 'opening_balance') => {
    const itemKey =
      itemType === 'credit'
        ? `credit-${(item as Credit).CreditPaymentID}`
        : `ob-${(item as OpeningBalance).OpeningBalanceID}`;

    setSelectedItems((prev) => {
      const existingIndex = prev.findIndex((selected) => getSettlementItemKey(selected) === itemKey);

      if (existingIndex > -1) {
        const removedItem = prev[existingIndex];
        const nextItems = prev.filter((selected) => getSettlementItemKey(selected) !== itemKey);

        const removedAmount = parseFloat(removedItem.suggestedAmount || removedItem.amount || '0');
        if (!isNaN(removedAmount)) {
          const currentSuggested = parseFloat(suggestedTotalPayment || '0');
          const newSuggested = Math.max(0, currentSuggested - removedAmount);
          setSuggestedTotalPayment(newSuggested > 0 ? newSuggested.toFixed(2) : '');
        }

        if (distributionMode === 'auto' && totalPaymentAmount) {
          const totalAmount = parseFloat(totalPaymentAmount);
          if (!isNaN(totalAmount) && totalAmount > 0) {
            return distributePaymentAmount(nextItems, totalAmount);
          }
        }
        return nextItems;
      }

      const outstanding =
        itemType === 'credit'
          ? Number((item as Credit).Amount)
          : Number((item as OpeningBalance).Amount);
      const suggestedAmount = outstanding.toFixed(2);
      const newItem: SelectedSettlementItem =
        itemType === 'credit'
          ? {
              type: 'credit',
              credit: item as Credit,
              amount: '',
              suggestedAmount,
            }
          : {
              type: 'opening_balance',
              openingBalance: item as OpeningBalance,
              amount: '',
              suggestedAmount,
            };
      const nextItems = [...prev, newItem];

      const itemAmount = parseFloat(suggestedAmount);
      if (!isNaN(itemAmount)) {
        const currentSuggested = parseFloat(suggestedTotalPayment || '0');
        setSuggestedTotalPayment((currentSuggested + itemAmount).toFixed(2));
      }

      if (distributionMode === 'auto' && totalPaymentAmount) {
        const totalAmount = parseFloat(totalPaymentAmount);
        if (!isNaN(totalAmount) && totalAmount > 0) {
          return distributePaymentAmount(nextItems, totalAmount);
        }
      }
      return nextItems;
    });
  };

  const distributePaymentAmount = (
    items: SelectedSettlementItem[],
    totalAmount: number
  ): SelectedSettlementItem[] => {
    if (isNaN(totalAmount) || totalAmount <= 0 || items.length === 0) {
      return items.map((item) => ({ ...item, amount: '' }));
    }

    let remainingAmount = totalAmount;
    return items.map((item) => {
      const outstanding = getSettlementOutstanding(item);
      if (remainingAmount <= 0) {
        return { ...item, amount: '', suggestedAmount: item.suggestedAmount };
      }

      if (remainingAmount >= outstanding) {
        remainingAmount -= outstanding;
        return { ...item, amount: outstanding.toFixed(2), suggestedAmount: item.suggestedAmount };
      }

      const partialAmount = remainingAmount;
      remainingAmount = 0;
      return { ...item, amount: partialAmount.toFixed(2), suggestedAmount: item.suggestedAmount };
    });
  };

  const acceptSuggestedAmount = (itemKey: string) => {
    setSelectedItems((prev) =>
      prev.map((item) =>
        getSettlementItemKey(item) === itemKey
          ? { ...item, amount: item.suggestedAmount || '' }
          : item
      )
    );
    setDistributionMode('manual');
  };

  const acceptSuggestedTotalPayment = () => {
    setTotalPaymentAmount(suggestedTotalPayment);
    setDistributionMode('auto');
    if (selectedItems.length > 0) {
      const totalAmount = parseFloat(suggestedTotalPayment);
      if (!isNaN(totalAmount) && totalAmount > 0) {
        setSelectedItems(distributePaymentAmount(selectedItems, totalAmount));
      }
    }
  };

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

    if (selectedItems.length > 0) {
      const totalAmount = parseFloat(normalized);
      if (!isNaN(totalAmount) && totalAmount > 0) {
        setSelectedItems(distributePaymentAmount(selectedItems, totalAmount));
      } else {
        setSelectedItems(selectedItems.map((item) => ({ ...item, amount: '' })));
      }
    }
  };

  const handleItemAmountChange = (itemKey: string, rawValue: string) => {
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

    setSelectedItems((prev) =>
      prev.map((item) =>
        getSettlementItemKey(item) === itemKey ? { ...item, amount: normalized } : item
      )
    );
  };

  const handleItemAmountBlur = (itemKey: string, value: string, maxAmount: number) => {
    const numeric = parseFloat(value);

    if (!value || isNaN(numeric) || numeric <= 0) {
      setSelectedItems((prev) =>
        prev.map((item) =>
          getSettlementItemKey(item) === itemKey ? { ...item, amount: '' } : item
        )
      );
      return;
    }

    const clamped = Math.min(numeric, maxAmount);
    setSelectedItems((prev) =>
      prev.map((item) =>
        getSettlementItemKey(item) === itemKey
          ? { ...item, amount: clamped.toFixed(2) }
          : item
      )
    );
  };

  const selectedItemMap = useMemo(() => {
    const map = new Map<
      string,
      { index: number; amount: string; suggestedAmount?: string }
    >();

    selectedItems.forEach((item, index) => {
      map.set(getSettlementItemKey(item), {
        index,
        amount: item.amount,
        suggestedAmount: item.suggestedAmount,
      });
    });

    return map;
  }, [selectedItems]);

  const totalSelectedAmount = useMemo(() => {
    return selectedItems.reduce((sum, item) => {
      const value = parseFloat(item.amount);
      if (isNaN(value)) {
        return sum;
      }
      return sum + value;
    }, 0);
  }, [selectedItems]);

  const hasInvalidSelection = useMemo(() => {
    if (selectedItems.length === 0) {
      return true;
    }

    if (distributionMode === 'auto' && totalPaymentAmount) {
      const totalAmount = parseFloat(totalPaymentAmount);
      if (isNaN(totalAmount) || totalAmount <= 0) {
        return true;
      }
      return false;
    }

    return selectedItems.some((item) => {
      const value = parseFloat(item.amount);
      if (!item.amount || isNaN(value) || value <= 0) {
        return true;
      }
      return value - getSettlementOutstanding(item) > 0.009;
    });
  }, [selectedItems, distributionMode, totalPaymentAmount]);

  const handleOpenConfirmDialog = () => {
    if (selectedItems.length === 0) {
      toast({
        variant: "destructive",
        title: "No Items Selected",
        description: "Please select at least one credit or opening balance to settle.",
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
        description: "Please enter valid amounts for the selected items.",
        duration: 3000,
      });
      return;
    }

    if (paymentMethod === 'CHEQUE') {
      const hasInvalidCheque = cheques.some((cheque) => !cheque.realizeDate);

      if (hasInvalidCheque) {
        toast({
          variant: "destructive",
          title: "Missing Cheque Details",
          description: "Each cheque must include a realize date.",
          duration: 3000,
        });
        return;
      }

      const missingInHandDetails = cheques.some(
        (cheque) => cheque.receivedInHand && (!cheque.chequeNumber || !cheque.bank)
      );

      if (missingInHandDetails) {
        toast({
          variant: "destructive",
          title: "Missing Cheque Details",
          description: "Cheque number and bank are required when the cheque is already in hand.",
          duration: 3000,
        });
        return;
      }

      if (cheques.length > 1) {
        const chequeTotal = cheques.reduce((sum, cheque) => sum + (parseFloat(cheque.amount) || 0), 0);
        if (Math.abs(chequeTotal - totalSelectedAmount) > 0.01) {
          toast({
            variant: "destructive",
            title: "Cheque Amount Mismatch",
            description: "The total of all cheque amounts must match the settlement amount.",
            duration: 3000,
          });
          return;
        }
      }
    }
    
    setConfirmDialogOpen(true);
  };

  const handleCloseConfirmDialog = () => {
    setConfirmDialogOpen(false);
  };

  const handleSettleAmount = async () => {
    if (
      !selectedCustomerId ||
      selectedItems.length === 0 ||
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
      selectedItems: selectedItems.map((item) =>
        item.type === 'credit'
          ? {
              type: 'credit',
              creditPaymentId: item.credit.CreditPaymentID,
              amount: parseFloat(item.amount),
            }
          : {
              type: 'opening_balance',
              openingBalanceId: item.openingBalance.OpeningBalanceID,
              amount: parseFloat(item.amount),
            }
      ),
      ...(paymentMethod === 'CHEQUE' && {
        cheques: cheques.map((cheque) => ({
          chequeNumber: cheque.chequeNumber,
          bank: cheque.bank,
          realizeDate: cheque.realizeDate,
          receivedInHand: cheque.receivedInHand,
          amount: cheques.length > 1
            ? parseFloat(cheque.amount)
            : parseFloat(totalSelectedAmount.toFixed(2)),
        })),
      })
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
        description: "Payment successfully applied",
        duration: 3000,
      });
      
      // Notify parent component to refresh its data
      onSuccess();
      setSelectedItems([]);
      
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
      setSelectedItems([]);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.CustomerID.toString());
    setSelectedCustomerName(customer.CusName);
    setSelectedItems([]);
  };

  const renderSettleAmountCell = (
    itemKey: string,
    isSelected: boolean,
    amountValue: string,
    suggestedAmount?: string,
    maxAmount?: number
  ) => {
    if (!isSelected) {
      return (
        <span className="text-xs text-muted-foreground">
          Not selected
        </span>
      );
    }

    return (
      <div className="flex flex-col gap-1 items-end">
        <Input
          inputMode="decimal"
          value={amountValue}
          onChange={(e) => handleItemAmountChange(itemKey, e.target.value)}
          onBlur={(e) => handleItemAmountBlur(itemKey, e.target.value, maxAmount || 0)}
          className="text-right"
        />
        {suggestedAmount && !amountValue && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => acceptSuggestedAmount(itemKey)}
            className="h-6 text-xs px-2"
          >
            Use {formatCurrency(parseFloat(suggestedAmount))}
          </Button>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[1000px]">
          <DialogHeader>
            <DialogTitle>Custom Credit Settlement</DialogTitle>
            <DialogDescription>
              Apply a custom payment amount to a customer&apos;s pending credits and opening balances.
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
              <div className="flex items-center justify-between">
                <Label>Cheque Details</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCheques((prev) => [...prev, createEmptyCheque()])}
                >
                  Add Cheque
                </Button>
              </div>
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
              <div className="flex items-center gap-2">
                <Checkbox
                  id="settlement-cheque-received"
                  checked={chequeDetails.receivedInHand}
                  onCheckedChange={(checked) => setChequeDetails(prev => ({
                    ...prev,
                    receivedInHand: checked === true,
                  }))}
                />
                <Label htmlFor="settlement-cheque-received" className="text-sm font-normal">
                  Cheque received in hand (floating)
                </Label>
              </div>
              {cheques.slice(1).map((cheque, index) => (
                <div key={index + 1} className="space-y-3 border rounded p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Cheque {index + 2}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCheques((prev) => prev.filter((_, itemIndex) => itemIndex !== index + 1))}
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`cheque-number-${index + 1}`}>Cheque Number</Label>
                      <Input
                        id={`cheque-number-${index + 1}`}
                        value={cheque.chequeNumber}
                        onChange={(e) => setCheques((prev) => prev.map((item, itemIndex) =>
                          itemIndex === index + 1 ? { ...item, chequeNumber: e.target.value } : item
                        ))}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`bank-${index + 1}`}>Bank</Label>
                      <Input
                        id={`bank-${index + 1}`}
                        value={cheque.bank}
                        onChange={(e) => setCheques((prev) => prev.map((item, itemIndex) =>
                          itemIndex === index + 1 ? { ...item, bank: e.target.value } : item
                        ))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`realize-date-${index + 1}`}>Realize Date</Label>
                      <Input
                        id={`realize-date-${index + 1}`}
                        type="date"
                        value={cheque.realizeDate}
                        onChange={(e) => setCheques((prev) => prev.map((item, itemIndex) =>
                          itemIndex === index + 1 ? { ...item, realizeDate: e.target.value } : item
                        ))}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`cheque-amount-${index + 1}`}>Amount (Rs.)</Label>
                      <Input
                        id={`cheque-amount-${index + 1}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={cheque.amount}
                        onChange={(e) => setCheques((prev) => prev.map((item, itemIndex) =>
                          itemIndex === index + 1 ? { ...item, amount: e.target.value } : item
                        ))}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`settlement-cheque-received-${index + 1}`}
                      checked={cheque.receivedInHand}
                      onCheckedChange={(checked) => setCheques((prev) => prev.map((item, itemIndex) =>
                        itemIndex === index + 1 ? { ...item, receivedInHand: checked === true } : item
                      ))}
                    />
                    <Label htmlFor={`settlement-cheque-received-${index + 1}`} className="text-sm font-normal">
                      Cheque received in hand (floating)
                    </Label>
                  </div>
                </div>
              ))}
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
            ) : customerCredits &&
              (customerCredits.pendingCredits.length > 0 ||
                customerCredits.pendingOpeningBalances.length > 0) ? (
              <>
                {/* Customer Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-md">
                  <div>
                    <p className="text-sm text-gray-500">Customer</p>
                    <p className="font-medium">{customerCredits.customerDetails.CusName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Credit Limit</p>
                    <p className="font-medium tabular-nums">
                      {formatCurrency(customerCredits.customerDetails.CreditLimit)}
                    </p>
                  </div>
                  {customerCredits.openingBalanceOutstanding > 0 && (
                    <div>
                      <p className="text-sm text-gray-500">Opening Balance</p>
                      <p className="font-medium tabular-nums">
                        {formatCurrency(customerCredits.openingBalanceOutstanding)}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-500">Total Outstanding</p>
                    <p className="font-medium tabular-nums">
                      {formatCurrency(customerCredits.totalOutstanding)}
                    </p>
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
                        const itemKey = `credit-${credit.CreditPaymentID}`;
                        const selection = selectedItemMap.get(itemKey);
                        const isSelected = Boolean(selection);
                        const amountValue = selection?.amount ?? '';
                        const outstanding = Number(credit.Amount);

                        return (
                          <TableRow
                            key={credit.CreditPaymentID}
                            className={isSelected ? "bg-blue-50/50" : undefined}
                          >
                            <TableCell className="text-center">
                              <Checkbox
                                aria-label="Select credit"
                                checked={isSelected}
                                onCheckedChange={() => toggleItemSelection(credit, 'credit')}
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
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(outstanding)}
                            </TableCell>
                            <TableCell className="text-right">
                              {renderSettleAmountCell(
                                itemKey,
                                isSelected,
                                amountValue,
                                selection?.suggestedAmount,
                                outstanding
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {customerCredits.pendingOpeningBalances.map((openingBalance) => {
                        const itemKey = `ob-${openingBalance.OpeningBalanceID}`;
                        const selection = selectedItemMap.get(itemKey);
                        const isSelected = Boolean(selection);
                        const amountValue = selection?.amount ?? '';
                        const outstanding = Number(openingBalance.Amount);

                        return (
                          <TableRow
                            key={itemKey}
                            className={isSelected ? "bg-amber-50/50" : "bg-amber-50/20"}
                          >
                            <TableCell className="text-center">
                              <Checkbox
                                aria-label="Select opening balance"
                                checked={isSelected}
                                onCheckedChange={() => toggleItemSelection(openingBalance, 'opening_balance')}
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
                            <TableCell>{openingBalance.ReferenceID}</TableCell>
                            <TableCell>—</TableCell>
                            <TableCell>
                              {format(new Date(openingBalance.BalanceDate), 'yyyy-MM-dd')}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(outstanding)}
                            </TableCell>
                            <TableCell className="text-right">
                              {renderSettleAmountCell(
                                itemKey,
                                isSelected,
                                amountValue,
                                selection?.suggestedAmount,
                                outstanding
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
                      {distributionMode === 'auto' && suggestedTotalPayment && !totalPaymentAmount && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={acceptSuggestedTotalPayment}
                          className="h-7 text-xs"
                        >
                          Use Suggested: {formatCurrency(parseFloat(suggestedTotalPayment))}
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
                      disabled={distributionMode === 'manual'}
                    />
                    <p className="text-xs text-gray-500">
                      {distributionMode === 'manual'
                        ? 'Total payment amount is disabled while settle amounts are entered per row. Use Total Selected Amount below.'
                        : 'Enter the total payment amount and it will be automatically distributed across selected bills in order.'}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-sm font-medium text-gray-700">
                      Total Selected Amount
                    </p>
                    <p className="text-lg font-semibold text-gray-900 tabular-nums">
                      {formatCurrency(totalSelectedAmount)}
                    </p>
                  </div>
                  
                  {totalPaymentAmount && parseFloat(totalPaymentAmount) > totalSelectedAmount && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                      <p className="text-xs text-yellow-800">
                        Payment amount ({formatCurrency(parseFloat(totalPaymentAmount))}) exceeds total selected amount. 
                        Remaining {formatCurrency(parseFloat(totalPaymentAmount) - totalSelectedAmount)} will not be applied.
                      </p>
                    </div>
                  )}
                  
                  {hasInvalidSelection && selectedItems.length > 0 && distributionMode === 'manual' && (
                    <p className="text-xs text-red-500">
                      Please enter a valid amount (greater than zero and not exceeding the outstanding amount) for each selected item.
                    </p>
                  )}
                  <p className="text-sm text-gray-500 italic">
                    Items will be settled in the order selected. Partial credit settlements create a new pending credit for the remaining balance.
                  </p>
                </div>
              </>
            ) : selectedCustomerId ? (
              <div className="py-2 text-center text-sm">
                <p className="text-gray-500">No pending credits or opening balances found for this customer.</p>
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
                selectedItems.length === 0 ||
                hasInvalidSelection ||
                totalSelectedAmount <= 0 ||
                (paymentMethod === 'CHEQUE' &&
                  (!chequeDetails.realizeDate ||
                    (chequeDetails.receivedInHand &&
                      (!chequeDetails.chequeNumber || !chequeDetails.bank))))
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
              You are about to settle {formatCurrency(totalSelectedAmount)} 
              {customerCredits && ` for ${customerCredits.customerDetails.CusName}`}.
              Items will be settled in the exact order they were selected.
            </DialogDescription>
          </DialogHeader>
          {selectedItems.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-gray-700">Selected Items</p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                {selectedItems
                  .filter(item => item.amount && parseFloat(item.amount) > 0)
                  .map((item, index) => {
                    const amount = parseFloat(item.amount || '0');
                    const outstanding = getSettlementOutstanding(item);
                    const isPartial = amount < outstanding;

                    if (item.type === 'credit') {
                      return (
                        <li key={getSettlementItemKey(item)}>
                          <span className="font-medium">#{index + 1}</span> · Invoice: {item.credit.InvoiceID || 'N/A'} · Due{" "}
                          {format(new Date(item.credit.DueDate), 'yyyy-MM-dd')} · Settling{" "}
                          {formatCurrency(amount)}
                          {isPartial && (
                            <span className="text-orange-600"> (Partial - Remaining: {formatCurrency(outstanding - amount)})</span>
                          )}
                        </li>
                      );
                    }

                    return (
                      <li key={getSettlementItemKey(item)}>
                        <span className="font-medium">#{index + 1}</span> · Opening Balance: {item.openingBalance.ReferenceID} · Date{" "}
                        {format(new Date(item.openingBalance.BalanceDate), 'yyyy-MM-dd')} · Settling{" "}
                        {formatCurrency(amount)}
                        {isPartial && (
                          <span className="text-orange-600"> (Partial - Remaining: {formatCurrency(outstanding - amount)})</span>
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