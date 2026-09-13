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
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      return;
    }

    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    const timer = window.setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown);
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  // Dialog scroll-lock blocks wheel on nested lists; scroll the list manually.
  useEffect(() => {
    const list = listRef.current;
    if (!isOpen || !list) return;

    const onWheel = (event: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = list;
      if (scrollHeight <= clientHeight) return;

      event.stopPropagation();
      event.preventDefault();
      list.scrollTop = Math.min(
        Math.max(scrollTop + event.deltaY, 0),
        scrollHeight - clientHeight
      );
    };

    list.addEventListener('wheel', onWheel, { passive: false });
    return () => list.removeEventListener('wheel', onWheel);
  }, [isOpen, filteredCustomers.length]);

  const handleSelectCustomer = (customer: Customer) => {
    const customerName = getCustomerDisplayName(customer);
    onChange(customerName, customer.CustomerID);
    onSelectCustomer?.(customer);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={isOpen}
        className="w-full justify-between"
        onClick={() => setIsOpen((prev) => !prev)}
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
        <div className="mt-2 rounded-md border bg-background shadow-sm">
          <div className="border-b p-2">
            <div className="flex items-center gap-2 rounded-md border px-3">
              <Search className="h-4 w-4 shrink-0 text-gray-400" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>

          <div
            ref={listRef}
            className="max-h-[240px] overflow-y-auto overscroll-contain touch-pan-y p-1"
          >
            {isLoading ? (
              <div className="py-3 text-center text-sm text-gray-500">Loading customers...</div>
            ) : error ? (
              <div className="py-3 text-center text-sm text-red-500">{error}</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="py-3 text-center text-sm text-gray-500">No customers found</div>
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
                      "flex w-full items-center rounded-md px-3 py-2 text-left text-sm hover:bg-gray-100",
                      value === customerName && "bg-gray-100"
                    )}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === customerName ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex min-w-0 flex-col">
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
