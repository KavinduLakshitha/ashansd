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
import { addDays, format } from "date-fns";
import { parseISO } from "date-fns";
import SearchableCustomerSelect from './SearchableCustomerSelect';
import _ from 'lodash';
import * as XLSX from 'xlsx';
import { MonthYearDialog, YearDialog } from './MonthYearSelectors';

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
  const [, setLoadingItems] = useState<Record<string, boolean>>({});
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [monthYearDialogOpen, setMonthYearDialogOpen] = useState(false);
  const [yearDialogOpen, setYearDialogOpen] = useState(false);
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
  const [downloadingMonthly, setDownloadingMonthly] = useState(false);
  const [downloadingYearly, setDownloadingYearly] = useState(false);

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
    console.log(saleId);
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
      const items = saleItems[saleId];

      console.log('Invoice Sales:', invoiceSales);
      console.log('Sale Items:', items);

      if (!invoiceSales || !items) {
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

  const fetchAllSaleItems = async (salesIDs: string[]) => {
    const uniqueSaleIDs = [...new Set(salesIDs)];
    
    try {
      // setDownloadingExcel(true);
      
      const itemsData: Record<string, SaleItem[]> = {};
      
      // Fetch items for each unique sale ID
      for (const saleId of uniqueSaleIDs) {
        if (saleItems[saleId]) {
          // Use cached data if available
          itemsData[saleId] = saleItems[saleId];
        } else {
          // Fetch from API
          try {
            const response = await axios.get(
              `${process.env.NEXT_PUBLIC_API_URL}/sales/${saleId}/items`
            );
            
            itemsData[saleId] = response.data;
            
            // Update cache
            setSaleItems(prev => ({
              ...prev,
              [saleId]: response.data
            }));
          } catch (error) {
            console.error(`Error fetching items for sale ${saleId}:`, error);
            itemsData[saleId] = [];
          }
        }
      }
      
      return itemsData;
    } catch (error) {
      console.error('Error fetching all sale items:', error);
      return {};
    }
  };

  const downloadMonthlyReport = async (selectedMonth?: number, selectedYear?: number) => {
    try {
      setDownloadingMonthly(true);
      
      // Use provided month/year or default to current month/year
      const now = new Date();
      const month = selectedMonth !== undefined ? selectedMonth : now.getMonth();
      const year = selectedYear !== undefined ? selectedYear : now.getFullYear();
      
      // Get the month's date range
      const firstDayOfMonth = new Date(year, month, 1);
      firstDayOfMonth.setHours(0, 0, 0, 0);
      
      const lastDayOfMonth = new Date(year, month + 1, 0); // Last day of the month
      lastDayOfMonth.setHours(23, 59, 59, 999);
      
      // Fetch data for the selected month
      let monthlySales = sales;
      
      // Check if the current filter covers the entire selected month
      const currentFilterStartDate = filters.dateRange?.from ? new Date(filters.dateRange.from) : null;
      const currentFilterEndDate = filters.dateRange?.to ? new Date(filters.dateRange.to) : null;
      
      const needToFetchMonthlyData = !currentFilterStartDate || 
                                    !currentFilterEndDate ||
                                    currentFilterStartDate > firstDayOfMonth ||
                                    currentFilterEndDate < lastDayOfMonth;
      
      if (needToFetchMonthlyData) {
        try {
          const businessLineId = getBusinessLineID();
          
          const dateRange = {
            startDate: firstDayOfMonth.toISOString(),
            endDate: lastDayOfMonth.toISOString()
          };
          
          const response = await axios.get(
            `${process.env.NEXT_PUBLIC_API_URL}/payments/history/${businessLineId}`,
            {
              params: dateRange
            }
          );
          
          monthlySales = response.data.payments;
        } catch (error) {
          console.error('Error fetching monthly data:', error);
          return;
        }
      }
      
      // Fetch all sale items data for these sales
      const saleIDs = monthlySales.map(sale => sale.SaleID);
      const allSaleItems = await fetchAllSaleItems(saleIDs);
      
      // Group sales by invoice
      const groupedMonthlySales = _.groupBy(monthlySales, 'InvoiceID');
      
      // Create a new workbook
      const wb = XLSX.utils.book_new();
      
      // --- SUMMARY WORKSHEET ---
      const summaryData = [
        ['MONTHLY SALES REPORT', null, null, null, null, null],
        [null, null, null, null, null, null],
        [`Period: ${format(firstDayOfMonth, 'MMMM yyyy')}`, null, null, null, null, null],
        [null, null, null, null, null, null],
        ['Invoice ID', 'Date', 'Customer', 'Payment Method', 'Status', 'Amount']
      ];
      
      let totalMonthlyAmount = 0;
      
      // Add invoice rows to summary
      Object.entries(groupedMonthlySales).forEach(([invoiceId, invoiceSales]) => {
        const invoiceTotal = invoiceSales.reduce((sum, sale) => sum + Number(sale.Amount.toString()), 0);
        totalMonthlyAmount += invoiceTotal;
        
        // Add a row for each payment method in the invoice
        invoiceSales.forEach(sale => {
          summaryData.push([
            invoiceId,
            format(parseISO(sale.PaymentDate), 'dd/MM/yyyy'),
            sale.CustomerName,
            sale.PaymentMethod,
            getPaymentStatus(sale).text,
            sale.Amount.toString()
          ]);
        });
      });
      
      // Add total row
      summaryData.push([null, null, null, null, null, null]);
      summaryData.push(['TOTAL', null, null, null, null, totalMonthlyAmount.toString()]);
      
      // Create summary worksheet
      const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
      
      // Set column widths
      setColumnWidths(summaryWS, [15, 15, 30, 15, 15, 15]);
      
      // Define merged cells for headers
      const summaryMerges = [
        ['A1', 'F1'], // Merge cells for main header
        ['A3', 'F3']  // Merge cells for period
      ];
      
      // Apply merges
      setMerges(summaryWS, summaryMerges);
      
      // Style cells
      addBordersToWorksheet(summaryWS);
      styleHeaderRow(summaryWS, 0); // Main header
      styleHeaderRow(summaryWS, 4); // Column headers
      
      // Format currency columns
      for (let i = 6; i < summaryData.length - 2; i++) {
        const amountRef = XLSX.utils.encode_cell({ r: i, c: 5 }); // Column F (Amount)
        if (summaryWS[amountRef]) {
          summaryWS[amountRef].z = '#,##0.00';
        }
      }
      
      // Format total amount cell
      const totalAmountRef = XLSX.utils.encode_cell({ r: summaryData.length - 1, c: 5 });
      if (summaryWS[totalAmountRef]) {
        summaryWS[totalAmountRef].z = '#,##0.00';
      }
      
      XLSX.utils.book_append_sheet(wb, summaryWS, 'Monthly Summary');
      
      // --- PRODUCTS WORKSHEET ---
      const productsData = [
        ['PRODUCTS SUMMARY', null, null, null, null],
        [null, null, null, null, null],
        [`Period: ${format(firstDayOfMonth, 'MMMM yyyy')}`, null, null, null, null],
        [null, null, null, null, null],
        ['Product Name', 'Total Quantity', 'Average Unit Price', 'Total Sales']
      ];
      
      // Aggregate product data
      const productSummary: Record<string, { 
        totalQuantity: number; 
        totalSales: number;
        unitPrices: number[];
      }> = {};
      
      // Iterate through all sale items to build product summary
      Object.values(allSaleItems).forEach(itemList => {
        itemList.forEach(item => {
          if (!productSummary[item.ProductName]) {
            productSummary[item.ProductName] = {
              totalQuantity: 0,
              totalSales: 0,
              unitPrices: []
            };
          }
          
          productSummary[item.ProductName].totalQuantity += item.Quantity;
          productSummary[item.ProductName].totalSales += item.TotalPrice;
          productSummary[item.ProductName].unitPrices.push(item.UnitPrice);
        });
      });
      
      // Add product rows to summary
      Object.entries(productSummary).forEach(([productName, data]) => {
        const avgUnitPrice = data.unitPrices.reduce((sum, price) => sum + price, 0) / data.unitPrices.length;
        
        productsData.push([
          productName,
          data.totalQuantity.toString(),
          avgUnitPrice.toString(),
          data.totalSales.toString()
        ]);
      });
      
      // Add total row
      const totalProductSales = Object.values(productSummary).reduce((sum, data) => sum + data.totalSales, 0);
      productsData.push([null, null, null, null]);
      productsData.push(['TOTAL', null, null, totalProductSales.toString()]);
      
      // Create products worksheet
      const productsWS = XLSX.utils.aoa_to_sheet(productsData);
      
      // Set column widths
      setColumnWidths(productsWS, [40, 15, 20, 15]);
      
      // Define merged cells for headers
      const productsMerges = [
        ['A1', 'D1'], // Merge cells for main header
        ['A3', 'D3']  // Merge cells for period
      ];
      
      // Apply merges
      setMerges(productsWS, productsMerges);
      
      // Style cells
      addBordersToWorksheet(productsWS);
      styleHeaderRow(productsWS, 0); // Main header
      styleHeaderRow(productsWS, 4); // Column headers
      
      // Format currency and number columns
      for (let i = 6; i < productsData.length - 2; i++) {
        // Average Unit Price column
        const avgPriceRef = XLSX.utils.encode_cell({ r: i, c: 2 });
        if (productsWS[avgPriceRef]) {
          productsWS[avgPriceRef].z = '#,##0.00';
        }
        
        // Total Sales column
        const totalSalesRef = XLSX.utils.encode_cell({ r: i, c: 3 });
        if (productsWS[totalSalesRef]) {
          productsWS[totalSalesRef].z = '#,##0.00';
        }
      }
      
      // Format total amount cell
      const productsTotalRef = XLSX.utils.encode_cell({ r: productsData.length - 1, c: 3 });
      if (productsWS[productsTotalRef]) {
        productsWS[productsTotalRef].z = '#,##0.00';
      }
      
      // --- PAYMENT METHODS WORKSHEET ---
      const paymentMethodsData = [
        ['PAYMENT METHODS SUMMARY', null, null],
        [null, null, null],
        [`Period: ${format(firstDayOfMonth, 'MMMM yyyy')}`, null, null],
        [null, null, null],
        ['Payment Method', 'Count', 'Total Amount']
      ];
      
      // Aggregate payment method data
      const paymentMethodSummary: Record<string, { 
        count: number; 
        total: number;
      }> = {
        'CASH': { count: 0, total: 0 },
        'CHEQUE': { count: 0, total: 0 },
        'CREDIT': { count: 0, total: 0 }
      };
      
      // Iterate through all sales to build payment method summary
      monthlySales.forEach(sale => {
        if (paymentMethodSummary[sale.PaymentMethod]) {
          paymentMethodSummary[sale.PaymentMethod].count += 1;
          paymentMethodSummary[sale.PaymentMethod].total += Number(sale.Amount);
        }
      });
      
      // Add payment method rows
      Object.entries(paymentMethodSummary).forEach(([method, data]) => {
        paymentMethodsData.push([
          method,
          data.count.toString(),
          data.total.toString()
        ]);
      });
      
      // Add total row
      const totalMethodsAmount = Object.values(paymentMethodSummary).reduce((sum, data) => sum + data.total, 0);
      const totalMethodsCount = Object.values(paymentMethodSummary).reduce((sum, data) => sum + data.count, 0);
      paymentMethodsData.push([null, null, null]);
      paymentMethodsData.push(['TOTAL', totalMethodsCount.toString(), totalMethodsAmount.toString()]);
      
      // Create payment methods worksheet
      const methodsWS = XLSX.utils.aoa_to_sheet(paymentMethodsData);
      
      // Set column widths
      setColumnWidths(methodsWS, [20, 15, 20]);
      
      // Define merged cells for headers
      const methodsMerges = [
        ['A1', 'C1'], // Merge cells for main header
        ['A3', 'C3']  // Merge cells for period
      ];
      
      // Apply merges
      setMerges(methodsWS, methodsMerges);
      
      // Style cells
      addBordersToWorksheet(methodsWS);
      styleHeaderRow(methodsWS, 0); // Main header
      styleHeaderRow(methodsWS, 4); // Column headers
      
      // Format currency columns
      for (let i = 6; i < paymentMethodsData.length - 2; i++) {
        const totalRef = XLSX.utils.encode_cell({ r: i, c: 2 });
        if (methodsWS[totalRef]) {
          methodsWS[totalRef].z = '#,##0.00';
        }
      }
      
      // Format total amount cell
      const methodsTotalRef = XLSX.utils.encode_cell({ r: paymentMethodsData.length - 1, c: 2 });
      if (methodsWS[methodsTotalRef]) {
        methodsWS[methodsTotalRef].z = '#,##0.00';
      }
      
      XLSX.utils.book_append_sheet(wb, methodsWS, 'Payment Methods');
      
      // Save the Excel file
      const currentMonthStr = format(firstDayOfMonth, 'yyyy-MM');
      XLSX.writeFile(wb, `Monthly_Sales_Report_${currentMonthStr}.xlsx`);
    } catch (error) {
      console.error('Error generating monthly report:', error);
    } finally {
      setDownloadingMonthly(false);
    }
  };

  const downloadYearlyReport = async (selectedYear?: number) => {
    try {
      setDownloadingYearly(true);
      
      // Get the current year's date range
      const now = new Date();
      const year = selectedYear !== undefined ? selectedYear : now.getFullYear();
      
      const firstDayOfYear = new Date(year, 0, 1);
      firstDayOfYear.setHours(0, 0, 0, 0);
      
      const lastDayOfYear = new Date(year, 11, 31);
      lastDayOfYear.setHours(23, 59, 59, 999);
      // Fetch data for the current year if not already in the current filtered data
      let yearlySales = sales;
      
      // Check if the current filter covers the entire year
      const currentFilterStartDate = filters.dateRange?.from ? new Date(filters.dateRange.from) : null;
      const currentFilterEndDate = filters.dateRange?.to ? new Date(filters.dateRange.to) : null;
      
      const needToFetchYearlyData = !currentFilterStartDate || 
                                  !currentFilterEndDate || 
                                  currentFilterStartDate > firstDayOfYear || 
                                  currentFilterEndDate < lastDayOfYear;
      
      if (needToFetchYearlyData) {
        try {
          const businessLineId = getBusinessLineID();
          
          const dateRange = {
            startDate: firstDayOfYear.toISOString(),
            endDate: lastDayOfYear.toISOString()
          };
          
          const response = await axios.get(
            `${process.env.NEXT_PUBLIC_API_URL}/payments/history/${businessLineId}`,
            {
              params: dateRange
            }
          );
          
          yearlySales = response.data.payments;
        } catch (error) {
          console.error('Error fetching yearly data:', error);
          return;
        }
      }
      
      // Fetch all sale items data for these sales
      const saleIDs = yearlySales.map(sale => sale.SaleID);
      const allSaleItems = await fetchAllSaleItems(saleIDs);
      
      // Create a new workbook
      const wb = XLSX.utils.book_new();
      
      // --- MONTHLY BREAKDOWN WORKSHEET ---
      const monthlyBreakdownData = [
        ['YEARLY SALES REPORT - MONTHLY BREAKDOWN', null, null, null],
        [null, null, null, null],
        [`Year: ${year}`, null, null, null],
        [null, null, null, null],
        ['Month', 'Number of Sales', 'Revenue', 'Average Sale Value']
      ];
      
      // Group sales by month
      const salesByMonth: Record<number, { 
        count: number; 
        revenue: number;
      }> = {};
      
      // Initialize all months with zero values
      for (let month = 0; month < 12; month++) {
        salesByMonth[month] = { count: 0, revenue: 0 };
      }
      
      // Populate with actual sales data
      yearlySales.forEach(sale => {
        const saleDate = new Date(sale.PaymentDate);
        const month = saleDate.getMonth();
        
        salesByMonth[month].count += 1;
        salesByMonth[month].revenue += Number(sale.Amount);
      });
      
      // Add month rows
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June', 
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      
      let totalYearlyRevenue = 0;
      let totalYearlySalesCount = 0;
      
      monthNames.forEach((monthName, index) => {
        const monthData = salesByMonth[index];
        const avgSaleValue = monthData.count > 0 ? monthData.revenue / monthData.count : 0;
        
        totalYearlyRevenue += monthData.revenue;
        totalYearlySalesCount += monthData.count;
        
        monthlyBreakdownData.push([
          monthName,
          monthData.count.toString(),
          monthData.revenue.toString(),
          avgSaleValue.toString()
        ]);
      });
      
      // Add total row
      const yearlyAvgSaleValue = totalYearlySalesCount > 0 ? totalYearlyRevenue / totalYearlySalesCount : 0;
      monthlyBreakdownData.push([null, null, null, null]);
      monthlyBreakdownData.push([
        'TOTAL', 
        totalYearlySalesCount.toString(), 
        totalYearlyRevenue.toString(), 
        yearlyAvgSaleValue.toString()
      ]);
      
      // Create monthly breakdown worksheet
      const monthlyBreakdownWS = XLSX.utils.aoa_to_sheet(monthlyBreakdownData);
      
      // Set column widths
      setColumnWidths(monthlyBreakdownWS, [15, 20, 20, 20]);
      
      // Define merged cells for headers
      const monthlyMerges = [
        ['A1', 'D1'], // Merge cells for main header
        ['A3', 'D3']  // Merge cells for year
      ];
      
      // Apply merges
      setMerges(monthlyBreakdownWS, monthlyMerges);
      
      // Style cells
      addBordersToWorksheet(monthlyBreakdownWS);
      styleHeaderRow(monthlyBreakdownWS, 0); // Main header
      styleHeaderRow(monthlyBreakdownWS, 4); // Column headers
      
      // Format currency and number columns
      for (let i = 6; i < monthlyBreakdownData.length - 2; i++) {
        // Revenue column
        const revenueRef = XLSX.utils.encode_cell({ r: i, c: 2 });
        if (monthlyBreakdownWS[revenueRef]) {
          monthlyBreakdownWS[revenueRef].z = '#,##0.00';
        }
        
        // Average Sale Value column
        const avgValueRef = XLSX.utils.encode_cell({ r: i, c: 3 });
        if (monthlyBreakdownWS[avgValueRef]) {
          monthlyBreakdownWS[avgValueRef].z = '#,##0.00';
        }
      }
      
      // Format total cells
      const totalRevenueRef = XLSX.utils.encode_cell({ r: monthlyBreakdownData.length - 1, c: 2 });
      if (monthlyBreakdownWS[totalRevenueRef]) {
        monthlyBreakdownWS[totalRevenueRef].z = '#,##0.00';
      }
      
      const totalAvgRef = XLSX.utils.encode_cell({ r: monthlyBreakdownData.length - 1, c: 3 });
      if (monthlyBreakdownWS[totalAvgRef]) {
        monthlyBreakdownWS[totalAvgRef].z = '#,##0.00';
      }
      
      XLSX.utils.book_append_sheet(wb, monthlyBreakdownWS, 'Monthly Breakdown');
      
      // --- TOP PRODUCTS WORKSHEET ---
      const topProductsData = [
        ['TOP PRODUCTS', null, null, null],
        [null, null, null, null],
        [`Year: ${year}`, null, null, null],
        [null, null, null, null],
        ['Product', 'Quantity Sold', 'Revenue', '% of Total Revenue']
      ];
      
      // Aggregate product data
      const productSummary: Record<string, { 
        quantity: number; 
        revenue: number;
      }> = {};
      
      // Iterate through all sale items to build product summary
      Object.values(allSaleItems).forEach(itemList => {
        itemList.forEach(item => {
          if (!productSummary[item.ProductName]) {
            productSummary[item.ProductName] = {
              quantity: 0,
              revenue: 0
            };
          }
          
          productSummary[item.ProductName].quantity += item.Quantity;
          productSummary[item.ProductName].revenue += item.TotalPrice;
        });
      });
      
      // Calculate total product revenue for percentage calculation
      const totalProductRevenue = Object.values(productSummary).reduce((sum, data) => sum + data.revenue, 0);
      
      // Sort products by revenue (descending) and get top 20
      const topProducts = Object.entries(productSummary)
        .sort(([, a], [, b]) => b.revenue - a.revenue)
        .slice(0, 20);
      
      // Add product rows
      topProducts.forEach(([productName, data]) => {
        const percentOfTotal = (data.revenue / totalProductRevenue) * 100;
        
        topProductsData.push([
          productName,
          data.quantity.toString(),
          data.revenue.toString(),
          percentOfTotal.toString()
        ]);
      });
      
      // Create top products worksheet
      const topProductsWS = XLSX.utils.aoa_to_sheet(topProductsData);
      
      // Set column widths
      setColumnWidths(topProductsWS, [40, 15, 15, 15]);
      
      // Define merged cells for headers
      const topProductsMerges = [
        ['A1', 'D1'], // Merge cells for main header
        ['A3', 'D3']  // Merge cells for year
      ];
      
      // Apply merges
      setMerges(topProductsWS, topProductsMerges);
      
      // Style cells
      addBordersToWorksheet(topProductsWS);
      styleHeaderRow(topProductsWS, 0); // Main header
      styleHeaderRow(topProductsWS, 4); // Column headers
      
      // Format currency and percentage columns
      for (let i = 6; i < topProductsData.length; i++) {
        // Revenue column
        const revenueRef = XLSX.utils.encode_cell({ r: i, c: 2 });
        if (topProductsWS[revenueRef]) {
          topProductsWS[revenueRef].z = '#,##0.00';
        }
        
        // Percentage column
        const percentRef = XLSX.utils.encode_cell({ r: i, c: 3 });
        if (topProductsWS[percentRef]) {
          topProductsWS[percentRef].z = '0.00%';
        }
      }
      
      XLSX.utils.book_append_sheet(wb, topProductsWS, 'Top Products');
      
      // --- CUSTOMER ANALYSIS WORKSHEET ---
      const customerAnalysisData = [
        ['CUSTOMER ANALYSIS', null, null, null],
        [null, null, null, null],
        [`Year: ${year}`, null, null, null],
        [null, null, null, null],
        ['Customer', 'Number of Purchases', 'Total Spent', 'Average Purchase Value']
      ];
      
      // Group sales by customer
      const salesByCustomer: Record<string, { 
        customerName: string;
        purchaseCount: number;
        totalSpent: number;
      }> = {};
      
      // Populate with sales data
      yearlySales.forEach(sale => {
        if (!salesByCustomer[sale.CustomerID]) {
          salesByCustomer[sale.CustomerID] = {
            customerName: sale.CustomerName,
            purchaseCount: 0,
            totalSpent: 0
          };
        }
        
        salesByCustomer[sale.CustomerID].purchaseCount += 1;
        salesByCustomer[sale.CustomerID].totalSpent += Number(sale.Amount);
      });
      
      // Sort customers by total spent (descending) and get top 20
      const topCustomers = Object.entries(salesByCustomer)
        .sort(([, a], [, b]) => b.totalSpent - a.totalSpent)
        .slice(0, 20);
      
      // Add customer rows
      topCustomers.forEach(([, data]) => {
        const avgPurchaseValue = data.purchaseCount > 0 ? data.totalSpent / data.purchaseCount : 0;
        
        customerAnalysisData.push([
          data.customerName,
          data.purchaseCount.toString(),
          data.totalSpent.toString(),
          avgPurchaseValue.toString()
        ]);
      });
      
      // Create customer analysis worksheet
      const customerWS = XLSX.utils.aoa_to_sheet(customerAnalysisData);
      
      // Set column widths
      setColumnWidths(customerWS, [40, 20, 20, 20]);
      
      // Define merged cells for headers
      const customerMerges = [
        ['A1', 'D1'], // Merge cells for main header
        ['A3', 'D3']  // Merge cells for year
      ];
      
      // Apply merges
      setMerges(customerWS, customerMerges);
      
      // Style cells
      addBordersToWorksheet(customerWS);
      styleHeaderRow(customerWS, 0); // Main header
      styleHeaderRow(customerWS, 4); // Column headers
      
      // Format currency columns
      for (let i = 6; i < customerAnalysisData.length; i++) {
        // Total Spent column
        const totalSpentRef = XLSX.utils.encode_cell({ r: i, c: 2 });
        if (customerWS[totalSpentRef]) {
          customerWS[totalSpentRef].z = '#,##0.00';
        }
        
        // Average Purchase Value column
        const avgValueRef = XLSX.utils.encode_cell({ r: i, c: 3 });
        if (customerWS[avgValueRef]) {
          customerWS[avgValueRef].z = '#,##0.00';
        }
      }
      
      XLSX.utils.book_append_sheet(wb, customerWS, 'Customer Analysis');
      
      // Save the Excel file
      XLSX.writeFile(wb, `Yearly_Sales_Report_${year}.xlsx`);
    } catch (error) {
      console.error('Error generating yearly report:', error);
    } finally {
      setDownloadingYearly(false);
    }
  };

  const filteredSales = selectedPaymentMethod === 'ALL' || !selectedPaymentMethod
    ? sales
    : sales.filter(sale => sale.PaymentMethod === selectedPaymentMethod);

  const groupedSales = _.groupBy(filteredSales, 'InvoiceID');

  return (
    <Card className="w-full shadow-none rounded-tl-none rounded-tr-none border-0">
      <CardContent>
        <div className="flex items-center justify-between mb-6 mt-4">
          <div className="flex items-center gap-4 flex-wrap">
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
          
          {/* Download Reports Dropdown */}
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => setMonthYearDialogOpen(true)}
              disabled={downloadingMonthly}
            >
              <FileDown className="h-4 w-4 mr-2" />
              {downloadingMonthly ? 'Downloading...' : 'Monthly Report'}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => setYearDialogOpen(true)}
              disabled={downloadingYearly}
            >
              <FileDown className="h-4 w-4 mr-2" />
              {downloadingYearly ? 'Downloading...' : 'Yearly Report'}
            </Button>
          </div>
        </div>

        <MonthYearDialog 
          isOpen={monthYearDialogOpen}
          onClose={() => setMonthYearDialogOpen(false)}
          onConfirm={(month, year) => {
            downloadMonthlyReport(month, year);
            setMonthYearDialogOpen(false);
          }}
        />

        <YearDialog 
          isOpen={yearDialogOpen}
          onClose={() => setYearDialogOpen(false)}
          onConfirm={(year) => {
            downloadYearlyReport(year);
            setYearDialogOpen(false);
          }}
        />

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
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => toggleInvoiceExpand(invoiceId, saleId)}
                        >
                          <TableCell>
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
                              title="Download Invoice"
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        
                        {/* Expanded content row */}
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={6} className="bg-gray-50 p-0">
                              <div className="p-4">
                                {/* Payment Details Section */}
                                <div className="mb-4">
                                  <h4 className="font-semibold mb-2">Payment Details</h4>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableCell className="font-semibold">Payment Method</TableCell>
                                        <TableCell className="font-semibold">Amount</TableCell>
                                        <TableCell className="font-semibold">Status</TableCell>
                                        <TableCell className="font-semibold">Details</TableCell>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {invoiceSales.map(sale => (
                                        <TableRow key={sale.PaymentID}>
                                          <TableCell>{sale.PaymentMethod}</TableCell>
                                          <TableCell>{formatCurrency(sale.Amount)}</TableCell>
                                          <TableCell>
                                            <Badge className={getPaymentStatus(sale).className}>
                                              {getPaymentStatus(sale).text}
                                            </Badge>
                                          </TableCell>
                                          <TableCell>
                                            {sale.PaymentMethod === 'CHEQUE' && sale.paymentDetails && (
                                              <>
                                                Cheque #{sale.paymentDetails.chequeNumber} - {sale.paymentDetails.bank}
                                                {sale.paymentDetails.realizeDate && 
                                                  ` (Realize: ${new Date(sale.paymentDetails.realizeDate).toLocaleDateString()})`}
                                              </>
                                            )}
                                            {sale.PaymentMethod === 'CREDIT' && sale.paymentDetails && sale.paymentDetails.dueDate && (
                                              <>Due: {new Date(sale.paymentDetails.dueDate).toLocaleDateString()}</>
                                            )}
                                            {sale.PaymentMethod === 'CASH' && 'Paid in Cash'}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>

                                {/* Invoice Items Section */}
                                <div>
                                  <h4 className="font-semibold mb-2">Invoice Items</h4>
                                  {saleItems[saleId] ? (
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableCell className="font-semibold">Product</TableCell>
                                          <TableCell className="font-semibold">Quantity</TableCell>
                                          <TableCell className="font-semibold">Unit Price</TableCell>
                                          <TableCell className="font-semibold">Total</TableCell>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {saleItems[saleId].map(item => (
                                          <TableRow key={item.SaleItemID}>
                                            <TableCell>{item.ProductName}</TableCell>
                                            <TableCell>{item.Quantity}</TableCell>
                                            <TableCell>{formatCurrency(item.UnitPrice)}</TableCell>
                                            <TableCell>{formatCurrency(item.TotalPrice)}</TableCell>
                                          </TableRow>
                                        ))}
                                        <TableRow>
                                          <TableCell colSpan={3} className="text-right font-semibold">
                                            Subtotal:
                                          </TableCell>
                                          <TableCell className="font-semibold">
                                            {formatCurrency(
                                              saleItems[saleId].reduce((sum, item) => sum + Number(item.TotalPrice), 0)
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      </TableBody>
                                    </Table>
                                  ) : (
                                    <div className="text-center py-4 text-gray-500">
                                      Loading items...
                                    </div>
                                  )}
                                </div>
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