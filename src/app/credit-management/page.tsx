"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from '../auth/auth-context';
import axios from '@/lib/api/axios';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/DateRange';
import { format } from 'date-fns';
import { AxiosError } from 'axios';
import { toast } from '@/hooks/use-toast';
import CustomCreditSettlementDialog from '@/components/CustomCreditSettlement';
import { Trash2, AlertTriangle } from "lucide-react";
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Cheque {
  ChequePaymentID: string | number;
  ChequeNumber: string;
  Bank: string;
  RealizeDate: string;
  ReceivedDate?: string | null;
  DepositedDate?: string | null;
  Amount: number;
  CustomerName: string;
  CustomerID: number;
  CreditLimit: number;
  SaleID: number;
}

interface Credit {
  CreditPaymentID: string | number;
  DueDate: string;
  Amount: number;
  CustomerName: string;
  CustomerID: number;
  CreditLimit: number;
  SaleID: number;
}

interface OpeningBalance {
  OpeningBalanceID: number;
  Amount: number;
  BalanceDate: string;
  Status: string;
  CustomerName: string;
  CustomerID: number;
  CreditLimit: number;
  ReferenceID: string;
}

interface PaymentState {
  pendingCheques: Cheque[];
  pendingCredits: Credit[];
  pendingOpeningBalances: OpeningBalance[];
  realizedCheques: Cheque[];
  settledCredits: Credit[];
}

interface Customer {
  CustomerID: number;
  CustomerName: string;
}

interface ConfirmDialogState {
  isOpen: boolean;
  type: 'realize' | 'bounce' | 'settle' | 'settle_opening_balance' | 'delete_cheque' | 'delete_credit' | 'delete_opening_balance' | null;
  paymentId: string | number | null;
  title: string;
  description: string;
  paymentDetails?: {
    customerName?: string;
    amount?: number;
    chequeNumber?: string;
    bank?: string;
    dueDate?: string;
  };
}

type PendingCreditRow =
  | {
      kind: 'credit';
      credit: Credit;
      displayAmount: number;
      includedOpeningBalance?: OpeningBalance;
    }
  | {
      kind: 'opening_balance';
      openingBalance: OpeningBalance;
      displayAmount: number;
    };

