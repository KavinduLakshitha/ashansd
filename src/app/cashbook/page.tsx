"use client";

import { useCallback, useEffect, useState } from "react";
import { addDays, format } from "date-fns";
import { DateRange } from "react-day-picker";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Download, Eraser, Pencil, Plus, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
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
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableOptionSelect } from "@/components/SearchableOptionSelect";
import { useAuth } from "@/app/auth/auth-context";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api/axios";
import { AxiosError } from "axios";
import {
  DirectoryBank,
  DirectoryBranch,
  loadBankDirectory,
} from "@/lib/bank-directory";

interface CashbookEntry {
  EntryID: number;
  EntryDate: string;
  Direction: "IN" | "OUT";
  Amount: number;
  Category: string;
  ExpenseCategoryID: number | null;
  ExpenseCategoryName: string | null;
  ExpenseParentCategoryID?: number | null;
  ExpenseParentCategoryName?: string | null;
  Description: string | null;
  ReferenceType: string | null;
  ReferenceID: number | null;
  AccountType: "CASH" | "BANK";
  BankAccountID?: number | null;
  BankAccountName?: string | null;
  CreatedBy?: number | null;
  CreatedByName?: string | null;
  CreatedAt?: string | null;
  UpdatedAt?: string | null;
  BusinessLineID?: number;
}

interface ExpenseCategory {
  ExpenseCategoryID: number;
  Name: string;
  ParentCategoryID?: number | null;
  ParentName?: string | null;
  IsPredefined: number | boolean;
}

interface BankAccount {
  BankAccountID: number;
  Name: string;
  BankName: string | null;
  BankCode?: string | null;
  BranchName?: string | null;
  BranchCode?: string | null;
  AccountNumber: string | null;
  IsActive: number | boolean;
}

interface CashbookSummary {
  totalIn: number;
  totalOut: number;
  net: number;
  cashBalance: number;
  bankBalance: number;
  entryCount: number;
}

const CREATE_NEW_CATEGORY = "__create_new__";
const CREATE_NEW_BANK_ACCOUNT = "__create_new_bank__";
const DEFAULT_CATEGORY_TARGET = "__default__";
const INITIAL_ENTRY_LINES = 5;

type ManualEntryLine = {
  id: string;
  amount: string;
  description: string;
  expenseCategoryId: string;
};

const createEmptyLine = (): ManualEntryLine => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  amount: "",
  description: "",
  expenseCategoryId: "",
});

