"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ProductsInventory from '@/components/PriceGrid';

export default function InventoryPage() {
  return (
    <Card>
      <CardHeader className="bg-gray-50 border-b border-gray-200">
        <CardTitle className="text-xl font-semibold text-gray-800">Items Management</CardTitle>
      </CardHeader>
      <CardContent className='p-4'>
        <ProductsInventory />
      </CardContent>
    </Card>
  );
}