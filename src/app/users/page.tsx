"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Filter, Trash } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import UserDialog from "@/components/AddUser";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api/axios";

interface User {
  UserID: number;
  UserName: string;
  UserType: string;
  ContactNumber: string | null;
  Email: string | null;
  BusinessLineName: string;
  BusinessLineID: number;
  screens?: string[];
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleEdit = async (user: User) => {
    try {
      // Fetch full user data including screens
      const response = await api.get(`/users/${user.UserID}`);
      setSelectedUser(response.data);
      setIsDialogOpen(true);
    } catch (error) {
      console.error('Error fetching user details:', error);
      toast({
        title: "Error",
        description: "Failed to fetch user details",
        variant: "destructive",
      });
    }
  };

  const handleDialogOpen = () => {
    setSelectedUser(null);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedUser(null);
    fetchUsers();
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this user?")) {
      try {
        await api.delete(`/users/${id}`);
        toast({
          title: "Success",
          description: "User deleted successfully",
        });
        fetchUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
        toast({
          title: "Error",
          description: "Failed to delete user",
          variant: "destructive",
        });
      }
    }
  };

  const generateUserCode = (id: number) => {
    return `USR${String(id).padStart(3, '0')}`;
  };

  const filteredUsers = users.filter(user =>
    user.UserName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    generateUserCode(user.UserID).toLowerCase().includes(searchTerm.toLowerCase())
  );  

  return (
    <Card>
      <CardHeader className="bg-gray-50 border-b border-gray-200 flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-semibold text-gray-800">User Management</CardTitle>
        <div className="flex items-center space-x-4">
          <Input 
            className="w-96" 
            placeholder="Search by name or code" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
          <Button variant="default" onClick={handleDialogOpen}>
            New User
          </Button>
          <UserDialog 
            open={isDialogOpen} 
            onClose={handleDialogClose} 
            user={selectedUser}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0 m-2">
        <div className="border border-gray-200 rounded-sm">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow className="border-b border-gray-200">
                <TableCell className="font-bold">User Code</TableCell>
                <TableCell className="font-bold">User Name</TableCell>
                <TableCell className="font-bold">User Type</TableCell>
                <TableCell className="font-bold">Business Line</TableCell>
                <TableCell className="font-bold">Contact Number</TableCell>
                <TableCell className="font-bold">Email</TableCell>
                <TableCell className="font-bold">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.UserID} className="border-b border-gray-200">
                  <TableCell>{generateUserCode(user.UserID)}</TableCell>
                  <TableCell>{user.UserName}</TableCell>
                  <TableCell>{user.UserType}</TableCell>
                  <TableCell>{user.BusinessLineName}</TableCell>
                  <TableCell>{user.ContactNumber}</TableCell>
                  <TableCell>{user.Email}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => handleEdit(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => handleDelete(user.UserID)}
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