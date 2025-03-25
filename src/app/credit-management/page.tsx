"use client"

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from '../auth/auth-context';
import axios from '@/lib/api/axios';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/DateRange';
import { format } from 'date-fns';
import { AxiosError } from 'axios';
import { toast } from '@/hooks/use-toast';

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
}

interface Customer {
  CustomerID: number;
  CustomerName: string;
}

const PaymentManagement = () => {
  const { getBusinessLineID } = useAuth();
  const [pendingPayments, setPendingPayments] = useState<PaymentState>({ 
    pendingCheques: [], 
    pendingCredits: [] 
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingIds, setProcessingIds] = useState<Set<string | number>>(new Set());
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date()
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
        if (dateRange.from) params.append('startDate', format(dateRange.from, 'yyyy-MM-dd'));
        if (dateRange.to) params.append('endDate', format(dateRange.to, 'yyyy-MM-dd'));
    
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
      }
       finally {
        setLoading(false);
      }
    }, [selectedCustomer, dateRange, getBusinessLineID]);
    
    useEffect(() => {
      fetchCustomers();
    }, [fetchCustomers]);
  
    useEffect(() => {
      fetchPendingPayments();
    }, [fetchPendingPayments]);
  

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
    <Card>
      <CardHeader className="bg-gray-50 border-b border-gray-200 flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-semibold text-gray-800">
          Payment Management
        </CardTitle>

        <div className="flex gap-4 items-center">
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

          <DatePickerWithRange
              selected={dateRange}
              onChange={(range) => {
                if (range?.from && range?.to) {
                  setDateRange({ from: range.from, to: range.to });
                }
              }}
            />
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
                      <div className="flex justify-center items-center gap-4">
                        <Button 
                          variant="default"
                          onClick={() => handleRealizeCheque(cheque.ChequePaymentID)}
                          disabled={processingIds.has(cheque.ChequePaymentID)}
                        >
                          {processingIds.has(cheque.ChequePaymentID) ? 'Processing...' : 'Realize'}
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => handleBounceCheque(cheque.ChequePaymentID)}
                          disabled={processingIds.has(cheque.ChequePaymentID)}
                        >
                          {processingIds.has(cheque.ChequePaymentID) ? 'Processing...' : 'Bounce'}
                        </Button>
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
                      <div className="flex justify-center items-center">
                        <Button 
                          variant="default"
                          onClick={() => handleSettleCredit(credit.CreditPaymentID)}
                          disabled={processingIds.has(credit.CreditPaymentID)}
                        >
                          {processingIds.has(credit.CreditPaymentID) ? 'Processing...' : 'Settle'}
                        </Button>
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
  );
};

export default PaymentManagement;