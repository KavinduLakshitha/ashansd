"use client"

import { useRouter, useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import axios from "@/lib/api/axios";
import { useToast } from "@/hooks/use-toast";

interface AdjustmentItem {
    ProductName: string;
    AvailableQuantity: number;
    NewQuantity: number;
    AdjustedQuantity: number;
}

interface StockAdjustment {
    AdjustmentID: number;
    Date: string;
    Reason: string;
    Status: string;
    CreatedBy: string;
    CreatedAt: string;
    items: AdjustmentItem[];
}

export default function StockAdjustmentDetails() {
    const router = useRouter();
    const { id } = useParams();
    const { toast } = useToast();
    const [adjustment, setAdjustment] = useState<StockAdjustment | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAdjustmentDetails = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get<StockAdjustment>(`/stock/adjustment/details/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setAdjustment(response.data);
            } catch {
                toast({
                    title: "Error",
                    description: "Failed to fetch adjustment details",
                    variant: "destructive"
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchAdjustmentDetails();
    }, [id, toast]);

    if (isLoading) {
        return <div>Loading...</div>;
    }

    if (!adjustment) {
        return <div>Adjustment not found</div>;
    }

    return (
        <Card className="w-full mx-auto shadow-lg">
            <CardHeader className="bg-gray-50 border-b border-gray-200 flex flex-row items-center justify-between">
                <CardTitle className="text-xl font-semibold text-gray-800">Stock Adjustment Details</CardTitle>
                <Button
                    variant="outline"
                    onClick={() => router.push('/stock-adjustment')} 
                    className="flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <ChevronLeft className="mr-2 h-4 w-4" /> Back to Stock Adjustment
                </Button>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
                <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-lg border border-gray-100">
                    <div>
                        <p className="text-sm text-gray-500">Adjustment Date</p>
                        <p className="font-medium text-gray-800">
                            {new Date(adjustment.Date).toLocaleString()}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Adjustment Reason</p>
                        <p className="font-medium text-gray-800">{adjustment.Reason}</p>
                    </div>
                </div>
                
                <Table>
                    <TableHeader className="bg-gray-50">
                        <TableRow>
                            <TableHead className="text-black font-bold">Item Name</TableHead>
                            <TableHead className="text-black font-bold text-center">Available Quantity</TableHead>
                            <TableHead className="text-black font-bold text-center">Physical Quantity</TableHead>
                            <TableHead className="text-black font-bold text-center">Adjusted Quantity</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {adjustment.items.map((item: AdjustmentItem, index: number) => (
                            <TableRow key={index} className="hover:bg-gray-50 transition-colors">
                                <TableCell className="font-medium">{item.ProductName}</TableCell>
                                <TableCell className="text-center">{item.AvailableQuantity}</TableCell>
                                <TableCell className="text-center">{item.NewQuantity}</TableCell>
                                <TableCell className="text-center">
                                    <span className={`
                                        px-2 py-1 rounded-full text-xs font-semibold 
                                        ${item.AdjustedQuantity > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                                    `}>
                                        {item.AdjustedQuantity}
                                    </span>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}