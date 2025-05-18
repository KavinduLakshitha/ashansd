"use client";

import AddVendorDialog from "@/components/AddVendor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Trash, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api/axios";
import { AxiosError } from "axios";
import VendorDialog from "@/components/AddVendor";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";

interface Vendor {
  VendorID: number;
  VendorName: string;
  ContactNumber: string;
  ContactPersonName: string;
  BusinessRegNum: string;
  Address: string;
  BusinessLines: string[];
}

interface DependencyReference {
  table: string;
  displayName: string;
  count: number;
  hasReferences: boolean;
  details: unknown[];
}

interface DeleteStatus {
  vendorId: number;
  vendorName: string;
  canDelete: boolean;
  hasDependencies: boolean;
  totalReferences: number;
  references: DependencyReference[];
}

export default function VendorManagement() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  
  const [vendorToDelete, setVendorToDelete] = useState<DeleteStatus | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchVendors = useCallback(async () => {
    try {
      const response = await api.get('/vendors');
      setVendors(response.data);
    } catch (error: unknown) {
      console.error('Error fetching vendors:', error);
      
      const axiosError = error as AxiosError<{ message: string }>;
      const errorMessage = axiosError.response?.data?.message || "Failed to fetch vendors";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [toast]);
  
  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const handleEdit = (vendor: Vendor) => {
    setSelectedVendor(vendor);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedVendor(null);
    fetchVendors();
  };

  const initiateDelete = async (id: number) => {
    try {
      const response = await api.get(`/vendors/${id}/can-delete`);
      setVendorToDelete(response.data);
    } catch (error: unknown) {
      console.error('Error checking vendor delete status:', error);
      
      const axiosError = error as AxiosError<{ message: string }>;
      const errorMessage = axiosError.response?.data?.message || "Failed to check if vendor can be deleted";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const confirmDelete = async (cascade: boolean = false) => {
    if (!vendorToDelete) return;
    
    setIsDeleting(true);
    
    try {
      const endpoint = cascade 
        ? `/vendors/${vendorToDelete.vendorId}?cascade=true` 
        : `/vendors/${vendorToDelete.vendorId}`;
        
      await api.delete(endpoint);
      
      toast({
        title: "Success",
        description: cascade 
          ? "Vendor and all associated records deleted successfully" 
          : "Vendor deleted successfully",
      });
      
      fetchVendors();
      
      setVendorToDelete(null);
    } catch (error: unknown) {
        console.error('Error deleting vendor:', error);
        
        const axiosError = error as AxiosError<{ message: string }>;
        const errorMessage = axiosError.response?.data?.message || "Failed to delete vendor";
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setVendorToDelete(null);
  };

  const generateVendorCode = (id: number) => {
    return `VEN${String(id).padStart(3, '0')}`;
  };

  const filteredVendors = vendors.filter(vendor =>
    vendor.VendorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    generateVendorCode(vendor.VendorID).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader className="bg-gray-50 border-b border-gray-200 flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-semibold text-gray-800">Vendor Management</CardTitle>
        <div className="flex items-center space-x-4">
          <Input 
            className="w-96" 
            placeholder="Search by vendor name or code" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />          
          <Button variant="default" onClick={() => handleEdit({} as Vendor)}>
            New Vendor
          </Button>
          <AddVendorDialog open={isDialogOpen} onClose={handleDialogClose} onSuccess={() => fetchVendors()}/>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border border-gray-200 rounded-sm">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow className="border-b border-gray-200">
                <TableCell className="font-bold border-r border-gray-200">Vendor Code</TableCell>
                <TableCell className="font-bold border-r border-gray-200">Vendor Name</TableCell>
                <TableCell className="font-bold border-r border-gray-200">Address</TableCell>
                <TableCell className="font-bold border-r border-gray-200">Contact Number</TableCell>
                <TableCell className="font-bold border-r border-gray-200">Contact Person</TableCell>
                <TableCell className="font-bold border-r border-gray-200">BR Number</TableCell>
                <TableCell className="font-bold border-r border-gray-200">Business Lines</TableCell>
                <TableCell className="font-bold">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVendors.map((vendor) => (
                <TableRow key={vendor.VendorID} className="border-b border-gray-200">
                  <TableCell className="border-r border-gray-200">
                    {generateVendorCode(vendor.VendorID)}
                  </TableCell>
                  <TableCell className="border-r border-gray-200">{vendor.VendorName}</TableCell>
                  <TableCell className="border-r border-gray-200">{vendor.Address}</TableCell>
                  <TableCell className="border-r border-gray-200">{vendor.ContactNumber}</TableCell>
                  <TableCell className="border-r border-gray-200">{vendor.ContactPersonName}</TableCell>
                  <TableCell className="border-r border-gray-200">{vendor.BusinessRegNum}</TableCell>
                  <TableCell className="border-r border-gray-200">
                    {vendor.BusinessLines.join(', ')}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="icon" onClick={() => handleEdit(vendor)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => initiateDelete(vendor.VendorID)}
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
      
      {/* Edit Vendor Dialog */}
      <VendorDialog 
        open={selectedVendor !== null}
        onClose={handleDialogClose}
        vendorId={selectedVendor?.VendorID}
        initialData={selectedVendor || undefined}
      />
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!vendorToDelete} onOpenChange={open => !open && cancelDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {vendorToDelete?.hasDependencies 
                ? "Cascade Delete Warning" 
                : "Confirm Deletion"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {vendorToDelete?.hasDependencies ? (
                <div>
                  <div className="mb-3">
                    You&apos;re about to delete <strong>{vendorToDelete.vendorName}</strong>, which has the following dependencies:
                  </div>
                  <ul className="list-disc pl-5 mb-3">
                    {vendorToDelete.references
                      .filter(ref => ref.count > 0)
                      .map((dep, index) => (
                        <li key={index}>
                          <span className="font-medium">{dep.count}</span> {dep.displayName}
                        </li>
                      ))}
                  </ul>
                  <div className="text-amber-500 font-semibold">
                    Deleting this vendor will also delete all these related records. This action cannot be undone.
                  </div>
                </div>
              ) : (
                <div>
                  Are you sure you want to delete <strong>{vendorToDelete?.vendorName}</strong>? This action cannot be undone.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            {vendorToDelete?.hasDependencies ? (
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
    </Card>
  );
}