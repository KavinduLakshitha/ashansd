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

function getCustomerDisplayName(customer: Customer): string {
  return customer.CusName || customer.CustomerName || '';
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { getBusinessLineID } = useAuth();

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const businessLineId = getBusinessLineID();
        const token = localStorage.getItem('token');

        if (!token || !businessLineId) {
          throw new Error('Authentication or business line not available');
        }

        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/customers/dropdown`,
          {
            params: { businessLineId },
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        const customersList = Array.isArray(response.data?.data)
          ? response.data.data
          : Array.isArray(response.data)
            ? response.data
            : [];

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

  const filteredCustomers = customers.filter((customer) => {
    const name = getCustomerDisplayName(customer).toLowerCase();
    const code = `cus${String(customer.CustomerID).padStart(3, '0')}`;
    const query = searchQuery.toLowerCase();
    return name.includes(query) || code.includes(query) || String(customer.CustomerID).includes(query);
  });

  const handleSelectCustomer = (customer: Customer) => {
    const customerName = getCustomerDisplayName(customer);
    onChange(customerName, customer.CustomerID);
    onSelectCustomer?.(customer);
    setIsOpen(false);
    setSearchQuery("");
  };

  const stopEvent = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    const timer = window.setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown);
    }, 0);

    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(focusTimer);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
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

      {isOpen && (
        <div
          className="absolute z-[200] w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200"
          onPointerDown={stopEvent}
          onMouseDown={stopEvent}
        >
          <div className="p-2 border-b" onPointerDown={stopEvent} onMouseDown={stopEvent}>
            <div
              className="flex items-center gap-2 px-3 border rounded-md"
              onPointerDown={stopEvent}
              onMouseDown={stopEvent}
            >
              <Search className="h-4 w-4 text-gray-400 shrink-0" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onPointerDown={stopEvent}
                onMouseDown={stopEvent}
                onKeyDown={stopEvent}
                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-9"
              />
            </div>
          </div>

          <div
            className="max-h-[220px] overflow-y-auto overscroll-contain touch-pan-y p-1"
            onPointerDown={stopEvent}
            onMouseDown={stopEvent}
          >
            {isLoading ? (
              <div className="text-center py-2 text-sm text-gray-500">Loading customers...</div>
            ) : error ? (
              <div className="text-center py-2 text-sm text-red-500">{error}</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-2 text-sm text-gray-500">No customers found</div>
            ) : (
              filteredCustomers.map((customer) => {
                const customerName = getCustomerDisplayName(customer);
                const customerCode = `CUS${String(customer.CustomerID).padStart(3, '0')}`;
                return (
                  <button
                    key={customer.CustomerID}
                    type="button"
                    onClick={() => handleSelectCustomer(customer)}
                    className={cn(
                      "flex items-center w-full px-3 py-2 text-sm rounded-md hover:bg-gray-100 text-left",
                      value === customerName && "bg-gray-100"
                    )}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === customerName ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex flex-col min-w-0">
                      <span className="truncate">{customerName}</span>
                      <span className="text-xs text-gray-500">{customerCode}</span>
                    </span>
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
