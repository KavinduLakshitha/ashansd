import React, { useState, useEffect } from 'react';
import { FileDown, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger, } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Interfaces
interface Product {
  ProductID: number;
  Name: string;
  CurrentQTY: number;
  MinimumQTY: number;
  AverageCost?: number;
  LastUpdated?: string;
  BusinessLineID: number;
  TotalStock?: number;
  OldestStock?: string;
  Value?: number;
  Status?: 'Out of Stock' | 'Low Stock' | 'In Stock';
}

interface MovementDetails {
  vendor?: string;
  customer?: string;
  invoiceNumber?: string;
}

interface StockMovement {
  MovementID: number;
  ProductID: number;
  ProductName?: string;
  BusinessLineID: number;
  ReferenceID: string;
  Direction: 'IN' | 'OUT';
  Quantity: number;
  Date: string;
  Note?: string;
  CreatedBy: string;
  UnitCost?: number;
  BatchID?: number;  
  movementType?: 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'RETURN';
  movementLabel?: string;
  referenceNumber?: string;
  details?: MovementDetails;
}

interface RunningBalanceItem extends StockMovement {
  BalanceBefore: number;
  QuantityChange: number;
  BalanceAfter: number;
}

interface RunningBalanceResponse {
  initialBalance: number;
  movements: RunningBalanceItem[];
  finalBalance: number;
}

interface InventoryReportProps {
  businessLineId: number;
  initialDate?: Date;
}

