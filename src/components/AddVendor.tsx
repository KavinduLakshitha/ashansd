import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api/axios";
import { AxiosError } from "axios";

interface BusinessLine {
  BusinessLineID: number;
  BusinessLineName: string;
}

interface VendorDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  vendorId?: number;
  initialData?: {
    VendorName: string;
    ContactNumber: string;
    ContactPersonName: string;
    BusinessRegNum: string;
    Address: string;
    BusinessLines: (string | number)[];
  };
}

interface VendorResponse {
  id: string;
  vendorName: string;
  contactNumber: string;
  contactPersonName: string;
  businessRegNum: string;
  address: string;
  businessLines: string[];
}

const VendorDialog = ({ 
  open, 
  onClose, 
  onSuccess, 
  vendorId,
  initialData 
}: VendorDialogProps) => {
  const [businessLines, setBusinessLines] = useState<BusinessLine[]>([]);
  const [selectedBusinessLine, setSelectedBusinessLine] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [brNumber, setBrNumber] = useState("");
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();
  const isEditMode = !!vendorId;

  useEffect(() => {
    const fetchBusinessLines = async () => {
      try {
        const response = await api.get('/business-lines');
        setBusinessLines(response.data);
        if ((initialData?.BusinessLines ?? []).length > 0) {
          const initialBusinessLine = initialData?.BusinessLines[0] ?? "";
            const matchingBusinessLine: BusinessLine | undefined = response.data.find(
            (bl: BusinessLine) => bl.BusinessLineName === initialBusinessLine || bl.BusinessLineID.toString() === initialBusinessLine
            );
          
          if (matchingBusinessLine) {
            setSelectedBusinessLine(matchingBusinessLine.BusinessLineID.toString());
          }
        }
      } catch (error) {
        console.error('Error fetching business lines:', error);
        setError('Failed to load business lines');
      }
    };

    if (open) {
      fetchBusinessLines();
    }
  }, [open, initialData]);

  useEffect(() => {
    if (initialData) {
      // console.log('Initial Data received:', initialData);
      setVendorName(initialData.VendorName || "");
      setContactNumber(initialData.ContactNumber || "");
      setContactName(initialData.ContactPersonName || "");
      setBrNumber(initialData.BusinessRegNum || "");
      setAddress(initialData.Address || "");
    }
  }, [initialData]);

  const resetForm = () => {
    setVendorName("");
    setSelectedBusinessLine("");
    setContactName("");
    setContactNumber("");
    setBrNumber("");
    setAddress("");
    setError("");
  };

  const validateForm = () => {
    if (!vendorName.trim()) {
      setError("Vendor name is required");
      return false;
    }
    if (!selectedBusinessLine) {
      setError("Business line is required");
      return false;
    }
    if (!contactName.trim()) {
      setError("Contact person name is required");
      return false;
    }
    if (!contactNumber.trim()) {
      setError("Contact number is required");
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

      const payload = {
        vendorName: vendorName.trim(),
        contactNumber: contactNumber.trim(),
        contactPersonName: contactName.trim(),
        businessRegNum: brNumber.trim(),
        address: address.trim(),
        businessLines: [parseInt(selectedBusinessLine)]
      };

      if (isEditMode) {
        await api.put<VendorResponse>(`/vendors/${vendorId}`, payload);
        toast({
          title: "Success",
          description: "Vendor updated successfully",
        });
      } else {
        await api.post<VendorResponse>('/vendors', payload);
        toast({
          title: "Success",
          description: "Vendor added successfully",
        });
      }

      resetForm();
      onSuccess?.();
      onClose();
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      const errorMessage = axiosError.response?.data?.message || 
        `Failed to ${isEditMode ? 'update' : 'add'} vendor`;
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit Vendor' : 'Add New Vendor'}
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
              Vendor Name<span className="text-red-500">*</span>
            </label>
            <Input
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Enter vendor name"
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Business Line<span className="text-red-500">*</span>
            </label>
            <Select 
              value={selectedBusinessLine} 
              onValueChange={setSelectedBusinessLine}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a business line" />
              </SelectTrigger>
              <SelectContent>
                {businessLines.map((bl) => (
                  <SelectItem key={bl.BusinessLineID} value={bl.BusinessLineID.toString()}>
                    {bl.BusinessLineName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Contact Person<span className="text-red-500">*</span>
            </label>
            <Input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Enter contact person name"
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Contact Number<span className="text-red-500">*</span>
            </label>
            <Input
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="Enter contact number"
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              BR Number
            </label>
            <Input
              value={brNumber}
              onChange={(e) => setBrNumber(e.target.value)}
              placeholder="Enter business registration number"
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Address
            </label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter address"
              disabled={isSubmitting}
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
              : (isEditMode ? "Update Vendor" : "Add Vendor")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VendorDialog;