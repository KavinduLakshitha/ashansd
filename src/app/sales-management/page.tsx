"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import InvoiceTable from "@/components/InvoiceTable";
import SearchableCustomerSelect from "@/components/SearchableCustomerSelect";
import { Customer } from '@/types/customer';
import SearchableSalesPersonSelect from "@/components/SearchableSalesPerson";

export default function SalesManagementPage() {  
  const [dateRange, setDateRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
  });
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | undefined>();
  const [selectedSalesPerson, setSelectedSalesPerson] = useState<string>("");
  const [selectedSalesPersonId, setSelectedSalesPersonId] = useState<number | undefined>();
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [address, setAddress] = useState("");
  const [contactPerson, setContactPerson] = useState("");

  const handleDateChange = (field: "startDate" | "endDate", date: Date) => {
    setDateRange((prev) => ({ ...prev, [field]: date }));
  };  

  const handleCustomerSelect = (customer: Customer) => {
    setContactNumber(customer.ContactNumber || "");
    setAddress(customer.Address || "");
    setContactPerson(customer.ContactPersonName || "");
    setSelectedCustomerId(customer.CustomerID);
    setSelectedSalesPerson("");
    setSelectedSalesPersonId(undefined);
  };

  const resetCustomerFields = () => {
    setContactNumber("");
    setAddress("");
    setContactPerson("");
    setSelectedCustomerId(undefined);
  };

  return (
    <Card>
        <CardHeader className="bg-gray-50 border-b border-gray-200 flex flex-row items-center justify-between">
        <CardTitle className="text-xl whitespace-nowrap font-semibold text-gray-800">Sales Management</CardTitle>        
        </CardHeader>

        <div className="flex flex-col gap-1 ml-1 mt-1 mb-1">
        <SearchableCustomerSelect
          value={selectedCustomer}
          onChange={(value, customerId) => {
            setSelectedCustomer(value);
            if (!customerId) {
              resetCustomerFields();
            }
          }}
          onSelectCustomer={handleCustomerSelect}
        />
        <SearchableSalesPersonSelect
          value={selectedSalesPerson}
          onChange={(value, salesPersonId) => {
            setSelectedSalesPerson(value);
            setSelectedSalesPersonId(salesPersonId);
          }}
        />
        <DatePicker
          selectedDate={dateRange.startDate}
          onDateChange={(date) => handleDateChange("startDate", date)}
        />
        <Input 
          className="w-60" 
          placeholder="Invoice Number" 
          value={invoiceNumber} 
          onChange={(e) => setInvoiceNumber(e.target.value)}
        />
        <Input
          placeholder="Contact Number" 
          value={contactNumber}
          readOnly
          className="w-60 bg-gray-50"
        />
        <Input
          placeholder="Contact Person" 
          value={contactPerson}
          readOnly
          className="w-60 bg-gray-50"
        />
        <Input
          placeholder="Address" 
          value={address}
          readOnly
          className="w-60 bg-gray-50"
        />
        </div>
        <div className="ml-1">
        <InvoiceTable
          customerId={selectedCustomerId}
          customerName={selectedCustomer}
          contactNumber={contactNumber}
          salesPersonId={selectedSalesPersonId}
          salesPerson={selectedSalesPerson}
          address={address}
        />
        </div>
        
    </Card>
  );
}