const createEmptyLines = (count: number): ManualEntryLine[] =>
  Array.from({ length: Math.max(0, count) }, (_, index) => ({
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`,
    amount: "",
    description: "",
    expenseCategoryId: "",
  }));

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

const formatExpenseCategoryOption = (cat: ExpenseCategory) =>
  cat.ParentName ? `${cat.ParentName} › ${cat.Name}` : cat.Name;

const formatEntryExpenseCategory = (entry: {
  ExpenseCategoryName?: string | null;
  ExpenseParentCategoryName?: string | null;
}) => {
  if (!entry.ExpenseCategoryName) return "—";
  if (entry.ExpenseParentCategoryName) {
    return `${entry.ExpenseParentCategoryName} › ${entry.ExpenseCategoryName}`;
  }
  return entry.ExpenseCategoryName;
};

export default function CashbookPage() {
  const { user, getBusinessLineID } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const canManage = ["superuser", "admin", "management"].includes(user?.userType || "");
  const canClear = ["superuser", "admin"].includes(user?.userType || "");

  const [entries, setEntries] = useState<CashbookEntry[]>([]);
  const [summary, setSummary] = useState<CashbookSummary | null>(null);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [bankAccountFilter, setBankAccountFilter] = useState<string>("all");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dateFilterMode, setDateFilterMode] = useState<"range" | "asOf">("range");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });
  const [asOfDate, setAsOfDate] = useState<Date>(new Date());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CashbookEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [clearOpen, setClearOpen] = useState(false);
  const [clearBalances, setClearBalances] = useState<{
    cashBalance: number;
    bankBalance: number;
  } | null>(null);
  const [exportDownloaded, setExportDownloaded] = useState(false);
  const [downloadingExport, setDownloadingExport] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");
  const [clearing, setClearing] = useState(false);

  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryParentId, setNewCategoryParentId] = useState<string>("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryLineId, setCategoryLineId] = useState<string | null>(null);

  const [newBankOpen, setNewBankOpen] = useState(false);
  const [manageBanksOpen, setManageBanksOpen] = useState(false);
  const [newBankForm, setNewBankForm] = useState({
    name: "",
    bankCode: "",
    branchCode: "",
    accountNumber: "",
  });
  const [directoryBanks, setDirectoryBanks] = useState<DirectoryBank[]>([]);
  const [directoryBranchesByBank, setDirectoryBranchesByBank] = useState<
    Record<string, DirectoryBranch[]>
  >({});
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [creatingBank, setCreatingBank] = useState(false);
  const [selectNewBankAfterCreate, setSelectNewBankAfterCreate] = useState(false);
  const [selectNewBankForTransfer, setSelectNewBankForTransfer] = useState<
    null | "from" | "to"
  >(null);

  const [editBankTarget, setEditBankTarget] = useState<BankAccount | null>(null);
  const [editBankForm, setEditBankForm] = useState({ name: "", accountNumber: "" });
  const [savingBankEdit, setSavingBankEdit] = useState(false);
  const [deleteBankTarget, setDeleteBankTarget] = useState<BankAccount | null>(null);
  const [deletingBank, setDeletingBank] = useState(false);

  const [form, setForm] = useState({
    entryDate: format(new Date(), "yyyy-MM-dd"),
    direction: "IN" as "IN" | "OUT",
    accountType: "CASH" as "CASH" | "BANK",
    bankAccountId: "",
    defaultExpenseCategoryId: "",
    lines: createEmptyLines(INITIAL_ENTRY_LINES) as ManualEntryLine[],
  });

  const [transferForm, setTransferForm] = useState({
    entryDate: format(new Date(), "yyyy-MM-dd"),
    transferType: "CASH_TO_BANK" as "CASH_TO_BANK" | "BANK_TO_BANK",
    amount: "",
    fromBankAccountId: "",
    toBankAccountId: "",
    description: "",
  });

  useEffect(() => {
    if (user && !canManage) {
      router.push("/dashboard");
    }
  }, [user, canManage, router]);

  const fetchExpenseCategories = useCallback(async () => {
    const businessLineId = getBusinessLineID();
    if (!businessLineId) return [];

    const response = await api.get("/cashbook/expense-categories", {
      params: { businessLineId },
    });
    const data: ExpenseCategory[] = response.data.data || [];
    setExpenseCategories(data);
    return data;
  }, [getBusinessLineID]);

  const fetchBankAccounts = useCallback(async () => {
    const businessLineId = getBusinessLineID();
    if (!businessLineId) return [];

    const response = await api.get("/cashbook/bank-accounts", {
      params: { businessLineId },
    });
    const data: BankAccount[] = response.data.data || [];
    setBankAccounts(data);
    return data;
  }, [getBusinessLineID]);

  const fetchData = useCallback(async () => {
    const businessLineId = getBusinessLineID();
    if (!businessLineId) return;

    setLoading(true);
    try {
      const params: Record<string, string> = { businessLineId: String(businessLineId) };
      if (dateFilterMode === "asOf") {
        params.endDate = format(asOfDate, "yyyy-MM-dd");
      } else {
        if (dateRange?.from) params.startDate = format(dateRange.from, "yyyy-MM-dd");
        if (dateRange?.to) params.endDate = format(dateRange.to, "yyyy-MM-dd");
      }
      if (directionFilter !== "all") params.direction = directionFilter;
      if (accountFilter !== "all") params.accountType = accountFilter;
      if (bankAccountFilter !== "all") params.bankAccountId = bankAccountFilter;
      if (expenseCategoryFilter !== "all") params.expenseCategoryId = expenseCategoryFilter;
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
        fetchExpenseCategories(),
        fetchBankAccounts(),
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
  }, [
    getBusinessLineID,
    dateFilterMode,
    dateRange,
    asOfDate,
    directionFilter,
    accountFilter,
    bankAccountFilter,
    expenseCategoryFilter,
    search,
    toast,
    fetchExpenseCategories,
    fetchBankAccounts,
  ]);

  useEffect(() => {
    if (canManage) {
      fetchData();
    }
  }, [canManage, fetchData]);

  const openCreateDialog = (direction: "IN" | "OUT" = "IN") => {
    setForm({
      entryDate: format(new Date(), "yyyy-MM-dd"),
      direction,
      accountType: "CASH",
      bankAccountId: "",
      defaultExpenseCategoryId: "",
      lines: createEmptyLines(INITIAL_ENTRY_LINES),
    });
    setCategoryLineId(null);
    setDialogOpen(true);
  };

  const openTransferDialog = () => {
    setTransferForm({
      entryDate: format(new Date(), "yyyy-MM-dd"),
      transferType: "CASH_TO_BANK",
      amount: "",
      fromBankAccountId: "",
      toBankAccountId: "",
      description: "",
    });
    setTransferOpen(true);
  };

  const openNewBankDialog = async (
    selectAfterCreate = false,
    transferField: null | "from" | "to" = null
  ) => {
    setSelectNewBankAfterCreate(selectAfterCreate);
    setSelectNewBankForTransfer(transferField);
    setNewBankForm({ name: "", bankCode: "", branchCode: "", accountNumber: "" });
    setNewBankOpen(true);

    if (directoryBanks.length > 0) return;

    setLoadingDirectory(true);
    try {
      const directory = await loadBankDirectory();
      setDirectoryBanks(directory.banks);
      setDirectoryBranchesByBank(directory.branchesByBank);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to load bank branch directory",
        variant: "destructive",
      });
    } finally {
      setLoadingDirectory(false);
    }
  };

  const openManageBanksDialog = () => {
    setManageBanksOpen(true);
  };

  const openEditBankDialog = (account: BankAccount) => {
    setEditBankTarget(account);
    setEditBankForm({
      name: account.Name || "",
      accountNumber: account.AccountNumber || "",
    });
  };

  const selectedDirectoryBank = directoryBanks.find(
    (bank) => bank.code === newBankForm.bankCode
  );
  const selectedDirectoryBranches = newBankForm.bankCode
    ? directoryBranchesByBank[newBankForm.bankCode] || []
    : [];
  const selectedDirectoryBranch = selectedDirectoryBranches.find(
    (branch) => branch.code === newBankForm.branchCode
  );

  const suggestAccountName = (bankName?: string, branchName?: string) => {
    if (bankName && branchName) return `${bankName} — ${branchName}`.slice(0, 100);
    if (bankName) return bankName.slice(0, 100);
    return "";
  };

  const handleDirectoryBankChange = (bankCode: string) => {
    const bank = directoryBanks.find((item) => item.code === bankCode);
    setNewBankForm((prev) => ({
      ...prev,
      bankCode,
      branchCode: "",
      name: suggestAccountName(bank?.name),
    }));
  };

  const handleDirectoryBranchChange = (branchCode: string) => {
    const branch = selectedDirectoryBranches.find((item) => item.code === branchCode);
    setNewBankForm((prev) => ({
      ...prev,
      branchCode,
      name: suggestAccountName(selectedDirectoryBank?.name, branch?.name),
    }));
  };

  const updateFormLine = (lineId: string, patch: Partial<ManualEntryLine>) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line) =>
        line.id === lineId ? { ...line, ...patch } : line
      ),
    }));
  };

  const addFormLines = (count = INITIAL_ENTRY_LINES) => {
    setForm((prev) => {
      const remaining = 50 - prev.lines.length;
      if (remaining <= 0) return prev;
      return {
        ...prev,
        lines: [...prev.lines, ...createEmptyLines(Math.min(count, remaining))],
      };
    });
  };

  const removeFormLine = (lineId: string) => {
    setForm((prev) => {
      if (prev.lines.length <= 1) {
        return {
          ...prev,
          lines: [createEmptyLine()],
        };
      }
      return {
        ...prev,
        lines: prev.lines.filter((line) => line.id !== lineId),
      };
    });
  };

  const applyDefaultCategoryToAll = () => {
    if (!form.defaultExpenseCategoryId) {
      toast({
        title: "Select a category first",
        description: "Choose the shared category, then apply it to every row.",
        variant: "destructive",
      });
      return;
    }
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => ({
        ...line,
        expenseCategoryId: prev.defaultExpenseCategoryId,
      })),
    }));
  };

  const handleDefaultExpenseCategorySelect = (value: string) => {
    if (value === CREATE_NEW_CATEGORY) {
      setCategoryLineId(DEFAULT_CATEGORY_TARGET);
      setNewCategoryName("");
      setNewCategoryParentId("");
      setNewCategoryOpen(true);
      return;
    }
    setForm((prev) => ({ ...prev, defaultExpenseCategoryId: value }));
  };

  const handleExpenseCategorySelect = (lineId: string, value: string) => {
    if (value === CREATE_NEW_CATEGORY) {
      setCategoryLineId(lineId);
      setNewCategoryName("");
      setNewCategoryParentId(form.defaultExpenseCategoryId || "");
      setNewCategoryOpen(true);
      return;
    }
    updateFormLine(lineId, { expenseCategoryId: value });
  };

  const handleBankAccountSelect = (value: string) => {
    if (value === CREATE_NEW_BANK_ACCOUNT) {
      openNewBankDialog(true);
      return;
    }
    setForm((prev) => ({ ...prev, bankAccountId: value }));
  };

  const handleCreateCategory = async () => {
    const businessLineId = getBusinessLineID();
    if (!businessLineId) return;

    const name = newCategoryName.trim();
    if (!name) {
      toast({
        title: "Invalid category",
        description: "Enter a category name.",
        variant: "destructive",
      });
      return;
    }

    setCreatingCategory(true);
    try {
      const response = await api.post("/cashbook/expense-categories", {
        businessLineId,
        name,
        parentCategoryId: newCategoryParentId
          ? Number(newCategoryParentId)
          : undefined,
      });
      const created: ExpenseCategory = response.data.data;
      await fetchExpenseCategories();
      const createdId = String(created.ExpenseCategoryID);
      if (categoryLineId === DEFAULT_CATEGORY_TARGET) {
        setForm((prev) => ({ ...prev, defaultExpenseCategoryId: createdId }));
      } else if (categoryLineId) {
        updateFormLine(categoryLineId, {
          expenseCategoryId: createdId,
        });
      }
      setNewCategoryOpen(false);
      setNewCategoryName("");
      setNewCategoryParentId("");
      setCategoryLineId(null);
      toast({
        title: created.ParentCategoryID ? "Subcategory added" : "Category added",
        description: `"${formatExpenseCategoryOption(created)}" is ready to use.`,
      });
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast({
        title: "Error",
        description: axiosError.response?.data?.message || "Failed to create category",
        variant: "destructive",
      });
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleCreateBankAccount = async () => {
    const businessLineId = getBusinessLineID();
    if (!businessLineId) return;

    const name = newBankForm.name.trim();
    const bank = selectedDirectoryBank;
    if (!bank) {
      toast({
        title: "Bank required",
        description: "Select a bank from the directory.",
        variant: "destructive",
      });
      return;
    }
    if (!name) {
      toast({
        title: "Invalid bank account",
        description: "Enter an account name.",
        variant: "destructive",
      });
      return;
    }

    setCreatingBank(true);
    try {
      const response = await api.post("/cashbook/bank-accounts", {
        businessLineId,
        name,
        bankName: bank.name,
        bankCode: bank.code,
        branchName: selectedDirectoryBranch?.name,
        branchCode: selectedDirectoryBranch?.code,
        accountNumber: newBankForm.accountNumber.trim() || undefined,
      });
      const created: BankAccount = response.data.data;
      await fetchBankAccounts();
      if (selectNewBankAfterCreate) {
        setForm((prev) => ({
          ...prev,
          accountType: "BANK",
          bankAccountId: String(created.BankAccountID),
        }));
      } else if (selectNewBankForTransfer === "from") {
        setTransferForm((prev) => ({
          ...prev,
          fromBankAccountId: String(created.BankAccountID),
        }));
      } else if (selectNewBankForTransfer === "to") {
        setTransferForm((prev) => ({
          ...prev,
          toBankAccountId: String(created.BankAccountID),
        }));
      }
      setNewBankOpen(false);
      setNewBankForm({ name: "", bankCode: "", branchCode: "", accountNumber: "" });
      setSelectNewBankAfterCreate(false);
      setSelectNewBankForTransfer(null);
      if (!selectNewBankAfterCreate && !selectNewBankForTransfer) {
        setManageBanksOpen(true);
      }
      toast({
        title: "Bank account added",
        description: `"${created.Name}" is ready to use.`,
      });
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast({
        title: "Error",
        description: axiosError.response?.data?.message || "Failed to create bank account",
        variant: "destructive",
      });
    } finally {
      setCreatingBank(false);
    }
  };

  const handleUpdateBankAccount = async () => {
    const businessLineId = getBusinessLineID();
    if (!businessLineId || !editBankTarget) return;

    const name = editBankForm.name.trim();
    if (!name) {
      toast({
        title: "Invalid bank account",
        description: "Enter an account name.",
        variant: "destructive",
      });
      return;
    }

    setSavingBankEdit(true);
    try {
      await api.put(`/cashbook/bank-accounts/${editBankTarget.BankAccountID}`, {
        businessLineId,
        name,
        accountNumber: editBankForm.accountNumber.trim() || null,
      });
      toast({
        title: "Bank account updated",
        description: `"${name}" saved.`,
      });
      setEditBankTarget(null);
      setManageBanksOpen(true);
      await fetchBankAccounts();
      await fetchData();
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast({
        title: "Error",
        description: axiosError.response?.data?.message || "Failed to update bank account",
        variant: "destructive",
      });
    } finally {
      setSavingBankEdit(false);
    }
  };

  const handleDeleteBankAccount = async () => {
    const businessLineId = getBusinessLineID();
    if (!businessLineId || !deleteBankTarget) return;

    setDeletingBank(true);
    try {
      await api.delete(`/cashbook/bank-accounts/${deleteBankTarget.BankAccountID}`, {
        params: { businessLineId },
      });
      toast({
        title: "Bank account deleted",
        description: `"${deleteBankTarget.Name}" was removed.`,
      });
      if (form.bankAccountId === String(deleteBankTarget.BankAccountID)) {
        setForm((prev) => ({ ...prev, bankAccountId: "" }));
      }
      if (bankAccountFilter === String(deleteBankTarget.BankAccountID)) {
        setBankAccountFilter("all");
      }
      setDeleteBankTarget(null);
      setManageBanksOpen(true);
      await fetchBankAccounts();
      await fetchData();
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast({
        title: "Error",
        description: axiosError.response?.data?.message || "Failed to delete bank account",
        variant: "destructive",
      });
    } finally {
      setDeletingBank(false);
    }
  };

  const handleCreate = async () => {
    const businessLineId = getBusinessLineID();
    if (!businessLineId) return;

    if (!form.entryDate) {
      toast({
        title: "Invalid entry",
        description: "Enter a valid date.",
        variant: "destructive",
      });
      return;
    }

    if (form.accountType === "BANK" && !form.bankAccountId) {
      toast({
        title: "Bank account required",
        description: "Select or create a bank account.",
        variant: "destructive",
      });
      return;
    }

    const activeLines = form.lines
      .map((line, index) => ({
        index,
        amountRaw: line.amount.trim(),
        amount: parseFloat(line.amount),
        description: line.description.trim(),
        expenseCategoryId:
          line.expenseCategoryId || form.defaultExpenseCategoryId || "",
        hasContent:
          line.amount.trim() !== "" ||
          line.description.trim() !== "" ||
          !!line.expenseCategoryId,
      }))
      .filter((line) => line.hasContent);

    if (activeLines.length === 0) {
      toast({
        title: "Nothing to save",
        description: "Enter at least one amount in the table.",
        variant: "destructive",
      });
      return;
    }

    const invalidAmount = activeLines.find(
      (line) => line.amountRaw === "" || !(line.amount > 0)
    );
    if (invalidAmount) {
      toast({
        title: "Invalid amount",
        description: `Row ${invalidAmount.index + 1}: enter an amount greater than zero.`,
        variant: "destructive",
      });
      return;
    }

    if (form.direction === "OUT") {
      const missingCategory = activeLines.find((line) => !line.expenseCategoryId);
      if (missingCategory) {
        toast({
          title: "Category required",
          description: `Row ${missingCategory.index + 1}: select a category, or set a shared category above the table.`,
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);
    try {
      const response = await api.post("/cashbook/bulk", {
        businessLineId,
        entryDate: form.entryDate,
        direction: form.direction,
        accountType: form.accountType,
        bankAccountId:
          form.accountType === "BANK" ? Number(form.bankAccountId) : undefined,
        entries: activeLines.map((line) => ({
          amount: line.amount,
          description: line.description || undefined,
          category: form.direction === "IN" ? "MANUAL_INCOME" : "MANUAL_EXPENSE",
          expenseCategoryId:
            form.direction === "OUT" ? Number(line.expenseCategoryId) : undefined,
        })),
      });
      const count = Number(response.data.count || activeLines.length);
      toast({
        title: count === 1 ? "Entry added" : "Entries added",
        description:
          count === 1
            ? "Manual cashbook entry created."
            : `${count} manual cashbook entries created.`,
      });
      setDialogOpen(false);
      await fetchData();
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast({
        title: "Error",
        description: axiosError.response?.data?.message || "Failed to create entries",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTransfer = async () => {
    const businessLineId = getBusinessLineID();
    if (!businessLineId) return;

    const amount = parseFloat(transferForm.amount);
    if (!transferForm.entryDate || !(amount > 0)) {
      toast({
        title: "Invalid transfer",
        description: "Enter a valid date and amount greater than zero.",
        variant: "destructive",
      });
      return;
    }

    if (!transferForm.toBankAccountId) {
      toast({
        title: "Destination required",
        description: "Select the destination bank account.",
        variant: "destructive",
      });
      return;
    }

    if (transferForm.transferType === "BANK_TO_BANK") {
      if (!transferForm.fromBankAccountId) {
        toast({
          title: "Source required",
          description: "Select the source bank account.",
          variant: "destructive",
        });
        return;
      }
      if (transferForm.fromBankAccountId === transferForm.toBankAccountId) {
        toast({
          title: "Invalid accounts",
          description: "Source and destination bank accounts must be different.",
          variant: "destructive",
        });
        return;
      }
    }

    setTransferring(true);
    try {
      await api.post("/cashbook/transfer", {
        businessLineId,
        entryDate: transferForm.entryDate,
        amount,
        transferType: transferForm.transferType,
        fromBankAccountId:
          transferForm.transferType === "BANK_TO_BANK"
            ? Number(transferForm.fromBankAccountId)
            : undefined,
        toBankAccountId: Number(transferForm.toBankAccountId),
        description: transferForm.description || undefined,
      });
      toast({
        title: "Transfer recorded",
        description:
          transferForm.transferType === "CASH_TO_BANK"
            ? "Cash moved to bank account."
            : "Funds moved between bank accounts.",
      });
      setTransferOpen(false);
      await fetchData();
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast({
        title: "Error",
        description: axiosError.response?.data?.message || "Failed to record transfer",
        variant: "destructive",
      });
    } finally {
      setTransferring(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/cashbook/${deleteTarget.EntryID}`);
      toast({
        title: "Deleted",
        description: isTransferEntry(deleteTarget)
          ? "Transfer removed from both accounts."
          : "Manual entry removed.",
      });
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

  const openClearDialog = async () => {
    const businessLineId = getBusinessLineID();
    if (!businessLineId) return;

    setExportDownloaded(false);
    setClearConfirmText("");
    setClearBalances(null);
    setClearOpen(true);

    try {
      const response = await api.get("/cashbook/balances", {
        params: { businessLineId },
      });
      setClearBalances({
        cashBalance: Number(response.data.cashBalance || 0),
        bankBalance: Number(response.data.bankBalance || 0),
      });
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast({
        title: "Error",
        description: axiosError.response?.data?.message || "Failed to load balances",
        variant: "destructive",
      });
      setClearOpen(false);
    }
  };

  const handleDownloadExport = async () => {
    const businessLineId = getBusinessLineID();
    if (!businessLineId) return;

    setDownloadingExport(true);
    try {
      // Fetch every entry (no date/filters) so the export matches the full cashbook
      const [entriesRes, balancesRes, summaryRes] = await Promise.all([
        api.get("/cashbook", { params: { businessLineId } }),
        api.get("/cashbook/balances", { params: { businessLineId } }),
        api.get("/cashbook/summary", { params: { businessLineId } }),
      ]);

      const allEntries: CashbookEntry[] = entriesRes.data.data || [];
      const cashBalance = Number(balancesRes.data.cashBalance || 0);
      const bankBalance = Number(balancesRes.data.bankBalance || 0);
      const totalIn = Number(summaryRes.data.totalIn || 0);
      const totalOut = Number(summaryRes.data.totalOut || 0);

      if (allEntries.length === 0) {
        throw new Error("No cashbook entries found to export");
      }

      const formatEntryDate = (value: string | null | undefined) => {
        if (!value) return "";
        try {
          return format(new Date(value), "yyyy-MM-dd");
        } catch {
          return String(value).slice(0, 10);
        }
      };

      const sorted = [...allEntries].sort((a, b) => {
        const dateCompare =
          formatEntryDate(a.EntryDate).localeCompare(formatEntryDate(b.EntryDate));
        if (dateCompare !== 0) return dateCompare;
        return Number(a.EntryID) - Number(b.EntryID);
      });

      let runningCash = 0;
      let runningBank = 0;

      const header = [
        "Entry ID",
        "Date",
        "Direction",
        "Account",
        "Bank Account",
        "Amount",
        "In Amount",
        "Out Amount",
        "Category",
        "Expense Category",
        "Description",
        "Reference Type",
        "Reference ID",
        "Created By",
        "Created At",
        "Running Cash Balance",
        "Running Bank Balance",
        "Running Total Balance",
      ];

      const dataRows = sorted.map((entry) => {
        const amount = Number(entry.Amount) || 0;
        const signed = entry.Direction === "OUT" ? -amount : amount;
        if (entry.AccountType === "CASH") runningCash += signed;
        if (entry.AccountType === "BANK") runningBank += signed;

        return [
          entry.EntryID,
          formatEntryDate(entry.EntryDate),
          entry.Direction,
          entry.AccountType,
          entry.BankAccountName || "",
          amount,
          entry.Direction === "IN" ? amount : 0,
          entry.Direction === "OUT" ? amount : 0,
          categoryLabel(entry.Category),
          entry.ExpenseCategoryName
            ? formatEntryExpenseCategory(entry)
            : "",
          entry.Description || "",
          entry.ReferenceType || "",
          entry.ReferenceID ?? "",
          entry.CreatedByName || "",
          entry.CreatedAt ? formatEntryDate(entry.CreatedAt) : "",
          Number(runningCash.toFixed(2)),
          Number(runningBank.toFixed(2)),
          Number((runningCash + runningBank).toFixed(2)),
        ];
      });

      const wb = XLSX.utils.book_new();

      // Sheet 1: every daily/individual record (this is the main sheet)
      const recordsAoA = [header, ...dataRows];
      const recordsSheet = XLSX.utils.aoa_to_sheet(recordsAoA);
      recordsSheet["!cols"] = [
        { wch: 10 },
        { wch: 12 },
        { wch: 10 },
        { wch: 10 },
        { wch: 18 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 18 },
        { wch: 18 },
        { wch: 45 },
        { wch: 14 },
        { wch: 12 },
        { wch: 16 },
        { wch: 12 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, recordsSheet, "All Records");

      // Sheet 2: totals only
      const summaryAoA = [
        ["Cashbook Export Summary"],
        ["Exported At", format(new Date(), "yyyy-MM-dd HH:mm:ss")],
        ["Business Line ID", businessLineId],
        ["Total Records", allEntries.length],
        ["Total In", totalIn],
        ["Total Out", totalOut],
        ["Net", totalIn - totalOut],
        ["Cash Balance", cashBalance],
        ["Bank Balance", bankBalance],
        ["Total Balance", cashBalance + bankBalance],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryAoA);
      summarySheet["!cols"] = [{ wch: 18 }, { wch: 28 }];
      XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

      const fileName = `cashbook-export-${businessLineId}-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      setExportDownloaded(true);
      toast({
        title: "Records downloaded",
        description: `${allEntries.length} cashbook records saved. You can now clear the cashbook.`,
      });
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast({
        title: "Error",
        description:
          (error instanceof Error && error.message) ||
          axiosError.response?.data?.message ||
          "Failed to download cashbook records",
        variant: "destructive",
      });
    } finally {
      setDownloadingExport(false);
    }
  };

  const handleClearCashbook = async () => {
    const businessLineId = getBusinessLineID();
    if (!businessLineId) return;

    if (!exportDownloaded) {
      toast({
        title: "Download required",
        description: "Download the cashbook records before clearing.",
        variant: "destructive",
      });
      return;
    }

    if (clearConfirmText.trim().toUpperCase() !== "CLEAR") {
      toast({
        title: "Confirmation required",
        description: 'Type CLEAR to confirm.',
        variant: "destructive",
      });
      return;
    }

    setClearing(true);
    try {
      const response = await api.post("/cashbook/clear", {
        businessLineId,
        confirmText: "CLEAR",
      });
      toast({
        title: "Cashbook cleared",
        description: `${response.data.deletedCount || 0} entries removed. Balances are now zero.`,
      });
      setClearOpen(false);
      setExportDownloaded(false);
      setClearConfirmText("");
      await fetchData();
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast({
        title: "Error",
        description: axiosError.response?.data?.message || "Failed to clear cashbook",
        variant: "destructive",
      });
    } finally {
      setClearing(false);
    }
  };

  const isDeletable = (entry: CashbookEntry) =>
    entry.ReferenceType === "MANUAL" ||
    entry.ReferenceType === "TRANSFER" ||
    entry.Category === "MANUAL_INCOME" ||
    entry.Category === "MANUAL_EXPENSE" ||
    entry.Category === "TRANSFER_OUT" ||
    entry.Category === "TRANSFER_IN";

  const rootExpenseCategories = expenseCategories.filter((cat) => !cat.ParentCategoryID);
  const hasSavableManualEntry = form.lines.some((line) => Number(line.amount) > 0);

  const isTransferEntry = (entry: CashbookEntry | null) =>
    !!entry &&
    (entry.ReferenceType === "TRANSFER" ||
      entry.Category === "TRANSFER_OUT" ||
      entry.Category === "TRANSFER_IN");

  if (!canManage) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader className="bg-gray-50 border-b border-gray-200 flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-xl font-semibold text-gray-800">Cashbook</CardTitle>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {canClear && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800"
                onClick={openClearDialog}
              >
                <Eraser className="h-4 w-4 mr-1" />
                Clear cashbook
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={openManageBanksDialog}>
              Bank Accounts
            </Button>
            <Button variant="outline" size="sm" onClick={openTransferDialog}>
              <ArrowLeftRight className="h-4 w-4 mr-1" />
              Transfer
            </Button>
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

          <div className="flex flex-col lg:flex-row gap-3 lg:items-center flex-wrap">
            <div className="flex gap-2 items-center">
              <Button
                type="button"
                variant={dateFilterMode === "range" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilterMode("range")}
              >
                Date Range
              </Button>
              <Button
                type="button"
                variant={dateFilterMode === "asOf" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilterMode("asOf")}
              >
                As of Date
              </Button>
            </div>
            {dateFilterMode === "range" ? (
              <DatePickerWithRange selected={dateRange} onChange={setDateRange} />
            ) : (
              <DatePicker selectedDate={asOfDate} onDateChange={setAsOfDate} />
            )}
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
            <Select
              value={accountFilter}
              onValueChange={(value) => {
                setAccountFilter(value);
                if (value !== "BANK") setBankAccountFilter("all");
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Cash + Bank</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="BANK">Bank</SelectItem>
              </SelectContent>
            </Select>
            {(accountFilter === "BANK" || accountFilter === "all") && bankAccounts.length > 0 && (
              <Select value={bankAccountFilter} onValueChange={setBankAccountFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Bank account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All bank accounts</SelectItem>
                  {bankAccounts.map((account) => (
                    <SelectItem
                      key={account.BankAccountID}
                      value={String(account.BankAccountID)}
                    >
                      {account.Name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={expenseCategoryFilter} onValueChange={setExpenseCategoryFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Expense category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All expense categories</SelectItem>
                {expenseCategories.map((cat) => (
                  <SelectItem key={cat.ExpenseCategoryID} value={String(cat.ExpenseCategoryID)}>
                    {cat.ParentCategoryID ? `↳ ${cat.Name}` : cat.Name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="w-full lg:w-64"
              placeholder="Search description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="font-bold text-black">Date</TableHead>
                  <TableHead className="font-bold text-black">Direction</TableHead>
                  <TableHead className="font-bold text-black">Type</TableHead>
                  <TableHead className="font-bold text-black">Expense Category</TableHead>
                  <TableHead className="font-bold text-black">Account</TableHead>
                  <TableHead className="font-bold text-black">Description</TableHead>
                  <TableHead className="font-bold text-black text-right">Amount</TableHead>
                  <TableHead className="font-bold text-black text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6">
                      Loading cashbook...
                    </TableCell>
                  </TableRow>
                ) : entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                      {dateFilterMode === "asOf"
                        ? "No cashbook entries as of this date"
                        : "No cashbook entries for this period"}
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
                      <TableCell>{formatEntryExpenseCategory(entry)}</TableCell>
                      <TableCell>
                        {entry.AccountType === "BANK"
                          ? entry.BankAccountName
                            ? `Bank — ${entry.BankAccountName}`
                            : "Bank"
                          : "Cash"}
                      </TableCell>
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
                        {isDeletable(entry) ? (
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
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {form.direction === "IN" ? "Add Income" : "Add Expense"}
            </DialogTitle>
            <DialogDescription>
              Set the account once, then fill rows like a spreadsheet. Empty rows are
              skipped on save. Sales, purchases, and cheque realizations are recorded
              automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                    setForm((prev) => ({
                      ...prev,
                      direction: value as "IN" | "OUT",
                      defaultExpenseCategoryId:
                        value === "IN" ? "" : prev.defaultExpenseCategoryId,
                      lines: prev.lines.map((line) => ({
                        ...line,
                        expenseCategoryId: value === "IN" ? "" : line.expenseCategoryId,
                      })),
                    }))
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
                    setForm((prev) => ({
                      ...prev,
                      accountType: value as "CASH" | "BANK",
                      bankAccountId: value === "CASH" ? "" : prev.bankAccountId,
                    }))
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
              {form.accountType === "BANK" && (
                <div>
                  <Label>Bank Account</Label>
                  <Select
                    value={form.bankAccountId || undefined}
                    onValueChange={handleBankAccountSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select bank account" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((account) => (
                        <SelectItem
                          key={account.BankAccountID}
                          value={String(account.BankAccountID)}
                        >
                          {account.Name}
                          {account.BankName ? ` (${account.BankName}` : ""}
                          {account.BranchName ? ` — ${account.BranchName}` : ""}
                          {account.BankName ? ")" : ""}
                        </SelectItem>
                      ))}
                      <SelectItem value={CREATE_NEW_BANK_ACCOUNT}>
                        + Create new bank account
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {form.direction === "OUT" && (
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1 min-w-0">
                    <Label>Shared category (optional)</Label>
                    <p className="text-xs text-muted-foreground mb-1.5">
                      Use one category for every blank row. Override per row when needed.
                    </p>
                    <Select
                      value={form.defaultExpenseCategoryId || undefined}
                      onValueChange={handleDefaultExpenseCategorySelect}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Same category for all rows" />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseCategories.map((cat) => (
                          <SelectItem
                            key={cat.ExpenseCategoryID}
                            value={String(cat.ExpenseCategoryID)}
                          >
                            {cat.ParentCategoryID
                              ? `${cat.ParentName} › ${cat.Name}`
                              : cat.Name}
                          </SelectItem>
                        ))}
                        <SelectItem value={CREATE_NEW_CATEGORY}>
                          + Create new category / subcategory
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyDefaultCategoryToAll}
                    disabled={saving || !form.defaultExpenseCategoryId}
                  >
                    Apply to all rows
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-medium">
                  {form.direction === "IN" ? "Income grid" : "Expense grid"}
                </Label>
                <span className="text-xs text-muted-foreground">
                  {form.lines.length} rows · empty rows ignored
                </span>
              </div>

              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="w-10 text-center">#</TableHead>
                      {form.direction === "OUT" && (
                        <TableHead className="min-w-[200px]">Category</TableHead>
                      )}
                      <TableHead className="min-w-[130px]">Amount (Rs.)</TableHead>
                      <TableHead className="min-w-[220px]">Description</TableHead>
                      <TableHead className="w-12 text-center" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.lines.map((line, index) => (
                      <TableRow key={line.id} className="align-middle">
                        <TableCell className="text-center text-muted-foreground tabular-nums text-xs">
                          {index + 1}
                        </TableCell>
                        {form.direction === "OUT" && (
                          <TableCell className="p-1.5">
                            <Select
                              value={
                                line.expenseCategoryId ||
                                form.defaultExpenseCategoryId ||
                                undefined
                              }
                              onValueChange={(value) =>
                                handleExpenseCategorySelect(line.id, value)
                              }
                            >
                              <SelectTrigger className="h-9 border-0 shadow-none bg-transparent focus:ring-1">
                                <SelectValue
                                  placeholder={
                                    form.defaultExpenseCategoryId
                                      ? "Using shared category"
                                      : "Select category"
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {expenseCategories.map((cat) => (
                                  <SelectItem
                                    key={cat.ExpenseCategoryID}
                                    value={String(cat.ExpenseCategoryID)}
                                  >
                                    {cat.ParentCategoryID
                                      ? `${cat.ParentName} › ${cat.Name}`
                                      : cat.Name}
                                  </SelectItem>
                                ))}
                                <SelectItem value={CREATE_NEW_CATEGORY}>
                                  + Create new category / subcategory
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        )}
                        <TableCell className="p-1.5">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.amount}
                            onChange={(e) =>
                              updateFormLine(line.id, { amount: e.target.value })
                            }
                            className="h-9 border-0 shadow-none bg-transparent focus-visible:ring-1"
                            placeholder="0.00"
                          />
                        </TableCell>
                        <TableCell className="p-1.5">
                          <Input
                            value={line.description}
                            onChange={(e) =>
                              updateFormLine(line.id, { description: e.target.value })
                            }
                            className="h-9 border-0 shadow-none bg-transparent focus-visible:ring-1"
                            placeholder="Optional note"
                            onKeyDown={(e) => {
                              if (
                                e.key === "Enter" &&
                                index === form.lines.length - 1 &&
                                form.lines.length < 50
                              ) {
                                e.preventDefault();
                                addFormLines(1);
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="p-1 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeFormLine(line.id)}
                            disabled={saving}
                            aria-label={`Remove row ${index + 1}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addFormLines(1)}
                  disabled={saving || form.lines.length >= 50}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add row
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addFormLines(INITIAL_ENTRY_LINES)}
                  disabled={saving || form.lines.length >= 50}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add {INITIAL_ENTRY_LINES} rows
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || !hasSavableManualEntry}>
              {saving ? "Saving..." : "Save Entries"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={transferOpen}
        onOpenChange={(open) => {
          if (!open && (newBankOpen || creatingBank)) {
            return;
          }
          setTransferOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer funds</DialogTitle>
            <DialogDescription>
              Move money from cash to a bank account, or between two bank accounts. This does not count as income or expense.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="tr-date">Date</Label>
              <Input
                id="tr-date"
                type="date"
                value={transferForm.entryDate}
                onChange={(e) =>
                  setTransferForm((prev) => ({ ...prev, entryDate: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Transfer type</Label>
              <Select
                value={transferForm.transferType}
                onValueChange={(value) =>
                  setTransferForm((prev) => ({
                    ...prev,
                    transferType: value as "CASH_TO_BANK" | "BANK_TO_BANK",
                    fromBankAccountId:
                      value === "CASH_TO_BANK" ? "" : prev.fromBankAccountId,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH_TO_BANK">Cash → Bank</SelectItem>
                  <SelectItem value="BANK_TO_BANK">Bank → Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {transferForm.transferType === "BANK_TO_BANK" && (
              <div>
                <Label>From bank account</Label>
                <Select
                  value={transferForm.fromBankAccountId || undefined}
                  onValueChange={(value) => {
                    if (value === CREATE_NEW_BANK_ACCOUNT) {
                      openNewBankDialog(false, "from");
                      return;
                    }
                    setTransferForm((prev) => ({ ...prev, fromBankAccountId: value }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((account) => (
                      <SelectItem
                        key={account.BankAccountID}
                        value={String(account.BankAccountID)}
                      >
                        {account.Name}
                        {account.BankName ? ` (${account.BankName}` : ""}
                        {account.BranchName ? ` — ${account.BranchName}` : ""}
                        {account.BankName ? ")" : ""}
                      </SelectItem>
                    ))}
                    <SelectItem value={CREATE_NEW_BANK_ACCOUNT}>
                      + Create new bank account
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>To bank account</Label>
              <Select
                value={transferForm.toBankAccountId || undefined}
                onValueChange={(value) => {
                  if (value === CREATE_NEW_BANK_ACCOUNT) {
                    openNewBankDialog(false, "to");
                    return;
                  }
                  setTransferForm((prev) => ({ ...prev, toBankAccountId: value }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select destination account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts
                    .filter(
                      (account) =>
                        transferForm.transferType !== "BANK_TO_BANK" ||
                        String(account.BankAccountID) !== transferForm.fromBankAccountId
                    )
                    .map((account) => (
                      <SelectItem
                        key={account.BankAccountID}
                        value={String(account.BankAccountID)}
                      >
                        {account.Name}
                        {account.BankName ? ` (${account.BankName}` : ""}
                        {account.BranchName ? ` — ${account.BranchName}` : ""}
                        {account.BankName ? ")" : ""}
                      </SelectItem>
                    ))}
                  <SelectItem value={CREATE_NEW_BANK_ACCOUNT}>
                    + Create new bank account
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tr-amount">Amount (Rs.)</Label>
              <Input
                id="tr-amount"
                type="number"
                min="0"
                step="0.01"
                value={transferForm.amount}
                onChange={(e) =>
                  setTransferForm((prev) => ({ ...prev, amount: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="tr-desc">Description</Label>
              <Input
                id="tr-desc"
                value={transferForm.description}
                onChange={(e) =>
                  setTransferForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Optional note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTransferOpen(false)}
              disabled={transferring}
            >
              Cancel
            </Button>
            <Button onClick={handleTransfer} disabled={transferring}>
              {transferring ? "Transferring..." : "Record Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={newCategoryOpen}
        onOpenChange={(open) => {
          setNewCategoryOpen(open);
          if (!open) {
            setCategoryLineId(null);
            setNewCategoryParentId("");
            setNewCategoryName("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New expense category</DialogTitle>
            <DialogDescription>
              Create a main category, or choose a parent to add a subcategory under it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Parent category (optional)</Label>
              <Select
                value={newCategoryParentId || "__none__"}
                onValueChange={(value) =>
                  setNewCategoryParentId(value === "__none__" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None — main category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None — main category</SelectItem>
                  {rootExpenseCategories.map((cat) => (
                    <SelectItem
                      key={cat.ExpenseCategoryID}
                      value={String(cat.ExpenseCategoryID)}
                    >
                      {cat.Name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="new-cat-name">
                {newCategoryParentId ? "Subcategory name" : "Category name"}
              </Label>
              <Input
                id="new-cat-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={
                  newCategoryParentId ? "e.g. Fuel" : "e.g. Packaging"
                }
                maxLength={100}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateCategory();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewCategoryOpen(false);
                setCategoryLineId(null);
                setNewCategoryParentId("");
                setNewCategoryName("");
              }}
              disabled={creatingCategory}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateCategory} disabled={creatingCategory}>
              {creatingCategory ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={manageBanksOpen}
        onOpenChange={(open) => {
          // Nested create/edit/delete dialogs briefly unmount pointer-events on the
          // parent Dialog; ignore those close events so the list stays open.
          if (
            !open &&
            (newBankOpen || editBankTarget || deleteBankTarget || creatingBank || savingBankEdit || deletingBank)
          ) {
            return;
          }
          setManageBanksOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Bank accounts</DialogTitle>
            <DialogDescription>
              View, edit, or remove bank accounts for this business line.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => openNewBankDialog(false)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add bank account
            </Button>
          </div>

          <div className="rounded-md border max-h-[420px] overflow-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="font-bold text-black">Account name</TableHead>
                  <TableHead className="font-bold text-black">Bank</TableHead>
                  <TableHead className="font-bold text-black">Branch</TableHead>
                  <TableHead className="font-bold text-black">Account number</TableHead>
                  <TableHead className="font-bold text-black text-center w-[100px]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bankAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      No bank accounts yet. Add one to start recording bank entries.
                    </TableCell>
                  </TableRow>
                ) : (
                  bankAccounts.map((account) => (
                    <TableRow key={account.BankAccountID}>
                      <TableCell className="font-medium">{account.Name}</TableCell>
                      <TableCell>{account.BankName || "—"}</TableCell>
                      <TableCell>{account.BranchName || "—"}</TableCell>
                      <TableCell className="tabular-nums">
                        {account.AccountNumber || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditBankDialog(account)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:bg-red-50 hover:text-red-600"
                            onClick={() => setDeleteBankTarget(account)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManageBanksOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={newBankOpen}
        onOpenChange={(open) => {
          setNewBankOpen(open);
          if (!open) {
            setSelectNewBankAfterCreate(false);
            setSelectNewBankForTransfer(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md overflow-visible">
          <DialogHeader>
            <DialogTitle>New bank account</DialogTitle>
            <DialogDescription>
              Choose bank and branch from the LankaPay directory, then set an account label and number.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Bank</Label>
              <SearchableOptionSelect
                value={newBankForm.bankCode}
                onChange={handleDirectoryBankChange}
                options={directoryBanks.map((bank) => ({
                  value: bank.code,
                  label: bank.name,
                }))}
                placeholder={loadingDirectory ? "Loading banks…" : "Select bank"}
                searchPlaceholder="Search bank…"
                emptyText={loadingDirectory ? "Loading…" : "No banks found"}
                disabled={loadingDirectory || creatingBank}
              />
            </div>
            <div>
              <Label>Branch</Label>
              <SearchableOptionSelect
                value={newBankForm.branchCode}
                onChange={handleDirectoryBranchChange}
                options={selectedDirectoryBranches.map((branch) => ({
                  value: branch.code,
                  label: branch.name,
                }))}
                placeholder={
                  !newBankForm.bankCode
                    ? "Select a bank first"
                    : selectedDirectoryBranches.length === 0
                      ? "No branches listed for this bank"
                      : "Select branch (optional)"
                }
                searchPlaceholder="Search branch…"
                emptyText="No branches found"
                disabled={
                  loadingDirectory ||
                  creatingBank ||
                  !newBankForm.bankCode ||
                  selectedDirectoryBranches.length === 0
                }
              />
            </div>
            <div>
              <Label htmlFor="new-bank-name">Account name</Label>
              <Input
                id="new-bank-name"
                value={newBankForm.name}
                onChange={(e) =>
                  setNewBankForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g. HNB Current — City Office"
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="new-bank-number">Account number (optional)</Label>
              <Input
                id="new-bank-number"
                value={newBankForm.accountNumber}
                onChange={(e) =>
                  setNewBankForm((prev) => ({ ...prev, accountNumber: e.target.value }))
                }
                placeholder="e.g. 1234567890"
                maxLength={50}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateBankAccount();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewBankOpen(false)}
              disabled={creatingBank}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateBankAccount}
              disabled={creatingBank || loadingDirectory || !newBankForm.bankCode}
            >
              {creatingBank ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editBankTarget}
        onOpenChange={(open) => {
          if (!open && !savingBankEdit) setEditBankTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit bank account</DialogTitle>
            <DialogDescription>
              Update the account label or account number.
              {editBankTarget?.BankName
                ? ` Bank: ${editBankTarget.BankName}${
                    editBankTarget.BranchName ? ` — ${editBankTarget.BranchName}` : ""
                  }.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="edit-bank-name">Account name</Label>
              <Input
                id="edit-bank-name"
                value={editBankForm.name}
                onChange={(e) =>
                  setEditBankForm((prev) => ({ ...prev, name: e.target.value }))
                }
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="edit-bank-number">Account number (optional)</Label>
              <Input
                id="edit-bank-number"
                value={editBankForm.accountNumber}
                onChange={(e) =>
                  setEditBankForm((prev) => ({ ...prev, accountNumber: e.target.value }))
                }
                maxLength={50}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleUpdateBankAccount();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditBankTarget(null)}
              disabled={savingBankEdit}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateBankAccount} disabled={savingBankEdit}>
              {savingBankEdit ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteBankTarget}
        onOpenChange={(open) => !open && !deletingBank && setDeleteBankTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bank account?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes{" "}
              <span className="font-medium text-foreground">
                {deleteBankTarget?.Name}
              </span>{" "}
              from the account list. Existing cashbook entries stay, but will no longer
              be linked to this account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBank}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingBank}
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteBankAccount();
              }}
            >
              {deletingBank ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isTransferEntry(deleteTarget) ? "Delete transfer?" : "Delete manual entry?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isTransferEntry(deleteTarget)
                ? `This will remove both sides of the transfer${
                    deleteTarget
                      ? ` (${formatCurrency(Number(deleteTarget.Amount))})`
                      : ""
                  }.`
                : `This will permanently remove the selected cashbook entry${
                    deleteTarget
                      ? ` (${formatCurrency(Number(deleteTarget.Amount))})`
                      : ""
                  }.`}
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

      <Dialog
        open={clearOpen}
        onOpenChange={(open) => {
          if (clearing) return;
          setClearOpen(open);
          if (!open) {
            setExportDownloaded(false);
            setClearConfirmText("");
            setClearBalances(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clear cashbook</DialogTitle>
            <DialogDescription>
              This permanently deletes all cashbook entries for this business line and
              resets cash and bank balances to zero. Sales and purchases are not deleted.
              Download the full cashbook records (every entry, not just totals) first.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Cash balance</span>
                <span className="font-medium tabular-nums">
                  {clearBalances ? formatCurrency(clearBalances.cashBalance) : "…"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Bank balance</span>
                <span className="font-medium tabular-nums">
                  {clearBalances ? formatCurrency(clearBalances.bankBalance) : "…"}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleDownloadExport}
              disabled={downloadingExport || clearing}
            >
              <Download className="h-4 w-4 mr-2" />
              {downloadingExport
                ? "Downloading…"
                : exportDownloaded
                  ? "Download records again"
                  : "Download cashbook records"}
            </Button>

            {exportDownloaded && (
              <p className="text-xs text-green-700">
                Cashbook records downloaded for this session.
              </p>
            )}

            <div>
              <Label htmlFor="clear-confirm">Type CLEAR to confirm</Label>
              <Input
                id="clear-confirm"
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                placeholder="CLEAR"
                disabled={clearing}
                autoComplete="off"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setClearOpen(false)}
              disabled={clearing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearCashbook}
              disabled={
                clearing ||
                !exportDownloaded ||
                clearConfirmText.trim().toUpperCase() !== "CLEAR"
              }
            >
              {clearing ? "Clearing…" : "Clear & zero balances"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
