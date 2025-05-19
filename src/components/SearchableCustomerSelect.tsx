import React, { useState, useEffect } from 'react';
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
  // Store businessLineId in a ref so we don't lose it between renders
  const [businessLineId, setBusinessLineId] = useState<number | null>(null);

  // First useEffect to get and set the business line ID
  useEffect(() => {
    const id = getBusinessLineID();
    console.log("Setting Business Line ID:", id);
    setBusinessLineId(id);
  }, [getBusinessLineID]);

  // Second useEffect that only runs when businessLineId is available
  useEffect(() => {
    // Skip if businessLineId is not yet available
    if (!businessLineId) {
      console.log("Waiting for business line ID to be available...");
      return;
    }

    const fetchCustomers = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log("Fetching customers with Business Line ID:", businessLineId);
        
        const token = localStorage.getItem('token');

        if (!token) {
          throw new Error('No authentication token found');
        }

        // Now we're guaranteed to have a business line ID
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/customers`, {
          params: {
            businessLineId: businessLineId
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        // Check if response.data is an object with a data property (paginated response)
        if (response.data && response.data.data) {
          // Use the data array from the paginated response
          const customersArray = response.data.data;
          // Filter customers for current business line if needed
          const filteredCustomers = customersArray.filter(
            (customer: Customer) => customer.BusinessLineID === businessLineId
          );
          setCustomers(filteredCustomers);
        } else if (Array.isArray(response.data)) {
          // Handle the case where response.data is directly the array
          const filteredCustomers = response.data.filter(
            (customer: Customer) => customer.BusinessLineID === businessLineId
          );
          setCustomers(filteredCustomers);
        } else {
          // Neither expected format was found
          console.error('Unexpected API response format:', response.data);
          setError('Invalid data format received from server');
        }
      } catch (err: unknown) {
        let errorMessage = 'Failed to fetch customers';
        if (typeof err === 'object' && err !== null && 'response' in err) {
          const response = (err as { response?: { data?: { message?: string } } }).response;
          if (response && response.data && response.data.message) {
            errorMessage = response.data.message;
          }
        }
        setError(errorMessage);
        console.error('Error fetching customers:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, [businessLineId]); // Only depends on businessLineId, not on getBusinessLineID

  useEffect(() => {
    setSelectedValue(value);
  }, [value]);

  const filteredCustomers = customers.filter(customer =>
    customer.CusName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false
  );

  const handleSelect = (customer: Customer) => {
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
              <p className="p-2 text-xs text-center text-red-500">{error}</p>
            ) : isLoading ? (
              <p className="p-2 text-xs text-center text-muted-foreground">Loading customers...</p>
            ) : filteredCustomers.length === 0 ? (
              <p className="p-2 text-xs text-center text-muted-foreground">No customer found.</p>
            ) : (
              filteredCustomers.map((customer) => (
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
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}