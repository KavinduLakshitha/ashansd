"use client";

import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable, { RowInput } from 'jspdf-autotable';
import { FileSpreadsheet, FileText } from 'lucide-react';
import axios from '@/lib/api/axios';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/app/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ReportCustomer {
  CustomerID: number;
  CustomerName: string;
}

interface PendingCredit {
  CreditPaymentID: number | string;
  DueDate: string;
  Amount: number | string;
  CustomerName: string;
  CustomerID: number;
  SaleDate?: string | null;
  InvoiceID?: string | null;
}

interface PendingOpeningBalance {
  OpeningBalanceID: number;
  Amount: number | string;
  BalanceDate: string;
  CustomerName: string;
  CustomerID: number;
  ReferenceID: string;
}

type ReportType = 'BILL_WISE' | 'CUSTOMER_TOTAL';
type CustomerScope = 'ALL' | 'SELECTED';

interface Bill {
  customerId: number;
  customerName: string;
  reference: string;
  billDate: string;
  dueDate: string;
  amount: number;
}

interface CreditBalanceReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: ReportCustomer[];
}

const formatAmount = (value: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDay = (value?: string | null) => {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : format(parsed, 'yyyy-MM-dd');
};

const byName = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });

const CreditBalanceReportDialog: React.FC<CreditBalanceReportDialogProps> = ({
  open,
  onOpenChange,
  customers,
}) => {
  const { getBusinessLineID } = useAuth();
  const [scope, setScope] = useState<CustomerScope>('ALL');
  const [reportType, setReportType] = useState<ReportType>('BILL_WISE');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<'excel' | 'pdf' | null>(null);

  const visibleCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return customers
      .filter((customer) => !query || customer.CustomerName.toLowerCase().includes(query))
      .sort((a, b) => byName(a.CustomerName, b.CustomerName));
  }, [customers, search]);

  const toggleCustomer = (customerId: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(customerId);
      else next.delete(customerId);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleCustomers.forEach((customer) => next.add(customer.CustomerID));
      return next;
    });
  };

  const canDownload = scope === 'ALL' || selectedIds.size > 0;

  // Loads every pending credit and opening balance (no date filters) and shapes it for the report.
  const loadReportData = async () => {
    const businessLineId = getBusinessLineID();
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL}/payments/pending/${businessLineId}`
    );
    const credits: PendingCredit[] = response.data?.pendingCredits ?? [];
    const openingBalances: PendingOpeningBalance[] = response.data?.pendingOpeningBalances ?? [];

    const allowed = (customerId: number) => scope === 'ALL' || selectedIds.has(customerId);

    const bills: Bill[] = [
      ...credits
        .filter((credit) => allowed(credit.CustomerID))
        .map((credit) => ({
          customerId: credit.CustomerID,
          customerName: credit.CustomerName,
          reference: credit.InvoiceID || `Sale ${credit.CreditPaymentID}`,
          billDate: formatDay(credit.SaleDate),
          dueDate: formatDay(credit.DueDate),
          amount: Number(credit.Amount) || 0,
        })),
      ...openingBalances
        .filter((balance) => allowed(balance.CustomerID))
        .map((balance) => ({
          customerId: balance.CustomerID,
          customerName: balance.CustomerName,
          reference: `${balance.ReferenceID} (Opening Balance)`,
          billDate: formatDay(balance.BalanceDate),
          dueDate: '-',
          amount: Number(balance.Amount) || 0,
        })),
    ];

    // Group by customer, customers A-Z, bills oldest first.
    const grouped = new Map<number, { name: string; bills: Bill[] }>();
    for (const bill of bills) {
      const entry = grouped.get(bill.customerId) ?? { name: bill.customerName, bills: [] };
      entry.bills.push(bill);
      grouped.set(bill.customerId, entry);
    }

    // Selected customers with nothing owed still appear in the Total Balance report (as 0.00).
    if (scope === 'SELECTED' && reportType === 'CUSTOMER_TOTAL') {
      for (const customer of customers) {
        if (selectedIds.has(customer.CustomerID) && !grouped.has(customer.CustomerID)) {
          grouped.set(customer.CustomerID, { name: customer.CustomerName, bills: [] });
        }
      }
    }

    const groups = Array.from(grouped.entries())
      .map(([customerId, entry]) => ({
        customerId,
        name: entry.name,
        bills: entry.bills.sort((a, b) => a.billDate.localeCompare(b.billDate)),
        total: entry.bills.reduce((sum, bill) => sum + bill.amount, 0),
      }))
      .sort((a, b) => byName(a.name, b.name));

    return groups;
  };

  const reportTitle =
    reportType === 'BILL_WISE' ? 'Credit Balance Report - Bill Wise' : 'Credit Balance Report - Customer Total Balance';

  const scopeDescription = (groups: { name: string }[]) =>
    scope === 'ALL'
      ? 'Customers: All customers'
      : `Customers: ${groups.map((group) => group.name).join(', ')}`;

  const buildSheetRows = (groups: Awaited<ReturnType<typeof loadReportData>>) => {
    const rows: (string | number)[][] = [];
    rows.push([reportTitle]);
    rows.push([`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`]);
    rows.push([scopeDescription(groups)]);
    rows.push([]);

    const grandTotal = groups.reduce((sum, group) => sum + group.total, 0);

    if (reportType === 'BILL_WISE') {
      rows.push(['Customer', 'Invoice / Reference', 'Invoice Date', 'Due Date', 'Balance (Rs.)']);
      for (const group of groups) {
        for (const bill of group.bills) {
          rows.push([group.name, bill.reference, bill.billDate, bill.dueDate, bill.amount]);
        }
        rows.push([`${group.name} - Total`, '', '', '', group.total]);
        rows.push([]);
      }
      rows.push(['GRAND TOTAL', '', '', '', grandTotal]);
    } else {
      rows.push(['Customer', 'No. of Bills', 'Total Balance (Rs.)']);
      for (const group of groups) {
        rows.push([group.name, group.bills.length, group.total]);
      }
      rows.push([
        'GRAND TOTAL',
        groups.reduce((sum, group) => sum + group.bills.length, 0),
        grandTotal,
      ]);
    }
    return rows;
  };

  const fileStem = () =>
    `credit-balance-${reportType === 'BILL_WISE' ? 'bill-wise' : 'customer-total'}-${format(new Date(), 'yyyy-MM-dd')}`;

  const download = async (kind: 'excel' | 'pdf') => {
    if (!canDownload) return;
    try {
      setBusy(kind);
      const groups = await loadReportData();

      if (groups.length === 0) {
        toast({
          title: 'Nothing to report',
          description: 'There is no outstanding credit balance for the selected customers.',
          duration: 3000,
        });
        return;
      }

      if (kind === 'excel') {
        const rows = buildSheetRows(groups);
        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        worksheet['!cols'] =
          reportType === 'BILL_WISE'
            ? [{ wch: 30 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 18 }]
            : [{ wch: 36 }, { wch: 14 }, { wch: 20 }];

        // Amount column number format
        const amountCol = reportType === 'BILL_WISE' ? 4 : 2;
        rows.forEach((row, rowIndex) => {
          const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: amountCol })];
          if (cell && typeof cell.v === 'number') cell.z = '#,##0.00';
        });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(
          workbook,
          worksheet,
          reportType === 'BILL_WISE' ? 'Bill Wise' : 'Customer Total'
        );
        XLSX.writeFile(workbook, `${fileStem()}.xlsx`);
      } else {
        const doc = new jsPDF();
        doc.setFontSize(15);
        doc.text(reportTitle, 14, 16);
        doc.setFontSize(9);
        doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 14, 22);
        const scopeText = doc.splitTextToSize(scopeDescription(groups), 180);
        doc.text(scopeText, 14, 27);
        const startY = 27 + scopeText.length * 4.5 + 3;

        const grandTotal = groups.reduce((sum, group) => sum + group.total, 0);
        const bold = { fontStyle: 'bold' as const, fillColor: [240, 240, 240] as [number, number, number] };

        if (reportType === 'BILL_WISE') {
          const body: RowInput[] = [];
          for (const group of groups) {
            for (const bill of group.bills) {
              body.push([
                group.name,
                bill.reference,
                bill.billDate,
                bill.dueDate,
                { content: formatAmount(bill.amount), styles: { halign: 'right' } },
              ]);
            }
            body.push([
              { content: `${group.name} - Total`, colSpan: 4, styles: bold },
              { content: formatAmount(group.total), styles: { ...bold, halign: 'right' } },
            ]);
          }
          body.push([
            { content: 'GRAND TOTAL', colSpan: 4, styles: { ...bold, fillColor: [51, 51, 51], textColor: 255 } },
            {
              content: formatAmount(grandTotal),
              styles: { ...bold, fillColor: [51, 51, 51], textColor: 255, halign: 'right' },
            },
          ]);
          autoTable(doc, {
            startY,
            head: [['Customer', 'Invoice / Reference', 'Invoice Date', 'Due Date', 'Balance (Rs.)']],
            body,
            theme: 'grid',
            headStyles: { fillColor: [51, 51, 51] },
            styles: { fontSize: 9, cellPadding: 2 },
            columnStyles: { 4: { halign: 'right' } },
          });
        } else {
          const body: RowInput[] = groups.map((group) => [
            group.name,
            { content: String(group.bills.length), styles: { halign: 'right' } },
            { content: formatAmount(group.total), styles: { halign: 'right' } },
          ]);
          body.push([
            { content: 'GRAND TOTAL', styles: { ...bold, fillColor: [51, 51, 51], textColor: 255 } },
            {
              content: String(groups.reduce((sum, group) => sum + group.bills.length, 0)),
              styles: { ...bold, fillColor: [51, 51, 51], textColor: 255, halign: 'right' },
            },
            {
              content: formatAmount(grandTotal),
              styles: { ...bold, fillColor: [51, 51, 51], textColor: 255, halign: 'right' },
            },
          ]);
          autoTable(doc, {
            startY,
            head: [['Customer', 'No. of Bills', 'Total Balance (Rs.)']],
            body,
            theme: 'grid',
            headStyles: { fillColor: [51, 51, 51] },
            styles: { fontSize: 10, cellPadding: 2.5 },
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
          });
        }

        doc.save(`${fileStem()}.pdf`);
      }
    } catch (error) {
      console.error('Error generating credit balance report:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not generate the report. Please try again.',
        duration: 3000,
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Credit Balance Report</DialogTitle>
          <DialogDescription>
            Outstanding credit (pending credits and opening balances). Cheques that are still pending are
            not included.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <Label>Report type</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={reportType === 'BILL_WISE' ? 'default' : 'outline'}
                onClick={() => setReportType('BILL_WISE')}
              >
                Bill Wise
              </Button>
              <Button
                type="button"
                variant={reportType === 'CUSTOMER_TOTAL' ? 'default' : 'outline'}
                onClick={() => setReportType('CUSTOMER_TOTAL')}
              >
                Customer Total Balance
              </Button>
            </div>
          </div>

          <div>
            <Label>Customers</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={scope === 'ALL' ? 'default' : 'outline'}
                onClick={() => setScope('ALL')}
              >
                All Customers
              </Button>
              <Button
                type="button"
                variant={scope === 'SELECTED' ? 'default' : 'outline'}
                onClick={() => setScope('SELECTED')}
              >
                Selected Customers
              </Button>
            </div>
          </div>

          {scope === 'SELECTED' && (
            <div className="space-y-2">
              <Input
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{selectedIds.size} selected</span>
                <div className="flex gap-3">
                  <button type="button" className="underline" onClick={selectAllVisible}>
                    Select all shown
                  </button>
                  <button type="button" className="underline" onClick={() => setSelectedIds(new Set())}>
                    Clear
                  </button>
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto rounded-md border p-2">
                {visibleCustomers.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">No customers found</div>
                ) : (
                  visibleCustomers.map((customer) => (
                    <label
                      key={customer.CustomerID}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-muted"
                    >
                      <Checkbox
                        checked={selectedIds.has(customer.CustomerID)}
                        onCheckedChange={(checked) => toggleCustomer(customer.CustomerID, checked === true)}
                      />
                      <span className="truncate">{customer.CustomerName}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2 gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy !== null}>
            Close
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => download('excel')}
              disabled={!canDownload || busy !== null}
              className="flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {busy === 'excel' ? 'Preparing...' : 'Excel'}
            </Button>
            <Button
              onClick={() => download('pdf')}
              disabled={!canDownload || busy !== null}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              {busy === 'pdf' ? 'Preparing...' : 'PDF'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreditBalanceReportDialog;
