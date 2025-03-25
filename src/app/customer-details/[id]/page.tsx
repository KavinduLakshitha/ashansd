"use client"

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api/axios";
import CustomerPrices from '@/components/CustomerPrices';

interface CustomerDetails {
  CustomerID: number;
  CreditLimit: number;
  Status: string;
  BankDetails?: string;
  CusName: string;
  ContactNumber: string;
  Address: string;
  ContactPersonName: string;
  SMSNumber: string;
  BusinessRegNo: string;
  BusinessLineID: number;
}

interface CustomerOutstanding {
  TotalOutstanding: number;
}

interface PaymentDetails {
  chequeNumber?: string;
  bank?: string;
  dueDate?: string;
}

interface Payment {
  PaymentDate: string;
  PaymentMethod: string;
  Amount: number;
  paymentDetails?: PaymentDetails;
  InvoiceID?: string;
}

interface PendingCheque {
  RealizeDate: string;
  ChequeNumber: string;
  Bank: string;
  Amount: number;
}

interface PendingCredit {
  DueDate: string;
  Amount: number;
}

interface PendingPayments {
  pendingCheques: PendingCheque[];
  pendingCredits: PendingCredit[];
}

// Utility functions
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) {
    return 'Rs. 0.00';
  }
  
  return `Rs. ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

const getPaymentDetails = (payment: Payment) => {
  if (payment.PaymentMethod === 'CHEQUE' && payment.paymentDetails) {
    return `Cheque #${payment.paymentDetails.chequeNumber} - ${payment.paymentDetails.bank}`;
  }
  if (payment.PaymentMethod === 'CREDIT' && payment.paymentDetails?.dueDate) {
    return `Due: ${formatDate(payment.paymentDetails.dueDate)}`;
  }
  return '';
};

