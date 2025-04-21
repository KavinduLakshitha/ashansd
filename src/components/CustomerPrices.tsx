"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Save, X } from "lucide-react";
import api from "@/lib/api/axios";
import { useAuth } from "@/app/auth/auth-context";

interface Price {
  PriceListID: number | null;
  ProductID: number;
  ProductName: string;
  Price: number | null;
  ModifiedDate: string | null;
  BusinessLineName?: string;
  BusinessLineID?: number;
}

export default function CustomerPrices() {
  const { id } = useParams();
  const { toast } = useToast();
  const { getBusinessLineID } = useAuth();
  const [prices, setPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState<string>("");
  const [filterApplied, setFilterApplied] = useState(false);

  const fetchPrices = useCallback(async () => {
    try {
      const response = await api.get(`/pricelist/customer/${id}`);
      const businessLineId = getBusinessLineID();

      setPrices(response.data);
      
      if (businessLineId && response.data.some((price: Price) => price.BusinessLineID !== undefined)) {
        const filteredPrices = response.data.filter(
          (price: Price) => price.BusinessLineID === businessLineId
        );
        setPrices(filteredPrices);
        setFilterApplied(true);
      } else {
        setFilterApplied(false);
      }
    } catch (error) {
      console.error('Error fetching prices:', error);
      toast({
        title: "Error",
        description: "Failed to fetch prices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast, getBusinessLineID]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  const handleEdit = (product: Price) => {
    setEditingId(product.ProductID);
    setEditPrice(product.Price?.toString() || "");
  };

  const handleSave = async (productId: number) => {
    if (!editPrice) {
      toast({
        title: "Error",
        description: "Please enter a valid price",
        variant: "destructive",
      });
      return;
    }

    try {
      await api.put(`/pricelist/customer/${id}/product/${productId}`, {
        price: parseFloat(editPrice)
      });
      
      // toast({
      //   title: "Success",
      //   description: "Price updated successfully",
      // });
      
      setEditingId(null);
      fetchPrices();
    } catch (error) {
      console.error('Error updating price:', error);
      toast({
        title: "Error",
        description: "Failed to update price",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditPrice("");
  };

  const formatPrice = (price: number | null): string => {
    if (price === null || price === undefined) {
      return "No price set";
    }
    
    const numericPrice = Number(price);
    if (isNaN(numericPrice)) {
      return "Invalid price";
    }
    
    return numericPrice.toFixed(2);
  };

  if (loading) {
    return <div>Loading product prices...</div>;
  }

  return (
    <div className="px-4">
      {!filterApplied && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-yellow-700 text-sm">
            Showing all product prices. Business line filtering not applied.
          </p>
        </div>
      )}
      
      {prices.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No product prices found for this customer.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Last Modified</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prices.map((product) => (
              <TableRow key={product.ProductID}>
                <TableCell>{product.ProductName}</TableCell>
                <TableCell>
                  {editingId === product.ProductID ? (
                    <Input
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="w-32"
                      step="0.01"
                      min="0"
                    />
                  ) : (
                    <span className="font-mono">
                      {product.Price !== null ? `Rs. ${formatPrice(product.Price)}` : "No price set"}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {product.ModifiedDate 
                    ? new Date(product.ModifiedDate).toLocaleDateString()
                    : "Never"
                  }
                </TableCell>
                <TableCell>
                  {editingId === product.ProductID ? (
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        onClick={() => handleSave(product.ProductID)}
                        className="h-8 px-2"
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancel}
                        className="h-8 px-2"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(product)}
                      className="h-8 px-2"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}