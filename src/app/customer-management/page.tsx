"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import AddCustomerDialog from "@/components/AddCustomer";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/app/auth/auth-context";
import api from "@/lib/api/axios";

interface ChequeItem {
  Amount: string | number;
}

interface CreditItem {
  Amount: string | number;
}

interface PendingPayments {
  pendingCheques: ChequeItem[];
  pendingCredits: CreditItem[];
}

interface Customer {
  CustomerID: number;
  CusName: string;
  Address: string;
  ContactNumber: string;
  ContactPersonName: string;
  SMSNumber: string;
  BusinessRegNo: string;
  CreditLimit: number;
  Status: string;
  BankDetails: string;
  BusinessLineID: number;
  TotalOutstanding?: number;
  CashSale?: number;
  CreditBalance?: number;
  UpcomingCheques?: number;
  PendingCredits?: number;
}

export default function CustomerManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const router = useRouter();
  const { getBusinessLineID, user } = useAuth();

  const fetchCustomers = useCallback(async () => {
    if (!user) return;
    
    try {
      const businessLineId = getBusinessLineID();
      const token = localStorage.getItem('token');
  
      const response = await api.get('/customers', {
        params: { businessLineId },
        headers: { 'Authorization': `Bearer ${token}` }
      });
  
      const filteredCustomers = response.data.filter(
        (customer: Customer) => customer.BusinessLineID === businessLineId
      );
  
      const customersWithData = await Promise.all(
        filteredCustomers.map(async (customer: Customer) => {
          try {
            const outstandingResponse = await api.get(
              `/payments/customer/${customer.CustomerID}/outstanding`
            );
            
            const pendingResponse = await api.get<PendingPayments>(
              `/payments/pending/${businessLineId}?customerId=${customer.CustomerID}`
            ).catch(error => {
              console.error(`Error fetching pending payments for customer ${customer.CustomerID}:`, error);
              return { data: { pendingCheques: [], pendingCredits: [] } as PendingPayments };
            });
            
            const upcomingCheques = pendingResponse.data.pendingCheques.reduce(
              (total: number, cheque: ChequeItem) => total + (Number(cheque.Amount) || 0), 
              0
            );
            
            const pendingCredits = pendingResponse.data.pendingCredits.reduce(
              (total: number, credit: CreditItem) => total + (Number(credit.Amount) || 0), 
              0
            );
            
            return {
              ...customer,
              TotalOutstanding: outstandingResponse.data.TotalOutstanding || 0,
              UpcomingCheques: upcomingCheques,
              PendingCredits: pendingCredits
            };
          } catch (error) {
            console.error(`Error fetching data for customer ${customer.CustomerID}:`, error);
            return customer;
          }
        })
      );
  
      setCustomers(customersWithData);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch customers",
        variant: "destructive",
      });
    }
  }, [toast, getBusinessLineID, user]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleAddCustomer = () => {
    setSelectedCustomerId(null);
    setIsEditMode(false);
    setIsDialogOpen(true);
  };

  const handleEditCustomer = (event: React.MouseEvent, id: number) => {
    event.stopPropagation();
    setSelectedCustomerId(id);
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedCustomerId(null);
    setIsEditMode(false);
    fetchCustomers();
  };

  const handleRowClick = (id: number) => {
    router.push(`/customer-details/${id}`);
  };

  const handleDelete = async (event: React.MouseEvent, id: number) => {
    event.stopPropagation();
    if (confirm("Are you sure you want to delete this customer?")) {
      try {
        const token = localStorage.getItem('token');
        await api.delete(`/customers/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        toast({
          title: "Success",
          description: "Customer deleted successfully",
        });
        fetchCustomers();
      } catch (error) {
        console.error('Error deleting customer:', error);
        toast({
          title: "Error",
          description: "Failed to delete customer",
          variant: "destructive",
        });
      }
    }
  };

  const generateCustomerCode = (id: number) => {
    return `CUS${String(id).padStart(3, '0')}`;
  };

  const getStatusColor = (status: string) => {
    const statusColorMap: Record<string, string> = {
      "No Risk": "bg-green-200",
      "Credit Hold": "bg-yellow-200",
      "Over Credit Limit": "bg-red-200"
    };
    return statusColorMap[status] || "bg-gray-200";
  };

  const getCreditUsageColor = (outstanding: number, creditLimit: number) => {
    if (!creditLimit) return "text-gray-600";
    const usagePercentage = (outstanding / creditLimit) * 100;
    if (usagePercentage >= 90) return "text-red-600";
    if (usagePercentage >= 70) return "text-yellow-600";
    return "text-green-600";
  };  
  
  const formatCurrency = (value: number | undefined | null | string): string => {
    if (value === undefined || value === null) return 'Rs. 0.00';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return 'Rs. 0.00';
    return `Rs. ${numValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const filteredCustomers = customers.filter(customer =>
    customer.CusName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    generateCustomerCode(customer.CustomerID).toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!user) {
    return (
      <Card>
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-xl font-semibold text-gray-800">Customer Management</CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center">
          Loading customer data...
        </CardContent>
      </Card>
    );
  }

  const businessLineId = user ? getBusinessLineID() : 0;

  return (
    <Card>
      <CardHeader className="bg-gray-50 border-b border-gray-200 flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-semibold text-gray-800">Customer Management</CardTitle>
        <div className="flex items-center space-x-4">
          <Input 
            className="w-96" 
            placeholder="Search by name or code" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button variant="secondary">Filters</Button>
          <Button variant="default" onClick={handleAddCustomer}>
            New Customer
          </Button>
          <AddCustomerDialog 
            open={isDialogOpen} 
            onClose={handleDialogClose}
            businessLineId={businessLineId || null}
            customerId={selectedCustomerId}
            isEditMode={isEditMode}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border border-gray-200 rounded-sm">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow className="border-b border-gray-200">
                <TableCell className="font-bold border-r border-gray-200">Customer Code</TableCell>
                <TableCell className="font-bold border-r border-gray-200">Customer Name</TableCell>
                <TableCell className="font-bold border-r border-gray-200">Credit Usage</TableCell>
                <TableCell className="font-bold border-r border-gray-200">Upcoming Cheques</TableCell>
                <TableCell className="font-bold border-r border-gray-200">Pending Credits</TableCell>
                <TableCell className="font-bold border-r border-gray-200">Status</TableCell>
                <TableCell className="font-bold">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow
                  key={customer.CustomerID}
                  className="cursor-pointer hover:bg-gray-100 border-b border-gray-200"
                  onClick={() => handleRowClick(customer.CustomerID)}
                >
                  <TableCell className="border-r border-gray-200">
                    {generateCustomerCode(customer.CustomerID)}
                  </TableCell>
                  <TableCell className="border-r border-gray-200">{customer.CusName}</TableCell>
                  <TableCell className={`border-r border-gray-200 ${getCreditUsageColor(customer.TotalOutstanding || 0, customer.CreditLimit)}`}>
                    {formatCurrency(customer.TotalOutstanding)}/{formatCurrency(customer.CreditLimit)}
                  </TableCell>                  
                  <TableCell className="border-r border-gray-200">
                    {formatCurrency(customer.UpcomingCheques)}
                  </TableCell>

                  <TableCell className="border-r border-gray-200">
                    {formatCurrency(customer.PendingCredits)}
                  </TableCell>
                  <TableCell className="border-r border-gray-200">
                    <span className={`px-2 py-1 rounded-full ${getStatusColor(customer.Status)}`}>
                      {customer.Status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={(e) => handleEditCustomer(e, customer.CustomerID)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={(e) => handleDelete(e, customer.CustomerID)}
                      >
                        <Trash className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}