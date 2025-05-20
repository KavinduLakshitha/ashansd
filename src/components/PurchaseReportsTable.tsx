import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/auth/auth-context';
import axios from '@/lib/api/axios';
import { isAxiosError } from 'axios';
import { Card, CardContent } from "@/components/ui/card";
import { DatePickerWithRange } from './DateRange';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Download, FileText } from "lucide-react";
import { DateRange } from "react-day-picker";
import { addDays } from "date-fns";

interface Vendor {
  VendorName: string;
  VendorID: number;
}

interface PaymentDetails {
  dueDate?: string;
  status?: string;
}

interface PurchaseItem {
  ProductID: string;
  Name: string;
  Quantity: number;
  UnitPrice: number;
  TotalPrice: number;
}

interface Purchase {
  PurchaseID: string;
  InvoiceNumber: string;
  VendorID: string;
  VendorName: string;
  PaymentID: string;
  PaymentMethod: 'CASH' | 'CREDIT';
  Amount: number;
  PurchaseDate: string;
  InvoiceDate: string;
  paymentDetails: PaymentDetails | null;
  items?: PurchaseItem[];
}

interface FilterState {
  businessLine: string;
  dateRange: DateRange | undefined;
  paymentType: string;
  selectedVendor: string;
  vendorId?: number;
  invoiceNumber: string;
}

