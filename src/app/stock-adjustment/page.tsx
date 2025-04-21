"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "@/lib/api/axios";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "../auth/auth-context";
import dynamic from 'next/dynamic';

// Dynamically import ExportComponent with SSR disabled
const ExportComponent = dynamic(
  () => import('@/components/ExportComponent'),
  { ssr: false }
);

interface Product {
    ProductID: number;
    Name: string;
    CurrentQTY: number;
}

interface InventoryItem {
    productId: number;
    itemName: string;
    availableQuantity: number;
    newQuantity: number;
    adjustedQuantity: number;
}

interface AdjustmentHistory {
    AdjustmentID: number;
    Date: string;
    Reason: string;
    Status: string;
    CreatedBy: string;
}

export default function StockAdjustmentPage() {
    const { toast } = useToast();
    const router = useRouter();
    const { getBusinessLineID } = useAuth();
    
    const [businessLineId, setBusinessLineId] = useState<number | null>(null);
    const [adjustmentHistory, setAdjustmentHistory] = useState<AdjustmentHistory[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [adjustmentReason, setAdjustmentReason] = useState("");
    const [dateRange, setDateRange] = useState({ startDate: new Date() });

    // Get business line ID only on client-side
    useEffect(() => {
        setBusinessLineId(getBusinessLineID());
    }, [getBusinessLineID]);

    // Fetch stock levels
    useEffect(() => {
        const fetchStockLevels = async () => {
            try {
                // Only run this on the client side where localStorage exists
                if (typeof window === 'undefined') return;
                
                const token = localStorage.getItem('token');
                if (!token || !businessLineId) return;

                const response = await axios.get(`/stock/levels/${businessLineId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const items = response.data.map((product: Product) => ({
                    productId: product.ProductID,
                    itemName: product.Name,
                    availableQuantity: product.CurrentQTY,
                    newQuantity: 0,
                    adjustedQuantity: 0
                  }));

                setInventoryItems(items);
            } catch {
                toast({
                    title: "Error",
                    description: "Failed to fetch stock levels",
                    variant: "destructive"
                });
            } finally {
                setIsLoading(false);
            }
        };

        if (businessLineId) {
            fetchStockLevels();
        }
    }, [businessLineId, toast]);

    // Fetch adjustment history
    useEffect(() => {
        const fetchAdjustmentHistory = async () => {
            try {
                // Only run this on the client side where localStorage exists
                if (typeof window === 'undefined') return;
                
                const token = localStorage.getItem('token');
                if (!token || !businessLineId) return;

                const response = await axios.get(`/stock/adjustment/${businessLineId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setAdjustmentHistory(response.data);
            } catch {
                toast({
                    title: "Error",
                    description: "Failed to fetch adjustment history",
                    variant: "destructive"
                });
            }
        };

        if (businessLineId) {
            fetchAdjustmentHistory();
        }
    }, [businessLineId, toast]);

    const handleDateChange = (field: keyof typeof dateRange, date: Date) => {
        setDateRange((prev) => ({ ...prev, [field]: date }));
    };       

    const updateNewQuantity = (index: number, value: string): void => {
        const updatedItems = [...inventoryItems];
        const numericValue = value === "" ? "" : Number(value);
        updatedItems[index].newQuantity = numericValue === "" ? 0 : numericValue;
        updatedItems[index].adjustedQuantity = (numericValue === "" ? 0 : numericValue) - updatedItems[index].availableQuantity;
        setInventoryItems(updatedItems);
    };

    const handleSaveAdjustment = async () => {
        try {
            // Only run this on the client side where localStorage exists
            if (typeof window === 'undefined') return;
            
            const token = localStorage.getItem('token');
            if (!token || !businessLineId) {
                toast({
                    title: "Error",
                    description: "Authentication error",
                    variant: "destructive"
                });
                return;
            }

            const itemsWithChanges = inventoryItems.filter(item => item.newQuantity !== 0);
            
            if (itemsWithChanges.length === 0) {
                toast({
                    title: "Error",
                    description: "No quantity changes to save",
                    variant: "destructive"
                });
                return;
            }

            if (!adjustmentReason.trim()) {
                toast({
                    title: "Error",
                    description: "Please provide an adjustment reason",
                    variant: "destructive"
                });
                return;
            }

            const payload = {
                businessLineId: businessLineId,
                reason: adjustmentReason,
                items: itemsWithChanges.map(item => ({
                    productId: item.productId,
                    availableQuantity: item.availableQuantity,
                    newQuantity: item.newQuantity,
                    reason: adjustmentReason
                }))
            };

            await axios.post('/stock/adjustment/create', payload, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            toast({
                title: "Success",
                description: "Stock adjustment saved successfully"
            });

            // Reset form
            setInventoryItems(prev => prev.map(item => ({
                ...item,
                newQuantity: 0,
                adjustedQuantity: 0
            })));
            setAdjustmentReason("");

            // Refresh history
            const response = await axios.get(`/stock/adjustment/${businessLineId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAdjustmentHistory(response.data);

        } catch {
            toast({
                title: "Error",
                description: "Failed to save adjustment",
                variant: "destructive"
            });
        }
    };

    const handleRowClick = (id: number) => {
        router.push(`/stock-adjustment-details/${id}`);
    };

    if (isLoading) {
        return <div>Loading...</div>;
    }

    return (
        <Card className="w-full mx-auto shadow-lg">
            <CardHeader className="bg-gray-50 border-b border-gray-200 flex flex-row items-center justify-between">
                <CardTitle className="text-xl font-semibold text-gray-800">Stock Adjustment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
                <Tabs defaultValue="makeadjustment" className="w-full">
                    <TabsList>
                        <TabsTrigger value="makeadjustment">Make Adjustment</TabsTrigger>
                        <TabsTrigger value="history">History</TabsTrigger>                        
                    </TabsList>
                    <TabsContent value="history">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date & Time</TableHead>
                                    <TableHead>Reason</TableHead>
                                    {/* <TableHead>Status</TableHead> */}
                                    <TableHead>Created By</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {adjustmentHistory.map((entry) => (
                                    <TableRow 
                                        key={entry.AdjustmentID} 
                                        className="cursor-pointer hover:bg-gray-100" 
                                        onClick={() => handleRowClick(entry.AdjustmentID)}
                                    >
                                        <TableCell>{new Date(entry.Date).toLocaleString()}</TableCell>
                                        <TableCell>{entry.Reason}</TableCell>
                                        {/* <TableCell>{entry.Status}</TableCell> */}
                                        <TableCell>{entry.CreatedBy}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TabsContent>
                    <TabsContent value="makeadjustment">
                        <div className="flex items-center space-x-4 mb-4 mt-4">
                            <DatePicker
                                selectedDate={dateRange.startDate}
                                onDateChange={(date) => handleDateChange("startDate", date)}
                                label="Date"
                            />
                            {typeof window !== 'undefined' && (
                                <ExportComponent 
                                    inventoryItems={inventoryItems}
                                    notes={adjustmentReason}
                                    date={dateRange.startDate}
                                />
                            )}
                        </div>
                        <Table>
                            <TableHeader className="bg-gray-50">
                                <TableRow>
                                    <TableHead className="font-bold text-black">Item Name</TableHead>
                                    <TableHead className="font-bold text-black">Available Quantity</TableHead>
                                    <TableHead className="font-bold text-black">Physical Quantity</TableHead>
                                    <TableHead className="font-bold text-black">Adjusted Quantity</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {inventoryItems.map((item, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{item.itemName}</TableCell>
                                        <TableCell>{item.availableQuantity}</TableCell>
                                        <TableCell>
                                        <Input 
                                            type="number" 
                                            value={item.newQuantity === 0 ? "" : item.newQuantity}
                                            onChange={(e) => updateNewQuantity(index, e.target.value)}
                                            className="w-20"
                                            min="0"
                                            placeholder="0"
                                        />
                                        </TableCell>
                                        <TableCell>
                                            <span className={`
                                                px-2 py-1 rounded-full text-xs font-semibold 
                                                ${item.adjustedQuantity > 0 ? 'bg-green-100 text-green-800' : 
                                                  item.adjustedQuantity < 0 ? 'bg-red-100 text-red-800' : ''}
                                            `}>
                                                {item.adjustedQuantity}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <div className="mt-4">
                            <Textarea 
                                placeholder="Notes"
                                value={adjustmentReason}
                                onChange={(e) => setAdjustmentReason(e.target.value)}
                            />
                        </div>
                        <div className="flex space-x-4 mt-4">
                            <Button onClick={handleSaveAdjustment}>Save</Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}