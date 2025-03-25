import React from 'react';
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface jsPDFWithPlugin extends jsPDF {
  autoTable: typeof autoTable;
  lastAutoTable?: {
    finalY?: number;
  };
}

interface ExportProps {
  inventoryItems: {
    itemName: string;
    availableQuantity: number;
    newQuantity: number;
    adjustedQuantity: number;
  }[];
  notes: string;
  date: Date;
}

const ExportComponent = ({ inventoryItems, date }: ExportProps) => {
  const formatCell = (value: number) => {
    return value === 0 ? '' : value.toString();
  };

  const handlePDFExport = () => {
    const doc = new jsPDF() as jsPDFWithPlugin;
    
    doc.setFontSize(16);
    doc.text('Stock Adjustment Report', 14, 15);  

    doc.setFontSize(11);
    doc.text(`Date: ${date.toLocaleDateString()}`, 14, 25);
    
    const tableData = inventoryItems.map(item => [
      item.itemName,
      formatCell(item.availableQuantity),
      formatCell(item.newQuantity),
      formatCell(item.adjustedQuantity)
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['Item Name', 'Available Quantity', 'Physical Quantity', 'Adjusted Quantity']],
      body: tableData,
      headStyles: { fillColor: [51, 51, 51] },
      theme: 'grid',
      styles: { 
        cellPadding: 2,
        fontSize: 10,
        valign: 'middle',
      },
      margin: { bottom: 40 }
    });

    const finalY = doc.lastAutoTable?.finalY || 30;
    const pageHeight = doc.internal.pageSize.height;
    
    if (finalY + 80 > pageHeight - 20) {
      doc.addPage();
      doc.text('Notes:', 14, 20);
      
      doc.setDrawColor(200);
      doc.setFillColor(255, 255, 255);
      doc.rect(14, 25, 182, 60, 'FD');
    } else {
      doc.text('Notes:', 14, finalY + 10);
      doc.setDrawColor(200);
      doc.setFillColor(255, 255, 255);
      doc.rect(14, finalY + 15, 182, 60, 'FD');
    }

    doc.save(`stock-adjustment-${date.toLocaleDateString()}.pdf`);
  };

  const handleCSVExport = () => {
    const headers = ['Item Name', 'Available Quantity', 'Physical Quantity', 'Adjusted Quantity'];
    const rows = inventoryItems.map(item => [
      item.itemName,
      formatCell(item.availableQuantity),
      formatCell(item.newQuantity),
      formatCell(item.adjustedQuantity)
    ]);

    const csvContent = [
      `Stock Adjustment Report - ${date.toLocaleDateString()}`,
      '',
      headers.join(','),
      ...rows.map(row => row.join(',')),
      '',
      'Notes:',
      ''
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-adjustment-${date.toLocaleDateString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="flex items-center gap-2">
          <Download size={16} />
          Export Report
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={handlePDFExport} className="flex items-center gap-2">
          <FileText size={16} />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCSVExport} className="flex items-center gap-2">
          <FileSpreadsheet size={16} />
          Export as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ExportComponent;