"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Trash, Upload, Download, AlertTriangle, Loader2, CheckCircle } from "lucide-react";
import AddOpeningBalanceDialog from "@/components/AddOpeningBalance";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/app/auth/auth-context";
import { useRouter } from "next/navigation";
import api from "@/lib/api/axios";
import { OpeningBalance, BulkImportResult } from "@/types/openingBalance";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";
import { AxiosError } from "axios";

const formatCurrency = (amount: number) =>
  `Rs. ${Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export default function OpeningBalancesPage() {
  const { user, getBusinessLineID } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [balances, setBalances] = useState<OpeningBalance[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OpeningBalance | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [importResults, setImportResults] = useState<BulkImportResult | null>(null);
  const [showImportResults, setShowImportResults] = useState(false);
  const [replaceOnImport, setReplaceOnImport] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");
  const [isClearing, setIsClearing] = useState(false);

  const canManageOpeningBalances = ["superuser", "admin", "management"].includes(
    user?.userType || ""
  );
  const isSuperuser = user?.userType === "superuser";

  useEffect(() => {
    if (user && !canManageOpeningBalances) {
      router.push("/dashboard");
    }
  }, [user, canManageOpeningBalances, router]);

  const fetchBalances = useCallback(async () => {
    const businessLineId = getBusinessLineID();
    if (!businessLineId) return;

    try {
      setIsLoading(true);
      const response = await api.get("/opening-balances", {
        params: { businessLineId },
      });
      setBalances(response.data.data || []);
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast({
        title: "Error",
        description: axiosError.response?.data?.message || "Failed to load opening balances",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [getBusinessLineID, toast]);

  useEffect(() => {
    if (canManageOpeningBalances) {
      fetchBalances();
    }
  }, [canManageOpeningBalances, fetchBalances]);

  const filteredBalances = balances.filter(
    (b) =>
      b.CustomerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(b.CustomerID).includes(searchTerm) ||
      `CUS${String(b.CustomerID).padStart(3, "0")}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  const handleSettle = async (balance: OpeningBalance) => {
    try {
      await api.put(`/opening-balances/${balance.OpeningBalanceID}/settle`);
      toast({ title: "Settled", description: `Opening balance for ${balance.CustomerName} marked as collected` });
      fetchBalances();
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast({
        title: "Error",
        description: axiosError.response?.data?.message || "Failed to settle",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.delete(`/opening-balances/${deleteTarget.OpeningBalanceID}`);
      toast({ title: "Deleted", description: "Opening balance removed" });
      setDeleteTarget(null);
      fetchBalances();
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast({
        title: "Error",
        description: axiosError.response?.data?.message || "Failed to delete",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearTransactionalData = async () => {
    if (clearConfirmText !== "CLEAR TRANSACTIONAL DATA") return;
    setIsClearing(true);
    try {
      const response = await api.post("/system/clear-transactional-data", {
        businessLineId: getBusinessLineID(),
        confirmPhrase: clearConfirmText,
      });
      toast({
        title: "Transactional Data Cleared",
        description: response.data.message,
      });
      setShowClearDialog(false);
      setClearConfirmText("");
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast({
        title: "Error",
        description: axiosError.response?.data?.message || "Failed to clear data",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        "Customer Code": "CUS001",
        "Customer Name": "Example Customer (optional)",
        "Opening Outstanding Balance": 15000.0,
        "Opening Balance Date": "2026-06-01",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Opening Balances");
    XLSX.writeFile(wb, "opening_balances_template.xlsx");
  };

  const parseImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

        const records = rows.map((row) => {
          const balanceDate = row["Opening Balance Date"];
          let formattedDate = "";

          if (balanceDate instanceof Date) {
            formattedDate = balanceDate.toISOString().split("T")[0];
          } else if (balanceDate) {
            const parsed = new Date(String(balanceDate));
            formattedDate = isNaN(parsed.getTime())
              ? String(balanceDate)
              : parsed.toISOString().split("T")[0];
          }

          return {
            customerCode: row["Customer Code"] ?? row["Customer ID"],
            customerName: row["Customer Name"],
            amount: row["Opening Outstanding Balance"],
            balanceDate: formattedDate,
            notes: row["Notes"],
          };
        });

        const response = await api.post<BulkImportResult>("/opening-balances/bulk-import", {
          records,
          replaceExisting: replaceOnImport,
          businessLineId: getBusinessLineID(),
        });

        setImportResults(response.data);
        setShowImportResults(true);
        fetchBalances();

        toast({
          title: "Import Complete",
          description: response.data.message,
        });
      } catch (error) {
        const axiosError = error as AxiosError<{ message?: string }>;
        toast({
          title: "Import Failed",
          description: axiosError.response?.data?.message || "Failed to import file",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      parseImportFile(file);
      event.target.value = "";
    }
  };

  if (!user || !canManageOpeningBalances) {
    return null;
  }

  return (
    <Card className="w-full mx-auto shadow-lg">
      <CardHeader className="bg-gray-50 border-b border-gray-200 flex flex-row items-center justify-between flex-wrap gap-3">
        <CardTitle className="text-xl font-semibold text-gray-800">
          Opening Outstanding Balances
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="w-4 h-4 mr-1" />
            Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-1" />
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileUpload}
          />
          {isSuperuser && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowClearDialog(true)}
            >
              <AlertTriangle className="w-4 h-4 mr-1" />
              Clear Transactional Data
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              setIsEditMode(false);
              setSelectedId(null);
              setIsDialogOpen(true);
            }}
          >
            Add Balance
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <div className="flex items-center gap-4 mb-4">
          <Input
            placeholder="Search by customer name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={replaceOnImport}
              onChange={(e) => setReplaceOnImport(e.target.checked)}
            />
            Replace existing on import
          </label>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Record pre go-live outstanding balances per customer. These appear in customer
          statements and A/R totals as <strong>OPENING_BALANCE</strong> transactions.
          Customer master data is never affected.
        </p>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer Code</TableHead>
                <TableHead>Customer Name</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Balance Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBalances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No opening balances recorded yet
                  </TableCell>
                </TableRow>
              ) : (
                filteredBalances.map((balance) => (
                  <TableRow key={balance.OpeningBalanceID}>
                    <TableCell>
                      CUS{String(balance.CustomerID).padStart(3, "0")}
                    </TableCell>
                    <TableCell>{balance.CustomerName}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(balance.Amount)}
                    </TableCell>
                    <TableCell>{formatDate(balance.BalanceDate)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={balance.Status === "PENDING" ? "default" : "secondary"}
                      >
                        {balance.Status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {balance.Notes || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={balance.Status === "SETTLED"}
                          onClick={() => {
                            setSelectedId(balance.OpeningBalanceID);
                            setIsEditMode(true);
                            setIsDialogOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={balance.Status === "SETTLED"}
                          title="Mark as collected"
                          onClick={() => handleSettle(balance)}
                        >
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={balance.Status === "SETTLED"}
                          onClick={() => setDeleteTarget(balance)}
                        >
                          <Trash className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AddOpeningBalanceDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={fetchBalances}
        openingBalanceId={selectedId}
        isEditMode={isEditMode}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Opening Balance</AlertDialogTitle>
            <AlertDialogDescription>
              Remove the opening balance of {formatCurrency(deleteTarget?.Amount || 0)} for{" "}
              {deleteTarget?.CustomerName}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Transactional Data</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will permanently delete all sales invoices, payments, collections,
                  and related customer account transactions for the current business line.
                  Customer master data (names, contacts, credit limits, price lists) will
                  be retained. Product stock quantities from sales will be restored.
                </p>
                <p className="font-medium text-red-600">
                  Type <code>CLEAR TRANSACTIONAL DATA</code> to confirm:
                </p>
                <Input
                  value={clearConfirmText}
                  onChange={(e) => setClearConfirmText(e.target.value)}
                  placeholder="CLEAR TRANSACTIONAL DATA"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleClearTransactionalData}
              disabled={isClearing || clearConfirmText !== "CLEAR TRANSACTIONAL DATA"}
            >
              {isClearing ? "Clearing..." : "Clear Data"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showImportResults} onOpenChange={setShowImportResults}>
        <AlertDialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Import Results</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-sm">
                {importResults && (
                  <>
                    <p>{importResults.message}</p>
                    {importResults.errors.length > 0 && (
                      <div>
                        <p className="font-medium text-red-600 mb-2">
                          Errors ({importResults.errors.length})
                        </p>
                        <ul className="space-y-1 max-h-40 overflow-y-auto">
                          {importResults.errors.map((err, i) => (
                            <li key={i} className="text-red-600">
                              Row {err.row}
                              {err.customerCode ? ` (${err.customerCode})` : ""}: {err.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {importResults.success.length > 0 && (
                      <div>
                        <p className="font-medium text-green-600 mb-2">
                          Successful ({importResults.success.length})
                        </p>
                        <ul className="space-y-1 max-h-40 overflow-y-auto">
                          {importResults.success.map((s, i) => (
                            <li key={i} className="text-green-700">
                              Row {s.row}: {s.customerName} — {s.action}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button onClick={() => setShowImportResults(false)}>Close</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
