import React, { useState, useEffect } from 'react';
import { FileDown, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger, } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import * as XLSX from 'xlsx';
import { MonthYearDialog, YearDialog } from './MonthYearSelectors';
import { useToast } from '@/hooks/use-toast';

// Interfaces
interface Product {
  ProductID: number;
  Name: string;
  CurrentQTY: number;
  MinimumQTY: number;
  AverageCost?: number;
  LastUpdated?: string;
  BusinessLineID: number;
  TotalStock?: number;
  OldestStock?: string;
  Value?: number;
  Status?: 'Out of Stock' | 'Low Stock' | 'In Stock';
}

interface MovementDetails {
  vendor?: string;
  customer?: string;
  invoiceNumber?: string;
}

interface StockMovement {
  MovementID: number;
  ProductID: number;
  ProductName?: string;
  BusinessLineID: number;
  ReferenceID: string;
  Direction: 'IN' | 'OUT';
  Quantity: number;
  Date: string;
  Note?: string;
  CreatedBy: string;
  UnitCost?: number;
  BatchID?: number;  
  movementType?: 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'RETURN';
  movementLabel?: string;
  referenceNumber?: string;
  details?: MovementDetails;
}

interface RunningBalanceItem extends StockMovement {
  BalanceBefore: number;
  QuantityChange: number;
  BalanceAfter: number;
}

interface RunningBalanceResponse {
  initialBalance: number;
  movements: RunningBalanceItem[];
  finalBalance: number;
}

interface InventoryReportProps {
  businessLineId: number;
  initialDate?: Date;
}

