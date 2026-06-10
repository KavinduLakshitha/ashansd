import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api/axios";
import { useAuth } from "@/app/auth/auth-context";
import DialogCustomerSelect from "@/components/DialogCustomerSelect";
import { AxiosError } from "axios";

interface AddOpeningBalanceDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  openingBalanceId?: number | null;
  isEditMode?: boolean;
}

const AddOpeningBalanceDialog = ({
  open,
  onClose,
  onSuccess,
  openingBalanceId,
  isEditMode = false,
}: AddOpeningBalanceDialogProps) => {
  const { getBusinessLineID } = useAuth();
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [amount, setAmount] = useState("");
  const [balanceDate, setBalanceDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      if (isEditMode && openingBalanceId && open) {
        setIsLoading(true);
        try {
          const response = await api.get(`/opening-balances/${openingBalanceId}`);
          const data = response.data;
          setCustomerId(data.CustomerID);
          setCustomerName(data.CustomerName || "");
          setAmount(String(data.Amount));
          setBalanceDate(data.BalanceDate?.split("T")[0] || data.BalanceDate);
          setNotes(data.Notes || "");
        } catch {
          toast({
            title: "Error",
            description: "Failed to load opening balance",
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
        }
      } else if (open && !isEditMode) {
        setCustomerId(null);
        setCustomerName("");
        setAmount("");
        setBalanceDate(new Date().toISOString().split("T")[0]);
        setNotes("");
      }
    };
    fetchData();
  }, [isEditMode, openingBalanceId, open, toast]);

  const handleSubmit = async () => {
    if (!isEditMode && !customerId) {
      toast({ title: "Validation", description: "Please select a customer", variant: "destructive" });
      return;
    }
    if (!amount || Number(amount) < 0) {
      toast({ title: "Validation", description: "Amount must be zero or greater", variant: "destructive" });
      return;
    }
    if (!balanceDate) {
      toast({ title: "Validation", description: "Balance date is required", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const businessLineId = getBusinessLineID();
      const payload = {
        customerId,
        amount: Number(amount),
        balanceDate,
        notes: notes || undefined,
        businessLineId,
      };

      if (isEditMode && openingBalanceId) {
        await api.put(`/opening-balances/${openingBalanceId}`, payload);
        toast({ title: "Success", description: "Opening balance updated" });
      } else {
        await api.post("/opening-balances", payload);
        toast({ title: "Success", description: "Opening balance created" });
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast({
        title: "Error",
        description: axiosError.response?.data?.message || "Failed to save opening balance",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md overflow-visible">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Opening Balance" : "Add Opening Balance"}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Loading...</p>
        ) : (
          <div className="space-y-4 py-2">
            {!isEditMode && (
              <div className="space-y-2">
                <Label>Customer</Label>
                <DialogCustomerSelect
                  value={customerName}
                  onChange={(name, id) => {
                    setCustomerName(name);
                    setCustomerId(id ?? null);
                  }}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amount">Opening Outstanding Balance (Rs.)</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="balanceDate">Opening Balance Date</Label>
              <Input
                id="balanceDate"
                type="date"
                value={balanceDate}
                onChange={(e) => setBalanceDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || isLoading}>
            {isSubmitting ? "Saving..." : isEditMode ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddOpeningBalanceDialog;
