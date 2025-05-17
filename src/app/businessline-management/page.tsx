"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Trash } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import api from '@/lib/api/axios'
import BusinessLineDialog from "@/components/AddBusinessLine";

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

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this business line?")) {
      try {
        const response = await api.delete(`/business-lines/${id}`);
        
        // Check if the response indicates dependencies
        if (response.data.hasDependencies) {
          toast({
            title: "Cannot Delete",
            description: response.data.message,
            variant: "destructive",
          });
          return;
        }
        
        toast({
          title: "Success",
          description: "Business line deleted successfully",
        });
        fetchBusinessLines();
      } catch (error) {
        console.error('Error deleting business line:', error);
        // For other types of errors
        let errorMessage = "Failed to delete business line";
        if (error && typeof error === "object" && "response" in error) {
          const err = error as { response?: { data?: { message?: string } } };
          errorMessage = err.response?.data?.message || errorMessage;
        }
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
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
          {/* <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button> */}
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
                        onClick={() => handleDelete(row.BusinessLineID)}
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
      <BusinessLineDialog 
        open={isDialogOpen} 
        onClose={handleDialogClose}
        businessLineId={selectedBusinessLine?.BusinessLineID}
        initialData={selectedBusinessLine ? { BusinessLineName: selectedBusinessLine.BusinessLineName } : undefined}
      />
    </Card>
  );
}