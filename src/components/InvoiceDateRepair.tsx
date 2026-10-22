"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import axios from '@/lib/api/axios';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DateMismatch {
  PaymentID: number;
  SaleID: number;
  InvoiceID: string;
  CustomerName: string;
  PaymentMethod: string;
  Amount: number;
  InvoiceDate: string;
  CurrentDate: string;
  FromBouncedCheque: boolean;
}

const formatAmount = (amount: number) =>
  `Rs. ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const methodLabel = (method: string) =>
  method === 'BANK_TRANSFER' ? 'Bank transfer' : method.charAt(0) + method.slice(1).toLowerCase();

const errorMessage = (error: unknown, fallback: string) =>
  isAxiosError(error) ? error.response?.data?.message || fallback : fallback;

export default function InvoiceDateRepair() {
  const [rows, setRows] = useState<DateMismatch[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await axios.get('/payments/date-mismatches');
        if (cancelled) return;
        const mismatches: DateMismatch[] = response.data?.mismatches ?? [];
        setRows(mismatches);
        // Pre-select everything except bounced-cheque credits, which are dated on purpose.
        setSelected(new Set(mismatches.filter((m) => !m.FromBouncedCheque).map((m) => m.PaymentID)));
      } catch (error) {
        if (cancelled) return;
        toast({
          title: 'Error',
          description: errorMessage(error, 'Could not load moved invoice dates'),
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const load = () => {
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  const invoiceCount = useMemo(() => new Set(rows.map((r) => r.SaleID)).size, [rows]);
  const allSelected = rows.length > 0 && selected.size === rows.length;

  const toggle = (paymentId: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(paymentId);
      else next.delete(paymentId);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(rows.map((r) => r.PaymentID)) : new Set());
  };

  const fixSelected = async () => {
    setFixing(true);
    try {
      const response = await axios.post('/payments/date-mismatches/fix', {
        paymentIds: Array.from(selected),
      });
      toast({
        title: 'Dates restored',
        description: response.data?.message ?? 'Selected payments were restored to their invoice date',
      });
      setConfirmOpen(false);
      load();
    } catch (error) {
      toast({
        title: 'Error',
        description: errorMessage(error, 'Could not restore the selected dates'),
        variant: 'destructive',
      });
    } finally {
      setFixing(false);
    }
  };

  return (
    <div className="px-6 pb-6">
      <div className="mb-4 rounded-md border bg-gray-50 p-4 text-sm text-gray-700">
        <p className="font-medium text-gray-900">Invoices whose date was moved by a payment</p>
        <p className="mt-1">
          An earlier bug moved an invoice to the day a credit payment was made, so it no longer
          showed under its real date in Reports. Each row below is a payment that no longer matches
          its invoice date. Fixing it puts the payment back on the invoice date. Amounts, payment
          status and the cashbook are not changed.
        </p>
        <p className="mt-1">
          Rows marked <span className="font-medium">Bounced cheque</span> are credits created when a
          cheque bounced. Those are dated on the bounce day on purpose, so they are not ticked.
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-gray-600">
          {loading
            ? 'Checking…'
            : rows.length === 0
              ? 'No moved invoice dates found.'
              : `${rows.length} payment${rows.length === 1 ? '' : 's'} on ${invoiceCount} invoice${invoiceCount === 1 ? '' : 's'} · ${selected.size} selected`}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading || fixing}>
            Refresh
          </Button>
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={loading || fixing || selected.size === 0}
          >
            Restore selected dates
          </Button>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <Table className="w-full border whitespace-nowrap">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => toggleAll(checked === true)}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Invoice date</TableHead>
                <TableHead>Currently shown on</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.PaymentID}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(row.PaymentID)}
                      onCheckedChange={(checked) => toggle(row.PaymentID, checked === true)}
                      aria-label={`Select payment ${row.PaymentID}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{row.InvoiceID}</TableCell>
                  <TableCell>{row.CustomerName}</TableCell>
                  <TableCell>{methodLabel(row.PaymentMethod)}</TableCell>
                  <TableCell className="text-right">{formatAmount(row.Amount)}</TableCell>
                  <TableCell>{row.InvoiceDate}</TableCell>
                  <TableCell className="text-red-600">{row.CurrentDate}</TableCell>
                  <TableCell>
                    {row.FromBouncedCheque && <Badge variant="secondary">Bounced cheque</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !fixing && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore {selected.size} payment date{selected.size === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription>
              The selected payments will be moved back to their invoice date, so the invoices show
              under their original date in Reports. Amounts and payment status are not changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={fixing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={fixing}
              onClick={(event) => {
                event.preventDefault();
                fixSelected();
              }}
            >
              {fixing ? 'Restoring…' : 'Restore dates'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
