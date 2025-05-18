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

interface User {
  UserID?: number;
  UserName: string;
  UserType: string;
  ContactNumber: string | null;
  Email: string | null;
  BusinessLineID: number;
  screens?: string[];
}

interface UserDialogProps {
  open: boolean;
  onClose: () => void;
  user?: User | null;
  onSuccess?: () => void;
}

const UserDialog = ({ open, onClose, user, onSuccess }: UserDialogProps) => {
  const [businessLines, setBusinessLines] = useState<BusinessLine[]>([]);
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState("user");
  const [selectedBusinessLine, setSelectedBusinessLine] = useState("");
  const [screens, setScreens] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const isEditMode = !!user;  

  useEffect(() => {
    const fetchBusinessLines = async () => {
      try {
        const response = await api.get('/business-lines');
        setBusinessLines(response.data);
  
        // Handle initial business line selection if user exists
        if (user && response.data.length > 0) {
          const matchingBusinessLine: BusinessLine | undefined = response.data.find(
            (bl: BusinessLine) => 
              bl.BusinessLineID === user.BusinessLineID || 
              bl.BusinessLineID.toString() === user.BusinessLineID?.toString()
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
  }, [open, user]);
  
  useEffect(() => {
    if (user) {
      setUserName(user.UserName || "");
      setContactNumber(user.ContactNumber || "");
      setEmail(user.Email || "");
      setUserType(user.UserType || "user");
      
      // Safely handle BusinessLineID
      if (user.BusinessLineID) {
        setSelectedBusinessLine(user.BusinessLineID.toString());
      }
      
      // Handle screens with fallback
      setScreens(user.screens || []);
      
      // Clear password in edit mode
      setPassword("");
    } else {
      // Reset form when no user is provided
      resetForm();
    }
  }, [user]);

  const resetForm = () => {
    setUserName("");
    setPassword("");
    setContactNumber("");
    setEmail("");
    setUserType("user");
    setSelectedBusinessLine("");
    setScreens([]);
    setError("");
  };

  const validateForm = () => {
    if (!userName.trim()) {
      setError("Username is required");
      return false;
    }
    if (!isEditMode && !password.trim()) {
      setError("Password is required");
      return false;
    }
    if (!selectedBusinessLine) {
      setError("Business line is required");
      return false;
    }
    if (email && !email.includes("@")) {
      setError("Invalid email format");
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

      interface UserData {
        username: string;
        password?: string;
        businessLineId: number;
        contactNumber: string;
        email: string;
        userType: string;
        screens: string[];
      }

      const userData: UserData = {
        username: userName.trim(),
        businessLineId: parseInt(selectedBusinessLine),
        contactNumber: contactNumber.trim(),
        email: email.trim(),
        userType: userType,
        screens: screens
      };

      // Only include password if it's provided or if it's a new user
      if (password.trim() || !isEditMode) {
        userData.password = password.trim();
      }

      if (isEditMode && user?.UserID) {
        await api.put(`/users/${user.UserID}`, userData);
        toast({
          title: "Success",
          description: "User updated successfully",
        });
      } else {
        await api.post('/users', userData);
        toast({
          title: "Success",
          description: "User added successfully",
        });
      }

      resetForm();
      onSuccess?.();
      onClose();
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      const errorMessage = axiosError.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'add'} user`;
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
          <DialogTitle>{isEditMode ? 'Edit User' : 'Add New User'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Username<span className="text-red-500">*</span>
              </label>
              <Input
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter username"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Password{!isEditMode && <span className="text-red-500">*</span>}
                {isEditMode && <span className="text-xs text-gray-500 ml-1">(Leave blank to keep current)</span>}
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEditMode ? "Enter new password" : "Enter password"}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Contact Number
              </label>
              <Input
                value={contactNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setContactNumber(value);
                }}
                onKeyDown={(e) => {
                  if (['e', 'E', '+', '-', '.'].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                User Type<span className="text-red-500">*</span>
              </label>
              <Select 
                value={userType} 
                onValueChange={setUserType}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="superuser">Super User</SelectItem>
                  <SelectItem value="management">Management User</SelectItem>
                  <SelectItem value="sales">Sales User</SelectItem>
                </SelectContent>
              </Select>
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
                  <SelectValue placeholder="Select business line" />
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
            {isSubmitting ? (isEditMode ? "Updating..." : "Adding...") : (isEditMode ? "Update User" : "Add User")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserDialog;