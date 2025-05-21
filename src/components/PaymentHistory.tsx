"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardTitle, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import DatePickerWithRange from './DateRange';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/app/auth/auth-context";
import { Loader2, Search, RefreshCw, Download, Filter } from "lucide-react";
import api from "@/lib/api/axios";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/use-debounce";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { PaymentStatusChange, transformPaymentsToStatusChanges } from "@/lib/paymentStatusAdapter";

// Customer type
interface Customer {
  CustomerID: number | string;
  CustomerName: string;
}

// Date range type
interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

const PaymentStatusHistory: React.FC = () => {
  const { toast } = useToast();
  const { getBusinessLineID } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(true);
  const [statusChanges, setStatusChanges] = useState<PaymentStatusChange[]>([]);
  const [filteredChanges, setFilteredChanges] = useState<PaymentStatusChange[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  });
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("all");
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);  

  const fetchCustomers = useCallback(async (): Promise<void> => {
  try {
    const businessLineId = getBusinessLineID();
    const response = await api.get(`/payments/customers/${businessLineId}`);
    setCustomers(response.data);
  } catch (error) {
    console.error('Error fetching customers:', error);
    toast({
      title: "Error",
      description: "Failed to load customers. Please try again.",
      variant: "destructive",
    });
  }
  }, [getBusinessLineID, toast]);

  const fetchStatusChanges = useCallback(async (): Promise<void> => {
  setLoading(true);
  try {
    const businessLineId = getBusinessLineID();
    const dateParams = dateRange ? {
      startDate: dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
      endDate: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined
    } : {};      
    
    const response = await api.get(`/payments/history/${businessLineId}`, {
      params: dateParams
    });
    
    const statusChanges = transformPaymentsToStatusChanges(response.data.payments || []);
    
    setStatusChanges(statusChanges);
    setFilteredChanges(statusChanges);
  } catch (error) {
    console.error('Error fetching payment status changes:', error);
    toast({
      title: "Error",
      description: "Failed to load payment status changes. Please try again.",
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
  }, [getBusinessLineID, dateRange, setStatusChanges, setFilteredChanges, setLoading, toast]);

  const filterStatusChanges = useCallback((): void => {
    let result = [...statusChanges];
    
    // Filter by customer
    if (selectedCustomerId !== "all") {
      result = result.filter(change => change.customerId.toString() === selectedCustomerId);
    }
    
    // Filter by tab
    if (activeTab === "settled-credits") {
      result = result.filter(change => 
        change.paymentMethod === 'CREDIT' && change.toStatus === 'SETTLED'
      );
    } else if (activeTab === "realized-cheques") {
      result = result.filter(change => 
        change.paymentMethod === 'CHEQUE' && change.toStatus === 'REALIZED'
      );
    } else if (activeTab === "bounced-cheques") {
      result = result.filter(change => 
        change.paymentMethod === 'CHEQUE' && change.toStatus === 'BOUNCED'
      );
    }
    
    // Filter by search term
    if (debouncedSearchTerm) {
      const search = debouncedSearchTerm.toLowerCase();
      result = result.filter(change => 
        (change.customerName?.toLowerCase() || '').includes(search) ||
        (change.invoiceId?.toLowerCase() || '').includes(search) ||
        (change.details?.chequeNumber?.toLowerCase() || '').includes(search) ||
        (change.details?.bank?.toLowerCase() || '').includes(search)
      );
    }
    
    setFilteredChanges(result);
  }, [statusChanges, debouncedSearchTerm, selectedCustomerId, activeTab]);

  useEffect(() => { 
    fetchCustomers(); 
    fetchStatusChanges(); 
  }, []);

  useEffect(() => { 
    filterStatusChanges(); 
  }, [filterStatusChanges]);

  useEffect(() => { 
    filterStatusChanges(); 
  }, [filterStatusChanges, statusChanges, debouncedSearchTerm, selectedCustomerId, activeTab]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(e.target.value);
  };

  const handleDateRangeChange = (range: DateRange | undefined): void => {
    setDateRange(range || { from: undefined, to: undefined });
  };

  const handleRefresh = (): void => {
    fetchStatusChanges();
  };

  const applyDateFilters = (): void => {
    fetchStatusChanges();
  };

  const exportToExcel = (): void => {
    toast({
      title: "Export Started",
      description: "Preparing payment status changes export...",
    });
  };

  const getStatusBadge = (status: string): JSX.Element => {
    switch (status) {
      case 'REALIZED':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Realized</Badge>;
      case 'SETTLED':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Settled</Badge>;
      case 'BOUNCED':
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Bounced</Badge>;
      case 'PENDING':
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const getPaymentMethodBadge = (method: string): JSX.Element => {
    switch (method) {
      case 'CREDIT':
        return <Badge variant="outline" className="border-orange-500 text-orange-500">Credit</Badge>;
      case 'CHEQUE':
        return <Badge variant="outline" className="border-blue-500 text-blue-500">Cheque</Badge>;
      default:
        return <Badge variant="default">{method}</Badge>;
    }
  };

  const formatCurrency = (amount: number | string): string => {
    const numValue = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numValue)) return 'Rs. 0.00';
    return `Rs. ${numValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'yyyy-MM-dd');
    } catch (e) {
      console.log(e);
      return dateString || 'N/A';
    }
  };

  return (
    <Card className="w-full shadow-none rounded-tl-none rounded-tr-none border-0">
      <CardHeader>
        <CardTitle>Payment Status Changes</CardTitle>
      </CardHeader>
      <CardContent className="mt-3">
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">All Changes</TabsTrigger>
            <TabsTrigger value="settled-credits">Settled Credits</TabsTrigger>
            <TabsTrigger value="realized-cheques">Realized Cheques</TabsTrigger>
            <TabsTrigger value="bounced-cheques">Bounced Cheques</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="flex flex-col space-y-4">
          {/* Filter controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="text-sm font-medium mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer, invoice, cheque..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Customer</label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="All Customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customers.map(customer => (
                    <SelectItem key={customer.CustomerID} value={customer.CustomerID.toString()}>
                      {customer.CustomerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Date Range</label>
              <DatePickerWithRange dateRange={dateRange} onDateRangeChange={handleDateRangeChange} />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mb-6">
            <Button variant="outline" onClick={applyDateFilters}>
              <Filter className="h-4 w-4 mr-2" />
              Apply Filter
            </Button>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={exportToExcel}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
          
          {/* Status changes table */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="rounded-md border shadow-sm overflow-hidden">
                <Table className="w-full">
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead className="font-medium">Date</TableHead>
                      <TableHead className="font-medium">Customer</TableHead>
                      <TableHead className="font-medium">Invoice</TableHead>
                      <TableHead className="font-medium">Type</TableHead>
                      <TableHead className="font-medium">Status Change</TableHead>
                      <TableHead className="font-medium">Amount</TableHead>
                      <TableHead className="font-medium">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredChanges.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">
                          No payment status changes found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredChanges.map((change) => (
                        <TableRow key={change.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">
                            {formatDate(change.date)}
                          </TableCell>
                          <TableCell>
                            {change.customerName}
                          </TableCell>
                          <TableCell>
                            {change.invoiceId || `INV-${change.saleId}`}
                          </TableCell>
                          <TableCell>
                            {getPaymentMethodBadge(change.paymentMethod)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-gray-500">{change.fromStatus}</Badge>
                              <span className="text-gray-400">→</span>
                              {getStatusBadge(change.toStatus)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {formatCurrency(change.amount)}
                          </TableCell>
                          <TableCell>
                            {change.paymentMethod === 'CHEQUE' ? (
                              <div className="text-sm">
                                {change.details?.chequeNumber && (
                                  <div><span className="font-medium">Cheque:</span> {change.details.chequeNumber}</div>
                                )}
                                {change.details?.bank && (
                                  <div><span className="font-medium">Bank:</span> {change.details.bank}</div>
                                )}
                                {change.details?.realizeDate && (
                                  <div><span className="font-medium">Realize Date:</span> {formatDate(change.details.realizeDate)}</div>
                                )}
                                {change.details?.bouncedDate && (
                                  <div><span className="font-medium">Bounced Date:</span> {formatDate(change.details.bouncedDate)}</div>
                                )}
                              </div>
                            ) : change.paymentMethod === 'CREDIT' ? (
                              <div className="text-sm">
                                {change.details?.dueDate && (
                                  <div><span className="font-medium">Due Date:</span> {formatDate(change.details.dueDate)}</div>
                                )}
                                {change.details?.settledDate && (
                                  <div><span className="font-medium">Settled Date:</span> {formatDate(change.details.settledDate)}</div>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500">-</div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              
              <div className="mt-4 text-sm text-gray-500">
                Showing {filteredChanges.length} of {statusChanges.length} payment status changes
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentStatusHistory;