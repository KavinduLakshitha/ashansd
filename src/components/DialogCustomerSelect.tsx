import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronDown, ChevronUp, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import axios from '@/lib/api/axios';
import { useAuth } from '@/app/auth/auth-context';
import { Customer } from '@/types/customer';

interface DialogCustomerSelectProps {
  value: string;
  onChange: (value: string, customerId?: number) => void;
  onSelectCustomer?: (customer: Customer) => void;
}

export default function DialogCustomerSelect({
  value,
  onChange,
  onSelectCustomer
}: DialogCustomerSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { getBusinessLineID } = useAuth();

  // Fetch customers when component mounts
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

        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/payments/customers/${businessLineId}`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );

        let customersList: Customer[] = [];

        if (Array.isArray(response.data)) {
          customersList = response.data;
        } else {
          throw new Error('Invalid data format received from server');
        }

        setCustomers(customersList);
      } catch (err) {
        console.error('Error fetching customers:', err);
        setError('Failed to load customers');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, [getBusinessLineID]);

  // Filter customers based on search query
  const filteredCustomers = customers.filter(customer => {
    const customerName = customer.CustomerName || '';
    return customerName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Handle customer selection
  const handleSelectCustomer = (customer: Customer) => {
    const customerName = customer.CustomerName || '';
    onChange(customerName, customer.CustomerID);
    if (onSelectCustomer) {
      onSelectCustomer(customer);
    }
    setIsOpen(false);
    setSearchQuery("");
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Button to toggle dropdown */}
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-left flex-1 truncate">
          {value || "Select Customer"}
        </span>
        {isOpen ? (
          <ChevronUp className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        ) : (
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        )}
      </Button>

      {/* Dropdown content */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200">
          {/* Search input */}
          <div className="p-2 border-b">
            <div className="flex items-center gap-2 px-3 border rounded-md">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
                autoFocus
              />
            </div>
          </div>

          {/* Customer list */}
          <div className="max-h-[200px] overflow-y-auto p-1">
            {isLoading ? (
              <div className="text-center py-2 text-sm text-gray-500">Loading customers...</div>
            ) : error ? (
              <div className="text-center py-2 text-sm text-red-500">{error}</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-2 text-sm text-gray-500">No customers found</div>
            ) : (
              filteredCustomers.map((customer) => {
                const customerName = customer.CustomerName || '';
                return (
                  <button
                    key={customer.CustomerID}
                    type="button"
                    onClick={() => handleSelectCustomer(customer)}
                    className={cn(
                      "flex items-center w-full px-3 py-2 text-sm rounded-md hover:bg-gray-100",
                      value === customerName && "bg-gray-100"
                    )}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === customerName ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span>{customerName}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
