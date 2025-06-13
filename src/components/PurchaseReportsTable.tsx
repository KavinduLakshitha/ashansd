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
import { ChevronDown, ChevronRight, FileDown, FileText, Filter } from "lucide-react";
import { DateRange } from "react-day-picker";
import { addDays, format } from "date-fns";
import { parseISO } from "date-fns";
import * as XLSX from 'xlsx';
import { MonthYearDialog, YearDialog } from './MonthYearSelectors';
import { Trash2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import _ from 'lodash';

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
  const [monthYearDialogOpen, setMonthYearDialogOpen] = useState(false);
  const [yearDialogOpen, setYearDialogOpen] = useState(false);
  const [downloadingMonthly, setDownloadingMonthly] = useState(false);
  const [downloadingYearly, setDownloadingYearly] = useState(false);
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

  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    purchaseId: '',
    invoiceNumber: '',
    loading: false
  });

  const adjustDateRange = (dateRange: DateRange | undefined): { 
    startDate: string | undefined, 
    endDate: string | undefined 
  } => {
    if (!dateRange || !dateRange.from || !dateRange.to) {
      return { startDate: undefined, endDate: undefined };
    }
    
    const startDate = new Date(dateRange.from);
    startDate.setHours(0, 0, 0, 0);
    
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
        setError(null);
        const businessLineId = getBusinessLineID();
        
        const vendorsResponse = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/vendors?businessLineId=${businessLineId}`
        );
        
        const vendorsData = Array.isArray(vendorsResponse.data) 
          ? vendorsResponse.data 
          : [];
          
        setVendors(vendorsData);

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

  const handleDeletePurchase = async (purchaseId: string, invoiceNumber: string) => {
    setDeleteDialog({
      open: true,
      purchaseId,
      invoiceNumber,
      loading: false
    });
  };

  const confirmDeletePurchase = async () => {
    try {
      setDeleteDialog(prev => ({ ...prev, loading: true }));
      setError(null);

      const response = await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/purchases/${deleteDialog.purchaseId}`
      );

      // Remove the deleted purchase from the state
      setPurchases(prev => prev.filter(p => p.PurchaseID !== deleteDialog.purchaseId));
      
      // Close any expanded items for this purchase
      setExpandedInvoices(prev => {
        const newSet = new Set(prev);
        newSet.delete(deleteDialog.purchaseId);
        return newSet;
      });

      // Show success message (you can customize this)
      console.log('Purchase deleted successfully:', response.data);
      
      // Close dialog
      setDeleteDialog({
        open: false,
        purchaseId: '',
        invoiceNumber: '',
        loading: false
      });

    } catch (error) {
      console.error('Error deleting purchase:', error);
      setDeleteDialog(prev => ({ ...prev, loading: false }));
      
      if (isAxiosError(error)) {
        if (error.response?.status === 404) {
          setError('Purchase not found.');
        } else if (error.response?.status === 400) {
          setError(error.response.data.message || 'Cannot delete purchase due to insufficient stock.');
        } else if (error.response?.status === 403) {
          setError('You do not have permission to delete this purchase.');
        } else {
          setError('Failed to delete purchase. Please try again.');
        }
      } else {
        setError('Failed to delete purchase. Please try again.');
      }
    }
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

  const addBordersToWorksheet = (worksheet: XLSX.WorkSheet) => {
    if (!worksheet['!ref']) return;
    
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        
        if (!worksheet[cellAddress]) {
          worksheet[cellAddress] = { t: 's', v: '' };
        }
        
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
  
  const styleHeaderRow = (worksheet: XLSX.WorkSheet, headerRowIndex: number) => {
    if (!worksheet['!ref']) return;
    
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: col });
      
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { t: 's', v: '' };
      }
      
      if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
      
      worksheet[cellAddress].s = {
        ...worksheet[cellAddress].s,
        font: { bold: true },
        fill: { 
          patternType: 'solid', 
          fgColor: { rgb: "E9ECEF" }
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

  const fetchAllPurchaseItems = async (purchaseIDs: string[]) => {
    const uniquePurchaseIDs = [...new Set(purchaseIDs)];
    
    try {
      const itemsData: Record<string, PurchaseItem[]> = {};
      
      for (const purchaseId of uniquePurchaseIDs) {
        const purchase = purchases.find(p => p.PurchaseID === purchaseId);
        if (purchase?.items) {
          itemsData[purchaseId] = purchase.items;
        } else {
          try {
            const response = await axios.get(
              `${process.env.NEXT_PUBLIC_API_URL}/purchases/${purchaseId}/items`
            );
            
            itemsData[purchaseId] = response.data;
            
            setPurchases(prev => prev.map(p => 
              p.PurchaseID === purchaseId 
                ? { ...p, items: response.data }
                : p
            ));
          } catch (error) {
            console.error(`Error fetching items for purchase ${purchaseId}:`, error);
            itemsData[purchaseId] = [];
          }
        }
      }
      
      return itemsData;
    } catch (error) {
      console.error('Error fetching all purchase items:', error);
      return {};
    }
  };

  const downloadMonthlyReport = async (selectedMonth?: number, selectedYear?: number) => {
    try {
      setDownloadingMonthly(true);
      
      const now = new Date();
      const month = selectedMonth !== undefined ? selectedMonth : now.getMonth();
      const year = selectedYear !== undefined ? selectedYear : now.getFullYear();
      
      const firstDayOfMonth = new Date(year, month, 1);
      firstDayOfMonth.setHours(0, 0, 0, 0);
      
      const lastDayOfMonth = new Date(year, month + 1, 0);
      lastDayOfMonth.setHours(23, 59, 59, 999);
      
      let monthlyPurchases = purchases;
      
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
            `${process.env.NEXT_PUBLIC_API_URL}/purchases/history/${businessLineId}`,
            {
              params: dateRange
            }
          );
          
          monthlyPurchases = response.data;
        } catch (error) {
          console.error('Error fetching monthly data:', error);
          return;
        }
      }
      
      const purchaseIDs = monthlyPurchases.map(purchase => purchase.PurchaseID);
      const allPurchaseItems = await fetchAllPurchaseItems(purchaseIDs);
      
      const wb = XLSX.utils.book_new();
      
      // --- SUMMARY WORKSHEET ---
      const summaryData = [
        ['MONTHLY PURCHASE REPORT', null, null, null, null, null],
        [null, null, null, null, null, null],
        [`Period: ${format(firstDayOfMonth, 'MMMM yyyy')}`, null, null, null, null, null],
        [null, null, null, null, null, null],
        ['Invoice Number', 'Date', 'Vendor', 'Payment Method', 'Status', 'Amount']
      ];
      
      let totalMonthlyAmount = 0;
      
      monthlyPurchases.forEach(purchase => {
        totalMonthlyAmount += Number(purchase.Amount);
        
        summaryData.push([
          purchase.InvoiceNumber,
          format(parseISO(purchase.PurchaseDate), 'dd/MM/yyyy'),
          purchase.VendorName,
          purchase.PaymentMethod,
          getPaymentStatus(purchase).text,
          purchase.Amount.toString()
        ]);
      });
      
      summaryData.push([null, null, null, null, null, null]);
      summaryData.push(['TOTAL', null, null, null, null, totalMonthlyAmount.toString()]);
      
      const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
      
      setColumnWidths(summaryWS, [20, 15, 30, 15, 15, 15]);
      
      const summaryMerges = [
        ['A1', 'F1'],
        ['A3', 'F3']
      ];
      
      setMerges(summaryWS, summaryMerges);
      
      addBordersToWorksheet(summaryWS);
      styleHeaderRow(summaryWS, 0);
      styleHeaderRow(summaryWS, 4);
      
      for (let i = 6; i < summaryData.length - 2; i++) {
        const amountRef = XLSX.utils.encode_cell({ r: i, c: 5 });
        if (summaryWS[amountRef]) {
          summaryWS[amountRef].z = '#,##0.00';
        }
      }
      
      const totalAmountRef = XLSX.utils.encode_cell({ r: summaryData.length - 1, c: 5 });
      if (summaryWS[totalAmountRef]) {
        summaryWS[totalAmountRef].z = '#,##0.00';
      }
      
      XLSX.utils.book_append_sheet(wb, summaryWS, 'Monthly Summary');
      
      // --- PRODUCTS WORKSHEET ---
      const productsData = [
        ['PRODUCTS PURCHASED', null, null, null, null],
        [null, null, null, null, null],
        [`Period: ${format(firstDayOfMonth, 'MMMM yyyy')}`, null, null, null, null],
        [null, null, null, null, null],
        ['Product Name', 'Total Quantity', 'Average Unit Price', 'Total Cost']
      ];
      
      const productSummary: Record<string, { 
        totalQuantity: number; 
        totalCost: number;
        unitPrices: number[];
      }> = {};
      
      Object.values(allPurchaseItems).forEach(itemList => {
        itemList.forEach(item => {
          if (!productSummary[item.Name]) {
            productSummary[item.Name] = {
              totalQuantity: 0,
              totalCost: 0,
              unitPrices: []
            };
          }
          
          productSummary[item.Name].totalQuantity += item.Quantity;
          productSummary[item.Name].totalCost += item.TotalPrice;
          productSummary[item.Name].unitPrices.push(item.UnitPrice);
        });
      });
      
      Object.entries(productSummary).forEach(([productName, data]) => {
        const avgUnitPrice = data.unitPrices.reduce((sum, price) => sum + price, 0) / data.unitPrices.length;
        
        productsData.push([
          productName,
          data.totalQuantity.toString(),
          avgUnitPrice.toString(),
          data.totalCost.toString()
        ]);
      });
      
      const totalProductCost = Object.values(productSummary).reduce((sum, data) => sum + data.totalCost, 0);
      productsData.push([null, null, null, null]);
      productsData.push(['TOTAL', null, null, totalProductCost.toString()]);
      
      const productsWS = XLSX.utils.aoa_to_sheet(productsData);
      
      setColumnWidths(productsWS, [40, 15, 20, 15]);
      
      const productsMerges = [
        ['A1', 'D1'],
        ['A3', 'D3']
      ];
      
      setMerges(productsWS, productsMerges);
      
      addBordersToWorksheet(productsWS);
      styleHeaderRow(productsWS, 0);
      styleHeaderRow(productsWS, 4);
      
      for (let i = 6; i < productsData.length - 2; i++) {
        const avgPriceRef = XLSX.utils.encode_cell({ r: i, c: 2 });
        if (productsWS[avgPriceRef]) {
          productsWS[avgPriceRef].z = '#,##0.00';
        }
        
        const totalCostRef = XLSX.utils.encode_cell({ r: i, c: 3 });
        if (productsWS[totalCostRef]) {
          productsWS[totalCostRef].z = '#,##0.00';
        }
      }
      
      const productsTotalRef = XLSX.utils.encode_cell({ r: productsData.length - 1, c: 3 });
      if (productsWS[productsTotalRef]) {
        productsWS[productsTotalRef].z = '#,##0.00';
      }
      
      XLSX.utils.book_append_sheet(wb, productsWS, 'Products');
      
      // --- VENDOR ANALYSIS WORKSHEET ---
      const vendorData = [
        ['VENDOR ANALYSIS', null, null, null],
        [null, null, null, null],
        [`Period: ${format(firstDayOfMonth, 'MMMM yyyy')}`, null, null, null],
        [null, null, null, null],
        ['Vendor', 'Number of Purchases', 'Total Amount', 'Average Purchase Value']
      ];
      
      const vendorSummary: Record<string, { 
        vendorName: string;
        purchaseCount: number;
        totalAmount: number;
      }> = {};
      
      monthlyPurchases.forEach(purchase => {
        if (!vendorSummary[purchase.VendorID]) {
          vendorSummary[purchase.VendorID] = {
            vendorName: purchase.VendorName,
            purchaseCount: 0,
            totalAmount: 0
          };
        }
        
        vendorSummary[purchase.VendorID].purchaseCount += 1;
        vendorSummary[purchase.VendorID].totalAmount += Number(purchase.Amount);
      });
      
      Object.values(vendorSummary).forEach(data => {
        const avgPurchaseValue = data.purchaseCount > 0 ? data.totalAmount / data.purchaseCount : 0;
        
        vendorData.push([
          data.vendorName,
          data.purchaseCount.toString(),
          data.totalAmount.toString(),
          avgPurchaseValue.toString()
        ]);
      });
      
      const totalVendorAmount = Object.values(vendorSummary).reduce((sum, data) => sum + data.totalAmount, 0);
      const totalVendorCount = Object.values(vendorSummary).reduce((sum, data) => sum + data.purchaseCount, 0);
      vendorData.push([null, null, null, null]);
      vendorData.push(['TOTAL', totalVendorCount.toString(), totalVendorAmount.toString(), null]);
      
      const vendorWS = XLSX.utils.aoa_to_sheet(vendorData);
      
      setColumnWidths(vendorWS, [40, 20, 20, 20]);
      
      const vendorMerges = [
        ['A1', 'D1'],
        ['A3', 'D3']
      ];
      
      setMerges(vendorWS, vendorMerges);
      
      addBordersToWorksheet(vendorWS);
      styleHeaderRow(vendorWS, 0);
      styleHeaderRow(vendorWS, 4);
      
      for (let i = 6; i < vendorData.length - 2; i++) {
        const totalAmountRef = XLSX.utils.encode_cell({ r: i, c: 2 });
        if (vendorWS[totalAmountRef]) {
          vendorWS[totalAmountRef].z = '#,##0.00';
        }
        
        const avgValueRef = XLSX.utils.encode_cell({ r: i, c: 3 });
        if (vendorWS[avgValueRef]) {
          vendorWS[avgValueRef].z = '#,##0.00';
        }
      }
      
      const vendorTotalAmountRef = XLSX.utils.encode_cell({ r: vendorData.length - 1, c: 2 });
      if (vendorWS[vendorTotalAmountRef]) {
        vendorWS[vendorTotalAmountRef].z = '#,##0.00';
      }
      
      XLSX.utils.book_append_sheet(wb, vendorWS, 'Vendor Analysis');
      
      const currentMonthStr = format(firstDayOfMonth, 'yyyy-MM');
      XLSX.writeFile(wb, `Monthly_Purchase_Report_${currentMonthStr}.xlsx`);
    } catch (error) {
      console.error('Error generating monthly report:', error);
    } finally {
      setDownloadingMonthly(false);
    }
  };

  const downloadYearlyReport = async (selectedYear?: number) => {
    try {
      setDownloadingYearly(true);
      
      const now = new Date();
      const year = selectedYear !== undefined ? selectedYear : now.getFullYear();
      
      const firstDayOfYear = new Date(year, 0, 1);
      firstDayOfYear.setHours(0, 0, 0, 0);
      
      const lastDayOfYear = new Date(year, 11, 31);
      lastDayOfYear.setHours(23, 59, 59, 999);
      
      let yearlyPurchases = purchases;
      
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
            `${process.env.NEXT_PUBLIC_API_URL}/purchases/history/${businessLineId}`,
            {
              params: dateRange
            }
          );
          
          yearlyPurchases = response.data;
        } catch (error) {
          console.error('Error fetching yearly data:', error);
          return;
        }
      }
      
      const purchaseIDs = yearlyPurchases.map(purchase => purchase.PurchaseID);
      const allPurchaseItems = await fetchAllPurchaseItems(purchaseIDs);
      
      const wb = XLSX.utils.book_new();
      
      // --- MONTHLY BREAKDOWN WORKSHEET ---
      const monthlyBreakdownData = [
        ['YEARLY PURCHASE REPORT - MONTHLY BREAKDOWN', null, null, null],
        [null, null, null, null],
        [`Year: ${year}`, null, null, null],
        [null, null, null, null],
        ['Month', 'Number of Purchases', 'Total Spending', 'Average Purchase Value']
      ];
      
      const purchasesByMonth: Record<number, { 
        count: number; 
        spending: number;
      }> = {};
      
      for (let month = 0; month < 12; month++) {
        purchasesByMonth[month] = { count: 0, spending: 0 };
      }
      
      yearlyPurchases.forEach(purchase => {
        const purchaseDate = new Date(purchase.PurchaseDate);
        const month = purchaseDate.getMonth();
        
        purchasesByMonth[month].count += 1;
        purchasesByMonth[month].spending += Number(purchase.Amount);
      });
      
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June', 
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      
      let totalYearlySpending = 0;
      let totalYearlyPurchaseCount = 0;
      
      monthNames.forEach((monthName, index) => {
        const monthData = purchasesByMonth[index];
        const avgPurchaseValue = monthData.count > 0 ? monthData.spending / monthData.count : 0;
        
        totalYearlySpending += monthData.spending;
        totalYearlyPurchaseCount += monthData.count;
        
        monthlyBreakdownData.push([
          monthName,
          monthData.count.toString(),
          monthData.spending.toString(),
          avgPurchaseValue.toString()
        ]);
      });
      
      const yearlyAvgPurchaseValue = totalYearlyPurchaseCount > 0 ? totalYearlySpending / totalYearlyPurchaseCount : 0;
      monthlyBreakdownData.push([null, null, null, null]);
      monthlyBreakdownData.push([
        'TOTAL', 
        totalYearlyPurchaseCount.toString(), 
        totalYearlySpending.toString(), 
        yearlyAvgPurchaseValue.toString()
      ]);
      
      const monthlyBreakdownWS = XLSX.utils.aoa_to_sheet(monthlyBreakdownData);
      
      setColumnWidths(monthlyBreakdownWS, [15, 20, 20, 20]);
      
      const monthlyMerges = [
        ['A1', 'D1'],
        ['A3', 'D3']
      ];
      
      setMerges(monthlyBreakdownWS, monthlyMerges);
      
      addBordersToWorksheet(monthlyBreakdownWS);
      styleHeaderRow(monthlyBreakdownWS, 0);
      styleHeaderRow(monthlyBreakdownWS, 4);
      
      for (let i = 6; i < monthlyBreakdownData.length - 2; i++) {
        const spendingRef = XLSX.utils.encode_cell({ r: i, c: 2 });
        if (monthlyBreakdownWS[spendingRef]) {
          monthlyBreakdownWS[spendingRef].z = '#,##0.00';
        }
        
        const avgValueRef = XLSX.utils.encode_cell({ r: i, c: 3 });
        if (monthlyBreakdownWS[avgValueRef]) {
          monthlyBreakdownWS[avgValueRef].z = '#,##0.00';
        }
      }
      
      const totalSpendingRef = XLSX.utils.encode_cell({ r: monthlyBreakdownData.length - 1, c: 2 });
      if (monthlyBreakdownWS[totalSpendingRef]) {
        monthlyBreakdownWS[totalSpendingRef].z = '#,##0.00';
      }
      
      const totalAvgRef = XLSX.utils.encode_cell({ r: monthlyBreakdownData.length - 1, c: 3 });
      if (monthlyBreakdownWS[totalAvgRef]) {
        monthlyBreakdownWS[totalAvgRef].z = '#,##0.00';
      }
      
      XLSX.utils.book_append_sheet(wb, monthlyBreakdownWS, 'Monthly Breakdown');
      
      // --- TOP VENDORS WORKSHEET ---
      const topVendorsData = [
        ['TOP VENDORS', null, null, null],
        [null, null, null, null],
        [`Year: ${year}`, null, null, null],
        [null, null, null, null],
        ['Vendor', 'Number of Purchases', 'Total Amount', '% of Total Spending']
      ];
      
      const vendorSummary: Record<string, { 
        vendorName: string;
        purchaseCount: number;
        totalAmount: number;
      }> = {};
      
      yearlyPurchases.forEach(purchase => {
        if (!vendorSummary[purchase.VendorID]) {
          vendorSummary[purchase.VendorID] = {
            vendorName: purchase.VendorName,
            purchaseCount: 0,
            totalAmount: 0
          };
        }
        
        vendorSummary[purchase.VendorID].purchaseCount += 1;
        vendorSummary[purchase.VendorID].totalAmount += Number(purchase.Amount);
      });
      
      const totalVendorSpending = Object.values(vendorSummary).reduce((sum, data) => sum + data.totalAmount, 0);
      
      const topVendors = Object.entries(vendorSummary)
        .sort(([, a], [, b]) => b.totalAmount - a.totalAmount)
        .slice(0, 20);
      
      topVendors.forEach(([, data]) => {
        const percentOfTotal = (data.totalAmount / totalVendorSpending) * 100;
        
        topVendorsData.push([
          data.vendorName,
          data.purchaseCount.toString(),
          data.totalAmount.toString(),
          percentOfTotal.toString()
        ]);
      });
      
      const topVendorsWS = XLSX.utils.aoa_to_sheet(topVendorsData);
      
      setColumnWidths(topVendorsWS, [40, 20, 20, 20]);
      
      const topVendorsMerges = [
        ['A1', 'D1'],
        ['A3', 'D3']
      ];
      
      setMerges(topVendorsWS, topVendorsMerges);
      
      addBordersToWorksheet(topVendorsWS);
      styleHeaderRow(topVendorsWS, 0);
      styleHeaderRow(topVendorsWS, 4);
      
      for (let i = 6; i < topVendorsData.length; i++) {
        const totalAmountRef = XLSX.utils.encode_cell({ r: i, c: 2 });
        if (topVendorsWS[totalAmountRef]) {
          topVendorsWS[totalAmountRef].z = '#,##0.00';
        }
        
        const percentRef = XLSX.utils.encode_cell({ r: i, c: 3 });
        if (topVendorsWS[percentRef]) {
          topVendorsWS[percentRef].z = '0.00%';
        }
      }
      
      XLSX.utils.book_append_sheet(wb, topVendorsWS, 'Top Vendors');
      
      // --- TOP PRODUCTS WORKSHEET ---
      const topProductsData = [
        ['TOP PRODUCTS PURCHASED', null, null, null],
        [null, null, null, null],
        [`Year: ${year}`, null, null, null],
        [null, null, null, null],
        ['Product', 'Quantity Purchased', 'Total Cost', '% of Total Cost']
      ];
      
      const productSummary: Record<string, { 
        quantity: number; 
        cost: number;
      }> = {};
      
      Object.values(allPurchaseItems).forEach(itemList => {
        itemList.forEach(item => {
          if (!productSummary[item.Name]) {
            productSummary[item.Name] = {
              quantity: 0,
              cost: 0
            };
          }
          
          productSummary[item.Name].quantity += item.Quantity;
          productSummary[item.Name].cost += item.TotalPrice;
        });
      });
      
      const totalProductCost = Object.values(productSummary).reduce((sum, data) => sum + data.cost, 0);
      
      const topProducts = Object.entries(productSummary)
        .sort(([, a], [, b]) => b.cost - a.cost)
        .slice(0, 20);
      
      topProducts.forEach(([productName, data]) => {
        const percentOfTotal = (data.cost / totalProductCost) * 100;
        
        topProductsData.push([
          productName,
          data.quantity.toString(),
          data.cost.toString(),
          percentOfTotal.toString()
        ]);
      });
      
      const topProductsWS = XLSX.utils.aoa_to_sheet(topProductsData);
      
      setColumnWidths(topProductsWS, [40, 15, 15, 15]);
      
      const topProductsMerges = [
        ['A1', 'D1'],
        ['A3', 'D3']
      ];
      
      setMerges(topProductsWS, topProductsMerges);
      
      addBordersToWorksheet(topProductsWS);
      styleHeaderRow(topProductsWS, 0);
      styleHeaderRow(topProductsWS, 4);
      
      for (let i = 6; i < topProductsData.length; i++) {
        const costRef = XLSX.utils.encode_cell({ r: i, c: 2 });
        if (topProductsWS[costRef]) {
          topProductsWS[costRef].z = '#,##0.00';
        }
        
        const percentRef = XLSX.utils.encode_cell({ r: i, c: 3 });
        if (topProductsWS[percentRef]) {
          topProductsWS[percentRef].z = '0.00%';
        }
      }
      
      XLSX.utils.book_append_sheet(wb, topProductsWS, 'Top Products');
      
      XLSX.writeFile(wb, `Yearly_Purchase_Report_${year}.xlsx`);
    } catch (error) {
      console.error('Error generating yearly report:', error);
    } finally {
      setDownloadingYearly(false);
    }
  };

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

      const downloadLink = document.createElement('a');
      downloadLink.href = window.URL.createObjectURL(blob);
      downloadLink.download = `Purchase_${purchaseId}.xlsx`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
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

  const handleFilterChange = async () => {
    try {
      setLoading(true);
      const businessLineId = getBusinessLineID();

      const { startDate, endDate } = adjustDateRange(filters.dateRange);
      
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/purchases/history/${businessLineId}`,
        {
          params: {
            startDate,
            endDate,
            vendorId: filters.vendorId,
            paymentType: filters.paymentType
          }
        }
      );
      setPurchases(response.data);
    } catch (error) {
      console.error('Error applying filters:', error);
      setError('Failed to apply filters. Please try again.');
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

  const toggleInvoiceExpand = async (invoiceNumber: string) => {
    const newExpanded = new Set(expandedInvoices);
    
    if (newExpanded.has(invoiceNumber)) {
      newExpanded.delete(invoiceNumber);
    } else {
      const invoicePurchases = purchases.filter(p => p.InvoiceNumber === invoiceNumber);
      const firstPurchase = invoicePurchases[0];
      
      if (firstPurchase && !firstPurchase.items) {
        try {
          const response = await axios.get(
            `${process.env.NEXT_PUBLIC_API_URL}/purchases/${firstPurchase.PurchaseID}/items`
          );
          setPurchases(prev => prev.map(purchase => 
            purchase.InvoiceNumber === invoiceNumber
              ? { ...purchase, items: response.data }
              : purchase
          ));
        } catch (error) {
          console.error('Error fetching purchase items:', error);
          setError('Failed to fetch purchase items. Please try again.');
        }
      }
      newExpanded.add(invoiceNumber);
    }
    setExpandedInvoices(newExpanded);
  };

  const canDeletePurchase = (invoicePurchases: Purchase[]): boolean => {
    return !invoicePurchases.some(purchase => {
      if (purchase.PaymentMethod === 'CASH') return false;
      if (purchase.PaymentMethod === 'CREDIT') {
        return purchase.paymentDetails?.status === 'SETTLED';
      }
      return false;
    });
  };

  const filteredPurchases = selectedPaymentMethod === 'ALL' || !selectedPaymentMethod
    ? purchases
    : purchases.filter(purchase => purchase.PaymentMethod === selectedPaymentMethod);

  const groupedPurchases = _.groupBy(
    filteredPurchases.filter(purchase => 
      purchase.InvoiceNumber.toLowerCase().includes(filters.invoiceNumber.toLowerCase())
    ), 
    'InvoiceNumber'
  );

  return (
    <Card className="w-full shadow-none rounded-tl-none rounded-tr-none border-0">
      <CardContent className='mt-4'>
        {error && (
          <div className="bg-red-50 text-red-700 p-4 mb-6 rounded-lg border border-red-200">
            <p className="flex items-center gap-2">
              <span className="font-medium">Error:</span> {error}
            </p>
          </div>
        )}
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-wrap items-center gap-4">
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

            <Button 
              variant="outline"
              onClick={handleFilterChange}
            >
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
          </div>
          
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
              ) : Object.entries(groupedPurchases).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="h-8 w-8 text-gray-400" />
                      <p className="text-sm text-gray-500">No purchase data found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                Object.entries(groupedPurchases).map(([invoiceNumber, invoicePurchases]) => {
                  const firstPurchase = invoicePurchases[0];
                  const totalAmount = invoicePurchases.reduce((sum, purchase) => sum + Number(purchase.Amount), 0);
                  const isExpanded = expandedInvoices.has(invoiceNumber);
                  const purchaseId = firstPurchase.PurchaseID;
                  const canDelete = canDeletePurchase(invoicePurchases);

                  return (
                    <React.Fragment key={invoiceNumber}>
                      <TableRow 
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => toggleInvoiceExpand(invoiceNumber)}
                      >
                        <TableCell className="flex items-center gap-2">
                          {isExpanded ? 
                            <ChevronDown className="h-4 w-4 text-gray-500" /> : 
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          }
                          <span className="font-medium">{invoiceNumber}</span>
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {new Date(firstPurchase.PurchaseDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-gray-600">{firstPurchase.VendorName}</TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(totalAmount)}
                        </TableCell>
                        <TableCell>
                          {invoicePurchases.map(purchase => {
                            const status = getPaymentStatus(purchase);
                            return (
                              <Badge 
                                key={purchase.PaymentID}
                                className={`${status.className} px-2 py-1 mr-2 mb-1`}
                              >
                                {`${purchase.PaymentMethod} - ${status.text}`}
                              </Badge>
                            );
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadExcel(purchaseId);
                              }}
                              className="hover:bg-gray-100"
                              title="Download Excel Report"
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePurchase(purchaseId, invoiceNumber);
                              }}
                              disabled={!canDelete}
                              className={
                                canDelete 
                                  ? "hover:bg-red-100 text-red-600 hover:text-red-700" 
                                  : "opacity-50 cursor-not-allowed"
                              }
                              title={
                                canDelete 
                                  ? "Delete Purchase" 
                                  : "Cannot delete purchase with settled payments"
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="bg-gray-50">
                          <TableCell colSpan={6} className="p-0">
                            <div className="p-6">
                              {/* Payment Details Section */}
                              <div className="mb-4">
                                <h4 className="text-sm font-semibold text-gray-900 mb-2">Payment Details</h4>
                                <div className="bg-white rounded-lg border">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-gray-50">
                                        <TableCell className="font-medium">Payment Method</TableCell>
                                        <TableCell className="font-medium">Amount</TableCell>
                                        <TableCell className="font-medium">Status</TableCell>
                                        <TableCell className="font-medium">Details</TableCell>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {invoicePurchases.map(purchase => {
                                        const status = getPaymentStatus(purchase);
                                        return (
                                          <TableRow key={purchase.PaymentID}>
                                            <TableCell>{purchase.PaymentMethod}</TableCell>
                                            <TableCell>{formatCurrency(purchase.Amount)}</TableCell>
                                            <TableCell>
                                              <Badge className={status.className}>
                                                {status.text}
                                              </Badge>
                                            </TableCell>
                                            <TableCell>
                                              {purchase.PaymentMethod === 'CREDIT' && purchase.paymentDetails && purchase.paymentDetails.dueDate && (
                                                <>Due: {new Date(purchase.paymentDetails.dueDate).toLocaleDateString()}</>
                                              )}
                                              {purchase.PaymentMethod === 'CASH' && 'Paid in Cash'}
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>

                              {/* Purchase Items Section */}
                              <div>
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
                                      {firstPurchase.items?.map((item, itemIndex) => (
                                        <TableRow key={`${invoiceNumber}-item-${item.ProductID}-${itemIndex}`}>
                                          <TableCell>{item.Name}</TableCell>
                                          <TableCell>{item.Quantity}</TableCell>
                                          <TableCell>{formatCurrency(item.UnitPrice)}</TableCell>
                                          <TableCell className="font-medium">
                                            {formatCurrency(item.TotalPrice)}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                      {firstPurchase.items && (
                                        <TableRow>
                                          <TableCell colSpan={3} className="text-right font-semibold">
                                            Subtotal:
                                          </TableCell>
                                          <TableCell className="font-semibold">
                                            {formatCurrency(
                                              firstPurchase.items.reduce((sum, item) => sum + Number(item.TotalPrice), 0)
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      )}
                                    </TableBody>
                                  </Table>
                                </div>
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

        <Dialog open={deleteDialog.open} onOpenChange={(open) => !deleteDialog.loading && setDeleteDialog(prev => ({ ...prev, open }))}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Delete Purchase
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This action cannot be undone. This will permanently delete the purchase record and reverse all associated stock movements.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Are you sure you want to delete this purchase?
                </p>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm">
                    <span className="font-medium">Invoice Number:</span> {deleteDialog.invoiceNumber}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Purchase ID:</span> {deleteDialog.purchaseId}
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteDialog(prev => ({ ...prev, open: false }))}
                disabled={deleteDialog.loading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={confirmDeletePurchase}
                disabled={deleteDialog.loading}
              >
                {deleteDialog.loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Purchase
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default PurchaseReportsTable;