const InventoryReport: React.FC<InventoryReportProps> = ({ 
  businessLineId,
  initialDate = new Date()
}) => {
  // State management
  const { toast } = useToast();
  const [asOfDate, setAsOfDate] = useState<Date>(initialDate);
  const [dateOpen, setDateOpen] = useState<boolean>(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [, setRunningBalance] = useState<RunningBalanceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [movementLoading, setMovementLoading] = useState<boolean>(false);
  const [, setBalanceLoading] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [startDateOpen, setStartDateOpen] = useState<boolean>(false);
  const [endDateOpen, setEndDateOpen] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [movementType, setMovementType] = useState<string>('all');
  const [totalItems, setTotalItems] = useState<number>(0);
  const [, setTotalValue] = useState<number>(0);
  const [lowStockItems, setLowStockItems] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [monthYearDialogOpen, setMonthYearDialogOpen] = useState(false);
  const [yearDialogOpen, setYearDialogOpen] = useState(false);
  const [downloadingMonthly, setDownloadingMonthly] = useState(false);
  const [downloadingYearly, setDownloadingYearly] = useState(false);
  const [downloadingCurrent, setDownloadingCurrent] = useState(false);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;    
    const isToday = date.toDateString() === new Date().toDateString();
    
    if (isToday) {
      setAsOfDate(new Date());
    } else {
      const newDate = new Date(date);
      newDate.setHours(23, 59, 59, 999);
      setAsOfDate(newDate);
    }
    
    setDateOpen(false);
  };

  const handleToDateSelect = (date: Date | undefined) => {
    if (!date) return;
  
    const isToday = date.toDateString() === new Date().toDateString();
  
    if (isToday) {
      setEndDate(new Date());
    } else {
      const newDate = new Date(date);
      newDate.setHours(23, 59, 59, 999);
      setEndDate(newDate);
    }
  
    setEndDateOpen(false);
  };
  
  useEffect(() => {
    const fetchInventoryData = async () => {
      if (asOfDate > new Date()) {
        setError('Cannot fetch inventory for future dates. Please select a date today or earlier.');
        setLoading(false);
        return; 
      }
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/inventory/levels/${businessLineId}?asOfDate=${asOfDate.toISOString()}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json() as Product[];
        setProducts(data);
        setTotalItems(data.length);
        setTotalValue(data.reduce((sum, item) => sum + (item.Value || item.CurrentQTY * (item.AverageCost || 0)), 0));
        setLowStockItems(data.filter(item => item.Status === 'Low Stock' || 
          (item.CurrentQTY < item.MinimumQTY)).length);
      } catch (error) {
        console.error('Error fetching inventory data:', error);
        setError('Failed to load inventory data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (businessLineId) {
      fetchInventoryData();
    }
  }, [businessLineId, asOfDate]);

  useEffect(() => {
    setMovements([]);
    const fetchMovementHistory = async () => {
      if (!businessLineId || (selectedProduct === 'all' && !startDate && !endDate)) return;  
  
      setMovementLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams({
          businessLineId: businessLineId.toString(),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
  
        if (selectedProduct !== 'all') {
          queryParams.append('productId', selectedProduct);
        }
  
        if (movementType !== 'all') {
          queryParams.append('direction', movementType);
        }
  
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/inventory/movements?${queryParams.toString()}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
  
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
  
        const data = await response.json() as StockMovement[];
        console.log("Movements API response:", data);
        setMovements(data);
      } catch (error) {
        console.error('Error fetching movement history:', error);
        setError('Failed to load movement history. Please try again later.');
      } finally {
        setMovementLoading(false);
      }
    };
  
    fetchMovementHistory();
  }, [businessLineId, selectedProduct, movementType, startDate, endDate]);
  
  useEffect(() => {
    const fetchRunningBalance = async () => {
      if (selectedProduct === 'all' || !selectedProduct) return;
      
      setBalanceLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
        
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/inventory/running-balance/${selectedProduct}?${queryParams.toString()}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json() as RunningBalanceResponse;
        setRunningBalance(data);
      } catch (error) {
        console.error('Error fetching running balance:', error);
        setError('Failed to load product balance history. Please try again later.');
      } finally {
        setBalanceLoading(false);
      }
    };

    if (selectedProduct !== 'all') {
      fetchRunningBalance();
    } else {
      setRunningBalance(null);
    }
  }, [selectedProduct, startDate, endDate]);
  
  const filteredProducts = products.filter(product => 
    product.Name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const exportCurrentInventory = async () => {
    try {
      setDownloadingCurrent(true);
      
      const wb = XLSX.utils.book_new();
      
      // Current Inventory Sheet
      const inventoryData = [
        ['CURRENT INVENTORY REPORT', null, null, null, null, null, null],
        [null, null, null, null, null, null, null],
        [`As of: ${format(asOfDate, 'PPP')}`, null, null, null, null, null, null],
        [`Generated on: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, null, null, null, null, null, null],
        [null, null, null, null, null, null, null],
        ['ID', 'Product', 'Current Qty', 'Min Qty', 'Status', 'Value', 'Last Updated']
      ];
      
      let totalValue = 0;
      filteredProducts.forEach(product => {
        const value = product.Value || product.CurrentQTY * (product.AverageCost || 0);
        totalValue += value;
        
        inventoryData.push([
          product.ProductID.toString(),
          product.Name,
          product.CurrentQTY.toString(),
          (product.MinimumQTY || 0).toString(),
          product.Status || (product.CurrentQTY === 0 ? 'Out of Stock' : 
            product.CurrentQTY < (product.MinimumQTY || 0) ? 'Low Stock' : 'In Stock'),
          value.toString(),
          product.LastUpdated ? format(new Date(product.LastUpdated), 'MMM d, yyyy') : 'N/A'
        ]);
      });
      
      inventoryData.push([null, null, null, null, null, null, null]);
      inventoryData.push(['SUMMARY', null, null, null, null, null, null]);
      inventoryData.push([`Total Items: ${filteredProducts.length}`, null, null, null, null, null, null]);
      inventoryData.push([`Low Stock Items: ${lowStockItems}`, null, null, null, null, null, null]);
      inventoryData.push([`Total Value: LKR ${totalValue.toFixed(2)}`, null, null, null, null, null, null]);
      
      const ws = XLSX.utils.aoa_to_sheet(inventoryData);
      
      setColumnWidths(ws, [10, 40, 12, 10, 15, 15, 15]);
      
      const merges = [
        ['A1', 'G1'], // Title
        ['A3', 'G3'], // As of date
        ['A4', 'G4'], // Generated date
        ['A9', 'G9'], // Summary
        ['A10', 'G10'], // Total items
        ['A11', 'G11'], // Low stock
        ['A12', 'G12']  // Total value
      ];
      setMerges(ws, merges);
      
      addBordersToWorksheet(ws);
      styleHeaderRow(ws, 0);
      styleHeaderRow(ws, 5);
      styleHeaderRow(ws, 8);
      
      // Format currency columns
      for (let i = 7; i < inventoryData.length - 5; i++) {
        const valueRef = XLSX.utils.encode_cell({ r: i, c: 5 });
        if (ws[valueRef]) {
          ws[valueRef].z = '#,##0.00';
        }
      }
      
      XLSX.utils.book_append_sheet(wb, ws, 'Current_Inventory');
      
      // Movement History Sheet (if movements loaded)
      if (movements.length > 0) {
        const movementData = [
          ['MOVEMENT HISTORY', null, null, null, null, null, null, null],
          [null, null, null, null, null, null, null, null],
          [`From: ${format(startDate, 'PPP')} To: ${format(endDate, 'PPP')}`, null, null, null, null, null, null, null],
          [null, null, null, null, null, null, null, null],
          ['Date & Time', 'Product', 'Type', 'Reference', 'Quantity', 'Direction', 'User', 'Details']
        ];
        
        movements.forEach(movement => {
          const product = products.find(p => p.ProductID === movement.ProductID);
          let details = '';
          
          if (movement.details?.vendor) details += `Vendor: ${movement.details.vendor} `;
          if (movement.details?.customer) details += `Customer: ${movement.details.customer} `;
          if (movement.details?.invoiceNumber) details += `Invoice: ${movement.details.invoiceNumber} `;
          if (movement.Note) details += movement.Note;
          
          movementData.push([
            format(new Date(movement.Date), 'MMM d, yyyy h:mm a'),
            movement.ProductName || product?.Name || `Product ID: ${movement.ProductID}`,
            getMovementTypeLabel(movement),
            getMovementReference(movement),
            movement.Quantity.toString(),
            movement.Direction,
            movement.CreatedBy,
            details.trim() || '-'
          ]);
        });
        
        const movementWs = XLSX.utils.aoa_to_sheet(movementData);
        
        setColumnWidths(movementWs, [20, 30, 15, 15, 10, 10, 15, 40]);
        
        const movementMerges = [
          ['A1', 'H1'],
          ['A3', 'H3']
        ];
        setMerges(movementWs, movementMerges);
        
        addBordersToWorksheet(movementWs);
        styleHeaderRow(movementWs, 0);
        styleHeaderRow(movementWs, 4);
        
        XLSX.utils.book_append_sheet(wb, movementWs, 'Movement History');
      }
      
      const fileName = `Inventory_Report_${format(asOfDate, 'yyyy-MM-dd')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast({
        title: "Export Complete",
        description: `Downloaded ${fileName}`,
      });
    } catch (error) {
      console.error('Error exporting inventory:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export inventory data. Please try again.",
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
      
      // Fetch movements for the month
      const queryParams = new URLSearchParams({
        businessLineId: businessLineId.toString(),
        startDate: firstDayOfMonth.toISOString(),
        endDate: lastDayOfMonth.toISOString()
      });
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/inventory/movements?${queryParams.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const monthlyMovements = await response.json() as StockMovement[];
      
      const wb = XLSX.utils.book_new();
      
      // --- INVENTORY SUMMARY WORKSHEET ---
      const summaryData = [
        ['MONTHLY INVENTORY REPORT', null, null, null, null],
        [null, null, null, null, null],
        [`Period: ${format(firstDayOfMonth, 'MMMM yyyy')}`, null, null, null, null],
        [null, null, null, null, null],
        ['Product', 'Opening Stock', 'Stock In', 'Stock Out', 'Closing Stock']
      ];
      
      // Calculate summary for each product
      const productSummary: Record<number, {
        name: string;
        openingStock: number;
        stockIn: number;
        stockOut: number;
        closingStock: number;
      }> = {};
      
      products.forEach(product => {
        const productMovements = monthlyMovements.filter(m => m.ProductID === product.ProductID);
        const stockIn = productMovements
          .filter(m => m.Direction === 'IN')
          .reduce((sum, m) => sum + m.Quantity, 0);
        const stockOut = productMovements
          .filter(m => m.Direction === 'OUT')
          .reduce((sum, m) => sum + m.Quantity, 0);
        
        productSummary[product.ProductID] = {
          name: product.Name,
          openingStock: product.CurrentQTY + stockOut - stockIn, // Approximate
          stockIn,
          stockOut,
          closingStock: product.CurrentQTY
        };
      });
      
      Object.values(productSummary).forEach(data => {
        summaryData.push([
          data.name,
          data.openingStock.toString(),
          data.stockIn.toString(),
          data.stockOut.toString(),
          data.closingStock.toString()
        ]);
      });
      
      const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
      
      setColumnWidths(summaryWS, [40, 15, 15, 15, 15]);
      
      const summaryMerges = [
        ['A1', 'E1'],
        ['A3', 'E3']
      ];
      
      setMerges(summaryWS, summaryMerges);
      
      addBordersToWorksheet(summaryWS);
      styleHeaderRow(summaryWS, 0);
      styleHeaderRow(summaryWS, 4);
      
      XLSX.utils.book_append_sheet(wb, summaryWS, 'Summary');
      
      // --- MOVEMENT ANALYSIS WORKSHEET ---
      const analysisData = [
        ['MOVEMENT TYPE ANALYSIS', null, null, null],
        [null, null, null, null],
        [`Period: ${format(firstDayOfMonth, 'MMMM yyyy')}`, null, null, null],
        [null, null, null, null],
        ['Movement Type', 'Direction', 'Count', 'Total Quantity']
      ];
      
      // Group movements by type
      const movementTypes: Record<string, { in: number; out: number; inQty: number; outQty: number }> = {
        'Purchase': { in: 0, out: 0, inQty: 0, outQty: 0 },
        'Sale': { in: 0, out: 0, inQty: 0, outQty: 0 },
        'Adjustment': { in: 0, out: 0, inQty: 0, outQty: 0 },
        'Return': { in: 0, out: 0, inQty: 0, outQty: 0 },
        'Transfer': { in: 0, out: 0, inQty: 0, outQty: 0 }
      };
      
      monthlyMovements.forEach(movement => {
        const type = getMovementTypeLabel(movement);
        let category = 'Other';
        
        if (type.includes('Purchase')) category = 'Purchase';
        else if (type.includes('Sale')) category = 'Sale';
        else if (type.includes('Adjustment')) category = 'Adjustment';
        else if (type.includes('Return')) category = 'Return';
        else if (type.includes('Transfer')) category = 'Transfer';
        
        if (!movementTypes[category]) {
          movementTypes[category] = { in: 0, out: 0, inQty: 0, outQty: 0 };
        }
        
        if (movement.Direction === 'IN') {
          movementTypes[category].in += 1;
          movementTypes[category].inQty += movement.Quantity;
        } else {
          movementTypes[category].out += 1;
          movementTypes[category].outQty += movement.Quantity;
        }
      });
      
      Object.entries(movementTypes).forEach(([type, data]) => {
        if (data.in > 0) {
          analysisData.push([type, 'IN', data.in.toString(), data.inQty.toString()]);
        }
        if (data.out > 0) {
          analysisData.push([type, 'OUT', data.out.toString(), data.outQty.toString()]);
        }
      });
      
      const analysisWS = XLSX.utils.aoa_to_sheet(analysisData);
      
      setColumnWidths(analysisWS, [20, 10, 15, 20]);
      
      const analysisMerges = [
        ['A1', 'D1'],
        ['A3', 'D3']
      ];
      
      setMerges(analysisWS, analysisMerges);
      
      addBordersToWorksheet(analysisWS);
      styleHeaderRow(analysisWS, 0);
      styleHeaderRow(analysisWS, 4);
      
      XLSX.utils.book_append_sheet(wb, analysisWS, 'Movement Analysis');
      
      const currentMonthStr = format(firstDayOfMonth, 'yyyy-MM');
      XLSX.writeFile(wb, `Monthly_Inventory_Report_${currentMonthStr}.xlsx`);
      
      toast({
        title: "Report Generated",
        description: "Monthly inventory report downloaded successfully.",
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
      
      // Fetch movements for the year
      const queryParams = new URLSearchParams({
        businessLineId: businessLineId.toString(),
        startDate: firstDayOfYear.toISOString(),
        endDate: lastDayOfYear.toISOString()
      });
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/inventory/movements?${queryParams.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const yearlyMovements = await response.json() as StockMovement[];
      
      const wb = XLSX.utils.book_new();
      
      // --- MONTHLY BREAKDOWN WORKSHEET ---
      const monthlyBreakdownData = [
        ['YEARLY INVENTORY REPORT - MONTHLY BREAKDOWN', null, null, null, null],
        [null, null, null, null, null],
        [`Year: ${year}`, null, null, null, null],
        [null, null, null, null, null],
        ['Month', 'Total Movements', 'Stock In', 'Stock Out', 'Net Change']
      ];
      
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June', 
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      
      let yearTotalMovements = 0;
      let yearTotalIn = 0;
      let yearTotalOut = 0;
      
      monthNames.forEach((monthName, index) => {
        const monthMovements = yearlyMovements.filter(movement => {
          const moveDate = new Date(movement.Date);
          return moveDate.getMonth() === index;
        });
        
        const stockIn = monthMovements
          .filter(m => m.Direction === 'IN')
          .reduce((sum, m) => sum + m.Quantity, 0);
        const stockOut = monthMovements
          .filter(m => m.Direction === 'OUT')
          .reduce((sum, m) => sum + m.Quantity, 0);
        const netChange = stockIn - stockOut;
        
        yearTotalMovements += monthMovements.length;
        yearTotalIn += stockIn;
        yearTotalOut += stockOut;
        
        monthlyBreakdownData.push([
          monthName,
          monthMovements.length.toString(),
          stockIn.toString(),
          stockOut.toString(),
          netChange.toString()
        ]);
      });
      
      monthlyBreakdownData.push([null, null, null, null, null]);
      monthlyBreakdownData.push([
        'TOTAL',
        yearTotalMovements.toString(),
        yearTotalIn.toString(),
        yearTotalOut.toString(),
        (yearTotalIn - yearTotalOut).toString()
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
      
      // --- TOP MOVING PRODUCTS WORKSHEET ---
      const topProductsData = [
        ['TOP MOVING PRODUCTS', null, null, null, null],
        [null, null, null, null, null],
        [`Year: ${year}`, null, null, null, null],
        [null, null, null, null, null],
        ['Product', 'Total Movements', 'Total In', 'Total Out', 'Turnover Rate']
      ];
      
      // Calculate product movement statistics
      const productStats: Record<number, {
        name: string;
        movements: number;
        totalIn: number;
        totalOut: number;
        avgStock: number;
      }> = {};
      
      yearlyMovements.forEach(movement => {
        if (!productStats[movement.ProductID]) {
          const product = products.find(p => p.ProductID === movement.ProductID);
          productStats[movement.ProductID] = {
            name: movement.ProductName || product?.Name || `Product ${movement.ProductID}`,
            movements: 0,
            totalIn: 0,
            totalOut: 0,
            avgStock: product?.CurrentQTY || 0
          };
        }
        
        productStats[movement.ProductID].movements += 1;
        if (movement.Direction === 'IN') {
          productStats[movement.ProductID].totalIn += movement.Quantity;
        } else {
          productStats[movement.ProductID].totalOut += movement.Quantity;
        }
      });
      
      // Sort by total movements and get top 20
      const topProducts = Object.values(productStats)
        .sort((a, b) => b.movements - a.movements)
        .slice(0, 20);
      
      topProducts.forEach(product => {
        const turnoverRate = product.avgStock > 0 
          ? (product.totalOut / product.avgStock).toFixed(2)
          : '0.00';
        
        topProductsData.push([
          product.name,
          product.movements.toString(),
          product.totalIn.toString(),
          product.totalOut.toString(),
          turnoverRate
        ]);
      });
      
      const topProductsWS = XLSX.utils.aoa_to_sheet(topProductsData);
      
      setColumnWidths(topProductsWS, [40, 15, 15, 15, 15]);
      
      const topProductsMerges = [
        ['A1', 'E1'],
        ['A3', 'E3']
      ];
      
      setMerges(topProductsWS, topProductsMerges);
      
      addBordersToWorksheet(topProductsWS);
      styleHeaderRow(topProductsWS, 0);
      styleHeaderRow(topProductsWS, 4);
      
      XLSX.utils.book_append_sheet(wb, topProductsWS, 'Top Products');
      
      // --- STOCK STATUS ANALYSIS WORKSHEET ---
      const stockStatusData = [
        ['STOCK STATUS ANALYSIS', null, null, null],
        [null, null, null, null],
        [`Year: ${year}`, null, null, null],
        [null, null, null, null],
        ['Metric', 'Count', 'Products', 'Percentage']
      ];
      
      const outOfStock = products.filter(p => p.CurrentQTY === 0);
      const lowStock = products.filter(p => p.CurrentQTY > 0 && p.CurrentQTY < p.MinimumQTY);
      const adequateStock = products.filter(p => p.CurrentQTY >= p.MinimumQTY);
      
      const totalProducts = products.length;
      
      stockStatusData.push([null, null, null, null]);
      stockStatusData.push([
        'Out of Stock',
        outOfStock.length.toString(),
        outOfStock.slice(0, 5).map(p => p.Name).join(', ') + (outOfStock.length > 5 ? '...' : ''),
        totalProducts > 0 ? ((outOfStock.length / totalProducts) * 100).toFixed(2) : '0'
      ]);
      stockStatusData.push([
        'Low Stock',
        lowStock.length.toString(),
        lowStock.slice(0, 5).map(p => p.Name).join(', ') + (lowStock.length > 5 ? '...' : ''),
        totalProducts > 0 ? ((lowStock.length / totalProducts) * 100).toFixed(2) : '0'
      ]);
      stockStatusData.push([
        'Adequate Stock',
        adequateStock.length.toString(),
        adequateStock.slice(0, 5).map(p => p.Name).join(', ') + (adequateStock.length > 5 ? '...' : ''),
        totalProducts > 0 ? ((adequateStock.length / totalProducts) * 100).toFixed(2) : '0'
      ]);
      
      stockStatusData.push([null, null, null, null]);
      stockStatusData.push(['TOTAL', totalProducts.toString(), null, '100.00']);
      
      const stockStatusWS = XLSX.utils.aoa_to_sheet(stockStatusData);
      
      setColumnWidths(stockStatusWS, [20, 10, 50, 15]);
      
      const stockStatusMerges = [
        ['A1', 'D1'],
        ['A3', 'D3']
      ];
      
      setMerges(stockStatusWS, stockStatusMerges);
      
      addBordersToWorksheet(stockStatusWS);
      styleHeaderRow(stockStatusWS, 0);
      styleHeaderRow(stockStatusWS, 4);
      styleHeaderRow(stockStatusWS, 5);
      
      // Format percentage column
      for (let i = 7; i <= 9; i++) {
        const percentRef = XLSX.utils.encode_cell({ r: i, c: 3 });
        if (stockStatusWS[percentRef]) {
          stockStatusWS[percentRef].z = '0.00%';
        }
      }
      
      XLSX.utils.book_append_sheet(wb, stockStatusWS, 'Stock Status');
      
      XLSX.writeFile(wb, `Yearly_Inventory_Report_${year}.xlsx`);
      
      toast({
        title: "Report Generated",
        description: "Yearly inventory report downloaded successfully.",
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
  
  // Updated to use the API's movementType or movementLabel directly
  const getMovementTypeLabel = (movement: StockMovement): string => {
    // First prioritize the movement label from the API
    if (movement.movementLabel) {
      return movement.movementLabel;
    }
    
    // Fall back to movement type if available
    if (movement.movementType) {
      switch(movement.movementType) {
        case 'PURCHASE':
          return 'Purchase';
        case 'SALE':
          return 'Sale';
        case 'ADJUSTMENT':
          return 'Adjustment';
        case 'TRANSFER_IN':
          return 'Transfer In';
        case 'TRANSFER_OUT':
          return 'Transfer Out';
        case 'RETURN':
          return 'Customer Return';
        default:
          return movement.movementType;
      }
    }
    
    // Legacy fallback if neither is available
    const referencePrefix = movement.ReferenceID?.split('-')[0] || '';
    
    switch(referencePrefix) {
      case 'INV':
        return 'Sale';
      case 'PUR':
        return 'Purchase';
      case 'ADJ':
        return 'Adjustment';
      default:
        return movement.Note || 'Other';
    }
  };

  // Get the appropriate reference/invoice number
  const getMovementReference = (movement: StockMovement): string => {
    if (movement.referenceNumber) {
      return movement.referenceNumber;
    }
    return movement.ReferenceID || '-';
  };

  return (
    <Card className="w-full shadow-none rounded-tl-none rounded-tr-none border-0">
      <CardContent className='mt-3'>
        {/* Top Controls - Date and Export Options */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex flex-col gap-1">
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[200px] flex justify-start text-left font-normal"
                  >                    
                    {format(asOfDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={asOfDate}
                    onSelect={handleDateSelect}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setAsOfDate(new Date())}
              title="Refresh data"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportCurrentInventory}
              disabled={downloadingCurrent}
            >
              <FileDown className="mr-2 h-4 w-4" />
              {downloadingCurrent ? 'Exporting...' : 'Export Current'}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setMonthYearDialogOpen(true)}
              disabled={downloadingMonthly}
            >
              <FileDown className="mr-2 h-4 w-4" />
              {downloadingMonthly ? 'Downloading...' : 'Monthly Report'}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setYearDialogOpen(true)}
              disabled={downloadingYearly}
            >
              <FileDown className="mr-2 h-4 w-4" />
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

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalItems}</div>
              <p className="text-xs text-muted-foreground">As of {format(asOfDate, 'PPP')}</p>
            </CardContent>
          </Card>
                      
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Alert</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">{lowStockItems}</div>
              <p className="text-xs text-muted-foreground">Items below minimum quantity</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="current" className="w-full mt-2">
          <TabsList className="grid w-full grid-cols-2 print:hidden">
            <TabsTrigger value="current">Current Inventory</TabsTrigger>
            <TabsTrigger value="history">Movement History</TabsTrigger>
          </TabsList>
          
          {/* Current Inventory Tab */}
          <TabsContent value="current" className="w-full">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Items</CardTitle>
                <CardDescription>
                  Current stock levels as of {format(asOfDate, 'MMMM d, yyyy')}
                </CardDescription>
                
                <div className="mt-2 print:hidden">
                  <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-md"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Current Qty</TableHead>
                          <TableHead className="text-right">Min Qty</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                          <TableHead>Last Updated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProducts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No inventory items found
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredProducts.map((product) => (
                            <TableRow key={product.ProductID}>
                              <TableCell className="font-mono text-xs">{product.ProductID}</TableCell>
                              <TableCell className="font-medium">{product.Name}</TableCell>
                              <TableCell className="text-right">{product.CurrentQTY}</TableCell>
                              <TableCell className="text-right">{product.MinimumQTY || 0}</TableCell>
                              <TableCell>
                                {product.Status ? (
                                  <Badge
                                    variant={product.Status === 'In Stock' ? 'outline' : 'destructive'}
                                    className={
                                      product.Status === 'In Stock'
                                        ? 'bg-green-100 text-green-800 border-green-200'
                                        : product.Status === 'Low Stock'
                                          ? 'bg-amber-500'
                                          : undefined
                                    }
                                  >
                                    {product.Status}
                                  </Badge>
                                ) : (
                                  product.CurrentQTY === 0 ? (
                                    <Badge variant="destructive">Out of Stock</Badge>
                                  ) : product.CurrentQTY < (product.MinimumQTY || 0) ? (
                                    <Badge variant="destructive" className="bg-amber-500">Low Stock</Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">In Stock</Badge>
                                  )
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {new Intl.NumberFormat('en-US', {
                                  style: 'currency',
                                  currency: 'LKR'
                                }).format(product.Value || product.CurrentQTY * (product.AverageCost || 0))}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {product.LastUpdated ? format(new Date(product.LastUpdated), 'MMM d, yyyy') : 'N/A'}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="text-sm text-muted-foreground">
                  {filteredProducts.length} of {products.length} items
                </div>
              </CardFooter>
            </Card>
          </TabsContent>
          
          {/* Movement History Tab - Updated */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Movement History</CardTitle>
                <CardDescription>
                  Track all inventory changes including sales, purchases, and adjustments
                </CardDescription>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 print:hidden">
                  {/* Date Range Selectors */}
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-gray-500">From Date:</span>
                    <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full flex justify-start text-left font-normal"
                        >                            
                          {startDate ? format(startDate, 'PP') : 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={(date) => {
                            setStartDate(date || startDate);
                            setStartDateOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-gray-500">To Date:</span>
                    <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full flex justify-start text-left font-normal"
                        >                            
                          {endDate ? format(endDate, 'PP') : 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={handleToDateSelect}
                          disabled={(date) => date > new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  {/* Filters */}
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-gray-500">Product:</span>
                    <Select
                      value={selectedProduct}
                      onValueChange={setSelectedProduct}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Products" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Products</SelectItem>
                        {products.map(product => (
                          <SelectItem key={product.ProductID} value={product.ProductID.toString()}>
                            {product.Name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-gray-500">Movement Type:</span>
                    <Select
                      value={movementType}
                      onValueChange={setMovementType}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Movements" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Movements</SelectItem>
                        <SelectItem value="IN">Stock In</SelectItem>
                        <SelectItem value="OUT">Stock Out</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4 print:hidden">
                  <AlertDescription>
                    Showing inventory movements from {format(startDate, 'PPP')} to {format(endDate, 'PPP')}
                  </AlertDescription>
                </Alert>
                
                {movementLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead>Direction</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movements.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                              No movement records found for the selected criteria
                            </TableCell>
                          </TableRow>
                        ) : (
                          movements.map((movement) => {
                            const product = products.find(p => p.ProductID === movement.ProductID);
                            return (
                              <TableRow key={movement.MovementID}>
                                <TableCell>
                                  {format(new Date(movement.Date), 'MMM d, yyyy')}
                                  <div className="text-xs text-muted-foreground">
                                    {format(new Date(movement.Date), 'h:mm a')}
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {movement.ProductName || product?.Name || `Product ID: ${movement.ProductID}`}
                                </TableCell>
                                <TableCell>{getMovementTypeLabel(movement)}</TableCell>
                                <TableCell className="font-mono text-xs">
                                  {getMovementReference(movement)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {movement.Quantity}
                                </TableCell>
                                <TableCell>
                                  {movement.Direction === 'IN' ? (
                                    <Badge className="bg-green-100 text-green-800 border-green-200">IN</Badge>
                                  ) : (
                                    <Badge className="bg-red-100 text-red-800 border-red-200">OUT</Badge>
                                  )}
                                </TableCell>
                                <TableCell>{movement.CreatedBy}</TableCell>
                                <TableCell className="max-w-xs">
                                  {movement.details?.vendor && (
                                    <div className="text-xs">Vendor: {movement.details.vendor}</div>
                                  )}
                                  {movement.details?.customer && (
                                    <div className="text-xs">Customer: {movement.details.customer}</div>
                                  )}
                                  {movement.details?.invoiceNumber && (
                                    <div className="text-xs">Invoice: {movement.details.invoiceNumber}</div>
                                  )}
                                  {movement.Note && (
                                    <div className="text-xs truncate">{movement.Note}</div>
                                  )}
                                  {!movement.details?.vendor && !movement.details?.customer && 
                                   !movement.details?.invoiceNumber && !movement.Note && '-'}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <div className="text-sm text-muted-foreground">
                  {movements.length} movements found
                </div>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>        
      </CardContent>
    </Card>
  );
};

export default InventoryReport;