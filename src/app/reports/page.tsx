"use client"

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SalesTable from '@/components/SalesTable';
import PurchaseReportsTable from '@/components/PurchaseReportsTable';
import InventoryReport from '@/components/InventoryReport';
import ProductReport from '@/components/ProductReport';
import ProfitLossReport from '@/components/ProfitLossReport';
import { useAuth } from '../auth/auth-context';
import PaymentsHistory from '@/components/PaymentHistory';
import InvoiceDateRepair from '@/components/InvoiceDateRepair';

export default function Reports() {
    const [, setActiveTab] = useState("sales");
    const { getBusinessLineID, user } = useAuth();
    const businessLineId = getBusinessLineID() ?? 0;
    const canRepairDates = ['superuser', 'admin', 'management'].includes(user?.userType ?? '');

    return (
        <Card className="w-full mx-auto shadow-lg">
            <CardHeader className="bg-gray-50 border-b border-gray-200 flex flex-row items-center justify-between">
                <CardTitle className="text-xl font-semibold text-gray-800">Reports</CardTitle>                
            </CardHeader>
            <Tabs defaultValue="sales" onValueChange={(value) => setActiveTab(value)} className='mt-4'>
                <TabsList className="ml-6 flex flex-wrap h-auto">
                    <TabsTrigger value="sales">Sales</TabsTrigger>
                    <TabsTrigger value="purchases">Purchase</TabsTrigger>
                    <TabsTrigger value="products">Products</TabsTrigger>
                    <TabsTrigger value="inventory">Inventory</TabsTrigger>
                    <TabsTrigger value="pnl">P&amp;L</TabsTrigger>
                    <TabsTrigger value="payments">Payments History</TabsTrigger>
                    {canRepairDates && (<TabsTrigger value="date-repair">Fix Invoice Dates</TabsTrigger>)}
                </TabsList>
                <TabsContent value="sales">
                    <SalesTable />
                </TabsContent>
                <TabsContent value="purchases">
                    <PurchaseReportsTable />
                </TabsContent>
                <TabsContent value="products">
                    <ProductReport />
                </TabsContent>
                <TabsContent value="inventory">
                  <InventoryReport businessLineId={businessLineId} />
                </TabsContent>
                <TabsContent value="pnl">
                    <ProfitLossReport />
                </TabsContent>
                <TabsContent value="payments">
                    <PaymentsHistory />
                </TabsContent>
                {canRepairDates && (
                    <TabsContent value="date-repair">
                        <InvoiceDateRepair />
                    </TabsContent>
                )}
            </Tabs>
        </Card>
    );
}