const formatCurrency = (amount: number) =>
  `Rs. ${Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const buildPendingCreditRows = (
  credits: Credit[],
  openingBalances: OpeningBalance[]
): PendingCreditRow[] => {
  const openingBalanceByCustomer = new Map(
    openingBalances.map((openingBalance) => [openingBalance.CustomerID, openingBalance])
  );
  const customersWithCredits = new Set(credits.map((credit) => credit.CustomerID));
  const mergedOpeningBalanceCustomers = new Set<number>();
  const rows: PendingCreditRow[] = [];

  for (const credit of credits) {
    const openingBalance = openingBalanceByCustomer.get(credit.CustomerID);
    let includedOpeningBalance: OpeningBalance | undefined;
    let displayAmount = Number(credit.Amount);

    if (openingBalance && !mergedOpeningBalanceCustomers.has(credit.CustomerID)) {
      includedOpeningBalance = openingBalance;
      displayAmount += Number(openingBalance.Amount);
      mergedOpeningBalanceCustomers.add(credit.CustomerID);
    }

    rows.push({
      kind: 'credit',
      credit,
      displayAmount,
      includedOpeningBalance,
    });
  }

  for (const openingBalance of openingBalances) {
    if (!customersWithCredits.has(openingBalance.CustomerID)) {
      rows.push({
        kind: 'opening_balance',
        openingBalance,
        displayAmount: Number(openingBalance.Amount),
      });
    }
  }

  return rows;
};

interface MarkReceivedDialogState {
  isOpen: boolean;
  cheque: Cheque | null;
  chequeNumber: string;
  bank: string;
  receivedDate: string;
}

interface MarkDepositedDialogState {
  isOpen: boolean;
  cheque: Cheque | null;
  depositedDate: string;
}

const PaymentManagement = () => {
  const { user, getBusinessLineID } = useAuth();
  const [pendingPayments, setPendingPayments] = useState<PaymentState>({ 
    pendingCheques: [], 
    pendingCredits: [],
    pendingOpeningBalances: [],
    realizedCheques: [],
    settledCredits: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingIds, setProcessingIds] = useState<Set<string | number>>(new Set());
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [customerOutstanding, setCustomerOutstanding] = useState<number | null>(null);
  
  const [dateFilterMode, setDateFilterMode] = useState<'range' | 'upTo' | 'on'>('range');
  const [upToDate, setUpToDate] = useState(new Date());
  const [saleUpToDate, setSaleUpToDate] = useState(new Date());
  const [dueOnDate, setDueOnDate] = useState(new Date());
  const [saleOnDate, setSaleOnDate] = useState(new Date());

  const [dueDateRange, setDueDateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date()
  });
  
  const [saleDateRange, setSaleDateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date()
  });
  
  const [activeDateFilter, setActiveDateFilter] = useState<'due' | 'sale'>('sale');
  const [customSettlementOpen, setCustomSettlementOpen] = useState(false);

  const pendingCreditRows = useMemo(
    () =>
      buildPendingCreditRows(
        pendingPayments.pendingCredits,
        pendingPayments.pendingOpeningBalances
      ),
    [pendingPayments.pendingCredits, pendingPayments.pendingOpeningBalances]
  );

  const { awaitingReceiptCheques, inHandCheques, floatingCheques } = useMemo(() => {
    const awaiting: Cheque[] = [];
    const inHand: Cheque[] = [];
    const floating: Cheque[] = [];

    for (const cheque of pendingPayments.pendingCheques) {
      if (cheque.DepositedDate) {
        floating.push(cheque);
      } else if (cheque.ReceivedDate) {
        inHand.push(cheque);
      } else {
        awaiting.push(cheque);
      }
    }

    return {
      awaitingReceiptCheques: awaiting,
      inHandCheques: inHand,
      floatingCheques: floating,
    };
  }, [pendingPayments.pendingCheques]);

  const chequeOnHandTotal = useMemo(
    () => inHandCheques.reduce((sum, cheque) => sum + Number(cheque.Amount || 0), 0),
    [inHandCheques]
  );

  const floatingChequeTotal = useMemo(
    () => floatingCheques.reduce((sum, cheque) => sum + Number(cheque.Amount || 0), 0),
    [floatingCheques]
  );

  const totalCreditAmount = useMemo(() => {
    const creditsTotal = pendingPayments.pendingCredits.reduce(
      (sum, credit) => sum + Number(credit.Amount || 0),
      0
    );
    const openingTotal = pendingPayments.pendingOpeningBalances.reduce(
      (sum, openingBalance) => sum + Number(openingBalance.Amount || 0),
      0
    );

    return creditsTotal + openingTotal;
  }, [pendingPayments.pendingCredits, pendingPayments.pendingOpeningBalances]);

  const totalChequeAmount = useMemo(
    () =>
      pendingPayments.pendingCheques.reduce(
        (sum, cheque) => sum + Number(cheque.Amount || 0),
        0
      ),
    [pendingPayments.pendingCheques]
  );

  // Remaining credit after cash, in-hand cheques, and floating (deposited) cheques.
  // Settled cash is already excluded from pending credits.
  const creditBalance = useMemo(() => {
    const awaitingReceiptTotal = awaitingReceiptCheques.reduce(
      (sum, cheque) => sum + Number(cheque.Amount || 0),
      0
    );
    return totalCreditAmount + awaitingReceiptTotal;
  }, [totalCreditAmount, awaitingReceiptCheques]);

  // State for confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    type: null,
    paymentId: null,
    title: '',
    description: ''
  });

  const [markReceivedDialog, setMarkReceivedDialog] = useState<MarkReceivedDialogState>({
    isOpen: false,
    cheque: null,
    chequeNumber: '',
    bank: '',
    receivedDate: format(new Date(), 'yyyy-MM-dd'),
  });

  const [markDepositedDialog, setMarkDepositedDialog] = useState<MarkDepositedDialogState>({
    isOpen: false,
    cheque: null,
    depositedDate: format(new Date(), 'yyyy-MM-dd'),
  });

  const fetchCustomers = useCallback(async () => {
    try {
      const businessLineId = getBusinessLineID();
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/payments/customers/${businessLineId}`);
      setCustomers(response.data);
    } catch (err: unknown) {
      console.error('Error fetching customers:', err);
    }
  }, [getBusinessLineID]);
  
  const fetchPendingPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const businessLineId = getBusinessLineID();
      
      const params = new URLSearchParams();
      if (selectedCustomer && selectedCustomer !== "all") {
          params.append('customerId', selectedCustomer);
      }
      
      // const dateRange = activeDateFilter === 'due' ? dueDateRange : saleDateRange;
      
      // if (dateRange.from) {
      //   if (activeDateFilter === 'due') {
      //     params.append('startDate', format(dateRange.from, 'yyyy-MM-dd'));
      //   } else {
      //     params.append('saleStartDate', format(dateRange.from, 'yyyy-MM-dd'));
      //   }
      // }
      
      // if (dateRange.to) {
      //   if (activeDateFilter === 'due') {
      //     params.append('endDate', format(dateRange.to, 'yyyy-MM-dd'));
      //   } else {
      //     params.append('saleEndDate', format(dateRange.to, 'yyyy-MM-dd'));
      //   }
      // }

      const dateRange = activeDateFilter === 'due' ? dueDateRange : saleDateRange;
      const currentUpToDate = activeDateFilter === 'due' ? upToDate : saleUpToDate;
      const currentOnDate = activeDateFilter === 'due' ? dueOnDate : saleOnDate;

      if (dateFilterMode === 'range') {
        if (dateRange.from) {
          if (activeDateFilter === 'due') {
            params.append('startDate', format(dateRange.from, 'yyyy-MM-dd'));
          } else {
            params.append('saleStartDate', format(dateRange.from, 'yyyy-MM-dd'));
          }
        }
        
        if (dateRange.to) {
          if (activeDateFilter === 'due') {
            params.append('endDate', format(dateRange.to, 'yyyy-MM-dd'));
          } else {
            params.append('saleEndDate', format(dateRange.to, 'yyyy-MM-dd'));
          }
        }
      } else if (dateFilterMode === 'upTo') {
        if (activeDateFilter === 'due') {
          params.append('endDate', format(currentUpToDate, 'yyyy-MM-dd'));
        } else {
          params.append('saleEndDate', format(currentUpToDate, 'yyyy-MM-dd'));
        }
      } else if (dateFilterMode === 'on') {
        if (activeDateFilter === 'due') {
          params.append('startDate', format(currentOnDate, 'yyyy-MM-dd'));
          params.append('endDate', format(currentOnDate, 'yyyy-MM-dd'));
        } else {
          params.append('saleStartDate', format(currentOnDate, 'yyyy-MM-dd'));
          params.append('saleEndDate', format(currentOnDate, 'yyyy-MM-dd'));
        }
      }
  
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/payments/pending/${businessLineId}?${params.toString()}`);
      setPendingPayments({
        pendingCheques: response.data.pendingCheques || [],
        pendingCredits: response.data.pendingCredits || [],
        pendingOpeningBalances: response.data.pendingOpeningBalances || [],
        realizedCheques: response.data.realizedCheques || [],
        settledCredits: response.data.settledCredits || [],
      });
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        const errorMessage = err.response?.data?.message || 'Failed to fetch pending payments';
        setError(`Error: ${errorMessage}`);
        console.error('API Error:', {
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: err.response?.data,
          url: err.config?.url,
          method: err.config?.method
        });
      } else {
        console.error('Unexpected error:', err);
      }      
    } finally {
      setLoading(false);
    }
  // }, [selectedCustomer, dueDateRange, saleDateRange, activeDateFilter, getBusinessLineID]);
  }, [selectedCustomer, dueDateRange, saleDateRange, activeDateFilter, dateFilterMode, upToDate, saleUpToDate, dueOnDate, saleOnDate, getBusinessLineID]);
    
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    fetchPendingPayments();
  }, [fetchPendingPayments]);

  useEffect(() => {
    const fetchCustomerOutstanding = async () => {
      if (!selectedCustomer || selectedCustomer === 'all') {
        setCustomerOutstanding(null);
        return;
      }

      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/payments/customer/${selectedCustomer}/outstanding`
        );
        setCustomerOutstanding(Number(response.data.TotalOutstanding || 0));
      } catch (err) {
        console.error('Error fetching customer outstanding:', err);
        setCustomerOutstanding(null);
      }
    };

    fetchCustomerOutstanding();
  }, [selectedCustomer, pendingPayments]);

  // Open confirmation dialog for Realize Cheque
  const confirmRealizeCheque = (cheque: Cheque) => {
    setConfirmDialog({
      isOpen: true,
      type: 'realize',
      paymentId: cheque.ChequePaymentID,
      title: 'Realize Cheque',
      description: `Are you sure you want to realize cheque #${cheque.ChequeNumber} for ${cheque.CustomerName} with amount Rs. ${Number(cheque.Amount).toFixed(2)}?`
    });
  };

  // Open confirmation dialog for Bounce Cheque
  const confirmBounceCheque = (cheque: Cheque) => {
    setConfirmDialog({
      isOpen: true,
      type: 'bounce',
      paymentId: cheque.ChequePaymentID,
      title: 'Bounce Cheque',
      description: `Are you sure you want to mark cheque #${cheque.ChequeNumber} as bounced? This will convert it to a credit with a due date 30 days from today.`
    });
  };

  const confirmSettleOpeningBalance = (openingBalance: OpeningBalance) => {
    setConfirmDialog({
      isOpen: true,
      type: 'settle_opening_balance',
      paymentId: openingBalance.OpeningBalanceID,
      title: 'Settle Opening Balance',
      description: `Mark the pre go-live opening balance (${openingBalance.ReferenceID}) for ${openingBalance.CustomerName} as collected? Amount: Rs. ${Number(openingBalance.Amount).toFixed(2)}. This removes it from outstanding. You can undo from Opening Balances using the Undo button.`
    });
  };

  // Open confirmation dialog for Settle Credit
  const confirmSettleCredit = (credit: Credit) => {
    setConfirmDialog({
      isOpen: true,
      type: 'settle',
      paymentId: credit.CreditPaymentID,
      title: 'Settle Credit',
      description: `Are you sure you want to settle this credit for ${credit.CustomerName} with amount Rs. ${Number(credit.Amount).toFixed(2)}?`
    });
  };

  // Open confirmation dialog for Delete Cheque Realization
  const confirmDeleteChequeRealization = (cheque: Cheque) => {
    setConfirmDialog({
      isOpen: true,
      type: 'delete_cheque',
      paymentId: cheque.ChequePaymentID,
      title: 'Delete Cheque Payment',
      description: `Are you sure you want to delete this cheque payment? This action will also delete the associated sale and restore product quantities to inventory.`,
      paymentDetails: {
        customerName: cheque.CustomerName,
        amount: cheque.Amount,
        chequeNumber: cheque.ChequeNumber,
        bank: cheque.Bank
      }
    });
  };

  const confirmDeleteOpeningBalance = (openingBalance: OpeningBalance) => {
    setConfirmDialog({
      isOpen: true,
      type: 'delete_opening_balance',
      paymentId: openingBalance.OpeningBalanceID,
      title: 'Delete Opening Balance',
      description: `Delete the opening balance (${openingBalance.ReferenceID}) of ${formatCurrency(openingBalance.Amount)} for ${openingBalance.CustomerName}? This removes it from outstanding totals.`,
      paymentDetails: {
        customerName: openingBalance.CustomerName,
        amount: openingBalance.Amount,
      },
    });
  };

  // Open confirmation dialog for Delete Credit Settlement
  const confirmDeleteCreditSettlement = (credit: Credit) => {
    setConfirmDialog({
      isOpen: true,
      type: 'delete_credit',
      paymentId: credit.CreditPaymentID,
      title: 'Delete Credit Payment',
      description: `Are you sure you want to delete this credit payment? This action will also delete the associated sale and restore product quantities to inventory.`,
      paymentDetails: {
        customerName: credit.CustomerName,
        amount: credit.Amount,
        dueDate: credit.DueDate
      }
    });
  };

  // Close confirmation dialog
  const closeConfirmDialog = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  };

  // Confirm action handler
  const handleConfirmAction = async () => {
    const { type, paymentId } = confirmDialog;
    closeConfirmDialog();
    
    if (!paymentId) return;
    
    switch (type) {
      case 'realize':
        await handleRealizeCheque(paymentId);
        break;
      case 'bounce':
        await handleBounceCheque(paymentId);
        break;
      case 'settle':
        await handleSettleCredit(paymentId);
        break;
      case 'settle_opening_balance':
        await handleSettleOpeningBalance(paymentId);
        break;
      case 'delete_cheque':
        await handleDeleteChequeRealization(paymentId);
        break;
      case 'delete_credit':
        await handleDeleteCreditSettlement(paymentId);
        break;
      case 'delete_opening_balance':
        await handleDeleteOpeningBalance(paymentId);
        break;
    }
  };

  const handleRealizeCheque = async (chequePaymentId: string | number) => {
    try {
      setProcessingIds(prev => new Set(prev).add(chequePaymentId));
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/payments/cheque/${chequePaymentId}/realize`);
      await fetchPendingPayments();
      toast({
        title: "Success",
        description: "Cheque has been realized successfully",
        duration: 3000,
      })
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        const errorMessage = err.response?.data?.message || 'Error realizing cheque';
        setError(`Error: ${errorMessage}`);
        console.error('API Error:', {
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: err.response?.data,
          url: err.config?.url,
          method: err.config?.method
        });
        toast({
          variant: "destructive",
          title: "Error",
          description: err instanceof AxiosError 
            ? err.response?.data?.message || 'Error realizing cheque'
            : 'Error realizing cheque',
          duration: 3000,
        })
      } else {
        console.error('Unexpected error:', err);
      }
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(chequePaymentId);
        return newSet;
      });
    }
  };

  const handleBounceCheque = async (chequePaymentId: string | number) => {
    try {
      setProcessingIds(prev => new Set(prev).add(chequePaymentId));
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/payments/cheque/${chequePaymentId}/bounce`, {
        dueDate: dueDate.toISOString().split('T')[0]
      });
      await fetchPendingPayments();
      toast({
        title: "Success",
        description: "Cheque has been marked as bounced and converted to credit",
        duration: 3000,
      })
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        const errorMessage = err.response?.data?.message || 'Error making cheque as bounced';
        setError(`Error: ${errorMessage}`);
        console.error('API Error:', {
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: err.response?.data,
          url: err.config?.url,
          method: err.config?.method
        });
        toast({
          variant: "destructive",
          title: "Error",
          description: err instanceof AxiosError 
            ? err.response?.data?.message || 'Error marking cheque as bounced'
            : 'Error marking cheque as bounced',
          duration: 3000,
        })
      } else {
        console.error('Unexpected error:', err);
      }
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(chequePaymentId);
        return newSet;
      });
    }
  };

  const openMarkReceivedDialog = (cheque: Cheque) => {
    setMarkReceivedDialog({
      isOpen: true,
      cheque,
      chequeNumber: cheque.ChequeNumber || '',
      bank: cheque.Bank || '',
      receivedDate: format(new Date(), 'yyyy-MM-dd'),
    });
  };

  const closeMarkReceivedDialog = () => {
    setMarkReceivedDialog((prev) => ({ ...prev, isOpen: false, cheque: null }));
  };

  const handleMarkChequeReceived = async () => {
    const { cheque, chequeNumber, bank, receivedDate } = markReceivedDialog;
    if (!cheque) return;

    if (!chequeNumber.trim() || !bank.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing details',
        description: 'Cheque number and bank are required when marking a cheque as received.',
        duration: 3000,
      });
      return;
    }

    try {
      setProcessingIds((prev) => new Set(prev).add(cheque.ChequePaymentID));
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/payments/cheque/${cheque.ChequePaymentID}/receive`,
        {
          receivedDate,
          chequeNumber: chequeNumber.trim(),
          bank: bank.trim(),
        }
      );
      closeMarkReceivedDialog();
      await fetchPendingPayments();
      toast({
        title: 'Success',
        description: 'Cheque marked as received and moved to in hand.',
        duration: 3000,
      });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof AxiosError
          ? err.response?.data?.message || 'Error marking cheque as received'
          : 'Error marking cheque as received';
      setError(`Error: ${errorMessage}`);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
        duration: 3000,
      });
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(cheque.ChequePaymentID);
        return newSet;
      });
    }
  };

  const openMarkDepositedDialog = (cheque: Cheque) => {
    setMarkDepositedDialog({
      isOpen: true,
      cheque,
      depositedDate: format(new Date(), 'yyyy-MM-dd'),
    });
  };

  const closeMarkDepositedDialog = () => {
    setMarkDepositedDialog((prev) => ({ ...prev, isOpen: false, cheque: null }));
  };

  const handleMarkChequeDeposited = async () => {
    const { cheque, depositedDate } = markDepositedDialog;
    if (!cheque) return;

    try {
      setProcessingIds((prev) => new Set(prev).add(cheque.ChequePaymentID));
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/payments/cheque/${cheque.ChequePaymentID}/deposit`,
        { depositedDate }
      );
      closeMarkDepositedDialog();
      await fetchPendingPayments();
      toast({
        title: 'Success',
        description: 'Cheque marked as deposited and moved to floating.',
        duration: 3000,
      });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof AxiosError
          ? err.response?.data?.message || 'Error marking cheque as deposited'
          : 'Error marking cheque as deposited';
      setError(`Error: ${errorMessage}`);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
        duration: 3000,
      });
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(cheque.ChequePaymentID);
        return newSet;
      });
    }
  };

  const handleSettleOpeningBalance = async (openingBalanceId: string | number) => {
    try {
      setProcessingIds(prev => new Set(prev).add(openingBalanceId));
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/payments/opening-balance/${openingBalanceId}/settle`);
      await fetchPendingPayments();
      toast({
        title: "Success",
        description: "Opening balance settled. Undo from Opening Balances if this was a mistake.",
        duration: 5000,
      });
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        const errorMessage = err.response?.data?.message || 'Error settling opening balance';
        setError(`Error: ${errorMessage}`);
        toast({
          variant: "destructive",
          title: "Error",
          description: errorMessage,
          duration: 3000,
        });
      } else {
        console.error('Unexpected error:', err);
      }
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(openingBalanceId);
        return newSet;
      });
    }
  };

  const handleDeleteOpeningBalance = async (openingBalanceId: string | number) => {
    try {
      setProcessingIds(prev => new Set(prev).add(openingBalanceId));
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/opening-balances/${openingBalanceId}`);
      await fetchPendingPayments();
      toast({
        title: "Success",
        description: "Opening balance removed",
        duration: 3000,
      });
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        const errorMessage = err.response?.data?.message || 'Error deleting opening balance';
        setError(`Error: ${errorMessage}`);
        toast({
          variant: "destructive",
          title: "Error",
          description: errorMessage,
          duration: 3000,
        });
      } else {
        console.error('Unexpected error:', err);
      }
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(openingBalanceId);
        return newSet;
      });
    }
  };

  const handleSettleCredit = async (creditPaymentId: string | number) => {
    try {
      setProcessingIds(prev => new Set(prev).add(creditPaymentId));
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/payments/credit/${creditPaymentId}/settle`);
      await fetchPendingPayments();
      toast({
        title: "Success",
        description: "Credit has been settled successfully",
        duration: 3000,
      })
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        const errorMessage = err.response?.data?.message || 'Error settling credit';
        setError(`Error: ${errorMessage}`);
        console.error('API Error:', {
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: err.response?.data,
          url: err.config?.url,
          method: err.config?.method
        });
        toast({
          variant: "destructive",
          title: "Error",
          description: err instanceof AxiosError 
            ? err.response?.data?.message || 'Error settling credit'
            : 'Error settling credit',
          duration: 3000,
        })
      } else {
        console.error('Unexpected error:', err);
      }
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(creditPaymentId);
        return newSet;
      });
    }
  };

  const handleDeleteChequeRealization = async (chequePaymentId: string | number) => {
    try {
      setProcessingIds(prev => new Set(prev).add(chequePaymentId));
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/payments/cheque/${chequePaymentId}`);
      await fetchPendingPayments();
      toast({
        title: "Success",
        description: "Cheque payment and associated sale have been deleted successfully.",
        duration: 3000,
      })
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        const errorMessage = err.response?.data?.message || 'Error deleting cheque payment';
        setError(`Error: ${errorMessage}`);
        console.error('API Error:', {
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: err.response?.data,
          url: err.config?.url,
          method: err.config?.method
        });
        toast({
          variant: "destructive",
          title: "Error",
          description: err instanceof AxiosError 
            ? err.response?.data?.message || 'Error deleting cheque payment'
            : 'Error deleting cheque payment',
          duration: 3000,
        })
      } else {
        console.error('Unexpected error:', err);
      }
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(chequePaymentId);
        return newSet;
      });
    }
  };

  const handleDeleteCreditSettlement = async (creditPaymentId: string | number) => {
    try {
      setProcessingIds(prev => new Set(prev).add(creditPaymentId));
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/payments/credit/${creditPaymentId}`);
      await fetchPendingPayments();
      toast({
        title: "Success",
        description: "Credit payment and associated sale have been deleted successfully.",
        duration: 3000,
      })
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        const errorMessage = err.response?.data?.message || 'Error deleting credit payment';
        setError(`Error: ${errorMessage}`);
        console.error('API Error:', {
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: err.response?.data,
          url: err.config?.url,
          method: err.config?.method
        });
        toast({
          variant: "destructive",
          title: "Error",
          description: err instanceof AxiosError 
            ? err.response?.data?.message || 'Error deleting credit payment'
            : 'Error deleting credit payment',
          duration: 3000,
        })
      } else {
        console.error('Unexpected error:', err);
      }
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(creditPaymentId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-center items-center">
            Loading payments...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {inHandCheques.length + floatingCheques.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex w-64 flex-col gap-3">
          {inHandCheques.length > 0 && (
            <Card className="border-amber-200 bg-amber-50 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-amber-900">Cheque in Hand</p>
                  <span className="rounded-full bg-amber-600 px-2 py-0.5 text-xs font-semibold text-white">
                    {inHandCheques.length}
                  </span>
                </div>
                <p className="mt-1 text-2xl font-bold text-amber-900">
                  {formatCurrency(chequeOnHandTotal)}
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  Received but not yet deposited
                </p>
              </CardContent>
            </Card>
          )}
          {floatingCheques.length > 0 && (
            <Card className="border-emerald-200 bg-emerald-50 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-emerald-900">Floating Cheques</p>
                  <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                    {floatingCheques.length}
                  </span>
                </div>
                <p className="mt-1 text-2xl font-bold text-emerald-900">
                  {formatCurrency(floatingChequeTotal)}
                </p>
                <p className="mt-1 text-xs text-emerald-700">
                  Deposited and pending realization
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      <Card>
        <CardHeader className="bg-gray-50 border-b border-gray-200 flex flex-row items-start justify-between">
          <CardTitle className="text-xl font-semibold text-gray-800">
            Payment Management
          </CardTitle>
           <Button 
            variant="outline" 
            onClick={() => setCustomSettlementOpen(true)}
            className="mr-4"
          >
            Custom Credit Settlement
          </Button>

          <div className="flex gap-4">
            <Select
              value={selectedCustomer}
              onValueChange={setSelectedCustomer}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select Customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customers.map((customer) => (
                  <SelectItem 
                    key={customer.CustomerID} 
                    value={customer.CustomerID.toString()}
                  >
                    {customer.CustomerName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-col gap-2">
              <div className="flex gap-2 items-center">
                <Button 
                  variant={activeDateFilter === 'sale' ? "default" : "outline"}
                  onClick={() => setActiveDateFilter('sale')}
                  className="text-xs px-2 py-1 h-auto"
                >
                  Sale Date Filter
                </Button>
                <Button 
                  variant={activeDateFilter === 'due' ? "default" : "outline"}
                  onClick={() => setActiveDateFilter('due')}
                  className="text-xs px-2 py-1 h-auto"
                >
                  Due Date Filter
                </Button>              
              </div>

              <div className="flex gap-2 items-center mt-2">
                <Button 
                  variant={dateFilterMode === 'range' ? "default" : "outline"}
                  onClick={() => setDateFilterMode('range')}
                  className="text-xs px-2 py-1 h-auto"
                >
                  Date Range
                </Button>
                <Button 
                  variant={dateFilterMode === 'upTo' ? "default" : "outline"}
                  onClick={() => setDateFilterMode('upTo')}
                  className="text-xs px-2 py-1 h-auto"
                >
                  Up To Date
                </Button>  
                <Button 
                  variant={dateFilterMode === 'on' ? "default" : "outline"}
                  onClick={() => setDateFilterMode('on')}
                  className="text-xs px-2 py-1 h-auto"
                >
                  On Date
                </Button>            
              </div>
              
              {/* {activeDateFilter === 'due' ? (
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-gray-500">Payment Due/Realize Date Range</span>
                  <DatePickerWithRange
                    selected={dueDateRange}
                    onChange={(range) => {
                      if (range?.from && range?.to) {
                        setDueDateRange({ from: range.from, to: range.to });
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-gray-500">Sale Date Range</span>
                  <DatePickerWithRange
                    selected={saleDateRange}
                    onChange={(range) => {
                      if (range?.from && range?.to) {
                        setSaleDateRange({ from: range.from, to: range.to });
                      }
                    }}
                  />
                </div>
              )} */}

              {activeDateFilter === 'due' ? (
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-gray-500">
                    {dateFilterMode === 'range' ? 'Payment Due/Realize Date Range' : dateFilterMode === 'upTo' ? 'Due/Realize Up To Date' : 'Due/Realize On Date'}
                  </span>
                  {dateFilterMode === 'range' ? (
                    <DatePickerWithRange
                      selected={dueDateRange}
                      onChange={(range) => {
                        if (range?.from && range?.to) {
                          setDueDateRange({ from: range.from, to: range.to });
                        }
                      }}
                    />
                  ) : dateFilterMode === 'upTo' ? (
                    <DatePicker
                      selectedDate={upToDate}
                      onDateChange={setUpToDate}
                    />
                  ) : (
                    <DatePicker
                      selectedDate={dueOnDate}
                      onDateChange={setDueOnDate}
                    />
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-gray-500">
                    {dateFilterMode === 'range' ? 'Sale Date Range' : dateFilterMode === 'upTo' ? 'Sale Up To Date' : 'Sale On Date'}
                  </span>
                  {dateFilterMode === 'range' ? (
                    <DatePickerWithRange
                      selected={saleDateRange}
                      onChange={(range) => {
                        if (range?.from && range?.to) {
                          setSaleDateRange({ from: range.from, to: range.to });
                        }
                      }}
                    />
                  ) : dateFilterMode === 'upTo' ? (
                    <DatePicker
                      selectedDate={saleUpToDate}
                      onDateChange={setSaleUpToDate}
                    />
                  ) : (
                    <DatePicker
                      selectedDate={saleOnDate}
                      onDateChange={setSaleOnDate}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
          
        </CardHeader>

        <div className="mx-4 mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="border-blue-100 bg-blue-50">
            <CardContent className="pt-6">
              <p className="text-sm text-blue-700">Credit Balance</p>
              <p className="text-2xl font-bold tabular-nums text-blue-900">
                {formatCurrency(creditBalance)}
              </p>
              <p className="mt-1 text-xs text-blue-600">
                After in-hand &amp; floating cheques and cash
              </p>
            </CardContent>
          </Card>
          <Card className="border-emerald-100 bg-emerald-50">
            <CardContent className="pt-6">
              <p className="text-sm text-emerald-700">Total Cheque</p>
              <p className="text-2xl font-bold tabular-nums text-emerald-900">
                {formatCurrency(totalChequeAmount)}
              </p>
            </CardContent>
          </Card>
        </div>

        {selectedCustomer !== 'all' && customerOutstanding !== null && (
          <div className="mx-4 mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Customer Total Outstanding</p>
                    <p className="text-2xl font-bold">{formatCurrency(customerOutstanding)}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {customers.find((customer) => customer.CustomerID.toString() === selectedCustomer)?.CustomerName}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {error && (
          <Alert variant="destructive" className="m-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <Tabs defaultValue="credit" className="mt-4 ml-4">
          <TabsList>
            <TabsTrigger value="credit">
              Pending Credits ({pendingCreditRows.length})
            </TabsTrigger>
            <TabsTrigger value="cheques">
              Pending Cheques ({pendingPayments.pendingCheques.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cheques">
            <CardContent className="mt-6 space-y-8">
              <div>
                <h3 className="text-lg font-semibold mb-3">
                  Awaiting receipt ({awaitingReceiptCheques.length})
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Customer agreed to pay by cheque, but the physical cheque is not yet in hand.
                </p>
              <Table className="border">
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="text-black w-40 font-bold">Cheque #</TableHead>
                    <TableHead className="text-black font-bold">Customer</TableHead>
                    <TableHead className="text-black font-bold">Realize Date</TableHead>
                    <TableHead className="text-black font-bold">Bank</TableHead>
                    <TableHead className="text-black font-bold text-right">Amount</TableHead>
                    <TableHead className="text-black font-bold text-right">Credit Limit</TableHead>
                    <TableHead className="text-black font-bold text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {awaitingReceiptCheques.map((cheque) => (
                    <TableRow key={cheque.ChequePaymentID}>
                      <TableCell>{cheque.ChequeNumber || '—'}</TableCell>
                      <TableCell>{cheque.CustomerName}</TableCell>
                      <TableCell>
                        {format(new Date(cheque.RealizeDate), 'yyyy-MM-dd')}
                      </TableCell>
                      <TableCell>{cheque.Bank || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(cheque.Amount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(cheque.CreditLimit)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center items-center gap-2">
                          <Button
                            variant="default"
                            onClick={() => openMarkReceivedDialog(cheque)}
                            disabled={processingIds.has(cheque.ChequePaymentID)}
                            size="sm"
                          >
                            {processingIds.has(cheque.ChequePaymentID) ? 'Processing...' : 'Mark received'}
                          </Button>
                          {user?.userType !== 'management' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => confirmDeleteChequeRealization(cheque)}
                              disabled={processingIds.has(cheque.ChequePaymentID)}
                              className="hover:bg-red-50 hover:text-red-600"
                              title="Delete Payment & Sale"
                            >
                              {processingIds.has(cheque.ChequePaymentID) ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {awaitingReceiptCheques.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4">
                        No cheques awaiting receipt
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">
                  In hand ({inHandCheques.length})
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Physical cheque received, but not yet deposited at the bank.
                </p>
                <Table className="border">
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead className="text-black w-40 font-bold">Cheque #</TableHead>
                      <TableHead className="text-black font-bold">Customer</TableHead>
                      <TableHead className="text-black font-bold">Received</TableHead>
                      <TableHead className="text-black font-bold">Realize Date</TableHead>
                      <TableHead className="text-black font-bold">Bank</TableHead>
                      <TableHead className="text-black font-bold text-right">Amount</TableHead>
                      <TableHead className="text-black font-bold text-right">Credit Limit</TableHead>
                      <TableHead className="text-black font-bold text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {inHandCheques.map((cheque) => (
                    <TableRow key={cheque.ChequePaymentID}>
                      <TableCell>{cheque.ChequeNumber}</TableCell>
                      <TableCell>{cheque.CustomerName}</TableCell>
                      <TableCell>
                        {cheque.ReceivedDate
                          ? format(new Date(cheque.ReceivedDate), 'yyyy-MM-dd')
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(cheque.RealizeDate), 'yyyy-MM-dd')}
                      </TableCell>
                      <TableCell>{cheque.Bank}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(cheque.Amount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(cheque.CreditLimit)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center items-center gap-2">
                          <Button
                            variant="default"
                            onClick={() => openMarkDepositedDialog(cheque)}
                            disabled={processingIds.has(cheque.ChequePaymentID)}
                            size="sm"
                          >
                            {processingIds.has(cheque.ChequePaymentID) ? 'Processing...' : 'Mark deposited'}
                          </Button>
                          {user?.userType !== 'management' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => confirmDeleteChequeRealization(cheque)}
                            disabled={processingIds.has(cheque.ChequePaymentID)}
                            className="hover:bg-red-50 hover:text-red-600"
                            title="Delete Payment & Sale"
                          >
                            {processingIds.has(cheque.ChequePaymentID) ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {inHandCheques.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-4">
                        No cheques in hand
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">
                  Floating ({floatingCheques.length})
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Cheque has been deposited and is pending bank realization.
                </p>
                <Table className="border">
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead className="text-black w-40 font-bold">Cheque #</TableHead>
                      <TableHead className="text-black font-bold">Customer</TableHead>
                      <TableHead className="text-black font-bold">Deposited</TableHead>
                      <TableHead className="text-black font-bold">Realize Date</TableHead>
                      <TableHead className="text-black font-bold">Bank</TableHead>
                      <TableHead className="text-black font-bold text-right">Amount</TableHead>
                      <TableHead className="text-black font-bold text-right">Credit Limit</TableHead>
                      <TableHead className="text-black font-bold text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {floatingCheques.map((cheque) => (
                    <TableRow key={cheque.ChequePaymentID}>
                      <TableCell>{cheque.ChequeNumber}</TableCell>
                      <TableCell>{cheque.CustomerName}</TableCell>
                      <TableCell>
                        {cheque.DepositedDate
                          ? format(new Date(cheque.DepositedDate), 'yyyy-MM-dd')
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(cheque.RealizeDate), 'yyyy-MM-dd')}
                      </TableCell>
                      <TableCell>{cheque.Bank}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(cheque.Amount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(cheque.CreditLimit)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center items-center gap-2">
                          <Button 
                            variant="default"
                            onClick={() => confirmRealizeCheque(cheque)}
                            disabled={processingIds.has(cheque.ChequePaymentID)}
                            size="sm"
                          >
                            {processingIds.has(cheque.ChequePaymentID) ? 'Processing...' : 'Realize'}
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => confirmBounceCheque(cheque)}
                            disabled={processingIds.has(cheque.ChequePaymentID)}
                            size="sm"
                          >
                            {processingIds.has(cheque.ChequePaymentID) ? 'Processing...' : 'Bounce'}
                          </Button>
                          {user?.userType !== 'management' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => confirmDeleteChequeRealization(cheque)}
                            disabled={processingIds.has(cheque.ChequePaymentID)}
                            className="hover:bg-red-50 hover:text-red-600"
                            title="Delete Payment & Sale"
                          >
                            {processingIds.has(cheque.ChequePaymentID) ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {floatingCheques.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-4">
                        No floating cheques
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </TabsContent>

          <TabsContent value="credit">
            <CardContent className="mt-6">
              <Table className="border">
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="text-black font-bold">Customer</TableHead>
                    <TableHead className="text-black font-bold">Due Date</TableHead>
                    <TableHead className="text-black font-bold text-right">Amount</TableHead>
                    <TableHead className="text-black font-bold text-right">Credit Limit</TableHead>
                    <TableHead className="text-black font-bold text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingCreditRows.map((row) => {
                    if (row.kind === 'credit') {
                      const { credit, displayAmount } = row;

                      return (
                        <TableRow key={`credit-${credit.CreditPaymentID}`}>
                          <TableCell>{credit.CustomerName}</TableCell>
                          <TableCell>
                            {format(new Date(credit.DueDate), 'yyyy-MM-dd')}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(displayAmount)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(credit.CreditLimit)}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-center items-center gap-2">
                              <Button
                                variant="default"
                                onClick={() => confirmSettleCredit(credit)}
                                disabled={processingIds.has(credit.CreditPaymentID)}
                                size="sm"
                              >
                                {processingIds.has(credit.CreditPaymentID) ? 'Processing...' : 'Settle'}
                              </Button>
                              {user?.userType !== 'management' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => confirmDeleteCreditSettlement(credit)}
                                  disabled={processingIds.has(credit.CreditPaymentID)}
                                  className="hover:bg-red-50 hover:text-red-600"
                                  title="Delete Payment & Sale"
                                >
                                  {processingIds.has(credit.CreditPaymentID) ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }

                    const { openingBalance, displayAmount } = row;

                    return (
                      <TableRow key={`ob-${openingBalance.OpeningBalanceID}`}>
                        <TableCell>{openingBalance.CustomerName}</TableCell>
                        <TableCell>
                          {format(new Date(openingBalance.BalanceDate), 'yyyy-MM-dd')}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(displayAmount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(openingBalance.CreditLimit)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center items-center gap-2">
                            <Button
                              variant="default"
                              onClick={() => confirmSettleOpeningBalance(openingBalance)}
                              disabled={processingIds.has(openingBalance.OpeningBalanceID)}
                              size="sm"
                            >
                              {processingIds.has(openingBalance.OpeningBalanceID) ? 'Processing...' : 'Settle'}
                            </Button>
                            {user?.userType !== 'management' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => confirmDeleteOpeningBalance(openingBalance)}
                                disabled={processingIds.has(openingBalance.OpeningBalanceID)}
                                className="hover:bg-red-50 hover:text-red-600"
                                title="Delete Opening Balance"
                              >
                                {processingIds.has(openingBalance.OpeningBalanceID) ? (
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {pendingCreditRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4">
                        No pending credits found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Mark Cheque Received Dialog */}
      <Dialog open={markReceivedDialog.isOpen} onOpenChange={(open) => !open && closeMarkReceivedDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark cheque as received</DialogTitle>
            <DialogDescription>
              Record that the physical cheque is now in hand. Deposit it later to move it to floating.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="mark-received-date">Received date</Label>
              <Input
                id="mark-received-date"
                type="date"
                value={markReceivedDialog.receivedDate}
                onChange={(e) =>
                  setMarkReceivedDialog((prev) => ({ ...prev, receivedDate: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="mark-received-number">Cheque number</Label>
              <Input
                id="mark-received-number"
                value={markReceivedDialog.chequeNumber}
                onChange={(e) =>
                  setMarkReceivedDialog((prev) => ({ ...prev, chequeNumber: e.target.value }))
                }
                placeholder="Enter cheque number"
              />
            </div>
            <div>
              <Label htmlFor="mark-received-bank">Bank</Label>
              <Input
                id="mark-received-bank"
                value={markReceivedDialog.bank}
                onChange={(e) =>
                  setMarkReceivedDialog((prev) => ({ ...prev, bank: e.target.value }))
                }
                placeholder="Enter bank name"
              />
            </div>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={closeMarkReceivedDialog}>
              Cancel
            </Button>
            <Button onClick={handleMarkChequeReceived}>
              Mark received
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Cheque Deposited Dialog */}
      <Dialog open={markDepositedDialog.isOpen} onOpenChange={(open) => !open && closeMarkDepositedDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark cheque as deposited</DialogTitle>
            <DialogDescription>
              Record that the cheque has been deposited. It will move to floating until realized or bounced.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="mark-deposited-date">Deposited date</Label>
              <Input
                id="mark-deposited-date"
                type="date"
                value={markDepositedDialog.depositedDate}
                onChange={(e) =>
                  setMarkDepositedDialog((prev) => ({ ...prev, depositedDate: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={closeMarkDepositedDialog}>
              Cancel
            </Button>
            <Button onClick={handleMarkChequeDeposited}>
              Mark deposited
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog
        open={
          confirmDialog.isOpen &&
          confirmDialog.type !== 'delete_cheque' &&
          confirmDialog.type !== 'delete_credit' &&
          confirmDialog.type !== 'delete_opening_balance'
        }
        onOpenChange={closeConfirmDialog}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>
              {confirmDialog.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={closeConfirmDialog}
            >
              Cancel
            </Button>
            <Button 
              variant="default"
              onClick={handleConfirmAction}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={
          confirmDialog.isOpen &&
          (confirmDialog.type === 'delete_cheque' ||
            confirmDialog.type === 'delete_credit' ||
            confirmDialog.type === 'delete_opening_balance')
        }
        onOpenChange={closeConfirmDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              {confirmDialog.title}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>{confirmDialog.description}</p>
                {confirmDialog.paymentDetails && (
                  <div className="mt-2 p-3 bg-gray-50 rounded">
                    <p><strong>Customer:</strong> {confirmDialog.paymentDetails.customerName}</p>
                    <p><strong>Amount:</strong> {formatCurrency(confirmDialog.paymentDetails.amount || 0)}</p>
                    {confirmDialog.paymentDetails.chequeNumber && (
                      <>
                        <p><strong>Cheque #:</strong> {confirmDialog.paymentDetails.chequeNumber}</p>
                        <p><strong>Bank:</strong> {confirmDialog.paymentDetails.bank}</p>
                      </>
                    )}
                    {confirmDialog.paymentDetails.dueDate && (
                      <p><strong>Due Date:</strong> {format(new Date(confirmDialog.paymentDetails.dueDate), 'yyyy-MM-dd')}</p>
                    )}
                  </div>
                )}
                {confirmDialog.type === 'delete_opening_balance' ? (
                  <p className="mt-2 text-sm font-medium text-red-600">
                    The record cannot be recovered - you would need to add it again manually.
                  </p>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-orange-600">
                      <strong>Warning:</strong> This action will:
                    </p>
                    <ul className="mt-1 text-sm text-orange-600 list-disc list-inside">
                      <li>Permanently delete the payment and associated sale</li>
                      <li>Restore product quantities to inventory</li>
                      <li>Remove all related payment records</li>
                      <li>Delete the entire invoice from the system</li>
                    </ul>
                    <p className="mt-2 text-sm font-medium text-red-600">
                      This action cannot be undone.
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className="bg-red-600 hover:bg-red-700"
              disabled={processingIds.has(confirmDialog.paymentId || '')}
            >
              {processingIds.has(confirmDialog.paymentId || '')
                ? 'Deleting...'
                : confirmDialog.type === 'delete_opening_balance'
                  ? 'Delete Opening Balance'
                  : 'Delete Payment & Sale'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CustomCreditSettlementDialog
        open={customSettlementOpen}
        onOpenChange={setCustomSettlementOpen}
        onSuccess={fetchPendingPayments}
      />
    </>
  );
};

export default PaymentManagement;