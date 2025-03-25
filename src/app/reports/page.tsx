"use client"

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SalesTable from '@/components/SalesTable';
import PurchaseReportsTable from '@/components/PurchaseReportsTable';
import InventoryReport from '@/components/InventoryReport';
import { useAuth } from '../auth/auth-context';

export default function Reports() {
    const [, setActiveTab] = useState("sales");
    const { getBusinessLineID } = useAuth();
    const businessLineId = getBusinessLineID() ?? 0;

    return (
        <Card className="w-full mx-auto shadow-lg">
            <CardHeader className="bg-gray-50 border-b border-gray-200 flex flex-row items-center justify-between">
                <CardTitle className="text-xl font-semibold text-gray-800">Reports</CardTitle>                
            </CardHeader>
            <Tabs defaultValue="sales" onValueChange={(value) => setActiveTab(value)} className='mt-4'>
                <TabsList className="ml-6">
                    <TabsTrigger value="sales">Sales</TabsTrigger>
                    <TabsTrigger value="purchases">Purchase</TabsTrigger>
                    <TabsTrigger value="inventory">Inventory</TabsTrigger>
                </TabsList>
                <TabsContent value="sales">
                    <SalesTable />
                </TabsContent>
                <TabsContent value="purchases">
                    <PurchaseReportsTable />
                </TabsContent>
                <TabsContent value="inventory">
                  <InventoryReport businessLineId={businessLineId} />
                </TabsContent>
            </Tabs>
        </Card>
    );
}