export default function CustomerDetailsPage() {
  const router = useRouter();
  const { id } = useParams();
  const { toast } = useToast();
  
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails | null>(null);
  const [outstanding, setOutstanding] = useState<CustomerOutstanding | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PendingPayments>({ 
    pendingCheques: [], 
    pendingCredits: [] 
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        
        // First fetch customer details
        const customerResponse = await api.get(`${process.env.NEXT_PUBLIC_API_URL}/customers/${id}`);
        const customerData = customerResponse.data;
        setCustomerDetails(customerData);

        // Then fetch the rest of the data
        const [outstandingResponse, paymentsResponse, pendingResponse] = await Promise.all([
          api.get(`${process.env.NEXT_PUBLIC_API_URL}/payments/customer/${id}/outstanding`).catch(error => {
            console.error('Error fetching outstanding:', error);
            return { data: { TotalOutstanding: 0 } };
          }),
          api.get(`${process.env.NEXT_PUBLIC_API_URL}/payments/customer/${id}`).catch(error => {
            console.error('Error fetching payments:', error);
            return { data: { payments: [] } };
          }),
          api.get(`${process.env.NEXT_PUBLIC_API_URL}/payments/pending/${customerData.BusinessLineID}?customerId=${id}`).catch(error => {
            console.error('Error fetching pending payments:', error);
            return { data: { pendingCheques: [], pendingCredits: [] } };
          })
        ]);

        setOutstanding(outstandingResponse.data);
        setPayments(paymentsResponse.data.payments);
        setPendingPayments(pendingResponse.data);
      } catch (error: unknown) {
        console.error('Error fetching customer data:', error);
        toast({
          title: "Error",
          description: (error instanceof Error) ? error.message : "Failed to fetch customer data. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchAllData();
    }
  }, [id, toast]);

  if (loading) {
    return (
      <Card className="w-full mx-auto shadow-lg">
        <CardContent className="p-6">
          <div className="flex justify-center items-center">
            Loading customer details...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!customerDetails) {
    return (
      <Card className="w-full mx-auto shadow-lg">
        <CardContent className="p-6">
          <div className="flex justify-center items-center text-red-600">
            Customer not found
          </div>
        </CardContent>
      </Card>
    );
  }

  const customerCode = `CUS${String(customerDetails.CustomerID).padStart(3, '0')}`;
  const creditUsagePercentage = (outstanding?.TotalOutstanding || 0) / customerDetails.CreditLimit * 100;

  return (
    <Card className="w-full mx-auto shadow-lg">
      <CardHeader className="bg-gray-50 border-b border-gray-200 flex flex-row items-center justify-between">
        <CardTitle className="text-xl flex gap-2 font-semibold text-gray-800">
          Customer Account Overview - <span className="font-medium text-gray-500">Customer #{customerCode}</span>
        </CardTitle>
        <Button
          variant="outline"
          onClick={() => router.push("/customer-management")}
          className="flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          Back to Customer Management
        </Button>
      </CardHeader>

      <Tabs defaultValue="account" className="w-full pb-4">
        <TabsList className="ml-4 mt-4">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="upcomingcheques">Upcoming Payments</TabsTrigger>
          <TabsTrigger value="customerinfo">Customer Info</TabsTrigger>
          <TabsTrigger value="itemprices">Item Prices</TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <CardContent className="pt-1 px-4 m-0">
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4 border border-gray-200">
                <p className="text-sm text-gray-500">Credit Usage</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="font-medium text-gray-800">
                    {formatCurrency(outstanding?.TotalOutstanding)}/
                    {formatCurrency(customerDetails.CreditLimit)}
                  </p>
                </div>
                <Progress 
                  value={creditUsagePercentage} 
                  className={`mt-4 ${creditUsagePercentage > 80 ? 'bg-red-200' : ''}`}
                />
              </Card>

              <Card className="p-4 border border-gray-200">
                <p className="text-sm text-gray-500">Status</p>
                <p className="font-medium text-gray-800 mt-2">{customerDetails.Status}</p>
              </Card>

              <Card className="p-4 border border-gray-200">
                <p className="text-sm text-gray-500">Bank Details</p>
                <p className="font-medium text-gray-800 mt-2">{customerDetails.BankDetails || 'Not provided'}</p>
              </Card>
            </div>

            {/* Payment History */}
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-4">Payment History</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4">
                        No payment history found
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((payment, index) => (
                      <TableRow key={index}>
                        <TableCell>{formatDate(payment.PaymentDate)}</TableCell>
                        <TableCell>{payment.InvoiceID || 'N/A'}</TableCell>
                        <TableCell>{payment.PaymentMethod}</TableCell>
                        <TableCell>{formatCurrency(payment.Amount)}</TableCell>
                        <TableCell>{getPaymentDetails(payment)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </TabsContent>

        <TabsContent value="upcomingcheques">
          <CardContent className="pt-1 px-4 m-0">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Upcoming Cheques</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Realize Date</TableHead>
                      <TableHead>Cheque Number</TableHead>
                      <TableHead>Bank</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingPayments.pendingCheques.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-4">
                          No upcoming cheques found
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingPayments.pendingCheques.map((cheque, index) => (
                        <TableRow key={index}>
                          <TableCell>{formatDate(cheque.RealizeDate)}</TableCell>
                          <TableCell>{cheque.ChequeNumber}</TableCell>
                          <TableCell>{cheque.Bank}</TableCell>
                          <TableCell>{formatCurrency(cheque.Amount)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-4">Pending Credits</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingPayments.pendingCredits.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center py-4">
                          No pending credits found
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingPayments.pendingCredits.map((credit, index) => (
                        <TableRow key={index}>
                          <TableCell>{formatDate(credit.DueDate)}</TableCell>
                          <TableCell>{formatCurrency(credit.Amount)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </TabsContent>

        <TabsContent value="customerinfo">
          <CardContent className="pt-1 px-4 m-0">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Customer Name</h3>
                  <p className="mt-1">{customerDetails.CusName}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Contact Number</h3>
                  <p className="mt-1">{customerDetails.ContactNumber}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Address</h3>
                <p className="mt-1">{customerDetails.Address}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Contact Person</h3>
                  <p className="mt-1">{customerDetails.ContactPersonName}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">SMS Number</h3>
                  <p className="mt-1">{customerDetails.SMSNumber}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Business Registration Number</h3>
                <p className="mt-1">{customerDetails.BusinessRegNo}</p>
              </div>
            </div>
          </CardContent>
        </TabsContent>

        <TabsContent value="itemprices">
          <CustomerPrices />
        </TabsContent>
      </Tabs>      
    </Card>
  );
}