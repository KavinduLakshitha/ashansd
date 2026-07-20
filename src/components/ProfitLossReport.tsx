"use client";

import React, { useCallback, useEffect, useState } from "react";
import { addDays, format } from "date-fns";
import { DateRange } from "react-day-picker";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePickerWithRange } from "./DateRange";
import { useAuth } from "@/app/auth/auth-context";
import axios from "@/lib/api/axios";
import { isAxiosError } from "axios";

interface ProfitAndLoss {
  period: { startDate: string; endDate: string };
  revenue: number;
  saleCount: number;
  purchases: number;
  purchaseCount: number;
  grossProfit: number;
  operatingExpenses: number;
  otherIncome: number;
  netProfit: number;
  cashBalance: number;
  bankBalance: number;
}

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 2,
  }).format(value);

const ProfitLossReport = () => {
  const { getBusinessLineID } = useAuth();
  const [data, setData] = useState<ProfitAndLoss | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });

  const fetchReport = useCallback(async () => {
    const businessLineId = getBusinessLineID();
    if (!businessLineId || !dateRange?.from || !dateRange?.to) {
      setError("Business line and date range are required");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get("/cashbook/pnl", {
        params: {
          businessLineId,
          startDate: format(dateRange.from, "yyyy-MM-dd"),
          endDate: format(dateRange.to, "yyyy-MM-dd"),
        },
      });
      setData(response.data);
    } catch (err) {
      console.error("Error fetching P&L:", err);
      if (isAxiosError(err)) {
        setError(err.response?.data?.message || "Failed to load P&L statement");
      } else {
        setError("Failed to load P&L statement");
      }
    } finally {
      setLoading(false);
    }
  }, [getBusinessLineID, dateRange]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const Row = ({
    label,
    value,
    muted,
    bold,
    emphasize,
  }: {
    label: string;
    value: number;
    muted?: boolean;
    bold?: boolean;
    emphasize?: "positive" | "negative" | "neutral";
  }) => (
    <div
      className={`flex items-center justify-between py-2 border-b last:border-b-0 ${
        muted ? "text-muted-foreground text-sm" : ""
      } ${bold ? "font-semibold text-base pt-3" : ""}`}
    >
      <span>{label}</span>
      <span
        className={`tabular-nums ${
          emphasize === "positive"
            ? "text-green-700"
            : emphasize === "negative"
              ? "text-red-600"
              : ""
        }`}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Profit &amp; Loss Statement</h2>
          <p className="text-sm text-muted-foreground">
            Revenue, purchases, expenses and balances for the selected period.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DatePickerWithRange selected={dateRange} onChange={setDateRange} />
          <Button variant="outline" size="icon" onClick={fetchReport} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Gross Profit</div>
            {loading || !data ? (
              <Skeleton className="h-7 w-28 mt-1" />
            ) : (
              <div
                className={`text-2xl font-bold ${
                  data.grossProfit >= 0 ? "text-green-700" : "text-red-600"
                }`}
              >
                {formatCurrency(data.grossProfit)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Net Profit</div>
            {loading || !data ? (
              <Skeleton className="h-7 w-28 mt-1" />
            ) : (
              <div
                className={`text-2xl font-bold ${
                  data.netProfit >= 0 ? "text-green-700" : "text-red-600"
                }`}
              >
                {formatCurrency(data.netProfit)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Bank Balance (as of end date)</div>
            {loading || !data ? (
              <Skeleton className="h-7 w-28 mt-1" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(data.bankBalance)}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Statement</CardTitle>
            <CardDescription>
              {data
                ? `${data.period.startDate} to ${data.period.endDate}`
                : "Select a date range"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div>
                <Row label="Sales Revenue" value={data.revenue} />
                <Row
                  label={`Less: Purchases (${data.purchaseCount} orders)`}
                  value={-data.purchases}
                  muted
                />
                <Row
                  label="Gross Profit"
                  value={data.grossProfit}
                  bold
                  emphasize={data.grossProfit >= 0 ? "positive" : "negative"}
                />
                <Row
                  label="Less: Operating Expenses"
                  value={-data.operatingExpenses}
                  muted
                />
                <Row label="Add: Other Income" value={data.otherIncome} muted />
                <Row
                  label="Net Profit / (Loss)"
                  value={data.netProfit}
                  bold
                  emphasize={data.netProfit >= 0 ? "positive" : "negative"}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Balances &amp; Volume</CardTitle>
            <CardDescription>
              Cashbook balances as of the period end date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div>
                <Row label="Cash Balance" value={data.cashBalance} />
                <Row label="Bank Balance" value={data.bankBalance} bold />
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border p-3">
                    <div className="text-muted-foreground">Sales count</div>
                    <div className="text-xl font-semibold">{data.saleCount}</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-muted-foreground">Purchase count</div>
                    <div className="text-xl font-semibold">{data.purchaseCount}</div>
                  </div>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Operating expenses and other income come from manual cashbook entries.
                  Cash sales and cheque realizations affect balances but are not re-counted as
                  revenue here (sales already include them).
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfitLossReport;
