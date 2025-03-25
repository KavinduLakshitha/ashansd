'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import axios from '@/lib/api/axios';
import { useAuth } from '../auth/auth-context';     
import { AlertCircle, Calendar } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { isAxiosError } from 'axios';
import { TooltipItem } from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface SaleData {
  date: Date;
  orderCount: number;
  totalAmount: number;
  avgOrderValue: number;
  formattedDate: string;
  month: string;
  year: number;
  weekNumber: number;
}

interface GroupedSaleData {
  period: string;
  orderCount: number;
  totalAmount: number;
  avgOrderValue: number;
}

type ChartType = 'line' | 'bar';

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 0
  }).format(value);
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
};

const getWeekNumber = (d: Date): number => {
  const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
  const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

const getYearOptions = (): number[] => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, i) => currentYear - i);
};

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function SalesDashboard() {
  const [, setSalesData] = useState<SaleData[]>([]);
  const [groupedData, setGroupedData] = useState<GroupedSaleData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ChartType>('line');
  
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  
  const { user } = useAuth();

  const getDateRange = (): { startDate: Date, endDate: Date } => {
    const startDate = new Date(selectedYear, selectedMonth, 1);
    const endDate = new Date(selectedYear, selectedMonth + 1, 0); // Last day of month
    endDate.setHours(23, 59, 59, 999);
    
    return { startDate, endDate };
  };

  const groupDataByDay = (data: SaleData[]): GroupedSaleData[] => {
    const groupedByDay: { [key: string]: GroupedSaleData } = {};
    
    data.forEach(item => {
      const formattedDate = formatDate(item.date.toString());
      
      if (!groupedByDay[formattedDate]) {
        groupedByDay[formattedDate] = {
          period: formattedDate,
          orderCount: 0,
          totalAmount: 0,
          avgOrderValue: 0
        };
      }
      
      groupedByDay[formattedDate].orderCount += item.orderCount;
      groupedByDay[formattedDate].totalAmount += item.totalAmount;
    });
    
    Object.keys(groupedByDay).forEach(key => {
      const group = groupedByDay[key];
      group.avgOrderValue = group.orderCount > 0 ? group.totalAmount / group.orderCount : 0;
    });
    
    return Object.values(groupedByDay).sort((a, b) => {
      const [aDay, aMonth] = a.period.split('/');
      const [bDay, bMonth] = b.period.split('/');
      
      if (aMonth !== bMonth) return parseInt(aMonth) - parseInt(bMonth);
      return parseInt(aDay) - parseInt(bDay);
    });
  };

  useEffect(() => {
    const fetchSalesData = async () => {
      if (!user?.currentBusinessLine) {
        setError('Business line ID not found');
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      try {
        const { startDate, endDate } = getDateRange();  
        const response = await axios.get('/sales/daily-summary', {
          params: {
            businessLineId: user.currentBusinessLine,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
          }
        });
  
        const processedData = response.data.map((item: { date: string; orderCount: number; totalAmount: number; avgOrderValue: number }) => {
          const date = new Date(item.date);
          return {
            ...item,
            date: date,
            formattedDate: formatDate(item.date),
            month: date.toLocaleString('default', { month: 'short' }),
            year: date.getFullYear(),
            weekNumber: getWeekNumber(date),
            orderCount: Number(item.orderCount || 0),
            totalAmount: Number(item.totalAmount || 0),
            avgOrderValue: Number(item.avgOrderValue || 0)
          };
        }).sort((a: SaleData, b: SaleData) => a.date.getTime() - b.date.getTime());
  
        setSalesData(processedData);
        
        const grouped = groupDataByDay(processedData);
        setGroupedData(grouped);
      } catch (err) {
        console.error('Error fetching sales data:', err);
        if (isAxiosError(err)) {
          setError(err.response?.data?.message || err.message || 'Failed to load sales data');
        } else {
          setError('Failed to load sales data');
        }
      } finally {
        setIsLoading(false);
      }
    };
  
    fetchSalesData();
  }, [user?.currentBusinessLine, selectedMonth, selectedYear]);

  const totalSales = groupedData.reduce((sum, period) => sum + period.totalAmount, 0);
  const totalOrders = groupedData.reduce((sum, period) => sum + period.orderCount, 0);  
  
  const chartData = {
    labels: groupedData.map(item => item.period),
    datasets: [
      {
        label: 'Sales (LKR)',
        data: groupedData.map(item => item.totalAmount),
        backgroundColor: 'rgba(75, 85, 99, 0.5)',
        borderColor: 'rgba(31, 41, 55, 1)',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: 'rgba(17, 24, 39, 1)', 
        pointHoverRadius: 5,
        fill: true
      }
    ]
  };

  // Fixed chart options type
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: {
            family: 'Inter, sans-serif'
          }
        }
      },
      tooltip: {
        titleFont: {
          family: 'Inter, sans-serif'
        },
        bodyFont: {
          family: 'Inter, sans-serif'
        },
        callbacks: {
            label: function(tooltipItem: TooltipItem<'line' | 'bar'>) {
            let label = tooltipItem.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (tooltipItem.parsed.y !== null) {
              label += formatCurrency(tooltipItem.parsed.y);
            }
            return label;
          },
          afterLabel: function(context: TooltipItem<'line' | 'bar'>) {
            const dataIndex = context.dataIndex;
            const orderCount = groupedData[dataIndex]?.orderCount;
            return orderCount ? `Orders: ${orderCount}` : '';
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Day of Month',
          font: {
            family: 'Inter, sans-serif',
          }
        },
        ticks: {
          font: {
            family: 'Inter, sans-serif'
          }
        },
        grid: {
          color: 'rgba(229, 231, 235, 0.5)'
        }
      },
      y: {
        display: true,
        beginAtZero: true,
        title: {
          display: true,
          text: 'Amount (LKR)',
          font: {
            family: 'Inter, sans-serif',
            weight: 500
          }
        },
        ticks: {
          font: {
            family: 'Inter, sans-serif'
          },
          callback: function(tickValue: string | number) {
            return formatCurrency(Number(tickValue));
          }
        },
        grid: {
          color: 'rgba(229, 231, 235, 0.5)'
        }
      }
    }
  };

  return (
    <Card className="shadow-md h-[calc(100vh-3rem)] flex flex-col">
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <CardTitle>Sales Overview</CardTitle>
            <CardDescription>Sales performance analysis</CardDescription>
          </div>
          <div className="mt-2 md:mt-0 flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              
              {/* Month selection */}
              <Select 
                value={selectedMonth.toString()} 
                onValueChange={(value) => setSelectedMonth(parseInt(value))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map((month, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Year selection */}
              <Select 
                value={selectedYear.toString()} 
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {getYearOptions().map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Total Sales</div>
                  {isLoading ? (
                    <Skeleton className="h-7 w-24 mt-1" />
                  ) : (
                    <div className="text-2xl font-bold">{formatCurrency(totalSales)}</div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Total Orders</div>
                  {isLoading ? (
                    <Skeleton className="h-7 w-24 mt-1" />
                  ) : (
                    <div className="text-2xl font-bold">{totalOrders}</div>
                  )}
                </CardContent>
              </Card>              
            </div>

            <Tabs defaultValue="line" value={activeTab} onValueChange={(value) => setActiveTab(value as ChartType)} className="flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">{monthNames[selectedMonth]} {selectedYear} Sales Trend</h3>
                <TabsList>
                  <TabsTrigger value="line">Line</TabsTrigger>
                  <TabsTrigger value="bar">Bar</TabsTrigger>
                </TabsList>
              </div>

              {isLoading ? (
                <Skeleton className="flex-1 w-full min-h-[300px]" />
              ) : groupedData.length === 0 ? (
                <div className="flex-1 flex justify-center items-center border border-dashed rounded-md min-h-[300px]">
                  <div className="text-center">
                    <p className="text-muted-foreground">No sales data available for this period</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1" style={{ height: '400px', position: 'relative' }}>
                  <TabsContent value="line" className="h-full absolute inset-0">
                    <Line 
                      key={`line-${selectedMonth}-${selectedYear}`} 
                      data={chartData} 
                      options={chartOptions} 
                      height="100%"
                    />
                  </TabsContent>
                  <TabsContent value="bar" className="h-full absolute inset-0">
                    <Bar 
                      key={`bar-${selectedMonth}-${selectedYear}`} 
                      data={chartData} 
                      options={chartOptions} 
                      height="100%"
                    />
                  </TabsContent>
                </div>
              )}
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
}