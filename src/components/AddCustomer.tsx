import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api/axios";
import { AxiosError } from "axios";
import { useAuth } from "@/app/auth/auth-context";

interface AddCustomerDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  businessLineId?: number | null;
  customerId?: number | null;
  isEditMode?: boolean; 
}

interface CustomerResponse {
  id: string;
  cusName: string;
  contactNumber: string;
  address: string;
  contactPersonName: string;
  businessRegNo: string;
  creditLimit: number | null;
  status: string;
  smsNumber: string;
  bankDetails: string | null;
}

const AddCustomerDialog = ({ 
  open, 
  onClose, 
  onSuccess, 
  businessLineId, 
  customerId, 
  isEditMode = false 
}: AddCustomerDialogProps) => {
  const { getBusinessLineID } = useAuth();
  const [customerName, setCustomerName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [contactPersonName, setContactPersonName] = useState("");
  const [businessRegNumber, setBusinessRegNumber] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [status, setStatus] = useState("No Risk");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [branchName, setBranchName] = useState("");
  const [smsNumber, setSmsNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  // Fetch customer data when in edit mode
  useEffect(() => {
    const fetchCustomerData = async () => {
      if (isEditMode && customerId && open) {
        setIsLoading(true);
        try {
          const token = localStorage.getItem('token');
          const response = await api.get(`/customers/${customerId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          const customer = response.data;
          
          setCustomerName(customer.CusName || "");
          setContactNumber(customer.ContactNumber || "");
          setCustomerAddress(customer.Address || "");
          setContactPersonName(customer.ContactPersonName || "");
          setBusinessRegNumber(customer.BusinessRegNo || "");
          setCreditLimit(customer.CreditLimit ? customer.CreditLimit.toString() : "");
          setStatus(customer.Status || "No Risk");
          setSmsNumber(customer.SMSNumber || "");
          
          // Parse bank details if available
          if (customer.BankDetails) {
            try {
              const bankDetails = customer.BankDetails;
              const bankNameMatch = bankDetails.match(/Bank: (.*?)(?:\n|$)/);
              const accountMatch = bankDetails.match(/Account: (.*?)(?:\n|$)/);
              const branchMatch = bankDetails.match(/Branch: (.*?)(?:\n|$)/);
              
              setBankName(bankNameMatch ? bankNameMatch[1] : "");
              setAccountNumber(accountMatch ? accountMatch[1] : "");
              setBranchName(branchMatch ? branchMatch[1] : "");
            } catch (err) {
              console.error("Error parsing bank details:", err);
              setBankName("");
              setAccountNumber("");
              setBranchName("");
            }
          }
        } catch (error) {
          console.error("Error fetching customer data:", error);
          toast({
            title: "Error",
            description: "Failed to fetch customer data",
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchCustomerData();
  }, [customerId, isEditMode, open, toast]);

  const resetForm = () => {
    setCustomerName("");
    setContactNumber("");
    setCustomerAddress("");
    setContactPersonName("");
    setBusinessRegNumber("");
    setCreditLimit("");
    setStatus("No Risk");
    setBankName("");
    setAccountNumber("");
    setBranchName("");
    setSmsNumber("");
    setError("");
  };

  const validateForm = () => {
    if (!customerName.trim()) {
      setError("Customer name is required");
      toast({
        title: "Error",
        description: "Customer name is required",
        variant: "destructive",
      });
      return false;
    }
    if (!contactNumber.trim()) {
      setError("Contact number is required");
      toast({
        title: "Error",
        description: "Contact number is required",
        variant: "destructive",
      });
      return false;
    }
    if (creditLimit && isNaN(Number(creditLimit))) {
      setError("Credit limit must be a valid number");
      toast({
        title: "Error",
        description: "Credit limit must be a valid number",
        variant: "destructive",
      });
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

      // Get business line ID either from props or from auth context
      const activeBizLineId = businessLineId ?? getBusinessLineID();
      
      // Validate that we have a valid business line ID
      if (!activeBizLineId) {
        setError("Business Line ID is not available.");
        toast({
          title: "Error",
          description: "Business Line ID is not available. Please ensure you're logged in.",
          variant: "destructive",
        });
        return;
      }

      setIsSubmitting(true);

      const bankDetails = bankName || accountNumber || branchName ? 
        `Bank: ${bankName}\nAccount: ${accountNumber}\nBranch: ${branchName}` : 
        null;

      const customerData = {
        businessLineId: activeBizLineId,
        cusName: customerName.trim(),
        contactNumber: contactNumber.trim(),
        address: customerAddress.trim(),
        contactPersonName: contactPersonName.trim(),
        businessRegNo: businessRegNumber.trim(),
        creditLimit: creditLimit ? Number(creditLimit) : null,
        status,
        smsNumber: smsNumber || contactNumber.trim(),
        bankDetails
      };

      if (isEditMode && customerId) {
        // Update existing customer
        await api.put(`/customers/${customerId}`, customerData);
        toast({
          title: "Success",
          description: "Customer updated successfully",
        });
      } else {
        // Create new customer
        await api.post<CustomerResponse>('/customers', customerData);
        toast({
          title: "Success",
          description: "Customer added successfully",
        });
      }

      resetForm();
      onSuccess?.();
      onClose();
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      const errorMessage = axiosError.response?.data?.message || 
        (isEditMode ? "Failed to update customer" : "Failed to add customer");
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Customer" : "Add New Customer"}</DialogTitle>
        </DialogHeader>
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4">
            {error}
          </div>
        )}
        {isLoading ? (
          <div className="p-4 text-center">Loading customer data...</div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Customer Name<span className="text-red-500">*</span>
              </label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name"
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
                Address
              </label>
              <Input
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Enter address"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Contact Person
              </label>
              <Input
                value={contactPersonName}
                onChange={(e) => setContactPersonName(e.target.value)}
                placeholder="Enter contact person name"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Business Registration Number
              </label>
              <Input
                value={businessRegNumber}
                onChange={(e) => setBusinessRegNumber(e.target.value)}
                placeholder="Enter BR number"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Credit Limit
              </label>
              <Input
                type="number"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="Enter credit limit"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Status
              </label>
              <Select 
                value={status} 
                onValueChange={setStatus}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="No Risk">No Risk</SelectItem>
                  <SelectItem value="Credit Hold">Credit Hold</SelectItem>
                  <SelectItem value="Over Credit Limit">Over Credit Limit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                SMS Number
              </label>
              <Input
                value={smsNumber}
                onChange={(e) => setSmsNumber(e.target.value)}
                placeholder="Enter SMS number"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <label className="text-sm font-medium text-gray-700">Bank Details</label>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Enter bank name"
                  disabled={isSubmitting}
                />
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Enter account number"
                  disabled={isSubmitting}
                />
                <Input
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="Enter branch name"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting || isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting 
              ? (isEditMode ? "Updating..." : "Adding...") 
              : (isEditMode ? "Update Customer" : "Add Customer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddCustomerDialog;