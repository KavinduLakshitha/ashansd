"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Trash, Loader2, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import AddCustomerDialog from "@/components/AddCustomer";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/app/auth/auth-context";
import api from "@/lib/api/axios";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

interface ChildDependencyReference {
  table: string;
  displayName: string;
  count: number;
  hasReferences: boolean;
  items: unknown[];
}

interface DependencyReference {
  table: string;
  displayName: string;
  count: number;
  hasReferences: boolean;
  items: unknown[];
  details?: unknown[];
  childReferences?: ChildDependencyReference[];
}

interface DeleteStatus {
  customerId: number;
  customerName: string;
  canDelete: boolean;
  hasDependencies: boolean;
  totalReferences: number;
  references: DependencyReference[];
}

// Define API error interface
interface ApiError {
  response?: {
    status?: number;
    data?: {
      error?: string;
      message?: string;
    };
  };
  message?: string;
}

export default function CustomerManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Delete state
  const [customerToDelete, setCustomerToDelete] = useState<DeleteStatus | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { toast } = useToast();
  const router = useRouter();
  const { getBusinessLineID, user } = useAuth();

  const fetchCustomers = useCallback(async (pageNum = 1, loadMore = false) => {
    if (!user) return;
    
    try {
      const businessLineId = getBusinessLineID();
      setIsLoading(pageNum === 1 && !loadMore);
      setIsLoadingMore(loadMore);
  
      const response = await api.get('/customers', {
        params: { 
          businessLineId,
          page: pageNum,
          limit
        },
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
  
      // Assuming the API returns { data: Customer[], total: number }
      const { data, total } = response.data;
      setTotalCustomers(total || 0);
      
      const customersWithData = await Promise.all(
        data.map(async (customer: Customer) => {
          try {
            const outstandingResponse = await api.get(
              `/payments/customer/${customer.CustomerID}/outstanding`
            );
            
            const pendingResponse = await api.get<PendingPayments>(
              `/payments/pending/${businessLineId}?customerId=${customer.CustomerID}`
            ).catch((error: ApiError) => {
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
          } catch (error: unknown) {
            console.error(`Error fetching data for customer ${customer.CustomerID}:`, error);
            return customer;
          }
        })
      );
  
      if (loadMore) {
        setCustomers(prev => [...prev, ...customersWithData]);
      } else {
        setCustomers(customersWithData);
      }
      
      // Check if we've loaded all customers
      setHasMore(customersWithData.length === limit);
      setPage(pageNum);
    } catch (error: unknown) {
      console.error('Error fetching customers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch customers",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [toast, getBusinessLineID, user, limit]);

  const loadMoreCustomers = () => {
    if (hasMore && !isLoadingMore) {
      fetchCustomers(page + 1, true);
    }
  };

  useEffect(() => {
    if (searchTerm) {
      setPage(1);
    }
  }, [searchTerm]);

  useEffect(() => {
    if (page === 1) {
      fetchCustomers(1);
    }
  }, [page, fetchCustomers]);

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
    fetchCustomers(1); // Refresh from first page after changes
  };

  const handleRowClick = (id: number) => {
    router.push(`/customer-details/${id}`);
  };

  // Handle initiating the delete process
  const initiateDelete = async (event: React.MouseEvent, id: number) => {
    event.stopPropagation();
    
    try {
      const response = await api.get(`/customers/${id}/can-delete`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      setCustomerToDelete(response.data);
    } catch (error: unknown) {
      console.error('Error checking customer delete status:', error);
      
      const apiError = error as ApiError;
      
      if (apiError.response?.status === 404) {
        toast({
          title: "Error",
          description: "Customer not found",
          variant: "destructive",
        });
        return;
      }
      
      if (
        apiError.response?.status === 500 &&
        apiError.response?.data?.error?.includes("doesn't exist")
      ) {
        // Get the customer info for the prompt
        const customer = customers.find(c => c.CustomerID === id);
        if (customer) {
          // Proceed with direct delete attempt
          const confirmDelete = window.confirm(`Are you sure you want to delete customer ${customer.CusName}?`);
          if (confirmDelete) {
            try {
              await api.delete(`/customers/${id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
              });
              
              toast({
                title: "Success",
                description: "Customer deleted successfully"
              });
              
              fetchCustomers(1); // Refresh from first page after delete
            } catch (deleteError: unknown) {
              // Handle constraint errors during direct delete
              const apiDeleteError = deleteError as ApiError;
              if (apiDeleteError.response?.status === 409) {
                toast({
                  title: "Error",
                  description: apiDeleteError.response?.data?.message || "Cannot delete customer with associated records",
                  variant: "destructive"
                });
              } else {
                toast({
                  title: "Error",
                  description: "Failed to delete customer",
                  variant: "destructive"
                });
              }
            }
          }
        }
        return;
      }
      
      toast({
        title: "Error",
        description: "Failed to check if customer can be deleted",
        variant: "destructive",
      });
    }
  };

  // Handle confirming the delete operation
  const confirmDelete = async (cascade: boolean = false) => {
    if (!customerToDelete) return;
    
    setIsDeleting(true);
    
    try {
      const token = localStorage.getItem('token');
      const endpoint = cascade 
        ? `/customers/${customerToDelete.customerId}?cascade=true` 
        : `/customers/${customerToDelete.customerId}`;
        
      await api.delete(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      toast({
        title: "Success",
        description: cascade 
          ? "Customer and all associated records deleted successfully" 
          : "Customer deleted successfully",
      });
      
      fetchCustomers(1); // Refresh from first page after delete
      setCustomerToDelete(null);
    } catch (error: unknown) {
      console.error('Error deleting customer:', error);
      
      let errorMessage = "Failed to delete customer";
      const apiError = error as ApiError;
      
      if (apiError.response?.data?.message) {
        errorMessage = apiError.response.data.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Cancel delete operation
  const cancelDelete = () => {
    setCustomerToDelete(null);
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

  useEffect(() => {
    if (!searchTerm) {
      fetchCustomers(1);
    }
  }, [searchTerm, fetchCustomers]);

  if (!user) {
    return (
      <Card>
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-xl font-semibold text-gray-800">Customer Management</CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p>Loading customer data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const businessLineId = user ? getBusinessLineID() : 0;

  return (
    <>
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
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p>Loading customers...</p>
            </div>
          ) : (
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
                  {filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        {searchTerm 
                          ? "No customers match your search criteria" 
                          : "No customers found"
                        }
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
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
                                onClick={(e) => initiateDelete(e, customer.CustomerID)}
                              >
                                <Trash className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      
                      {/* Load more button (only shown when not searching) */}
                      {!searchTerm && hasMore && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center p-4">
                            <Button 
                              variant="outline" 
                              onClick={loadMoreCustomers} 
                              disabled={isLoadingMore}
                              className="w-full"
                            >
                              {isLoadingMore ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Loading more...
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="mr-2 h-4 w-4" />
                                  Load More
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          
          {/* Pagination info */}
          {!isLoading && !searchTerm && filteredCustomers.length > 0 && (
            <div className="py-3 px-4 text-sm text-gray-500 border-t">
              Showing {filteredCustomers.length} of {totalCustomers} customers
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!customerToDelete} onOpenChange={open => !open && cancelDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {customerToDelete?.hasDependencies 
                ? "Cascade Delete Warning" 
                : "Confirm Deletion"}
            </AlertDialogTitle>
          </AlertDialogHeader>
          
          {/* Content */}
          {customerToDelete?.hasDependencies ? (
            <>
              <div className="mb-3 text-sm text-muted-foreground">
                You&apos;re about to delete <strong>{customerToDelete.customerName}</strong>, which has the following dependencies:
              </div>
              <ul className="list-disc pl-5 mb-3 text-sm text-muted-foreground">
                {customerToDelete.references && customerToDelete.references
                  .filter(ref => ref.count > 0)
                  .map((dep, index) => (
                    <li key={index} className="mb-2">
                      <div className="font-medium">
                        <span>{dep.count}</span> {dep.displayName}
                      </div>
                      
                      {/* Show child dependencies if they exist */}
                      {dep.childReferences && dep.childReferences.length > 0 && (
                        <ul className="list-circle pl-8 mt-1 text-sm">
                          {dep.childReferences
                            .filter(childRef => childRef.count > 0)
                            .map((childRef, childIndex) => (
                              <li key={childIndex}>
                                <span className="font-medium">{childRef.count}</span> {childRef.displayName}
                              </li>
                            ))}
                        </ul>
                      )}
                    </li>
                  ))}
              </ul>
              <div className="text-amber-500 font-semibold text-sm">
                Deleting this customer will also delete all these related records. This action cannot be undone.
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong>{customerToDelete?.customerName}</strong>? This action cannot be undone.
            </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            {customerToDelete?.hasDependencies ? (
              <Button 
                variant="destructive" 
                onClick={() => confirmDelete(true)}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete All"
                )}
              </Button>
            ) : (
              <Button 
                variant="destructive" 
                onClick={() => confirmDelete(false)}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}