import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import api from "@/lib/api/axios";
import { AxiosError } from "axios";

interface BusinessLineDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  businessLineId?: number;
  initialData?: {
    BusinessLineName: string;
  };
}

interface BusinessResponse {
  BusinessLineID: number;
  BusinessLineName: string;
}

const BusinessLineDialog = ({ 
  open, 
  onClose, 
  onSuccess, 
  businessLineId,
  initialData 
}: BusinessLineDialogProps) => {
  const [businessLineName, setBusinessLineName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();
  const isEditMode = !!businessLineId;

  useEffect(() => {
    if (initialData) {
      setBusinessLineName(initialData.BusinessLineName);
    }
  }, [initialData]);

  const resetForm = () => {
    setBusinessLineName("");
    setError("");
  };

  const validateForm = () => {
    if (!businessLineName.trim()) {
      setError("Business line name is required");
      return false;
    }
    if (businessLineName.length < 2) {
      setError("Business line name must be at least 2 characters long");
      return false;
    }
    if (businessLineName.length > 100) {
      setError("Business line name must not exceed 100 characters");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    try {
      setError("");
      
      if (!validateForm()) {
        return;
      }

      setIsSubmitting(true);

      if (isEditMode) {
        await api.put<BusinessResponse>(`/business-lines/${businessLineId}`, {
          businessLineName: businessLineName.trim()
        });

        toast({
          title: "Success",
          description: "Business line updated successfully",
        });
      } else {
        await api.post<BusinessResponse>('/business-lines', {
          businessLineName: businessLineName.trim()
        });

        toast({
          title: "Success",
          description: "Business line added successfully",
        });
      }

      resetForm();
      onSuccess?.();
      onClose();
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      const errorMessage = axiosError.response?.data?.message || 
        `Failed to ${isEditMode ? 'update' : 'add'} business line`;
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit Business Line' : 'Add New Business Line'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Business Line Name<span className="text-red-500">*</span>
            </label>
            <Input
              value={businessLineName}
              onChange={(e) => {
                setBusinessLineName(e.target.value);
                setError("");
              }}
              placeholder="Enter business line name"
              disabled={isSubmitting}
              maxLength={100}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting 
              ? (isEditMode ? "Updating..." : "Adding...") 
              : (isEditMode ? "Update Business Line" : "Add Business Line")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BusinessLineDialog;