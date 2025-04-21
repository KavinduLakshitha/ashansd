"use client";

import AddVendorDialog from "@/components/AddVendor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Trash } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api/axios";
import VendorDialog from "@/components/AddVendor";

interface Vendor {
  VendorID: number;
  VendorName: string;
  ContactNumber: string;
  ContactPersonName: string;
  BusinessRegNum: string;
  Address: string;
  BusinessLines: string[];
}

export default function VendorManagement() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  const fetchVendors = useCallback(async () => {
    try {
      const response = await api.get('/vendors');
      setVendors(response.data);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast({
        title: "Error",
        description: "Failed to fetch vendors",
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

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this vendor?")) {
      try {
        await api.delete(`/vendors/${id}`);
        toast({
          title: "Success",
          description: "Vendor deleted successfully",
        });
        fetchVendors();
      } catch (error) {
        console.error('Error deleting vendor:', error);
        toast({
          title: "Error",
          description: "Failed to delete vendor",
          variant: "destructive",
        });
      }
    }
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
                        onClick={() => handleDelete(vendor.VendorID)}
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
      <VendorDialog 
        open={selectedVendor !== null}
        onClose={handleDialogClose}
        vendorId={selectedVendor?.VendorID}
        initialData={selectedVendor || undefined}
      />
    </Card>
  );
}