const PurchaseReportsTable = () => {
  const { getBusinessLineID } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>({
    businessLine: '',
    dateRange: {
      from: addDays(new Date(), -30),
      to: new Date(),
    },
    paymentType: '',
    selectedVendor: '',
    vendorId: undefined,
    invoiceNumber: ''
  });
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("ALL");

  const adjustDateRange = (dateRange: DateRange | undefined): { 
    startDate: string | undefined, 
    endDate: string | undefined 
  } => {
    if (!dateRange || !dateRange.from || !dateRange.to) {
      return { startDate: undefined, endDate: undefined };
    }
    
    // Start date remains at beginning of day
    const startDate = new Date(dateRange.from);
    startDate.setHours(0, 0, 0, 0);
    
    // End date set to end of day (23:59:59.999)
    const endDate = new Date(dateRange.to);
    endDate.setHours(23, 59, 59, 999);
    
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  };

  // Then modify your useEffect to use this function:
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setError(null);
        const businessLineId = getBusinessLineID();
        
        const vendorsResponse = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/vendors?businessLineId=${businessLineId}`
        );
        
        const vendorsData = Array.isArray(vendorsResponse.data) 
          ? vendorsResponse.data 
          : [];
          
        setVendors(vendorsData);

        // Use the adjustDateRange helper
        const { startDate, endDate } = adjustDateRange(filters.dateRange);

        const purchasesResponse = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/purchases/history/${businessLineId}`,
          {
            params: {
              startDate,
              endDate
            }
          }
        );
        setPurchases(purchasesResponse.data);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to fetch data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [getBusinessLineID, filters.dateRange]);

  const handleDownloadExcel = async (purchaseId: string) => {
    try {
      setError(null);
      const url = `${process.env.NEXT_PUBLIC_API_URL}/purchases/report/${purchaseId}/excel`;
      console.log('Attempting Excel download from:', url);
      const response = await axios.get(
        url,
        { 
          responseType: 'blob',
          headers: {
            Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          },
          withCredentials: true
        }
      );
      
      const contentType = response.headers['content-type'];
      if (contentType && contentType.indexOf('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') === -1) {
        throw new Error('Received invalid file format');
      }

      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      if (blob.size === 0) {
        throw new Error('Received empty file');
      }

      // Create download link
      const downloadLink = document.createElement('a');
      downloadLink.href = window.URL.createObjectURL(blob);
      downloadLink.download = `Purchase_${purchaseId}.xlsx`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      // Clean up the URL object
      setTimeout(() => {
        window.URL.revokeObjectURL(downloadLink.href);
      }, 100);
    } catch (error: unknown) {
      console.error('Error downloading Excel:', error);
      if (isAxiosError(error)) {
        if (error.response?.status === 404) {
          setError('Excel report not found. Please try again later.');
        } else if (error.response?.status === 403) {
          setError('You do not have permission to download this report.');
        } else {
          setError('Failed to download Excel. Please try again.');
        }
      } else if (error instanceof Error) {
        setError(error.message || 'Failed to download Excel. Please try again.');
      } else {
        setError('Failed to download Excel. Please try again.');
      }
    }
  };
  
  const formatCurrency = (amount: number) => {
    return `Rs. ${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const getPaymentStatus = (purchase: Purchase): { text: string; className: string } => {
    const status = purchase.paymentDetails?.status?.toUpperCase();
    
    switch (purchase.PaymentMethod) {
      case 'CASH':
        return {
          text: 'PAID',
          className: 'bg-green-100 text-green-800'
        };
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
    setFilters(prev => ({ ...prev, invoiceNumber: e.target.value }));
  };

  const toggleInvoiceExpand = async (purchaseId: string) => {
    const newExpanded = new Set(expandedInvoices);
    
    if (newExpanded.has(purchaseId)) {
      newExpanded.delete(purchaseId);
    } else {
      // Fetch purchase items if not already loaded
      if (!purchases.find(p => p.PurchaseID === purchaseId)?.items) {
        try {
          const response = await axios.get(
            `${process.env.NEXT_PUBLIC_API_URL}/purchases/${purchaseId}/items`
          );
          setPurchases(prev => prev.map(purchase => 
            purchase.PurchaseID === purchaseId 
              ? { ...purchase, items: response.data }
              : purchase
          ));
        } catch (error) {
          console.error('Error fetching purchase items:', error);
          setError('Failed to fetch purchase items. Please try again.');
        }
      }
      newExpanded.add(purchaseId);
    }
    setExpandedInvoices(newExpanded);
  };

  const filteredPurchases = selectedPaymentMethod === 'ALL' || !selectedPaymentMethod
    ? purchases
    : purchases.filter(purchase => purchase.PaymentMethod === selectedPaymentMethod);

    return (
        <Card className="w-full shadow-none rounded-tl-none rounded-tr-none border-0">
          {/* <CardHeader className="pb-4">
            <div className="flex items-center justify-between">              
              <Button 
                variant="outline"
                onClick={handleFilterChange}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Apply Filters
              </Button>
            </div>
          </CardHeader> */}
    
          <CardContent className='mt-4'>
            {error && (
              <div className="bg-red-50 text-red-700 p-4 mb-6 rounded-lg border border-red-200">
                <p className="flex items-center gap-2">
                  <span className="font-medium">Error:</span> {error}
                </p>
              </div>
            )}
            
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="flex-1 min-w-[240px]">
              <DatePickerWithRange
                  selected={filters.dateRange!}
                  onChange={(range) => setFilters(prev => ({ ...prev, dateRange: range }))}
                />
              </div>
              
              <Select 
                value={selectedPaymentMethod}
                onValueChange={setSelectedPaymentMethod}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Payment Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Payments</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="CREDIT">Credit</SelectItem>
                </SelectContent>
              </Select>
    
              <Select 
                value={filters.selectedVendor}
                onValueChange={(value) => setFilters(prev => ({ 
                  ...prev, 
                  selectedVendor: value,
                  vendorId: parseInt(value)
                }))}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select Vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((vendor) => (
                    <SelectItem key={`vendor-${vendor.VendorID}`} value={vendor.VendorID.toString()}>
                      {vendor.VendorName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
    
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Search Invoice Number..."
                  value={filters.invoiceNumber}
                  onChange={handleInvoiceSearch}
                  className="w-full"
                />
              </div>
            </div>
    
            <div className="rounded-lg border shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableCell className="font-semibold">Invoice Number</TableCell>
                    <TableCell className="font-semibold">Purchase Date</TableCell>
                    <TableCell className="font-semibold">Vendor</TableCell>
                    <TableCell className="font-semibold">Total Amount</TableCell>
                    <TableCell className="font-semibold">Payment Status</TableCell>
                    <TableCell className="font-semibold text-right">Actions</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                          <p className="text-sm text-gray-500">Loading purchase data...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredPurchases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <FileText className="h-8 w-8 text-gray-400" />
                          <p className="text-sm text-gray-500">No purchase data found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPurchases
                      .filter(purchase => 
                        purchase.InvoiceNumber.toLowerCase().includes(filters.invoiceNumber.toLowerCase())
                      )
                      .map((purchase, index) => {
                        const isExpanded = expandedInvoices.has(purchase.PurchaseID);
                        const rowKey = `purchase-${purchase.PurchaseID}-${index}`;
                        const status = getPaymentStatus(purchase);
    
                        return (
                          <React.Fragment key={rowKey}>
                            <TableRow 
                              className="cursor-pointer hover:bg-gray-50 transition-colors"
                              onClick={() => toggleInvoiceExpand(purchase.PurchaseID)}
                            >
                              <TableCell className="flex items-center gap-2">
                                {isExpanded ? 
                                  <ChevronDown className="h-4 w-4 text-gray-500" /> : 
                                  <ChevronRight className="h-4 w-4 text-gray-500" />
                                }
                                <span className="font-medium">{purchase.InvoiceNumber}</span>
                              </TableCell>
                              <TableCell className="text-gray-600">
                                {new Date(purchase.PurchaseDate).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-gray-600">{purchase.VendorName}</TableCell>
                              <TableCell className="font-medium">
                                {formatCurrency(purchase.Amount)}
                              </TableCell>
                              <TableCell>
                                <Badge className={`${status.className} px-2 py-1`}>
                                  {`${purchase.PaymentMethod} - ${status.text}`}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadExcel(purchase.PurchaseID);
                                  }}
                                  className="hover:bg-gray-100"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow className="bg-gray-50">
                                <TableCell colSpan={6} className="p-0">
                                  <div className="p-6">
                                    <h4 className="text-sm font-semibold text-gray-900 mb-4">Purchase Items</h4>
                                    <div className="bg-white rounded-lg border">
                                      <Table>
                                        <TableHeader>
                                          <TableRow className="bg-gray-50">
                                            <TableCell className="font-medium">Product Name</TableCell>
                                            <TableCell className="font-medium">Quantity</TableCell>
                                            <TableCell className="font-medium">Unit Price</TableCell>
                                            <TableCell className="font-medium">Total Price</TableCell>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {purchase.items?.map((item, itemIndex) => (
                                            <TableRow key={`${rowKey}-item-${item.ProductID}-${itemIndex}`}>
                                              <TableCell>{item.Name}</TableCell>
                                              <TableCell>{item.Quantity}</TableCell>
                                              <TableCell>{formatCurrency(item.UnitPrice)}</TableCell>
                                              <TableCell className="font-medium">
                                                {formatCurrency(item.TotalPrice)}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
    
                                    {purchase.PaymentMethod === 'CREDIT' && purchase.paymentDetails && (
                                      <div className="mt-6">
                                        <h4 className="text-sm font-semibold text-gray-900 mb-2">
                                          Payment Details
                                        </h4>
                                        <div className="bg-white rounded-lg border p-4">
                                          <p className="text-sm text-gray-600">
                                            Due Date: {new Date(purchase.paymentDetails.dueDate || '').toLocaleDateString()}
                                          </p>
                                        </div>
                                      </div>
                                    )}
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
    
    export default PurchaseReportsTable;