"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PaymentDetails from "./PaymentDetails";
import axios from '@/lib/api/axios';
import { useToast } from "@/hooks/use-toast";

interface Product {
  ProductID: number;
  ProductName: string;
  CurrentQTY: number;
  Price: number | null;
  PriceListID?: number;
  BusinessLineName: string;
}

interface InvoiceTableProps {
  customerId?: number;
  customerName?: string;
  contactNumber?: string;
  salesPersonId?: number;
  salesPerson?: string;
  address?: string;
}

interface InvoiceRow {
  ProductID: number;
  ProductName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  PriceListID?: number;
}

export default function InvoiceTable({
  customerId,
  salesPersonId,
}: InvoiceTableProps) {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const validItems = rows
  .filter(row => row.quantity > 0)
  .map(row => ({
    ProductID: row.ProductID,
    item: row.ProductName,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    total: row.total
  }));

  useEffect(() => {
    const fetchCustomerPrices = async () => {
      if (!customerId) {
        setRows([]);
        return;
      }

      try {
        setIsLoading(true);
        const token = localStorage.getItem('token');

        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/pricelist/customer/${customerId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        const transformedRows = response.data.map((product: Product) => ({
          ProductID: product.ProductID,
          ProductName: product.ProductName,
          quantity: 0,
          unitPrice: product.Price || 0,
          total: 0,
          PriceListID: product.PriceListID
        }));

        setRows(transformedRows);
      } catch (error) {
        console.error('Error fetching customer prices:', error);
        toast({
          title: "Error",
          description: "Failed to fetch product prices",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomerPrices();
  }, [customerId, toast]);

  const handleQuantityChange = (productId: number, value: string) => {
    const quantity = Math.max(0, parseFloat(value) || 0);
    
    setRows(prevRows => 
      prevRows.map(row => {
        if (row.ProductID === productId) {
          return {
            ...row,
            quantity,
            total: quantity * row.unitPrice
          };
        }
        return row;
      })
    );
  };

  const handleUnitPriceChange = async (productId: number, value: string) => {
    const unitPrice = Math.max(0, parseFloat(value) || 0);
    
    try {
      if (customerId) {
        const token = localStorage.getItem('token');
        
        await axios.put(
          `${process.env.NEXT_PUBLIC_API_URL}/pricelist/customer/${customerId}/product/${productId}`,
          { price: unitPrice },
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        setRows(prevRows => 
          prevRows.map(row => {
            if (row.ProductID === productId) {
              return {
                ...row,
                unitPrice,
                total: row.quantity * unitPrice
              };
            }
            return row;
          })
        );

        // toast({
        //   title: "Success",
        //   description: "Price updated successfully",
        // });
      }
    } catch (error) {
      console.error('Error updating price:', error);
      toast({
        title: "Error",
        description: "Failed to update price",
        variant: "destructive",
      });
    }
  };

  const getTotalAmount = () => {
    return rows.reduce((total, row) => total + row.total, 0);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">
      Loading products...
    </div>;
  }

  return (
    <div className="flex gap-4 overflow-hidden h-[calc(100vh-14rem)]">
      <div className="overflow-auto flex-[1.5]">
        <Table className="w-full border whitespace-nowrap">
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead className="w-32">Order Qty</TableHead>
              <TableHead className="w-32">Unit Price (Rs.)</TableHead>
              <TableHead className="w-32">Total (Rs.)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.ProductID} className="border-b">
                <TableCell>{row.ProductName}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={row.quantity}
                    onChange={(e) => handleQuantityChange(row.ProductID, e.target.value)}
                    placeholder="0"
                    min="0"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={row.unitPrice}
                    onChange={(e) => handleUnitPriceChange(row.ProductID, e.target.value)}
                    placeholder="0"
                    min="0"
                  />
                </TableCell>
                <TableCell className="font-medium">
                  Rs. {row.total.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="overflow-auto flex-1">
      <PaymentDetails
          total={getTotalAmount()}
          items={validItems}
          customerID={customerId}
          salesPersonID={salesPersonId}
          onSuccess={() => {
            setRows(rows.map(row => ({ ...row, quantity: 0, total: 0 })));
            toast({
              title: "Success",
              description: "Sale completed successfully",
            });
          }}
          onError={(error) => {
            toast({
              title: "Error",
              description: error,
              variant: "destructive",
            });
          }}
        />
      </div>
    </div>
  );
}