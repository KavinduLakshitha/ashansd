"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Trash, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/app/auth/auth-context";
import { isAxiosError } from "axios";
import axiosInstance from "@/lib/api/axios";
import { Input } from "@/components/ui/input";
import ProductDialog from "./AddItem";

interface Product {
  ProductID: number;
  Name: string;
  BusinessLineID: string;
  VendorID?: string;
  CurrentQTY: number;
  BusinessLineName?: string;
}

const ProductsInventory: React.FC = () => {
  const { user, logout } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(undefined);

  // Filter products when search query or products change
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredProducts(products);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = products.filter(
      (product) =>
        product.ProductID.toString().includes(query) ||
        product.Name.toLowerCase().includes(query)
    );
    setFilteredProducts(filtered);
  }, [searchQuery, products]);

  const handleApiError = useCallback((error: unknown, defaultMessage: string) => {
    if (isAxiosError(error)) {
      if (error.response?.status === 401) {
        toast({
          title: "Session Expired",
          description: "Your session has expired. Please log in again.",
          variant: "destructive"
        });
        logout();
        return;
      }
      
      if (error.response?.status === 403) {
        toast({
          title: "Not Authorized",
          description: "You don't have permission to perform this action.",
          variant: "destructive"
        });
        return;
      }
      
      const errorMessage = error.response?.data?.message || defaultMessage;
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Error",
        description: defaultMessage,
        variant: "destructive"
      });
    }
  }, [logout]); 

  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await axiosInstance.get(
        `${process.env.NEXT_PUBLIC_API_URL}/products`,
        { params: { businessLineId: user?.currentBusinessLine } }
      );
      setProducts(response.data);
      setFilteredProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
      handleApiError(error, 'Failed to load products. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.currentBusinessLine, handleApiError]);

  useEffect(() => {
    if (user?.currentBusinessLine) {
      fetchProducts();
    }
  }, [user?.currentBusinessLine, fetchProducts]);

  const handleDeleteProduct = async (productId: number) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    
    try {
      await axiosInstance.delete(`${process.env.NEXT_PUBLIC_API_URL}/products/${productId}`);
      
      // Refresh product list
      fetchProducts();
      
      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      handleApiError(error, 'Failed to delete product');
    }
  };

  const handleAddProduct = () => {
    setSelectedProduct(undefined); // Clear any selected product
    setIsDialogOpen(true);
  };

  const handleEditProduct = async (productId: number) => {
    try {
      // Get full product details for editing
      const response = await axiosInstance.get(
        `${process.env.NEXT_PUBLIC_API_URL}/products/${productId}`
      );
      setSelectedProduct(response.data);
      setIsDialogOpen(true);
    } catch (error) {
      console.error('Error fetching product details:', error);
      handleApiError(error, 'Failed to fetch product details');
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    // Clear the selected product after dialog closes
    setTimeout(() => setSelectedProduct(undefined), 300);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex justify-between items-center mb-4">
        <Input
          className="w-80"
          placeholder="Search by ID or name..."
          value={searchQuery}
          onChange={handleSearch}
        />
        <Button 
          onClick={handleAddProduct}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Current QTY</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center">Loading products...</TableCell>
            </TableRow>
          ) : filteredProducts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center">
                {searchQuery ? "No matching products found" : "No products found"}
              </TableCell>
            </TableRow>
          ) : (
            filteredProducts.map(product => (
              <TableRow key={product.ProductID}>
                <TableCell>{product.ProductID}</TableCell>
                <TableCell>{product.Name}</TableCell>
                <TableCell className="text-right">{product.CurrentQTY}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEditProduct(product.ProductID)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDeleteProduct(product.ProductID)}
                    >
                      <Trash className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <ProductDialog 
        open={isDialogOpen} 
        onClose={handleCloseDialog}
        onProductSaved={fetchProducts}
        product={selectedProduct}
      />
    </div>
  );
};

export default ProductsInventory;