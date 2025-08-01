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
import { Loader2, Search, RefreshCw, Download, Filter, FileDown, Trash2, AlertTriangle } from "lucide-react";
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
import * as XLSX from 'xlsx';
import { MonthYearDialog, YearDialog } from './MonthYearSelectors';

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

// Delete confirmation dialog state
interface DeleteConfirmState {
  isOpen: boolean;
  paymentToDelete: PaymentStatusChange | null;
}

const PaymentStatusHistory: React.FC = () => {
  const { toast } = useToast();
  const { user, getBusinessLineID } = useAuth();
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
  const [monthYearDialogOpen, setMonthYearDialogOpen] = useState(false);
  const [yearDialogOpen, setYearDialogOpen] = useState(false);
  const [downloadingMonthly, setDownloadingMonthly] = useState(false);
  const [downloadingYearly, setDownloadingYearly] = useState(false);
  const [downloadingCurrent, setDownloadingCurrent] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({
    isOpen: false,
    paymentToDelete: null
  });
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  
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
    
    // Use the imported function from the adapter
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
  }, [fetchCustomers, fetchStatusChanges]);

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

  const exportCurrentView = async (): Promise<void> => {
    try {
      setDownloadingCurrent(true);
      
      const wb = XLSX.utils.book_new();
      
      // Create data array for Excel
      const excelData = [
        ['PAYMENT STATUS CHANGES REPORT', null, null, null, null, null, null],
        [null, null, null, null, null, null, null],
        [`Generated on: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, null, null, null, null, null, null],
        [`Filter: ${activeTab === 'all' ? 'All Changes' : activeTab.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`, null, null, null, null, null, null],
        [null, null, null, null, null, null, null],
        ['Date', 'Customer', 'Invoice', 'Type', 'Status Change', 'Amount', 'Details']
      ];
      
      // Add data rows
      filteredChanges.forEach(change => {
        let details = '';
        
        if (change.paymentMethod === 'CHEQUE') {
          const detailParts = [];
          if (change.details?.chequeNumber) detailParts.push(`Cheque: ${change.details.chequeNumber}`);
          if (change.details?.bank) detailParts.push(`Bank: ${change.details.bank}`);
          if (change.details?.realizeDate) detailParts.push(`Realize Date: ${formatDate(change.details.realizeDate)}`);
          if (change.details?.bouncedDate) detailParts.push(`Bounced Date: ${formatDate(change.details.bouncedDate)}`);
          details = detailParts.join(' | ');
        } else if (change.paymentMethod === 'CREDIT') {
          const detailParts = [];
          if (change.details?.dueDate) detailParts.push(`Due Date: ${formatDate(change.details.dueDate)}`);
          if (change.details?.settledDate) detailParts.push(`Settled Date: ${formatDate(change.details.settledDate)}`);
          details = detailParts.join(' | ');
        }
        
        excelData.push([
          formatDate(change.date),
          change.customerName,
          change.invoiceId || `INV-${change.saleId}`,
          change.paymentMethod,
          `${change.fromStatus} → ${change.toStatus}`,
          change.amount.toString(),
          details || '-'
        ]);
      });
      
      // Add summary row
      excelData.push([null, null, null, null, null, null, null]);
      excelData.push([`Total Records: ${filteredChanges.length}`, null, null, null, null, null, null]);
      
      const ws = XLSX.utils.aoa_to_sheet(excelData);
      
      // Set column widths
      setColumnWidths(ws, [15, 30, 15, 10, 25, 15, 40]);
      
      // Apply merges
      const merges = [
        ['A1', 'G1'], // Title
        ['A3', 'G3'], // Date
        ['A4', 'G4'], // Filter
        ['A' + (excelData.length), 'G' + (excelData.length)] // Total
      ];
      setMerges(ws, merges);
      
      // Apply styles
      addBordersToWorksheet(ws);
      styleHeaderRow(ws, 0); // Title
      styleHeaderRow(ws, 5); // Headers
      
      // Format currency columns
      for (let i = 7; i < excelData.length - 2; i++) {
        const amountRef = XLSX.utils.encode_cell({ r: i, c: 5 });
        if (ws[amountRef]) {
          ws[amountRef].z = '#,##0.00';
        }
      }
      
      XLSX.utils.book_append_sheet(wb, ws, 'Payment Status Changes');
      
      const fileName = `Payment_Status_Changes_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast({
        title: "Export Complete",
        description: `Downloaded ${fileName}`,
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloadingCurrent(false);
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
      
      // Fetch data for the selected month
      const businessLineId = getBusinessLineID();
      const response = await api.get(`/payments/history/${businessLineId}`, {
        params: {
          startDate: format(firstDayOfMonth, 'yyyy-MM-dd'),
          endDate: format(lastDayOfMonth, 'yyyy-MM-dd')
        }
      });
      
      const monthlyChanges = transformPaymentsToStatusChanges(response.data.payments || []);
      
      const wb = XLSX.utils.book_new();
      
      // --- SUMMARY WORKSHEET ---
      const summaryData = [
        ['MONTHLY PAYMENT STATUS REPORT', null, null, null, null, null],
        [null, null, null, null, null, null],
        [`Period: ${format(firstDayOfMonth, 'MMMM yyyy')}`, null, null, null, null, null],
        [null, null, null, null, null, null],
        ['Status Type', 'Count', 'Total Amount', 'Average Amount', '% of Total']
      ];
      
      // Group by status change type
      const statusSummary: Record<string, { count: number; amount: number }> = {
        'Credit Settled': { count: 0, amount: 0 },
        'Cheque Realized': { count: 0, amount: 0 },
        'Cheque Bounced': { count: 0, amount: 0 }
      };
      
      monthlyChanges.forEach(change => {
        if (change.paymentMethod === 'CREDIT' && change.toStatus === 'SETTLED') {
          statusSummary['Credit Settled'].count += 1;
          statusSummary['Credit Settled'].amount += Number(change.amount);
        } else if (change.paymentMethod === 'CHEQUE' && change.toStatus === 'REALIZED') {
          statusSummary['Cheque Realized'].count += 1;
          statusSummary['Cheque Realized'].amount += Number(change.amount);
        } else if (change.paymentMethod === 'CHEQUE' && change.toStatus === 'BOUNCED') {
          statusSummary['Cheque Bounced'].count += 1;
          statusSummary['Cheque Bounced'].amount += Number(change.amount);
        }
      });
      
      const totalAmount = Object.values(statusSummary).reduce((sum, data) => sum + data.amount, 0);
      const totalCount = Object.values(statusSummary).reduce((sum, data) => sum + data.count, 0);
      
      Object.entries(statusSummary).forEach(([status, data]) => {
        const avgAmount = data.count > 0 ? data.amount / data.count : 0;
        const percentage = totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0;
        
        summaryData.push([
          status,
          data.count.toString(),
          data.amount.toString(),
          avgAmount.toString(),
          percentage.toString()
        ]);
      });
      
      summaryData.push([null, null, null, null, null]);
      summaryData.push(['TOTAL', totalCount.toString(), totalAmount.toString(), null, '100']);
      
      const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
      
      setColumnWidths(summaryWS, [25, 15, 20, 20, 15]);
      
      const summaryMerges = [
        ['A1', 'E1'],
        ['A3', 'E3']
      ];
      
      setMerges(summaryWS, summaryMerges);
      
      addBordersToWorksheet(summaryWS);
      styleHeaderRow(summaryWS, 0);
      styleHeaderRow(summaryWS, 4);
      
      // Format currency and percentage columns
      for (let i = 6; i < summaryData.length - 2; i++) {
        const amountRef = XLSX.utils.encode_cell({ r: i, c: 2 });
        if (summaryWS[amountRef]) {
          summaryWS[amountRef].z = '#,##0.00';
        }
        
        const avgRef = XLSX.utils.encode_cell({ r: i, c: 3 });
        if (summaryWS[avgRef]) {
          summaryWS[avgRef].z = '#,##0.00';
        }
        
        const percentRef = XLSX.utils.encode_cell({ r: i, c: 4 });
        if (summaryWS[percentRef]) {
          summaryWS[percentRef].z = '0.00%';
        }
      }
      
      const totalAmountRef = XLSX.utils.encode_cell({ r: summaryData.length - 1, c: 2 });
      if (summaryWS[totalAmountRef]) {
        summaryWS[totalAmountRef].z = '#,##0.00';
      }
      
      XLSX.utils.book_append_sheet(wb, summaryWS, 'Summary');
      
      // --- CUSTOMER ANALYSIS WORKSHEET ---
      const customerData = [
        ['CUSTOMER PAYMENT PATTERNS', null, null, null, null],
        [null, null, null, null, null],
        [`Period: ${format(firstDayOfMonth, 'MMMM yyyy')}`, null, null, null, null],
        [null, null, null, null, null],
        ['Customer', 'Credits Settled', 'Cheques Realized', 'Cheques Bounced', 'Total Changes']
      ];
      
      // Group by customer
      const customerSummary: Record<string, {
        name: string;
        creditsSettled: number;
        chequesRealized: number;
        chequesBounced: number;
      }> = {};
      
      monthlyChanges.forEach(change => {
        if (!customerSummary[change.customerId]) {
          customerSummary[change.customerId] = {
            name: change.customerName,
            creditsSettled: 0,
            chequesRealized: 0,
            chequesBounced: 0
          };
        }
        
        if (change.paymentMethod === 'CREDIT' && change.toStatus === 'SETTLED') {
          customerSummary[change.customerId].creditsSettled += 1;
        } else if (change.paymentMethod === 'CHEQUE' && change.toStatus === 'REALIZED') {
          customerSummary[change.customerId].chequesRealized += 1;
        } else if (change.paymentMethod === 'CHEQUE' && change.toStatus === 'BOUNCED') {
          customerSummary[change.customerId].chequesBounced += 1;
        }
      });
      
      Object.values(customerSummary).forEach(data => {
        const total = data.creditsSettled + data.chequesRealized + data.chequesBounced;
        
        customerData.push([
          data.name,
          data.creditsSettled.toString(),
          data.chequesRealized.toString(),
          data.chequesBounced.toString(),
          total.toString()
        ]);
      });
      
      const customerWS = XLSX.utils.aoa_to_sheet(customerData);
      
      setColumnWidths(customerWS, [40, 15, 15, 15, 15]);
      
      const customerMerges = [
        ['A1', 'E1'],
        ['A3', 'E3']
      ];
      
      setMerges(customerWS, customerMerges);
      
      addBordersToWorksheet(customerWS);
      styleHeaderRow(customerWS, 0);
      styleHeaderRow(customerWS, 4);
      
      XLSX.utils.book_append_sheet(wb, customerWS, 'Customer Analysis');
      
      const currentMonthStr = format(firstDayOfMonth, 'yyyy-MM');
      XLSX.writeFile(wb, `Monthly_Payment_Status_Report_${currentMonthStr}.xlsx`);
      
      toast({
        title: "Report Generated",
        description: "Monthly payment status report downloaded successfully.",
      });
    } catch (error) {
      console.error('Error generating monthly report:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate monthly report. Please try again.",
        variant: "destructive",
      });
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
      
      // Fetch data for the selected year
      const businessLineId = getBusinessLineID();
      const response = await api.get(`/payments/history/${businessLineId}`, {
        params: {
          startDate: format(firstDayOfYear, 'yyyy-MM-dd'),
          endDate: format(lastDayOfYear, 'yyyy-MM-dd')
        }
      });
      
      const yearlyChanges = transformPaymentsToStatusChanges(response.data.payments || []);
      
      const wb = XLSX.utils.book_new();
      
      // --- MONTHLY BREAKDOWN WORKSHEET ---
      const monthlyBreakdownData = [
        ['YEARLY PAYMENT STATUS REPORT - MONTHLY BREAKDOWN', null, null, null, null],
        [null, null, null, null, null],
        [`Year: ${year}`, null, null, null, null],
        [null, null, null, null, null],
        ['Month', 'Credits Settled', 'Cheques Realized', 'Cheques Bounced', 'Total Changes']
      ];
      
      // Initialize monthly data
      const monthlyData: Record<number, {
        creditsSettled: number;
        chequesRealized: number;
        chequesBounced: number;
      }> = {};
      
      for (let month = 0; month < 12; month++) {
        monthlyData[month] = {
          creditsSettled: 0,
          chequesRealized: 0,
          chequesBounced: 0
        };
      }
      
      // Populate with actual data
      yearlyChanges.forEach(change => {
        const changeDate = new Date(change.date);
        const month = changeDate.getMonth();
        
        if (change.paymentMethod === 'CREDIT' && change.toStatus === 'SETTLED') {
          monthlyData[month].creditsSettled += 1;
        } else if (change.paymentMethod === 'CHEQUE' && change.toStatus === 'REALIZED') {
          monthlyData[month].chequesRealized += 1;
        } else if (change.paymentMethod === 'CHEQUE' && change.toStatus === 'BOUNCED') {
          monthlyData[month].chequesBounced += 1;
        }
      });
      
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June', 
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      
      let totalCreditsSettled = 0;
      let totalChequesRealized = 0;
      let totalChequesBounced = 0;
      
      monthNames.forEach((monthName, index) => {
        const data = monthlyData[index];
        const total = data.creditsSettled + data.chequesRealized + data.chequesBounced;
        
        totalCreditsSettled += data.creditsSettled;
        totalChequesRealized += data.chequesRealized;
        totalChequesBounced += data.chequesBounced;
        
        monthlyBreakdownData.push([
          monthName,
          data.creditsSettled.toString(),
          data.chequesRealized.toString(),
          data.chequesBounced.toString(),
          total.toString()
        ]);
      });
      
      const grandTotal = totalCreditsSettled + totalChequesRealized + totalChequesBounced;
      monthlyBreakdownData.push([null, null, null, null, null]);
      monthlyBreakdownData.push([
        'TOTAL',
        totalCreditsSettled.toString(),
        totalChequesRealized.toString(),
        totalChequesBounced.toString(),
        grandTotal.toString()
      ]);
      
      const monthlyBreakdownWS = XLSX.utils.aoa_to_sheet(monthlyBreakdownData);
      
      setColumnWidths(monthlyBreakdownWS, [15, 15, 15, 15, 15]);
      
      const monthlyMerges = [
        ['A1', 'E1'],
        ['A3', 'E3']
      ];
      
      setMerges(monthlyBreakdownWS, monthlyMerges);
      
      addBordersToWorksheet(monthlyBreakdownWS);
      styleHeaderRow(monthlyBreakdownWS, 0);
      styleHeaderRow(monthlyBreakdownWS, 4);
      
      XLSX.utils.book_append_sheet(wb, monthlyBreakdownWS, 'Monthly Breakdown');
      
      // --- TOP CUSTOMERS BY ACTIVITY WORKSHEET ---
      const topCustomersData = [
        ['TOP CUSTOMERS BY PAYMENT ACTIVITY', null, null, null, null, null],
        [null, null, null, null, null, null],
        [`Year: ${year}`, null, null, null, null, null],
        [null, null, null, null, null, null],
        ['Customer', 'Total Changes', 'Credits Settled', 'Cheques Realized', 'Cheques Bounced', 'Bounce Rate %']
      ];
      
      // Group by customer for the year
      const customerYearlyData: Record<string, {
        name: string;
        creditsSettled: number;
        chequesRealized: number;
        chequesBounced: number;
        totalCheques: number;
      }> = {};
      
      yearlyChanges.forEach(change => {
        if (!customerYearlyData[change.customerId]) {
          customerYearlyData[change.customerId] = {
            name: change.customerName,
            creditsSettled: 0,
            chequesRealized: 0,
            chequesBounced: 0,
            totalCheques: 0
          };
        }
        
        if (change.paymentMethod === 'CREDIT' && change.toStatus === 'SETTLED') {
          customerYearlyData[change.customerId].creditsSettled += 1;
        } else if (change.paymentMethod === 'CHEQUE' && change.toStatus === 'REALIZED') {
          customerYearlyData[change.customerId].chequesRealized += 1;
          customerYearlyData[change.customerId].totalCheques += 1;
        } else if (change.paymentMethod === 'CHEQUE' && change.toStatus === 'BOUNCED') {
          customerYearlyData[change.customerId].chequesBounced += 1;
          customerYearlyData[change.customerId].totalCheques += 1;
        }
      });
      
      // Sort customers by total activity and get top 20
      const topCustomers = Object.entries(customerYearlyData)
        .map(([, data]) => ({
          ...data,
          totalChanges: data.creditsSettled + data.chequesRealized + data.chequesBounced,
          bounceRate: data.totalCheques > 0 ? (data.chequesBounced / data.totalCheques) * 100 : 0
        }))
        .sort((a, b) => b.totalChanges - a.totalChanges)
        .slice(0, 20);
      
      topCustomers.forEach(customer => {
        topCustomersData.push([
          customer.name,
          customer.totalChanges.toString(),
          customer.creditsSettled.toString(),
          customer.chequesRealized.toString(),
          customer.chequesBounced.toString(),
          customer.bounceRate.toString()
        ]);
      });
      
      const topCustomersWS = XLSX.utils.aoa_to_sheet(topCustomersData);
      
      setColumnWidths(topCustomersWS, [40, 15, 15, 15, 15, 15]);
      
      const topCustomersMerges = [
        ['A1', 'F1'],
        ['A3', 'F3']
      ];
      
      setMerges(topCustomersWS, topCustomersMerges);
      
      addBordersToWorksheet(topCustomersWS);
      styleHeaderRow(topCustomersWS, 0);
      styleHeaderRow(topCustomersWS, 4);
      
      // Format percentage column
      for (let i = 6; i < topCustomersData.length; i++) {
        const bounceRateRef = XLSX.utils.encode_cell({ r: i, c: 5 });
        if (topCustomersWS[bounceRateRef]) {
          topCustomersWS[bounceRateRef].z = '0.00%';
        }
      }
      
      XLSX.utils.book_append_sheet(wb, topCustomersWS, 'Top Customers');
      
      // --- PAYMENT PERFORMANCE METRICS WORKSHEET ---
      const metricsData = [
        ['PAYMENT PERFORMANCE METRICS', null, null, null],
        [null, null, null, null],
        [`Year: ${year}`, null, null, null],
        [null, null, null, null],
        ['Metric', 'Count', 'Amount', 'Percentage']
      ];
      
      // Calculate metrics
      const creditChanges = yearlyChanges.filter(c => c.paymentMethod === 'CREDIT');
      const chequeChanges = yearlyChanges.filter(c => c.paymentMethod === 'CHEQUE');
      
      const creditSettled = creditChanges.filter(c => c.toStatus === 'SETTLED');
      const chequeRealized = chequeChanges.filter(c => c.toStatus === 'REALIZED');
      const chequeBounced = chequeChanges.filter(c => c.toStatus === 'BOUNCED');
      
      const totalCreditAmount = creditChanges.reduce((sum, c) => sum + Number(c.amount), 0);
      const totalChequeAmount = chequeChanges.reduce((sum, c) => sum + Number(c.amount), 0);
      
      const creditSettledAmount = creditSettled.reduce((sum, c) => sum + Number(c.amount), 0);
      const chequeRealizedAmount = chequeRealized.reduce((sum, c) => sum + Number(c.amount), 0);
      const chequeBouncedAmount = chequeBounced.reduce((sum, c) => sum + Number(c.amount), 0);
      
      metricsData.push([null, null, null, null]);
      metricsData.push(['CREDIT PAYMENTS', null, null, null]);
      metricsData.push([
        'Total Credits',
        creditChanges.length.toString(),
        totalCreditAmount.toString(),
        '100.00'
      ]);
      metricsData.push([
        'Credits Settled',
        creditSettled.length.toString(),
        creditSettledAmount.toString(),
        creditChanges.length > 0 ? ((creditSettled.length / creditChanges.length) * 100).toString() : '0'
      ]);
      
      metricsData.push([null, null, null, null]);
      metricsData.push(['CHEQUE PAYMENTS', null, null, null]);
      metricsData.push([
        'Total Cheques',
        chequeChanges.length.toString(),
        totalChequeAmount.toString(),
        '100.00'
      ]);
      metricsData.push([
        'Cheques Realized',
        chequeRealized.length.toString(),
        chequeRealizedAmount.toString(),
        chequeChanges.length > 0 ? ((chequeRealized.length / chequeChanges.length) * 100).toString() : '0'
      ]);
      metricsData.push([
        'Cheques Bounced',
        chequeBounced.length.toString(),
        chequeBouncedAmount.toString(),
        chequeChanges.length > 0 ? ((chequeBounced.length / chequeChanges.length) * 100).toString() : '0'
      ]);
      
      const metricsWS = XLSX.utils.aoa_to_sheet(metricsData);
      
      setColumnWidths(metricsWS, [25, 15, 20, 15]);
      
      const metricsMerges = [
        ['A1', 'D1'],
        ['A3', 'D3'],
        ['A7', 'D7'],
        ['A11', 'D11']
      ];
      
      setMerges(metricsWS, metricsMerges);
      
      addBordersToWorksheet(metricsWS);
      styleHeaderRow(metricsWS, 0);
      styleHeaderRow(metricsWS, 4);
      styleHeaderRow(metricsWS, 6);
      styleHeaderRow(metricsWS, 10);
      
      // Format amount and percentage columns
      for (let i = 8; i <= 14; i++) {
        if (i === 10 || i === 6) continue; // Skip header rows
        
        const amountRef = XLSX.utils.encode_cell({ r: i, c: 2 });
        if (metricsWS[amountRef]) {
          metricsWS[amountRef].z = '#,##0.00';
        }
        
        const percentRef = XLSX.utils.encode_cell({ r: i, c: 3 });
        if (metricsWS[percentRef]) {
          metricsWS[percentRef].z = '0.00%';
        }
      }
      
      XLSX.utils.book_append_sheet(wb, metricsWS, 'Performance Metrics');
      
      XLSX.writeFile(wb, `Yearly_Payment_Status_Report_${year}.xlsx`);
      
      toast({
        title: "Report Generated",
        description: "Yearly payment status report downloaded successfully.",
      });
    } catch (error) {
      console.error('Error generating yearly report:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate yearly report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloadingYearly(false);
    }
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

const handleDeleteStatusChange = async (change: PaymentStatusChange) => {
  try {
      setDeletingPaymentId(change.id.toString());
      let endpoint: string;
      let paymentId: string | number;

      console.log('Delete request for change:', {
        id: change.id,
        paymentMethod: change.paymentMethod,
        chequePaymentId: change.chequePaymentId,
        creditPaymentId: change.creditPaymentId,
        paymentId: change.paymentId
      });

      if (change.paymentMethod === 'CHEQUE') {
        // Try to use chequePaymentId first, then fall back to paymentId
        if (change.chequePaymentId && change.chequePaymentId !== null && change.chequePaymentId !== undefined) {
          paymentId = change.chequePaymentId;
          endpoint = `/payments/cheque/${paymentId}`;
        } else if (change.paymentId) {
          // Fallback: use the general paymentId
          console.warn('Using paymentId as fallback for cheque deletion');
          paymentId = change.paymentId;
          endpoint = `/payments/cheque/${paymentId}`;
        } else {
          throw new Error('No valid payment ID found for cheque deletion');
        }
      } else if (change.paymentMethod === 'CREDIT') {
        // Try to use creditPaymentId first, then fall back to paymentId
        if (change.creditPaymentId && change.creditPaymentId !== null && change.creditPaymentId !== undefined) {
          paymentId = change.creditPaymentId;
          endpoint = `/payments/credit/${paymentId}`;
        } else if (change.paymentId) {
          // Fallback: use the general paymentId
          console.warn('Using paymentId as fallback for credit deletion');
          paymentId = change.paymentId;
          endpoint = `/payments/credit/${paymentId}`;
        } else {
          throw new Error('No valid payment ID found for credit deletion');
        }
      } else {
        throw new Error('Unsupported payment method for deletion');
      }

      console.log(`Attempting to delete payment via: ${endpoint}`);
      
      await api.delete(endpoint);
      
      // Refresh the data
      await fetchStatusChanges();
      
      toast({
        title: "Success",
        description: `${change.paymentMethod === 'CHEQUE' ? 'Cheque' : 'Credit'} payment deleted successfully.`,
      });
    } catch (error) {
      console.error('Error deleting payment:', error);
      
      // Provide more specific error messages
      let errorMessage = "Failed to delete payment. Please try again.";
      
      if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: string }).message === "string"
      ) {
        if ((error as { message: string }).message.includes('No valid payment ID')) {
          errorMessage = "Cannot delete payment: Missing required payment ID. Please refresh and try again.";
        }
      } else if (
        typeof error === "object" &&
        error !== null &&
        "response" in error
      ) {
        const axiosError = error as {
          response?: {
            status?: number;
            data?: { message?: string };
          };
        };
        if (axiosError.response?.status === 404) {
          errorMessage = "Payment not found. It may have already been deleted.";
        } else if (axiosError.response?.status === 403) {
          errorMessage = "Access denied. You don't have permission to delete this payment.";
        } else if (axiosError.response?.data?.message) {
          errorMessage = axiosError.response.data.message;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setDeletingPaymentId(null);
    }
  };

  const confirmDeleteStatusChange = (change: PaymentStatusChange) => {
    const isRealized = change.toStatus === 'REALIZED';
    const isSettled = change.toStatus === 'SETTLED';
    
    if (!isRealized && !isSettled) {
      toast({
        title: "Cannot Delete",
        description: "Only realized cheques and settled credits can be deleted.",
        variant: "destructive",
      });
      return;
    }

    setDeleteConfirm({
      isOpen: true,
      paymentToDelete: change
    });
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirm.paymentToDelete) {
      await handleDeleteStatusChange(deleteConfirm.paymentToDelete);
    }
    setDeleteConfirm({ isOpen: false, paymentToDelete: null });
  };

  const handleCancelDelete = () => {
    setDeleteConfirm({ isOpen: false, paymentToDelete: null });
  };

  return (
    <>
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
            
            <div className="flex justify-between">
              <div className="flex gap-2">
                <Button variant="outline" onClick={applyDateFilters}>
                  <Filter className="h-4 w-4 mr-2" />
                  Apply Filter
                </Button>
                <Button variant="outline" onClick={handleRefresh}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button 
                  variant="outline" 
                  onClick={exportCurrentView}
                  disabled={downloadingCurrent}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {downloadingCurrent ? 'Exporting...' : 'Export Current View'}
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
                        {user?.userType !== 'management' && (<TableHead className="font-medium text-center">Actions</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredChanges.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={user?.userType === 'management' ? 7 : 8} className="h-24 text-center">
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
                            <TableCell>
                              {user?.userType !== 'management' && (
                              <div className="flex justify-center">
                                {(change.toStatus === 'REALIZED' || change.toStatus === 'SETTLED') && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => confirmDeleteStatusChange(change)}
                                    className="hover:bg-red-50 hover:text-red-600"
                                    title={`Delete ${change.paymentMethod === 'CHEQUE' ? 'Cheque Realization' : 'Credit Settlement'}`}
                                    disabled={deletingPaymentId === change.id}
                                  >
                                    {deletingPaymentId === change.id ? (
                                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </div>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirm.isOpen} onOpenChange={() => setDeleteConfirm({ isOpen: false, paymentToDelete: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete {deleteConfirm.paymentToDelete?.paymentMethod === 'CHEQUE' ? 'Cheque' : 'Credit'} Payment
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  Are you sure you want to delete this {deleteConfirm.paymentToDelete?.paymentMethod === 'CHEQUE' ? 'cheque' : 'credit'} payment? 
                  This action will also delete the associated sale and restore product quantities to inventory.
                </p>
                {deleteConfirm.paymentToDelete && (
                  <div className="mt-3 p-3 bg-gray-50 rounded">
                    <p><strong>Customer:</strong> {deleteConfirm.paymentToDelete.customerName}</p>
                    <p><strong>Amount:</strong> {formatCurrency(deleteConfirm.paymentToDelete.amount)}</p>
                    <p><strong>Invoice:</strong> {deleteConfirm.paymentToDelete.invoiceId || `INV-${deleteConfirm.paymentToDelete.saleId}`}</p>
                    <p><strong>Status:</strong> {deleteConfirm.paymentToDelete.toStatus}</p>
                    {deleteConfirm.paymentToDelete.paymentMethod === 'CHEQUE' && deleteConfirm.paymentToDelete.details?.chequeNumber && (
                      <>
                        <p><strong>Cheque #:</strong> {deleteConfirm.paymentToDelete.details.chequeNumber}</p>
                        {deleteConfirm.paymentToDelete.details.bank && (
                          <p><strong>Bank:</strong> {deleteConfirm.paymentToDelete.details.bank}</p>
                        )}
                      </>
                    )}
                    {deleteConfirm.paymentToDelete.paymentMethod === 'CREDIT' && deleteConfirm.paymentToDelete.details?.dueDate && (
                      <p><strong>Due Date:</strong> {formatDate(deleteConfirm.paymentToDelete.details.dueDate)}</p>
                    )}
                  </div>
                )}
                <p className="mt-3 text-sm text-orange-600">
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
            <AlertDialogCancel onClick={handleCancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deletingPaymentId !== null}
            >
              {deletingPaymentId !== null ? 'Deleting...' : 'Delete Payment & Sale'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PaymentStatusHistory;