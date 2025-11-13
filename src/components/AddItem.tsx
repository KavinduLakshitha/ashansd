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
import { Checkbox } from "@/components/ui/checkbox";
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
    vendorId: "", // For edit mode (single vendor)
    vendorIds: [] as string[] // For create mode (multiple vendors)
  });

  // Determine if we're in edit mode
  const isEditMode = !!product;

  // Update form data when product changes (for edit mode)
  useEffect(() => {
    if (product) {
      setFormData({
        name: product.Name,
        vendorId: product.VendorID || "",
        vendorIds: []
      });
    } else {
      // Reset form data when not in edit mode
      setFormData({
        name: "",
        vendorId: "",
        vendorIds: []
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

  const handleVendorToggle = (vendorId: string) => {
    setFormData(prev => {
      const vendorIds = prev.vendorIds || [];
      const isSelected = vendorIds.includes(vendorId);
      
      return {
        ...prev,
        vendorIds: isSelected
          ? vendorIds.filter(id => id !== vendorId)
          : [...vendorIds, vendorId]
      };
    });
  };

  const handleSaveProduct = async () => {
    // Validation
    if (!formData.name) {
      toast({ 
        title: 'Validation Error', 
        description: 'Please enter a product name', 
        variant: 'destructive' 
      });
      return;
    }

    if (isEditMode) {
      // Edit mode: single vendor required
      if (!formData.vendorId) {
        toast({ 
          title: 'Validation Error', 
          description: 'Please select a vendor', 
          variant: 'destructive' 
        });
        return;
      }
    } else {
      // Create mode: at least one vendor required
      if (!formData.vendorIds || formData.vendorIds.length === 0) {
        toast({ 
          title: 'Validation Error', 
          description: 'Please select at least one vendor', 
          variant: 'destructive' 
        });
        return;
      }
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
      
      if (isEditMode && product) {
        // Update existing product (single vendor)
        const productData = {
          name: formData.name,
          businessLineId: businessLineId,
          vendorId: parseInt(formData.vendorId, 10)
        };
        
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
        // Create new products for each selected vendor
        const vendorIds = formData.vendorIds.map(id => parseInt(id, 10));
        const productData = {
          name: formData.name,
          businessLineId: businessLineId,
          vendorIds: vendorIds // Send array of vendor IDs
        };
        
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
        
        const vendorCount = vendorIds.length;
        toast({ 
          title: 'Success', 
          description: `Product added successfully to ${vendorCount} vendor${vendorCount > 1 ? 's' : ''}`, 
          variant: 'default' 
        });
      }
      
      onProductSaved?.();
      onClose();
      
      // Reset form data
      setFormData({
        name: "",
        vendorId: "",
        vendorIds: []
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
        const errorMessage = axios.isAxiosError(error) && error.response?.data?.message 
          ? error.response.data.message 
          : `Failed to ${isEditMode ? 'update' : 'add'} product`;
        toast({ 
          title: 'Error', 
          description: errorMessage, 
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isEditMode ? 'Vendor' : 'Vendors (Select one or more)'}
            </label>
            {isEditMode ? (
              // Edit mode: Single vendor selection
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
            ) : (
              // Create mode: Multiple vendor selection with checkboxes
              <div className="border rounded-md p-3 max-h-60 overflow-auto">
                {vendors.length > 0 ? (
                  <div className="space-y-2">
                    {vendors.map((vendor) => (
                      <div key={vendor.VendorID} className="flex items-center space-x-2">
                        <Checkbox
                          id={`vendor-${vendor.VendorID}`}
                          checked={formData.vendorIds?.includes(vendor.VendorID.toString()) || false}
                          onCheckedChange={() => handleVendorToggle(vendor.VendorID.toString())}
                        />
                        <label
                          htmlFor={`vendor-${vendor.VendorID}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                        >
                          {vendor.VendorName}
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 text-center py-4">
                    No vendors found for the current business line
                  </div>
                )}
              </div>
            )}
            {!isEditMode && formData.vendorIds && formData.vendorIds.length > 0 && (
              <div className="text-xs text-gray-500 mt-2">
                {formData.vendorIds.length} vendor{formData.vendorIds.length > 1 ? 's' : ''} selected
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveProduct} 
            disabled={
              loading || 
              !formData.name || 
              (isEditMode ? !formData.vendorId : (!formData.vendorIds || formData.vendorIds.length === 0))
            }
          >
            {loading ? (isEditMode ? 'Updating...' : 'Adding...') : (isEditMode ? 'Update Product' : 'Add Product')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProductDialog;