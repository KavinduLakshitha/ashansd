import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import axios from '@/lib/api/axios';
import { useAuth } from '@/app/auth/auth-context';

interface SalesPerson {
  UserID: number;
  UserName: string;
  ContactNumber: string;
  Email: string;
  BusinessLineID: number;
  BusinessLineName: string;
}

interface SearchableSalesPersonSelectProps {
  value: string;
  onChange: (value: string, salesPersonId?: number) => void;
}

export default function SearchableSalesPersonSelect({ 
  value, 
  onChange,
}: SearchableSalesPersonSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedValue, setSelectedValue] = useState(value);
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { getBusinessLineID } = useAuth();

  useEffect(() => {
    const fetchSalesPersons = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const businessLineId = getBusinessLineID();
        const token = localStorage.getItem('token');

        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/sales/business-line/${businessLineId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        setSalesPersons(response.data);
      } catch (err) {
        setError('Failed to fetch sales persons');
        console.error('Error fetching sales persons:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSalesPersons();
  }, [getBusinessLineID]);

  useEffect(() => {
    setSelectedValue(value);
  }, [value]);

  const filteredSalesPersons = salesPersons.filter(person =>
    person.UserName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false
  );

  const handleSelect = (person: SalesPerson) => {
    onChange(person.UserName, person.UserID);
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
          <span className="text-left flex-1 truncate text-gray-500 font-normal">
            {isLoading ? "Loading..." : 
             error ? "Error loading sales persons" :
             selectedValue && selectedValue !== "Select Sales Person" 
              ? selectedValue
              : "Select Sales Person"}
          </span>
          {open ? (
            <ChevronUp className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          ) : (
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0">
        <div className="flex flex-col">
          <input
            className="flex h-10 w-full rounded-md bg-transparent px-3 py-2 text-xs outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-b"
            placeholder="Search sales person..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="flex flex-col max-h-[200px] overflow-y-auto">
            {error ? (
              <p className="p-2 text-xs text-center text-red-500">{error}</p>
            ) : isLoading ? (
              <p className="p-2 text-xs text-center text-muted-foreground">Loading sales persons...</p>
            ) : filteredSalesPersons.length === 0 ? (
              <p className="p-2 text-xs text-center text-muted-foreground">No sales person found.</p>
            ) : (
              filteredSalesPersons.map((person) => (
                <button
                  key={person.UserID}
                  onClick={() => handleSelect(person)}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-accent hover:text-accent-foreground",
                    selectedValue === person.UserName && "bg-accent text-accent-foreground"
                  )}
                >                  
                  <div className="flex flex-col">
                    <span>{person.UserName}</span>                    
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