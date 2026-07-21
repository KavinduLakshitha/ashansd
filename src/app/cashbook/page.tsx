"use client";

import { useCallback, useEffect, useState } from "react";
import { addDays, format } from "date-fns";
import { DateRange } from "react-day-picker";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePickerWithRange } from "@/components/DateRange";
import { useAuth } from "@/app/auth/auth-context";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api/axios";
import { AxiosError } from "axios";

interface CashbookEntry {
  EntryID: number;
  EntryDate: string;
  Direction: "IN" | "OUT";
  Amount: number;
  Category: string;
  Description: string | null;
  ReferenceType: string | null;
  ReferenceID: number | null;
  AccountType: "CASH" | "BANK";
  CreatedByName?: string | null;
}

interface CashbookSummary {
  totalIn: number;
  totalOut: number;
  net: number;
  cashBalance: number;
  bankBalance: number;
  entryCount: number;
}

const formatCurrency = (amount: number) =>
  `Rs. ${Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const categoryLabel = (category: string) =>
  category
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

export default function CashbookPage() {
  const { user, getBusinessLineID } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const canManage = ["superuser", "admin", "management"].includes(user?.userType || "");

  const [entries, setEntries] = useState<CashbookEntry[]>([]);
  const [summary, setSummary] = useState<CashbookSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CashbookEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    entryDate: format(new Date(), "yyyy-MM-dd"),
    direction: "IN" as "IN" | "OUT",
    amount: "",
    accountType: "CASH" as "CASH" | "BANK",
    description: "",
  });

  useEffect(() => {
    if (user && !canManage) {
      router.push("/dashboard");
    }
  }, [user, canManage, router]);

  const fetchData = useCallback(async () => {
    const businessLineId = getBusinessLineID();
    if (!businessLineId) return;

    setLoading(true);
    try {
      const params: Record<string, string> = { businessLineId: String(businessLineId) };
      if (dateRange?.from) params.startDate = format(dateRange.from, "yyyy-MM-dd");
      if (dateRange?.to) params.endDate = format(dateRange.to, "yyyy-MM-dd");
      if (directionFilter !== "all") params.direction = directionFilter;
      if (accountFilter !== "all") params.accountType = accountFilter;
      if (search.trim()) params.search = search.trim();

      const [entriesRes, summaryRes] = await Promise.all([
        api.get("/cashbook", { params }),
        api.get("/cashbook/summary", {
          params: {
            businessLineId,
            startDate: params.startDate,
            endDate: params.endDate,
          },
        }),
      ]);

      setEntries(entriesRes.data.data || []);
      setSummary(summaryRes.data);
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast({
        title: "Error",
        description: axiosError.response?.data?.message || "Failed to load cashbook",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [getBusinessLineID, dateRange, directionFilter, accountFilter, search, toast]);

  useEffect(() => {
    if (canManage) {
      fetchData();
    }
  }, [canManage, fetchData]);

  const openCreateDialog = (direction: "IN" | "OUT" = "IN") => {
    setForm({
      entryDate: format(new Date(), "yyyy-MM-dd"),
      direction,
      amount: "",
      accountType: "CASH",
      description: "",
    });
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    const businessLineId = getBusinessLineID();
    if (!businessLineId) return;

    const amount = parseFloat(form.amount);
    if (!form.entryDate || !(amount > 0)) {
      toast({
        title: "Invalid entry",
        description: "Enter a valid date and amount greater than zero.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await api.post("/cashbook", {
        businessLineId,
        entryDate: form.entryDate,
        direction: form.direction,
        amount,
        accountType: form.accountType,
        description: form.description || undefined,
        category: form.direction === "IN" ? "MANUAL_INCOME" : "MANUAL_EXPENSE",
      });
      toast({ title: "Entry added", description: "Manual cashbook entry created." });
      setDialogOpen(false);
      await fetchData();
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast({
        title: "Error",
        description: axiosError.response?.data?.message || "Failed to create entry",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/cashbook/${deleteTarget.EntryID}`);
      toast({ title: "Deleted", description: "Manual entry removed." });
      setDeleteTarget(null);
      await fetchData();
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast({
        title: "Error",
        description: axiosError.response?.data?.message || "Failed to delete entry",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const isManual = (entry: CashbookEntry) =>
    entry.ReferenceType === "MANUAL" ||
    entry.Category === "MANUAL_INCOME" ||
    entry.Category === "MANUAL_EXPENSE";

  if (!canManage) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader className="bg-gray-50 border-b border-gray-200 flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-xl font-semibold text-gray-800">Cashbook</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => openCreateDialog("OUT")}>
              Add Expense
            </Button>
            <Button size="sm" onClick={() => openCreateDialog("IN")}>
              <Plus className="h-4 w-4 mr-1" />
              Add Income
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Total In</div>
                {loading || !summary ? (
                  <Skeleton className="h-7 w-28 mt-1" />
                ) : (
                  <div className="text-2xl font-bold text-green-700">{formatCurrency(summary.totalIn)}</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Total Out</div>
                {loading || !summary ? (
                  <Skeleton className="h-7 w-28 mt-1" />
                ) : (
                  <div className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalOut)}</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Cash Balance</div>
                {loading || !summary ? (
                  <Skeleton className="h-7 w-28 mt-1" />
                ) : (
                  <div className="text-2xl font-bold">{formatCurrency(summary.cashBalance)}</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Bank Balance</div>
                {loading || !summary ? (
                  <Skeleton className="h-7 w-28 mt-1" />
                ) : (
                  <div className="text-2xl font-bold">{formatCurrency(summary.bankBalance)}</div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <DatePickerWithRange selected={dateRange} onChange={setDateRange} />
            <Select value={directionFilter} onValueChange={setDirectionFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All directions</SelectItem>
                <SelectItem value="IN">In only</SelectItem>
                <SelectItem value="OUT">Out only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Cash + Bank</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="BANK">Bank</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="w-full lg:w-64"
              placeholder="Search description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {/* <Button variant="outline" size="icon" onClick={fetchData} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button> */}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="font-bold text-black">Date</TableHead>
                  <TableHead className="font-bold text-black">Direction</TableHead>
                  <TableHead className="font-bold text-black">Category</TableHead>
                  <TableHead className="font-bold text-black">Account</TableHead>
                  <TableHead className="font-bold text-black">Description</TableHead>
                  <TableHead className="font-bold text-black text-right">Amount</TableHead>
                  <TableHead className="font-bold text-black text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6">
                      Loading cashbook...
                    </TableCell>
                  </TableRow>
                ) : entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      No cashbook entries for this period
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => (
                    <TableRow key={entry.EntryID}>
                      <TableCell>{format(new Date(entry.EntryDate), "yyyy-MM-dd")}</TableCell>
                      <TableCell>
                        <Badge variant={entry.Direction === "IN" ? "default" : "secondary"}>
                          {entry.Direction}
                        </Badge>
                      </TableCell>
                      <TableCell>{categoryLabel(entry.Category)}</TableCell>
                      <TableCell>{entry.AccountType}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {entry.Description || "—"}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums font-medium ${
                          entry.Direction === "IN" ? "text-green-700" : "text-red-600"
                        }`}
                      >
                        {entry.Direction === "IN" ? "+" : "−"}
                        {formatCurrency(Number(entry.Amount))}
                      </TableCell>
                      <TableCell className="text-center">
                        {isManual(entry) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:bg-red-50 hover:text-red-600"
                            onClick={() => setDeleteTarget(entry)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Auto</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {form.direction === "IN" ? "Add Income" : "Add Expense"}
            </DialogTitle>
            <DialogDescription>
              Create a manual cashbook entry. Sales, purchases, and cheque realizations are recorded automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="cb-date">Date</Label>
              <Input
                id="cb-date"
                type="date"
                value={form.entryDate}
                onChange={(e) => setForm((prev) => ({ ...prev, entryDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>Direction</Label>
              <Select
                value={form.direction}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, direction: value as "IN" | "OUT" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">In (Income)</SelectItem>
                  <SelectItem value="OUT">Out (Expense)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Account</Label>
              <Select
                value={form.accountType}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, accountType: value as "CASH" | "BANK" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BANK">Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cb-amount">Amount (Rs.)</Label>
              <Input
                id="cb-amount"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="cb-desc">Description</Label>
              <Input
                id="cb-desc"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Optional note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Saving..." : "Save Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete manual entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the selected cashbook entry
              {deleteTarget ? ` (${formatCurrency(Number(deleteTarget.Amount))})` : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
