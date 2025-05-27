"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Edit, Trash } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import api from '@/lib/api/axios'
import BusinessLineDialog from "@/components/AddBusinessLine";
import { useAuth } from "../auth/auth-context";

interface Vendor {
  VendorID: number;
  VendorName: string;
}

interface BusinessLine {
  BusinessLineID: number;
  BusinessLineName: string;
  vendors: Vendor[];
}

export default function BusinessLineManagement() {
  const [businessLines, setBusinessLines] = useState<BusinessLine[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const [selectedBusinessLine, setSelectedBusinessLine] = useState<BusinessLine | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [businessLineToDelete, setBusinessLineToDelete] = useState<number | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const { getBusinessLineID } = useAuth();

  const currentUserBusinessLineId = getBusinessLineID();

  const fetchBusinessLines = useCallback(async () => {
    try {
      const response = await api.get('/business-lines');
      setBusinessLines(response.data);
    } catch (error) {
      console.error('Error fetching business lines:', error);
      toast({
        title: "Error",
        description: "Failed to fetch business lines",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchBusinessLines();
  }, [fetchBusinessLines]); 

  const handleDialogOpen = (businessLine?: BusinessLine) => {
    if (businessLine) {
      setSelectedBusinessLine(businessLine);
    } else {
      setSelectedBusinessLine(null);
    }
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedBusinessLine(null);
    fetchBusinessLines();
  };

  const openDeleteDialog = (id: number) => {
    setBusinessLineToDelete(id);
    setDeleteErrorMessage(null);
    
    if (currentUserBusinessLineId && id === currentUserBusinessLineId) {
      setDeleteErrorMessage("You cannot delete the business line you are currently logged in as.");
    }
    
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setBusinessLineToDelete(null);
    setDeleteErrorMessage(null);
  };

  const handleDelete = async () => {
    if (!businessLineToDelete) return;
    
    // Double-check to prevent deletion of current user's business line
    if (currentUserBusinessLineId && businessLineToDelete === currentUserBusinessLineId) {
      setDeleteErrorMessage("You cannot delete the business line you are currently logged in as.");
      return;
    }
    
    try {
      const response = await api.delete(`/business-lines/${businessLineToDelete}`);
      
      if (response.data.hasDependencies) {
        setDeleteErrorMessage(response.data.message);
        return;
      }
      
      closeDeleteDialog();
      toast({
        title: "Success",
        description: "Business line deleted successfully",
      });
      fetchBusinessLines();
    } catch (error) {
      console.error('Error deleting business line:', error);
      let errorMessage = "Failed to delete business line";
      if (error && typeof error === "object" && "response" in error) {
        const err = error as { response?: { data?: { message?: string } } };
        errorMessage = err.response?.data?.message || errorMessage;
      }
      setDeleteErrorMessage(errorMessage);
    }
  };

  const filteredBusinessLines = businessLines.filter(bl =>
    bl.BusinessLineName ? 
    bl.BusinessLineName.toLowerCase().includes(searchTerm.toLowerCase()) : 
    false
  );

  return (
    <Card>
      <CardHeader className="bg-gray-50 border-b border-gray-200 flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-semibold text-gray-800">Business Line Management</CardTitle>
        <div className="flex items-center space-x-4">
          <Input 
            className="w-96" 
            placeholder="Search" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button variant="default" onClick={() => handleDialogOpen()}>
            New Business Line
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 m-2">
        <div className="border border-gray-200 rounded-sm">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow className="border-b border-gray-200">
                <TableCell className="font-bold border-r border-gray-200">Business Line Name</TableCell>
                <TableCell className="font-bold border-r border-gray-200">Vendors</TableCell>
                <TableCell className="font-bold">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBusinessLines.map((row) => (
                <TableRow key={row.BusinessLineID} className="border-b border-gray-200">
                  <TableCell className="border-r border-gray-200">{row.BusinessLineName}</TableCell>
                  <TableCell className="border-r border-gray-200 p-0">
                    <div className="border-0">
                      <Table>
                        <TableBody>
                          {row.vendors.map((vendor, vIndex) => (
                            <TableRow 
                              key={vendor.VendorID} 
                              className={`hover:bg-gray-50 ${
                                vIndex !== row.vendors.length - 1 ? 'border-b border-gray-200' : ''
                              }`}
                            >
                              <TableCell className="py-2">{vendor.VendorName}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="icon" onClick={() => handleDialogOpen(row)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => openDeleteDialog(row.BusinessLineID)}
                        disabled={currentUserBusinessLineId === row.BusinessLineID}
                        className={currentUserBusinessLineId === row.BusinessLineID ? "opacity-50 cursor-not-allowed" : ""}
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
      
      {/* Business Line Edit/Add Dialog */}
      <BusinessLineDialog 
        open={isDialogOpen} 
        onClose={handleDialogClose}
        businessLineId={selectedBusinessLine?.BusinessLineID}
        initialData={selectedBusinessLine ? { BusinessLineName: selectedBusinessLine.BusinessLineName } : undefined}
      />
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteErrorMessage ? "Cannot Delete Business Line" : "Are you sure?"}
            </AlertDialogTitle>
            <AlertDialogDescription className={deleteErrorMessage ? "text-red-500" : ""}>
              {deleteErrorMessage || 
                "This action will permanently delete this business line and cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDeleteDialog}>
              {deleteErrorMessage ? "Close" : "Cancel"}
            </AlertDialogCancel>
            {!deleteErrorMessage && (
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}