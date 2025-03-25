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

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const businessLineId = getBusinessLineID();
        const token = localStorage.getItem('token');

        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/customers`, {
          params: {
            businessLineId
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        // Filter customers for current business line
        const filteredCustomers = response.data.filter(
          (customer: Customer) => customer.BusinessLineID === businessLineId
        );

        setCustomers(filteredCustomers);
      } catch (err) {
        setError('Failed to fetch customers');
        console.error('Error fetching customers:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, [getBusinessLineID]);

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