"use client"

import React, { useCallback, useEffect, useState } from 'react';
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

interface Cheque {
  ChequePaymentID: string | number;
  ChequeNumber: string;
  Bank: string;
  RealizeDate: string;
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

interface PaymentState {
  pendingCheques: Cheque[];
  pendingCredits: Credit[];
  realizedCheques: Cheque[];
  settledCredits: Credit[];
}

interface Customer {
  CustomerID: number;
  CustomerName: string;
}

interface ConfirmDialogState {
  isOpen: boolean;
  type: 'realize' | 'bounce' | 'settle' | 'delete_cheque' | 'delete_credit' | null;
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

const PaymentManagement = () => {
  const { user, getBusinessLineID } = useAuth();
  const [pendingPayments, setPendingPayments] = useState<PaymentState>({ 
    pendingCheques: [], 
    pendingCredits: [],
    realizedCheques: [],
    settledCredits: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingIds, setProcessingIds] = useState<Set<string | number>>(new Set());
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  
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

  // State for confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    type: null,
    paymentId: null,
    title: '',
    description: ''
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
      setPendingPayments(response.data);
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
      case 'delete_cheque':
        await handleDeleteChequeRealization(paymentId);
        break;
      case 'delete_credit':
        await handleDeleteCreditSettlement(paymentId);
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
        
        {error && (
          <Alert variant="destructive" className="m-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <Tabs defaultValue="cheques" className="mt-4 ml-4">
          <TabsList>
            <TabsTrigger value="cheques">
              Pending Cheques ({pendingPayments.pendingCheques.length})
            </TabsTrigger>
            <TabsTrigger value="credit">
              Pending Credits ({pendingPayments.pendingCredits.length})
            </TabsTrigger>            
          </TabsList>

          <TabsContent value="cheques">
            <CardContent className="mt-6">
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
                  {pendingPayments.pendingCheques.map((cheque) => (
                    <TableRow key={cheque.ChequePaymentID}>
                      <TableCell>{cheque.ChequeNumber}</TableCell>
                      <TableCell>{cheque.CustomerName}</TableCell>
                      <TableCell>
                        {format(new Date(cheque.RealizeDate), 'yyyy-MM-dd')}
                      </TableCell>
                      <TableCell>{cheque.Bank}</TableCell>
                      <TableCell className="text-right">
                        Rs. {Number(cheque.Amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        Rs. {Number(cheque.CreditLimit).toFixed(2)}
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
                  {pendingPayments.pendingCheques.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4">
                        No pending cheques found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
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
                  {pendingPayments.pendingCredits.map((credit) => (
                    <TableRow key={credit.CreditPaymentID}>
                      <TableCell>{credit.CustomerName}</TableCell>
                      <TableCell>
                        {format(new Date(credit.DueDate), 'yyyy-MM-dd')}
                      </TableCell>
                      <TableCell className="text-right">
                        Rs. {Number(credit.Amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        Rs. {Number(credit.CreditLimit).toFixed(2)}
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
                  ))}
                  {pendingPayments.pendingCredits.length === 0 && (
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

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.isOpen} onOpenChange={closeConfirmDialog}>
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
      <AlertDialog open={confirmDialog.isOpen && (confirmDialog.type === 'delete_cheque' || confirmDialog.type === 'delete_credit')} onOpenChange={closeConfirmDialog}>
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
                    <p><strong>Amount:</strong> Rs. {Number(confirmDialog.paymentDetails.amount || 0).toFixed(2)}</p>
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
              {processingIds.has(confirmDialog.paymentId || '') ? 'Deleting...' : `Delete Payment & Sale`}
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