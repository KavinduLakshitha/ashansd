import React, { useState, useEffect, useCallback } from 'react';
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import axios from '@/lib/api/axios';
import { useAuth } from '@/app/auth/auth-context';
import { Customer } from '@/types/customer';

interface SearchableCustomerSelectProps {
  value: string;
  onChange: (value: string, customerId?: number) => void;
  onSelectCustomer?: (customer: Customer) => void;
}

export default function SearchableCustomerSelect({ 
  value, 
  onChange,
  onSelectCustomer 
}: SearchableCustomerSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedValue, setSelectedValue] = useState(value);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { getBusinessLineID } = useAuth();
  const [businessLineId, setBusinessLineId] = useState<number | null>(null);

  useEffect(() => {
    const id = getBusinessLineID();
    setBusinessLineId(id);
  }, [getBusinessLineID]);

  const fetchCustomers = useCallback(async () => {
    if (!businessLineId) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);     
      
      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error('No authentication token found');
      }

      // Use the dedicated dropdown endpoint
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/customers/dropdown`, {
        params: {
          businessLineId: businessLineId
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log("API Response:", response.data);

      if (response.data && response.data.data) {
        const customersArray = response.data.data;
        setCustomers(customersArray);
      } else if (Array.isArray(response.data)) {
        const filteredCustomers = response.data.filter(
          (customer: Customer) => customer.BusinessLineID === businessLineId
        );
        setCustomers(filteredCustomers);
      } else {
        console.error('Unexpected API response format:', response.data);
        setError('Invalid data format received from server');
      }
    } catch (err: unknown) {
      let errorMessage = 'Failed to fetch customers';
      console.error('Full error object:', err);
      
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const response = (err as { response?: { data?: { message?: string }, status?: number } }).response;
        if (response) {
          console.error('Error response:', response);
          if (response.data && response.data.message) {
            errorMessage = response.data.message;
          } else if (response.status === 401) {
            errorMessage = 'Authentication failed. Please login again.';
          } else if (response.status === 403) {
            errorMessage = 'Access denied. Check your permissions.';
          }
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      console.error('Error fetching customers:', err);
    } finally {
      setIsLoading(false);
    }
  }, [businessLineId]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    setSelectedValue(value);
  }, [value]);

  const filteredCustomers = customers.filter(customer =>
    customer.CusName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false
  );

  const handleSelect = (customer: Customer) => {
    console.log("Selected customer:", customer);
    onChange(customer.CusName, customer.CustomerID);
    if (onSelectCustomer) {
      onSelectCustomer(customer);
    }
    setOpen(false);
    setSearchQuery("");
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-60 justify-between text-xs"
          disabled={isLoading}
        >
          <span className="text-xs text-left flex-1 truncate text-gray-500 font-normal">
            {isLoading ? "Loading..." : 
             error ? "Error loading customers" :
             selectedValue && selectedValue !== "Select Customer" 
              ? selectedValue
              : "Select Customer"}
          </span>
          {open ? (
            <ChevronUp className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          ) : (
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0 ">
        <div className="flex flex-col text-xs">
          <input
            className="flex h-10 w-full rounded-md bg-transparent px-3 py-2 text-xs outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-b"
            placeholder="Search customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="flex flex-col max-h-[200px] overflow-y-auto">
            {error ? (
              <div className="p-2">
                <p className="text-xs text-center text-red-500">{error}</p>
                <p className="text-xs text-center text-gray-400 mt-1">
                  Total customers loaded: {customers.length}
                </p>
              </div>
            ) : isLoading ? (
              <p className="p-2 text-xs text-center text-muted-foreground">Loading customers...</p>
            ) : customers.length === 0 ? (
              <p className="p-2 text-xs text-center text-muted-foreground">No customers found for this business line.</p>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-2">
                <p className="text-xs text-center text-muted-foreground">No customer found matching &quot;{searchQuery}&quot;.</p>
                <p className="text-xs text-center text-gray-400 mt-1">
                  Total customers: {customers.length}
                </p>
              </div>
            ) : (
              <>
                <div className="px-2 py-1 text-xs text-gray-400 border-b">
                  {filteredCustomers.length} of {customers.length} customers
                </div>
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.CustomerID}
                    onClick={() => handleSelect(customer)}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-accent hover:text-accent-foreground",
                      selectedValue === customer.CusName && "bg-accent text-accent-foreground"
                    )}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedValue === customer.CusName ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{customer.CusName}</span>                    
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}