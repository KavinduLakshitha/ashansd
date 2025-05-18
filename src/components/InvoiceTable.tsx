"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PaymentDetails from "./PaymentDetails";
import axios from '@/lib/api/axios';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/app/auth/auth-context";
import { debounce } from 'lodash';

interface Product {
  ProductID: number;
  ProductName: string;
  CurrentQTY: number;
  Price: number | null;
  PriceListID?: number;
  BusinessLineName: string;
  BusinessLineID: number;
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
  uniqueId: string;
}

// Memoized Input Component for better performance
const NumberInput = memo(({ 
  value, 
  onChange, 
  onBlur = undefined,
  placeholder = "0",
  min = "0"
}: {
  value: number;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  placeholder?: string;
  min?: string;
}) => {
  const [localValue, setLocalValue] = useState(value.toString());

  // Update local value when prop value changes
  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  return (
    <Input
      type="number"
      value={localValue}
      onChange={(e) => {
        setLocalValue(e.target.value);
        onChange(e.target.value);
      }}
      onBlur={onBlur ? (e) => onBlur(e.target.value) : undefined}
      placeholder={placeholder}
      min={min}
    />
  );
});

// Memoized Table Row Component
const InvoiceTableRow = memo(({ 
  row, 
  onQuantityChange, 
  onUnitPriceChange, 
  onUnitPriceBlur
}: {
  row: InvoiceRow;
  onQuantityChange: (productId: number, value: string) => void;
  onUnitPriceChange: (productId: number, value: string) => void;
  onUnitPriceBlur: (productId: number, value: string) => void;
}) => {
  return (
    <TableRow className="border-b">
      <TableCell>{row.ProductName}</TableCell>
      <TableCell>
        <NumberInput
          value={row.quantity}
          onChange={(value) => onQuantityChange(row.ProductID, value)}
        />
      </TableCell>
      <TableCell>
        <NumberInput
          value={row.unitPrice}
          onChange={(value) => onUnitPriceChange(row.ProductID, value)}
          onBlur={(value) => onUnitPriceBlur(row.ProductID, value)}
        />
      </TableCell>
      <TableCell className="font-medium">
        Rs. {row.total.toFixed(2)}
      </TableCell>
    </TableRow>
  );
});

export default function InvoiceTable({
  customerId,
  salesPersonId,
}: InvoiceTableProps) {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { getBusinessLineID } = useAuth();

  // Create memoized valid items list
  const validItems = rows
    .filter(row => row.quantity > 0)
    .map(row => ({
      ProductID: row.ProductID,
      item: row.ProductName,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      total: row.total
    }));

  // Create debounced API call for price updates
  const debouncedPriceUpdate = useCallback(
    debounce(async (productId: number, unitPrice: number, customerId?: number) => {
      if (!customerId) return;
      
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No authentication token found');
        }
        
        await axios.put(
          `${process.env.NEXT_PUBLIC_API_URL}/pricelist/customer/${customerId}/product/${productId}`,
          { price: unitPrice },
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
      } catch (error) {
        console.error('Error updating price:', error);
        toast({
          title: "Error",
          description: "Failed to update price",
          variant: "destructive",
        });
      }
    }, 800),
    [toast]
  );

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

        // Get the business line ID from auth context
        const businessLineId = getBusinessLineID();

        if (!businessLineId) {
          throw new Error('Business line ID not found');
        }

        console.log(`Fetching products for customer ${customerId} and business line ${businessLineId}`);

        // Include businessLineId as a query parameter
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/pricelist/customer/${customerId}`,
          {
            params: {
              businessLineId: businessLineId
            },
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        console.log('Product data received:', response.data);

        // Transform the data with a unique ID for each row
        const transformedRows = response.data.map((product: Product, index: number) => ({
          ProductID: product.ProductID,
          ProductName: product.ProductName,
          quantity: 0,
          unitPrice: product.Price || 0,
          total: 0,
          PriceListID: product.PriceListID,
          // Create a unique ID using multiple properties and index for extra uniqueness
          uniqueId: `${product.ProductID}-${product.PriceListID || 'noprice'}-${index}-${Date.now()}`
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
  }, [customerId, toast, getBusinessLineID]);

  // Handle quantity change - update UI immediately
  const handleQuantityChange = useCallback((productId: number, value: string) => {
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
  }, []);

  // Handle unit price change in the UI (doesn't trigger API call)
  const handleUnitPriceChange = useCallback((productId: number, value: string) => {
    const unitPrice = Math.max(0, parseFloat(value) || 0);
    
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
  }, []);

  // Handle unit price blur - update API when user finishes typing
  const handleUnitPriceBlur = useCallback((productId: number, value: string) => {
    const unitPrice = Math.max(0, parseFloat(value) || 0);
    
    if (customerId) {
      debouncedPriceUpdate(productId, unitPrice, customerId);
    }
  }, [customerId, debouncedPriceUpdate]);

  // Calculate total in a memoized function
  const getTotalAmount = useCallback(() => {
    return rows.reduce((total, row) => total + row.total, 0);
  }, [rows]);

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
              <InvoiceTableRow 
                key={row.uniqueId}
                row={row}
                onQuantityChange={handleQuantityChange}
                onUnitPriceChange={handleUnitPriceChange}
                onUnitPriceBlur={handleUnitPriceBlur}
              />
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