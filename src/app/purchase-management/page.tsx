"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "../auth/auth-context";
import axios from "@/lib/api/axios";
import { isAxiosError } from "axios";
import { toast } from "@/hooks/use-toast";
import VendorProductsTable from "@/components/PurchaseTable";

interface Vendor {
  VendorID: number;
  VendorName: string;
  ContactNumber: string;
  ContactPersonName: string;
  BusinessRegNum: string;
  Address: string;
  BusinessLines: string[];
}

export default function PurchaseManagementPage() {
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { getBusinessLineID } = useAuth();  
  const [invoiceDate, setInvoiceDate] = useState<Date>(new Date());
  const [invoiceNumber, setInvoiceNumber] = useState("");

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const businessLineId = getBusinessLineID();
        const token = localStorage.getItem('token');
        
        if (!token) {
          throw new Error('No authentication token found');
        }        
        
        const filteredResponse = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/vendors`, {
          params: {
            businessLineId: businessLineId
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        setVendors(filteredResponse.data);
        
        // Auto-select if only one vendor
        if (filteredResponse.data.length === 1) {
          setSelectedVendor(filteredResponse.data[0].VendorID.toString());
        }
      } catch (error) {
        console.error('Error fetching vendors:', error);
        let errorMessage = "Failed to load vendors. Please try again.";
        
        if (isAxiosError(error) && error.response?.status === 401) {
          errorMessage = "Your session has expired. Please log in again.";          
        }
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchVendors();
  }, [getBusinessLineID]);

  const handleDateChange = (date: Date) => {
    console.log('Date selected:', date);
    setInvoiceDate(date);
  };

  const handleVendorChange = async (vendorId: string) => {
    try {
      setSelectedVendor(vendorId);      

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
    } catch (error) {
      console.error('Error fetching vendor details:', error);
      toast({
        title: "Error",
        description: "Failed to load vendor details.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="bg-gray-50 border-b border-gray-200 flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-semibold text-gray-800">Purchase Management</CardTitle>        
      </CardHeader>

      <div className="flex flex-col gap-1 ml-1 mt-1 mb-1 w-60">          
          <Select 
            disabled={isLoading} 
            value={selectedVendor} 
            onValueChange={handleVendorChange}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoading ? "Loading vendors..." : "Select Vendor"} />
            </SelectTrigger>
            <SelectContent>
              {vendors.map((vendor) => (
                <SelectItem 
                  key={vendor.VendorID} 
                  value={vendor.VendorID.toString()}
                >
                  {vendor.VendorName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DatePicker
            selectedDate={invoiceDate}
            onDateChange={handleDateChange}
          />

          <Input 
            className="w-60" 
            placeholder="Invoice Number" 
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
          />
        </div>

        <div className="ml-1">
          <VendorProductsTable 
            vendorId={selectedVendor} 
            invoiceNumber={invoiceNumber}
            invoiceDate={invoiceDate}
          />
        </div>       
    </Card>
  );
}