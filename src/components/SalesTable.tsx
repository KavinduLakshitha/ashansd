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
import { ChevronDown, ChevronRight, Filter, FileDown } from "lucide-react";
import { DateRange } from "react-day-picker";
import { addDays } from "date-fns";
import SearchableCustomerSelect from './SearchableCustomerSelect';
import _ from 'lodash';
import * as XLSX from 'xlsx';

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

interface SaleItem {
  SaleItemID: string;
  SaleID: string;
  ProductID: string;
  ProductName: string;
  Quantity: number;
  UnitPrice: number;
  TotalPrice: number;
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
  const [saleItems, setSaleItems] = useState<Record<string, SaleItem[]>>({});
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});
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
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  // Function to adjust the end date to include the entire day
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

        // Use the adjusted date range
        const { startDate, endDate } = adjustDateRange(filters.dateRange);
        
        const salesResponse = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/payments/history/${businessLineId}`,
          {
            params: {
              startDate,
              endDate
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
  }, [getBusinessLineID, filters.dateRange]);

  const fetchSaleItems = async (saleId: string) => {
    try {
      setLoadingItems(prev => ({ ...prev, [saleId]: true }));
      
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/sales/${saleId}/items`
      );
      
      setSaleItems(prev => ({
        ...prev,
        [saleId]: response.data
      }));
      
      setLoadingItems(prev => ({ ...prev, [saleId]: false }));
    } catch (error) {
      console.error(`Error fetching items for sale ${saleId}:`, error);
      setLoadingItems(prev => ({ ...prev, [saleId]: false }));
    }
  };

  const handleFilterChange = async () => {
    try {
      setLoading(true);
      const businessLineId = getBusinessLineID();

      // Use the adjusted date range for filtering as well
      const { startDate, endDate } = adjustDateRange(filters.dateRange);
      
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/payments/history/${businessLineId}`,
        {
          params: {
            startDate,
            endDate,
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

  const toggleInvoiceExpand = async (invoiceId: string, saleId: string) => {
    const newExpanded = new Set(expandedInvoices);
    
    if (newExpanded.has(invoiceId)) {
      newExpanded.delete(invoiceId);
    } else {
      newExpanded.add(invoiceId);
      
      // Fetch sale items if not already loaded
      if (!saleItems[saleId]) {
        await fetchSaleItems(saleId);
      }
    }
    
    setExpandedInvoices(newExpanded);
  };

  // Helper functions for Excel generation
  const setColumnWidths = (worksheet: XLSX.WorkSheet, widths: number[]) => {
    worksheet['!cols'] = widths.map((width) => ({ wch: width }));
  };

  const setMerges = (worksheet: XLSX.WorkSheet, merges: string[][] | [string, string][]) => {
    worksheet['!merges'] = merges.map(([startCell, endCell]) => {
      const start = XLSX.utils.decode_cell(startCell);
      const end = XLSX.utils.decode_cell(endCell);
      return { s: { r: start.r, c: start.c }, e: { r: end.r, c: end.c } };
    });
  };

  // Function to add borders to all cells in a worksheet
  const addBordersToWorksheet = (worksheet: XLSX.WorkSheet) => {
    if (!worksheet['!ref']) return;
    
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        
        // Create cell if it doesn't exist
        if (!worksheet[cellAddress]) {
          worksheet[cellAddress] = { t: 's', v: '' };
        }
        
        // Add border styles to the cell
        if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
        
        worksheet[cellAddress].s = {
          ...worksheet[cellAddress].s,
          border: {
            top: { style: 'thin', color: { rgb: "000000" } },
            bottom: { style: 'thin', color: { rgb: "000000" } },
            left: { style: 'thin', color: { rgb: "000000" } },
            right: { style: 'thin', color: { rgb: "000000" } }
          }
        };
      }
    }
  };

  // Function to add style to header cells
  const styleHeaderRow = (worksheet: XLSX.WorkSheet, headerRowIndex: number) => {
    if (!worksheet['!ref']) return;
    
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: col });
      
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { t: 's', v: '' };
      }
      
      if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
      
      // Add bold formatting and fill color to header cells
      worksheet[cellAddress].s = {
        ...worksheet[cellAddress].s,
        font: { bold: true },
        fill: { 
          patternType: 'solid', 
          fgColor: { rgb: "E9ECEF" }  // Light gray background
        },
        border: {
          top: { style: 'thin', color: { rgb: "000000" } },
          bottom: { style: 'thin', color: { rgb: "000000" } },
          left: { style: 'thin', color: { rgb: "000000" } },
          right: { style: 'thin', color: { rgb: "000000" } }
        }
      };
    }
  };

  // Function to download a single invoice as Excel
  const downloadInvoiceAsExcel = async (invoiceId: string, saleId: string) => {
    try {
      setDownloadingExcel(true);
      
      // Make sure we have the sale items data
      if (!saleItems[saleId]) {
        await fetchSaleItems(saleId);
      }
      
      const invoiceSales = groupedSales[invoiceId];
      if (!invoiceSales || !saleItems[saleId]) {
        console.error('No data available for download');
        return;
      }
      
      // Create a new workbook
      const wb = XLSX.utils.book_new();
      
      // --- INVOICE DETAILS WORKSHEET ---
      
      // Create invoice header section
      const invoiceDetails = [
        ['INVOICE DETAILS', null, null, null],
        [null, null, null, null],
        ['Invoice ID:', invoiceId, null, null],
        ['Date:', new Date(invoiceSales[0].PaymentDate).toLocaleDateString(), null, null],
        ['Customer:', invoiceSales[0].CustomerName, null, null],
        [null, null, null, null],
        ['PAYMENT DETAILS', null, null, null],
        [null, null, null, null],
        ['Payment Method', 'Amount', 'Status', 'Details']
      ];
      
      // Add payment rows
      invoiceSales.forEach(sale => {
        let details = '';
        if (sale.PaymentMethod === 'CHEQUE' && sale.paymentDetails) {
          details = `${sale.paymentDetails.chequeNumber} - ${sale.paymentDetails.bank}`;
        } else if (sale.PaymentMethod === 'CREDIT' && sale.paymentDetails) {
          details = `Due: ${new Date(sale.paymentDetails.dueDate || '').toLocaleDateString()}`;
        }
        
        invoiceDetails.push([
          sale.PaymentMethod,
          sale.Amount.toString(),
          getPaymentStatus(sale).text,
          details
        ]);
      });
      
      // Calculate total
      const totalAmount = invoiceSales.reduce((sum, sale) => sum + Number(sale.Amount), 0);
      invoiceDetails.push([null, null, null, null]);
      invoiceDetails.push(['Total:', totalAmount.toString(), null, null]);
      
      // Create invoice details worksheet
      const invoiceWS = XLSX.utils.aoa_to_sheet(invoiceDetails);
      
      // Set column widths for better readability
      setColumnWidths(invoiceWS, [20, 15, 15, 30]);
      
      // Define merged cells for headers
      const invoiceMerges = [
        ['A1', 'D1'], // Merge cells for main header
        ['A7', 'D7']  // Merge cells for payment details header
      ];
      
      // Apply merges
      setMerges(invoiceWS, invoiceMerges);
      
      // Apply number format to currency cells
      const lastRow = invoiceDetails.length;
      // Format Amount column for payment rows (start from row 10)
      for (let i = 10; i < lastRow - 1; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: i, c: 1 }); // Column B (Amount)
        if (invoiceWS[cellRef] && typeof invoiceWS[cellRef].v === 'number') {
          invoiceWS[cellRef].z = '#,##0.00';
        }
      }
      
      // Format total amount cell
      const totalCellRef = XLSX.utils.encode_cell({ r: lastRow - 1, c: 1 }); // Total amount cell
      if (invoiceWS[totalCellRef]) {
        invoiceWS[totalCellRef].z = '#,##0.00';
      }
      
      // Add borders to all cells
      addBordersToWorksheet(invoiceWS);
      
      // Style header rows
      styleHeaderRow(invoiceWS, 0); // "INVOICE DETAILS" header
      styleHeaderRow(invoiceWS, 6); // "PAYMENT DETAILS" header
      styleHeaderRow(invoiceWS, 8); // Payment details column headers
      
      XLSX.utils.book_append_sheet(wb, invoiceWS, 'Invoice Details');
      
      // --- INVOICE ITEMS WORKSHEET ---
      
      // Create items worksheet with header
      const itemsData = [
        ['INVOICE ITEMS', null, null, null],
        [null, null, null, null],
        ['Product', 'Quantity', 'Unit Price', 'Total']
      ];
      
      // Add item rows
      saleItems[saleId].forEach(item => {
        itemsData.push([
          item.ProductName,
          item.Quantity.toString(),
          item.UnitPrice.toString(),
          item.TotalPrice.toString()
        ]);
      });
      
      // Calculate subtotal
      const subtotal = saleItems[saleId].reduce((sum, item) => sum + item.TotalPrice, 0);
      itemsData.push([null, null, null, null]);
      itemsData.push([null, null, 'Subtotal:', subtotal.toString()]);
      
      // Create items worksheet
      const itemsWS = XLSX.utils.aoa_to_sheet(itemsData);
      
      // Set column widths for better readability
      setColumnWidths(itemsWS, [40, 10, 15, 15]);
      
      // Define merged cells for headers
      const itemsMerges = [
        ['A1', 'D1']  // Merge cells for main header
      ];
      
      // Apply merges
      setMerges(itemsWS, itemsMerges);
      
      // Apply number format to currency cells
      for (let i = 4; i < itemsData.length - 1; i++) {
        // Column C (Unit Price)
        const unitPriceRef = XLSX.utils.encode_cell({ r: i, c: 2 }); 
        if (itemsWS[unitPriceRef] && typeof itemsWS[unitPriceRef].v === 'number') {
          itemsWS[unitPriceRef].z = '#,##0.00';
        }
        
        // Column D (Total)
        const totalRef = XLSX.utils.encode_cell({ r: i, c: 3 }); 
        if (itemsWS[totalRef] && typeof itemsWS[totalRef].v === 'number') {
          itemsWS[totalRef].z = '#,##0.00';
        }
      }
      
      // Format subtotal cell
      const subtotalCellRef = XLSX.utils.encode_cell({ r: itemsData.length - 1, c: 3 });
      if (itemsWS[subtotalCellRef]) {
        itemsWS[subtotalCellRef].z = '#,##0.00';
      }
      
      // Add borders to all cells
      addBordersToWorksheet(itemsWS);
      
      // Style header rows
      styleHeaderRow(itemsWS, 0); // "INVOICE ITEMS" header
      styleHeaderRow(itemsWS, 2); // Item details column headers
      
      XLSX.utils.book_append_sheet(wb, itemsWS, 'Invoice Items');
      
      XLSX.writeFile(wb, `Invoice_${invoiceId}.xlsx`);
    } catch (error) {
      console.error('Error downloading invoice:', error);
    } finally {
      setDownloadingExcel(false);
    }
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
                <TableCell className="font-semibold">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : Object.entries(groupedSales).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4">
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
                    const saleId = firstSale.SaleID;

                    return (
                      <React.Fragment key={invoiceId}>
                        <TableRow 
                          className="hover:bg-gray-50"
                        >
                          <TableCell className="cursor-pointer" onClick={() => toggleInvoiceExpand(invoiceId, saleId)}>
                            <div className="flex items-center">
                              {isExpanded ? 
                                <ChevronDown className="h-4 w-4 mr-2" /> : 
                                <ChevronRight className="h-4 w-4 mr-2" />
                              }
                              {invoiceId}
                            </div>
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
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadInvoiceAsExcel(invoiceId, saleId);
                              }}
                              disabled={downloadingExcel}
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-gray-50">
                            <TableCell colSpan={6}>
                              <div className="p-4">
                                {/* Invoice Items Section */}
                                <h4 className="font-semibold mb-2">Invoice Items</h4>
                                {loadingItems[saleId] ? (
                                  <div className="text-center py-4">Loading invoice items...</div>
                                ) : !saleItems[saleId] ? (
                                  <div className="text-center py-4">No item details available</div>
                                ) : (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableCell className="font-medium">Product</TableCell>
                                        <TableCell className="font-medium">Quantity</TableCell>
                                        <TableCell className="font-medium">Unit Price</TableCell>
                                        <TableCell className="font-medium">Total</TableCell>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {saleItems[saleId]?.map((item) => (
                                        <TableRow key={item.SaleItemID}>
                                          <TableCell>{item.ProductName}</TableCell>
                                          <TableCell>{item.Quantity}</TableCell>
                                          <TableCell>{formatCurrency(item.UnitPrice)}</TableCell>
                                          <TableCell>{formatCurrency(item.TotalPrice)}</TableCell>
                                        </TableRow>
                                      ))}
                                      <TableRow className="bg-gray-100">
                                        <TableCell colSpan={3} className="text-right font-semibold">
                                          Subtotal:
                                        </TableCell>
                                        <TableCell className="font-semibold">
                                          {formatCurrency(
                                            saleItems[saleId]?.reduce(
                                              (sum, item) => sum + Number(item.TotalPrice), 0
                                            ) || 0
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    </TableBody>
                                  </Table>
                                )}

                                {/* Payment Details Section */}
                                <h4 className="font-semibold mt-6 mb-2">Payment Details</h4>
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