"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import axios from "axios";
import { useAuth } from "@/app/auth/auth-context";

interface Vendor {
  VendorID: number;
  VendorName: string;
  ContactNumber: string;
  ContactPersonName: string;
  BusinessRegNum: string;
  Address: string;
}

interface Product {
  ProductID: number;
  Name: string;
  BusinessLineID: string;
  VendorID?: string;
  CurrentQTY: number;
  BusinessLineName?: string;
}

interface ProductDialogProps {
  open: boolean;
  onClose: () => void;
  onProductSaved?: () => void;
  product?: Product; // Optional product for editing mode
}

const ProductDialog = ({ open, onClose, onProductSaved, product }: ProductDialogProps) => {
  const { getBusinessLineID } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    vendorId: ""
  });

  // Determine if we're in edit mode
  const isEditMode = !!product;

  // Update form data when product changes (for edit mode)
  useEffect(() => {
    if (product) {
      setFormData({
        name: product.Name,
        vendorId: product.VendorID || ""
      });
    } else {
      // Reset form data when not in edit mode
      setFormData({
        name: "",
        vendorId: ""
      });
    }
  }, [product]);

  useEffect(() => {
    if (open) {
      const businessLineId = getBusinessLineID();
      if (businessLineId) {
        fetchVendors(businessLineId.toString());
      }
    }
  }, [open, getBusinessLineID]);

  const fetchVendors = async (businessLineId: string) => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/products/vendors?businessLineId=${businessLineId}`,
        {
          withCredentials: true,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      setVendors(response.data);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to load vendors', 
        variant: 'destructive' 
      });
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveProduct = async () => {
    if (!formData.name || !formData.vendorId) {
      toast({ 
        title: 'Validation Error', 
        description: 'Please fill in all required fields', 
        variant: 'destructive' 
      });
      return;
    }

    const businessLineId = getBusinessLineID();
    
    if (!businessLineId) {
      toast({ 
        title: 'Error', 
        description: 'No business line selected', 
        variant: 'destructive' 
      });
      return;
    }

    try {
      setLoading(true);
      
      const productData = {
        name: formData.name,
        businessLineId: businessLineId,
        vendorId: parseInt(formData.vendorId, 10)
      };
      
      if (isEditMode && product) {
        // Update existing product
        await axios.put(
          `${process.env.NEXT_PUBLIC_API_URL}/products/${product.ProductID}`,
          productData,
          {
            withCredentials: true,
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
        toast({ 
          title: 'Success', 
          description: 'Product updated successfully', 
          variant: 'default' 
        });
      } else {
        // Create new product
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/products`,
          productData,
          {
            withCredentials: true,
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
        toast({ 
          title: 'Success', 
          description: 'Product added successfully', 
          variant: 'default' 
        });
      }
      
      onProductSaved?.();
      onClose();
      
      // Reset form data
      setFormData({
        name: "",
        vendorId: ""
      });
    } catch (error) {
      console.error('Error saving product:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        toast({ 
          title: 'Authentication Error', 
          description: 'Please sign in again', 
          variant: 'destructive' 
        });
      } else {
        toast({ 
          title: 'Error', 
          description: `Failed to ${isEditMode ? 'update' : 'add'} product`, 
          variant: 'destructive' 
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent aria-describedby="product-dialog-description">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        </DialogHeader>
        <div id="product-dialog-description" className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Product Name</label>
            <Input
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter product name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Vendor</label>
            <Select 
              onValueChange={(value) => handleInputChange('vendorId', value)}
              value={formData.vendorId || undefined}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors.length > 0 ? (
                  vendors.map((vendor) => (
                    <SelectItem 
                      key={vendor.VendorID} 
                      value={vendor.VendorID.toString()}
                    >
                      {vendor.VendorName}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-vendors" disabled>
                    No vendors available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <div className="text-xs text-gray-500 mt-1">
              {vendors.length === 0 && "No vendors found for the current business line"}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveProduct} 
            disabled={loading || !formData.name || !formData.vendorId}
          >
            {loading ? (isEditMode ? 'Updating...' : 'Adding...') : (isEditMode ? 'Update Product' : 'Add Product')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProductDialog;