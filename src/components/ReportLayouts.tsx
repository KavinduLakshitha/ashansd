// components/reports/ReportLayouts.tsx
import React from 'react';
import { Table, TableRow, TableBody, TableHeader, TableHead, TableCell } from './ui/table'; 

interface Transaction {
  id: string;
  itemName: string;
  purchasedDate: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

interface Sale {
    id: string;
    customer: string;
    date: string;
    salesValue: number;
    quantity: number;
    valueTotal: number;
    collection: {
      cash: number;
      chequeCredit: number;
    };
  }

interface Cheque {
  id: string;
  number: string;
  bank: string;
  date: string;
  amount: number;
  status: 'Cleared' | 'Pending' | 'Bounced';
}

interface BusinessLineData {
  businessLine: string;
  totalSales: number;
  transactions: Transaction[];
}

interface SalesPersonData {
    totalSales: number;
    collection: {
      cash: number;
      credit: {
        creditAmount: number;
        chequeAmount: number;
      };
      total: number;
    };
    sales: Sale[];
  }

interface ChequeData {
  totalCheques: number;
  totalAmount: number;
  cheques: Cheque[];
}

export const BusinessLineReport = ({ data, selectedPeriod }: { data: BusinessLineData, selectedPeriod: string }) => (
    <div className="px-6 pb-6">
      <div className="flex justify-between items-center my-4 p-0">
        <h3 className="text-lg font-semibold">Business Line: {data?.businessLine}</h3>
        <div className="text-sm text-gray-600">
          Period: {selectedPeriod}
        </div>
      </div>
      <div className="mb-4">
        <div className="text-sm text-gray-600">Total Sales: ${data?.totalSales || 0}</div>
      </div>
      
      <div className="border rounded-lg">
        <Table className="w-full">
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>Item Name</TableHead>
              <TableHead>Purchased Date</TableHead>
              <TableHead>Unit Price</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.transactions?.map((item) => (
              <TableRow key={item.id} className="border-t">
                <TableCell>{item.itemName}</TableCell>
                <TableCell>{item.purchasedDate}</TableCell>
                <TableCell>${item.unitPrice}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>${item.total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
  
export const SalesPersonReport = ({ data, selectedPeriod, selectedOption }: { data: SalesPersonData, selectedPeriod: string, selectedOption: string }) => (
<div className="px-6 pb-6">
    <div className="flex justify-between items-center my-4">
    <h3 className="text-lg font-bold flex gap-1">Sales Person <div className='text-gray-500'>{selectedOption}</div></h3>
    <div className="text-sm text-gray-600">
        Period: {selectedPeriod}
    </div>
    </div>

    <div className="grid grid-cols-2 gap-8 mb-6">
    {/* Total Sales for the day */}
    <div className="space-y-2">
        <h4 className="font-medium mb-2">Total Sales for the day</h4>
        <div className="space-y-1">
        <div className="flex justify-between">
            <span>Cash</span>
            <span>${data?.collection?.cash?.toFixed(2) || '0.00'}</span>
        </div>
        <div className="flex justify-between">
            <span>Credit</span>
            <span>${(data?.collection?.credit?.creditAmount || 0).toFixed(2)}</span>
        </div>
        <div className="ml-4 flex justify-between text-gray-600">
            <span>Credit Amount</span>
            <span>${(data?.collection?.credit?.creditAmount || 0).toFixed(2)}</span>
        </div>
        <div className="ml-4 flex justify-between text-gray-600">
            <span>Cheque Amount</span>
            <span>${(data?.collection?.credit?.chequeAmount || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-medium pt-2 border-t">
            <span>Total</span>
            <span>${(data?.collection?.total || 0).toFixed(2)}</span>
        </div>
        </div>
    </div>

    {/* Collection for the selected period */}
    <div className="space-y-2">
        <h4 className="font-medium mb-2">Collection (For the selected period)</h4>
        <div className="space-y-1">
        <div className="flex justify-between">
            <span>Cash</span>
            <span>${data?.collection?.cash?.toFixed(2) || '0.00'}</span>
        </div>
        <div className="flex justify-between">
            <span>Credit</span>
            <span>${(data?.collection?.credit?.creditAmount || 0).toFixed(2)}</span>
        </div>
        <div className="ml-4 flex justify-between text-gray-600">
            <span>Credit Amount</span>
            <span>${(data?.collection?.credit?.creditAmount || 0).toFixed(2)}</span>
        </div>
        <div className="ml-4 flex justify-between text-gray-600">
            <span>Cheque Amount</span>
            <span>${(data?.collection?.credit?.chequeAmount || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-medium pt-2 border-t">
            <span>Total</span>
            <span>${(data?.collection?.total || 0).toFixed(2)}</span>
        </div>
        </div>
    </div>
    </div>

    <div className="border rounded-lg">
    <Table className="w-full">
        <TableHeader className="bg-gray-50">
        <TableRow>
            <TableHead className='text-black font-bold'>Customer</TableHead>
            <TableHead className='text-black font-bold'>Sales Date</TableHead>
            <TableHead className="text-black font-bold text-right">Sales Value</TableHead>
            <TableHead className="text-black font-bold text-right">Qty</TableHead>
            <TableHead className="text-black font-bold text-right">Value (Total)</TableHead>
            <TableHead className="text-black font-bold text-right">Collection: Cash</TableHead>
            <TableHead className="text-black font-bold text-right">Cheque / Credit</TableHead>
        </TableRow>
        </TableHeader>
        <TableBody>
        {data?.sales?.map((sale) => (
            <TableRow key={sale.id} className="border-t">
            <TableCell>{sale.customer}</TableCell>
            <TableCell>{sale.date}</TableCell>
            <TableCell className="text-right">${sale.salesValue.toFixed(2)}</TableCell>
            <TableCell className="text-right">{sale.quantity}</TableCell>
            <TableCell className="text-right">${sale.valueTotal.toFixed(2)}</TableCell>
            <TableCell className="text-right">${sale.collection.cash.toFixed(2)}</TableCell>
            <TableCell className="text-right">${sale.collection.chequeCredit.toFixed(2)}</TableCell>
            </TableRow>
        ))}
        </TableBody>
    </Table>
    </div>
</div>
);
  
  export const ChequeReport = ({ data, selectedPeriod }: { data: ChequeData, selectedPeriod: string }) => (
    <div className="px-6 pb-6">
      <div className="flex justify-between items-center my-4">
        <h3 className="text-lg font-semibold">Cheque Report</h3>
        <div className="text-sm text-gray-600">
          Period: {selectedPeriod}
        </div>
      </div>
  
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-sm text-gray-600">Total Cheques</div>
          <div className="text-2xl font-bold">{data?.totalCheques || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-sm text-gray-600">Total Amount</div>
          <div className="text-2xl font-bold">${data?.totalAmount || 0}</div>
        </div>
      </div>
  
      <div className="border rounded-lg">
        <Table className="w-full">
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>Cheque Number</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.cheques?.map((cheque) => (
              <TableRow key={cheque.id} className="border-t">
                <TableCell>{cheque.number}</TableCell>
                <TableCell>{cheque.bank}</TableCell>
                <TableCell>{cheque.date}</TableCell>
                <TableCell className="text-right">${cheque.amount}</TableCell>
                <TableCell className="text-center">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    cheque.status === 'Cleared' ? 'bg-green-100 text-green-800' : 
                    cheque.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {cheque.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
  
  export const renderReport = (type: string, data: BusinessLineData | SalesPersonData | ChequeData, selectedPeriod: string, selectedOption:string ) => {
    if (!data) return null;
    
    switch (type) {
      case 'business-line':
        return <BusinessLineReport data={data as BusinessLineData} selectedPeriod={selectedPeriod}/>;
      case 'sales-person':
        return <SalesPersonReport data={data as SalesPersonData} selectedPeriod={selectedPeriod} selectedOption={selectedOption}/>;
      case 'cheque-number':
        return <ChequeReport data={data as ChequeData} selectedPeriod={selectedPeriod}/>;
      default:
        return null;
    }
  };