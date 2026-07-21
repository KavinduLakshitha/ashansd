"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePickerWithRange } from './DateRange';
import { useAuth } from '@/app/auth/auth-context';
import axios from '@/lib/api/axios';
import { isAxiosError } from 'axios';
import { formatMetricTons } from '@/lib/formatMetricTons';

interface ProductSalesRow {
  ProductID: number;
  ProductName: string;
  totalQuantity: number;
  totalMetricTons: number;
  totalRevenue: number;
  orderCount: number;
  avgSalePrice: number;
  lastPurchasePrice: number;
  unitProfit: number | null;
  totalProfit: number | null;
  margin: number | null;
}

type SortKey = 'totalRevenue' | 'totalMetricTons' | 'totalProfit';

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  }).format(value);

const formatUnits = (value: number): string =>
  Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 3,
  });

const ProductReport = () => {
  const { getBusinessLineID } = useAuth();
  const [products, setProducts] = useState<ProductSalesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('totalRevenue');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });

  const fetchReport = useCallback(async () => {
    const businessLineId = getBusinessLineID();
    if (!businessLineId) {
      setError('Business line ID not found');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = { businessLineId: String(businessLineId) };
      if (dateRange?.from && dateRange?.to) {
        params.startDate = format(dateRange.from, 'yyyy-MM-dd');
        params.endDate = format(dateRange.to, 'yyyy-MM-dd');
      }

      const response = await axios.get('/sales/product-report', { params });
      const rows: ProductSalesRow[] = Array.isArray(response.data) ? response.data : [];

      // console.group('[ProductReport] MT values from API');
      // console.table(
      //   rows.map((p) => ({
      //     product: p.ProductName,
      //     orders: p.orderCount,
      //     unitsSold: p.totalQuantity,
      //     metricTons: p.totalMetricTons,
      //     expectedIf50kg: Number(p.totalQuantity || 0) * 50 / 1000,
      //   }))
      // );
      // console.log(
      //   'Totals → units:',
      //   rows.reduce((s, p) => s + Number(p.totalQuantity || 0), 0),
      //   '| MT:',
      //   rows.reduce((s, p) => s + Number(p.totalMetricTons || 0), 0)
      // );
      // console.groupEnd();

      setProducts(rows);
    } catch (err) {
      console.error('Error fetching product report:', err);
      if (isAxiosError(err)) {
        setError(err.response?.data?.message || 'Failed to load product report');
      } else {
        setError('Failed to load product report');
      }
    } finally {
      setLoading(false);
    }
  }, [getBusinessLineID, dateRange]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const sortedProducts = useMemo(() => {
    const copy = [...products];
    copy.sort((a, b) => {
      const aValue = Number(a[sortKey] ?? 0);
      const bValue = Number(b[sortKey] ?? 0);
      return bValue - aValue;
    });
    return copy;
  }, [products, sortKey]);

  const highestSellers = useMemo(
    () => [...products].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5),
    [products]
  );

  const lowestSellers = useMemo(
    () => [...products].sort((a, b) => a.totalRevenue - b.totalRevenue).slice(0, 5),
    [products]
  );

  const totals = useMemo(() => {
    return products.reduce(
      (acc, product) => {
        acc.revenue += Number(product.totalRevenue || 0);
        acc.units += Number(product.totalQuantity || 0);
        acc.metricTons += Number(product.totalMetricTons || 0);
        acc.profit += Number(product.totalProfit || 0);
        return acc;
      },
      { revenue: 0, units: 0, metricTons: 0, profit: 0 }
    );
  }, [products]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Sales by Product</h2>
          <p className="text-sm text-muted-foreground">
            Sales volume, revenue and profit per product for the selected period.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DatePickerWithRange selected={dateRange} onChange={setDateRange} />
          {/* <Button variant="outline" size="icon" onClick={fetchReport} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button> */}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Revenue</div>
            {loading ? (
              <Skeleton className="h-7 w-28 mt-1" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(totals.revenue)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Units Sold</div>
            {loading ? (
              <Skeleton className="h-7 w-28 mt-1" />
            ) : (
              <div className="text-2xl font-bold">{formatUnits(totals.units)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Metric Tons Sold</div>
            {loading ? (
              <Skeleton className="h-7 w-28 mt-1" />
            ) : (
              <div className="text-2xl font-bold">{formatMetricTons(totals.metricTons)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Estimated Total Profit</div>
            {loading ? (
              <Skeleton className="h-7 w-28 mt-1" />
            ) : (
              <div className={`text-2xl font-bold ${totals.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {formatCurrency(totals.profit)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Highest Selling Products
            </CardTitle>
            <CardDescription>Top 5 by revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">MT</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {highestSellers.map((product) => (
                  <TableRow key={`high-${product.ProductID}`}>
                    <TableCell className="font-medium">{product.ProductName}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatUnits(product.totalQuantity)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMetricTons(product.totalMetricTons)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(product.totalRevenue)}</TableCell>
                  </TableRow>
                ))}
                {!loading && highestSellers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                      No sales in this period
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-amber-600" />
              Lowest Selling Products
            </CardTitle>
            <CardDescription>Bottom 5 by revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">MT</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowestSellers.map((product) => (
                  <TableRow key={`low-${product.ProductID}`}>
                    <TableCell className="font-medium">{product.ProductName}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatUnits(product.totalQuantity)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMetricTons(product.totalMetricTons)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(product.totalRevenue)}</TableCell>
                  </TableRow>
                ))}
                {!loading && lowestSellers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                      No sales in this period
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">All Products</CardTitle>
            <CardDescription>Profit uses average sale price vs last purchase price.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by</span>
            <div className="flex rounded-md border overflow-hidden">
              <Button
                variant={sortKey === 'totalRevenue' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none"
                onClick={() => setSortKey('totalRevenue')}
              >
                Revenue
              </Button>
              <Button
                variant={sortKey === 'totalMetricTons' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none"
                onClick={() => setSortKey('totalMetricTons')}
              >
                Metric Tons
              </Button>
              <Button
                variant={sortKey === 'totalProfit' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none"
                onClick={() => setSortKey('totalProfit')}
              >
                Profit
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Table className="border">
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="font-bold text-black">Product</TableHead>
                  <TableHead className="font-bold text-black text-right">Units Sold</TableHead>
                  <TableHead className="font-bold text-black text-right">Metric Tons</TableHead>
                  <TableHead className="font-bold text-black text-right">Orders</TableHead>
                  <TableHead className="font-bold text-black text-right">Avg Sale Price</TableHead>
                  <TableHead className="font-bold text-black text-right">Last Purchase</TableHead>
                  <TableHead className="font-bold text-black text-right">Revenue</TableHead>
                  <TableHead className="font-bold text-black text-right">Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProducts.map((product) => (
                  <TableRow key={product.ProductID}>
                    <TableCell className="font-medium">{product.ProductName}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatUnits(product.totalQuantity)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMetricTons(product.totalMetricTons)}</TableCell>
                    <TableCell className="text-right tabular-nums">{product.orderCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(product.avgSalePrice)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {product.lastPurchasePrice > 0 ? formatCurrency(product.lastPurchasePrice) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(product.totalRevenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {product.totalProfit != null ? (
                        <span className={product.totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}>
                          {formatCurrency(product.totalProfit)}
                          {product.margin != null && (
                            <span className="block text-xs text-muted-foreground">
                              {product.margin.toFixed(1)}% margin
                            </span>
                          )}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {sortedProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-4 text-muted-foreground">
                      No product sales found for this period
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductReport;