const InventoryReport: React.FC<InventoryReportProps> = ({ 
  businessLineId,
  initialDate = new Date()
}) => {
  // State management
  const [asOfDate, setAsOfDate] = useState<Date>(initialDate);
  const [dateOpen, setDateOpen] = useState<boolean>(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [, setRunningBalance] = useState<RunningBalanceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [movementLoading, setMovementLoading] = useState<boolean>(false);
  const [, setBalanceLoading] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [startDateOpen, setStartDateOpen] = useState<boolean>(false);
  const [endDateOpen, setEndDateOpen] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [movementType, setMovementType] = useState<string>('all');
  const [totalItems, setTotalItems] = useState<number>(0);
  const [, setTotalValue] = useState<number>(0);
  const [lowStockItems, setLowStockItems] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;    
    const isToday = date.toDateString() === new Date().toDateString();
    
    if (isToday) {
      setAsOfDate(new Date());
    } else {
      const newDate = new Date(date);
      newDate.setHours(23, 59, 59, 999);
      setAsOfDate(newDate);
    }
    
    setDateOpen(false);
  };

  const handleToDateSelect = (date: Date | undefined) => {
    if (!date) return;
  
    const isToday = date.toDateString() === new Date().toDateString();
  
    if (isToday) {
      setEndDate(new Date());
    } else {
      const newDate = new Date(date);
      newDate.setHours(23, 59, 59, 999);
      setEndDate(newDate);
    }
  
    setEndDateOpen(false);
  };
  
  useEffect(() => {
    const fetchInventoryData = async () => {
      if (asOfDate > new Date()) {
        setError('Cannot fetch inventory for future dates. Please select a date today or earlier.');
        setLoading(false);
        return; 
      }
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/inventory/levels/${businessLineId}?asOfDate=${asOfDate.toISOString()}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json() as Product[];
        setProducts(data);
        setTotalItems(data.length);
        setTotalValue(data.reduce((sum, item) => sum + (item.Value || item.CurrentQTY * (item.AverageCost || 0)), 0));
        setLowStockItems(data.filter(item => item.Status === 'Low Stock' || 
          (item.CurrentQTY < item.MinimumQTY)).length);
      } catch (error) {
        console.error('Error fetching inventory data:', error);
        setError('Failed to load inventory data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (businessLineId) {
      fetchInventoryData();
    }
  }, [businessLineId, asOfDate]);

  useEffect(() => {
    setMovements([]);
    const fetchMovementHistory = async () => {
      if (!businessLineId || (selectedProduct === 'all' && !startDate && !endDate)) return;  
  
      setMovementLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams({
          businessLineId: businessLineId.toString(),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
  
        if (selectedProduct !== 'all') {
          queryParams.append('productId', selectedProduct);
        }
  
        if (movementType !== 'all') {
          queryParams.append('direction', movementType);
        }
  
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/inventory/movements?${queryParams.toString()}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
  
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
  
        const data = await response.json() as StockMovement[];
        console.log("Movements API response:", data);
        setMovements(data);
      } catch (error) {
        console.error('Error fetching movement history:', error);
        setError('Failed to load movement history. Please try again later.');
      } finally {
        setMovementLoading(false);
      }
    };
  
    fetchMovementHistory();
  }, [businessLineId, selectedProduct, movementType, startDate, endDate]);
  
  useEffect(() => {
    const fetchRunningBalance = async () => {
      if (selectedProduct === 'all' || !selectedProduct) return;
      
      setBalanceLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
        
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/inventory/running-balance/${selectedProduct}?${queryParams.toString()}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json() as RunningBalanceResponse;
        setRunningBalance(data);
      } catch (error) {
        console.error('Error fetching running balance:', error);
        setError('Failed to load product balance history. Please try again later.');
      } finally {
        setBalanceLoading(false);
      }
    };

    if (selectedProduct !== 'all') {
      fetchRunningBalance();
    } else {
      setRunningBalance(null);
    }
  }, [selectedProduct, startDate, endDate]);
  
  const filteredProducts = products.filter(product => 
    product.Name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const exportToPDF = () => {
    alert('Exporting to PDF...');
  };
  
  // Updated to use the API's movementType or movementLabel directly
  const getMovementTypeLabel = (movement: StockMovement): string => {
    // First prioritize the movement label from the API
    if (movement.movementLabel) {
      return movement.movementLabel;
    }
    
    // Fall back to movement type if available
    if (movement.movementType) {
      switch(movement.movementType) {
        case 'PURCHASE':
          return 'Purchase';
        case 'SALE':
          return 'Sale';
        case 'ADJUSTMENT':
          return 'Adjustment';
        case 'TRANSFER_IN':
          return 'Transfer In';
        case 'TRANSFER_OUT':
          return 'Transfer Out';
        case 'RETURN':
          return 'Customer Return';
        default:
          return movement.movementType;
      }
    }
    
    // Legacy fallback if neither is available
    const referencePrefix = movement.ReferenceID?.split('-')[0] || '';
    
    switch(referencePrefix) {
      case 'INV':
        return 'Sale';
      case 'PUR':
        return 'Purchase';
      case 'ADJ':
        return 'Adjustment';
      default:
        return movement.Note || 'Other';
    }
  };

  // Get the appropriate reference/invoice number
  const getMovementReference = (movement: StockMovement): string => {
    if (movement.referenceNumber) {
      return movement.referenceNumber;
    }
    return movement.ReferenceID || '-';
  };

  return (
    <Card className="w-full shadow-none rounded-tl-none rounded-tr-none border-0">
      <CardContent className='mt-3'>
        {/* Top Controls - Date and Export Options */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex flex-col gap-1">
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[200px] flex justify-start text-left font-normal"
                  >                    
                    {format(asOfDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={asOfDate}
                    onSelect={handleDateSelect}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setAsOfDate(new Date())}
              title="Refresh data"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportToPDF}>
              <FileDown className="mr-2 h-4 w-4" />
              PDF
            </Button>                        
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalItems}</div>
              <p className="text-xs text-muted-foreground">As of {format(asOfDate, 'PPP')}</p>
            </CardContent>
          </Card>
                      
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Alert</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">{lowStockItems}</div>
              <p className="text-xs text-muted-foreground">Items below minimum quantity</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="current" className="w-full mt-2">
          <TabsList className="grid w-full grid-cols-2 print:hidden">
            <TabsTrigger value="current">Current Inventory</TabsTrigger>
            <TabsTrigger value="history">Movement History</TabsTrigger>
          </TabsList>
          
          {/* Current Inventory Tab */}
          <TabsContent value="current" className="w-full">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Items</CardTitle>
                <CardDescription>
                  Current stock levels as of {format(asOfDate, 'MMMM d, yyyy')}
                </CardDescription>
                
                <div className="mt-2 print:hidden">
                  <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-md"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Current Qty</TableHead>
                          <TableHead className="text-right">Min Qty</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                          <TableHead>Last Updated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProducts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No inventory items found
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredProducts.map((product) => (
                            <TableRow key={product.ProductID}>
                              <TableCell className="font-mono text-xs">{product.ProductID}</TableCell>
                              <TableCell className="font-medium">{product.Name}</TableCell>
                              <TableCell className="text-right">{product.CurrentQTY}</TableCell>
                              <TableCell className="text-right">{product.MinimumQTY || 0}</TableCell>
                              <TableCell>
                                {product.Status ? (
                                  <Badge
                                    variant={product.Status === 'In Stock' ? 'outline' : 'destructive'}
                                    className={
                                      product.Status === 'In Stock'
                                        ? 'bg-green-100 text-green-800 border-green-200'
                                        : product.Status === 'Low Stock'
                                          ? 'bg-amber-500'
                                          : undefined
                                    }
                                  >
                                    {product.Status}
                                  </Badge>
                                ) : (
                                  product.CurrentQTY === 0 ? (
                                    <Badge variant="destructive">Out of Stock</Badge>
                                  ) : product.CurrentQTY < (product.MinimumQTY || 0) ? (
                                    <Badge variant="destructive" className="bg-amber-500">Low Stock</Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">In Stock</Badge>
                                  )
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {new Intl.NumberFormat('en-US', {
                                  style: 'currency',
                                  currency: 'LKR'
                                }).format(product.Value || product.CurrentQTY * (product.AverageCost || 0))}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {product.LastUpdated ? format(new Date(product.LastUpdated), 'MMM d, yyyy') : 'N/A'}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="text-sm text-muted-foreground">
                  {filteredProducts.length} of {products.length} items
                </div>
              </CardFooter>
            </Card>
          </TabsContent>
          
          {/* Movement History Tab - Updated */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Movement History</CardTitle>
                <CardDescription>
                  Track all inventory changes including sales, purchases, and adjustments
                </CardDescription>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 print:hidden">
                  {/* Date Range Selectors */}
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-gray-500">From Date:</span>
                    <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full flex justify-start text-left font-normal"
                        >                            
                          {startDate ? format(startDate, 'PP') : 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={(date) => {
                            setStartDate(date || startDate);
                            setStartDateOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-gray-500">To Date:</span>
                    <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full flex justify-start text-left font-normal"
                        >                            
                          {endDate ? format(endDate, 'PP') : 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={handleToDateSelect}
                          disabled={(date) => date > new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  {/* Filters */}
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-gray-500">Product:</span>
                    <Select
                      value={selectedProduct}
                      onValueChange={setSelectedProduct}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Products" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Products</SelectItem>
                        {products.map(product => (
                          <SelectItem key={product.ProductID} value={product.ProductID.toString()}>
                            {product.Name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-gray-500">Movement Type:</span>
                    <Select
                      value={movementType}
                      onValueChange={setMovementType}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Movements" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Movements</SelectItem>
                        <SelectItem value="IN">Stock In</SelectItem>
                        <SelectItem value="OUT">Stock Out</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4 print:hidden">
                  <AlertDescription>
                    Showing inventory movements from {format(startDate, 'PPP')} to {format(endDate, 'PPP')}
                  </AlertDescription>
                </Alert>
                
                {movementLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead>Direction</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movements.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                              No movement records found for the selected criteria
                            </TableCell>
                          </TableRow>
                        ) : (
                          movements.map((movement) => {
                            const product = products.find(p => p.ProductID === movement.ProductID);
                            return (
                              <TableRow key={movement.MovementID}>
                                <TableCell>
                                  {format(new Date(movement.Date), 'MMM d, yyyy')}
                                  <div className="text-xs text-muted-foreground">
                                    {format(new Date(movement.Date), 'h:mm a')}
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {movement.ProductName || product?.Name || `Product ID: ${movement.ProductID}`}
                                </TableCell>
                                <TableCell>{getMovementTypeLabel(movement)}</TableCell>
                                <TableCell className="font-mono text-xs">
                                  {getMovementReference(movement)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {movement.Quantity}
                                </TableCell>
                                <TableCell>
                                  {movement.Direction === 'IN' ? (
                                    <Badge className="bg-green-100 text-green-800 border-green-200">IN</Badge>
                                  ) : (
                                    <Badge className="bg-red-100 text-red-800 border-red-200">OUT</Badge>
                                  )}
                                </TableCell>
                                <TableCell>{movement.CreatedBy}</TableCell>
                                <TableCell className="max-w-xs">
                                  {movement.details?.vendor && (
                                    <div className="text-xs">Vendor: {movement.details.vendor}</div>
                                  )}
                                  {movement.details?.customer && (
                                    <div className="text-xs">Customer: {movement.details.customer}</div>
                                  )}
                                  {movement.details?.invoiceNumber && (
                                    <div className="text-xs">Invoice: {movement.details.invoiceNumber}</div>
                                  )}
                                  {movement.Note && (
                                    <div className="text-xs truncate">{movement.Note}</div>
                                  )}
                                  {!movement.details?.vendor && !movement.details?.customer && 
                                   !movement.details?.invoiceNumber && !movement.Note && '-'}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <div className="text-sm text-muted-foreground">
                  {movements.length} movements found
                </div>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>        
      </CardContent>
    </Card>
  );
};

export default InventoryReport;