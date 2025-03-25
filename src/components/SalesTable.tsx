import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/auth/auth-context';
import axios from '@/lib/api/axios';
import { Card, CardContent } from "@/components/ui/card";
import { DatePickerWithRange } from './DateRange';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Filter } from "lucide-react";
import { DateRange } from "react-day-picker";
import { addDays } from "date-fns";
import SearchableCustomerSelect from './SearchableCustomerSelect';
import _ from 'lodash';

interface PaymentDetails {
  chequeNumber?: string;
  bank?: string;
  realizeDate?: string;
  status?: string;
  dueDate?: string;
}

interface Sale {
  SaleID: string;
  InvoiceID: string;
  CustomerID: string;
  CustomerName: string;
  PaymentID: string;
  PaymentMethod: 'CASH' | 'CHEQUE' | 'CREDIT';
  Amount: number;
  PaymentDate: string;
  paymentDetails: PaymentDetails | null;
}

interface FilterState {
  businessLine: string;
  salesPerson: string;
  dateRange: DateRange | undefined;
  paymentType: string;
  selectedCustomer: string;
  customerId?: number;
  invoiceId: string;
}

interface SalesPerson {
  UserID: number;
  UserName: string;
}

const SalesTable = () => {
  const { getBusinessLineID } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>({
    businessLine: '',
    salesPerson: '',
    dateRange: {
      from: addDays(new Date(), -30),
      to: new Date(),
    },
    paymentType: '',
    selectedCustomer: '',
    customerId: undefined,
    invoiceId: ''
  });
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("ALL");

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const businessLineId = getBusinessLineID();
        
        const salesPersonsResponse = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/sales/business-line/${businessLineId}`
        );
        setSalesPersons(salesPersonsResponse.data);

        const customersResponse = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/payments/customers/${businessLineId}`
        );
        setCustomers(customersResponse.data);

        const salesResponse = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/payments/history/${businessLineId}`,
          {
            params: {
              startDate: filters.dateRange?.from?.toISOString(),
              endDate: filters.dateRange?.to?.toISOString()
            }
          }
        );
        setSales(salesResponse.data.payments);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [getBusinessLineID, filters.dateRange?.from, filters.dateRange?.to]);

  const handleFilterChange = async () => {
    try {
      setLoading(true);
      const businessLineId = getBusinessLineID();
      
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/payments/history/${businessLineId}`,
        {
          params: {
            startDate: filters.dateRange?.from?.toISOString(),
            endDate: filters.dateRange?.to?.toISOString(),
            salesPerson: filters.salesPerson,
            paymentType: filters.paymentType,
            customerId: filters.customerId
          }
        }
      );
      setSales(response.data.payments);
    } catch (error) {
      console.error('Error applying filters:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `Rs. ${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const getPaymentStatus = (sale: Sale): { text: string; className: string } => {
    const status = sale.paymentDetails?.status?.toUpperCase();
    
    switch (sale.PaymentMethod) {
      case 'CASH':
        return {
          text: 'PAID',
          className: 'bg-green-100 text-green-800'
        };
      case 'CHEQUE':
        switch (status) {
          case 'PENDING':
            return {
              text: 'PENDING',
              className: 'bg-yellow-100 text-yellow-800'
            };
          case 'REALIZED':
            return {
              text: 'CLEARED',
              className: 'bg-green-100 text-green-800'
            };
          case 'BOUNCED':
            return {
              text: 'BOUNCED',
              className: 'bg-red-100 text-red-800'
            };
          default:
            return {
              text: 'PENDING',
              className: 'bg-yellow-100 text-yellow-800'
            };
        }
      case 'CREDIT':
        switch (status) {
          case 'PENDING':
            return {
              text: 'PENDING',
              className: 'bg-yellow-100 text-yellow-800'
            };
          case 'SETTLED':
            return {
              text: 'SETTLED',
              className: 'bg-green-100 text-green-800'
            };
          default:
            return {
              text: 'PENDING',
              className: 'bg-yellow-100 text-yellow-800'
            };
        }
      default:
        return {
          text: 'UNKNOWN',
          className: 'bg-gray-100 text-gray-800'
        };
    }
  };

  const handleInvoiceSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, invoiceId: e.target.value }));
  };

  const toggleInvoiceExpand = (invoiceId: string) => {
    const newExpanded = new Set(expandedInvoices);
    if (newExpanded.has(invoiceId)) {
      newExpanded.delete(invoiceId);
    } else {
      newExpanded.add(invoiceId);
    }
    setExpandedInvoices(newExpanded);
  };

  const filteredSales = selectedPaymentMethod === 'ALL' || !selectedPaymentMethod
    ? sales
    : sales.filter(sale => sale.PaymentMethod === selectedPaymentMethod);

  const groupedSales = _.groupBy(filteredSales, 'InvoiceID');

  return (
    <Card className="w-full shadow-none rounded-tl-none rounded-tr-none border-0">
      <CardContent>
        <div className="flex items-center gap-4 mb-6 mt-4">
        <DatePickerWithRange
          selected={filters.dateRange!}
          onChange={(range) => setFilters(prev => ({ ...prev, dateRange: range }))}
        />
          
          <Select 
            value={filters.salesPerson}
            onValueChange={(value) => setFilters(prev => ({ ...prev, salesPerson: value }))}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sales Person" />
            </SelectTrigger>
            <SelectContent>
              {salesPersons.map((person: SalesPerson) => (
                <SelectItem key={person.UserID} value={person.UserID.toString()}>
                  {person.UserName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={selectedPaymentMethod}
            onValueChange={setSelectedPaymentMethod}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Payment Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Payments</SelectItem>
              <SelectItem value="CASH">Cash</SelectItem>
              <SelectItem value="CHEQUE">Cheque</SelectItem>
              <SelectItem value="CREDIT">Credit</SelectItem>
            </SelectContent>
          </Select>

          <SearchableCustomerSelect
            value={filters.selectedCustomer}
            onChange={(value, customerId) => setFilters(prev => ({ 
              ...prev, 
              selectedCustomer: value,
              customerId: customerId
            }))}
          />

          <Input
            placeholder="Search Invoice ID..."
            value={filters.invoiceId}
            onChange={handleInvoiceSearch}
            className="w-48"
          />

          <Button 
            variant="outline"
            onClick={handleFilterChange}
          >
            <Filter className="h-4 w-4 mr-2" />
            Apply Filters
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell className="font-semibold">Invoice ID</TableCell>
                <TableCell className="font-semibold">Date</TableCell>
                <TableCell className="font-semibold">Customer</TableCell>
                <TableCell className="font-semibold">Total Amount</TableCell>
                <TableCell className="font-semibold">Payment Status</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : Object.entries(groupedSales).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4">
                    No sales data found
                  </TableCell>
                </TableRow>
              ) : (
                Object.entries(groupedSales)
                  .filter(([invoiceId]) => 
                    invoiceId.toLowerCase().includes(filters.invoiceId.toLowerCase())
                  )
                  .map(([invoiceId, invoiceSales]) => {
                    const firstSale = invoiceSales[0];
                    const totalAmount = invoiceSales.reduce((sum, sale) => sum + Number(sale.Amount), 0);
                    const isExpanded = expandedInvoices.has(invoiceId);

                    return (
                      <React.Fragment key={invoiceId}>
                        <TableRow 
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => toggleInvoiceExpand(invoiceId)}
                        >
                          <TableCell className="flex items-center">
                            {isExpanded ? 
                              <ChevronDown className="h-4 w-4 mr-2" /> : 
                              <ChevronRight className="h-4 w-4 mr-2" />
                            }
                            {invoiceId}
                          </TableCell>
                          <TableCell>{new Date(firstSale.PaymentDate).toLocaleDateString()}</TableCell>
                          <TableCell>{firstSale.CustomerName}</TableCell>
                          <TableCell>{formatCurrency(totalAmount)}</TableCell>
                          <TableCell>
                            {invoiceSales.map(sale => (
                              <Badge 
                                key={sale.PaymentID}
                                className={`${getPaymentStatus(sale).className} mr-2 mb-1`}
                              >
                                {`${sale.PaymentMethod} - ${getPaymentStatus(sale).text}`}
                              </Badge>
                            ))}
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-gray-50">
                            <TableCell colSpan={5}>
                              <div className="p-4">
                                <h4 className="font-semibold mb-2">Payment Details</h4>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableCell>Payment Method</TableCell>
                                      <TableCell>Amount</TableCell>
                                      <TableCell>Status</TableCell>
                                      <TableCell>Details</TableCell>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {invoiceSales.map(sale => (
                                      <TableRow key={sale.PaymentID}>
                                        <TableCell>
                                          <Badge variant="outline">
                                            {sale.PaymentMethod}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>{formatCurrency(sale.Amount)}</TableCell>
                                        <TableCell>
                                          <Badge className={getPaymentStatus(sale).className}>
                                            {getPaymentStatus(sale).text}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>
                                          {sale.PaymentMethod === 'CHEQUE' && sale.paymentDetails && (
                                            <span className="text-sm text-gray-500">
                                              {sale.paymentDetails.chequeNumber} - {sale.paymentDetails.bank}
                                            </span>
                                          )}
                                          {sale.PaymentMethod === 'CREDIT' && sale.paymentDetails && (
                                            <span className="text-sm text-gray-500">
                                              Due: {new Date(sale.paymentDetails.dueDate || '').toLocaleDateString()}
                                            </span>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default SalesTable;