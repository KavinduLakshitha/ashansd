"use client";

import React, { useEffect, useState } from 'react';
import axios from '@/lib/api/axios';
import { useAuth } from '@/app/auth/auth-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface BankAccountOption {
  BankAccountID: number;
  Name: string;
  BankName: string | null;
  BranchName?: string | null;
  AccountNumber: string | null;
}

export const bankAccountLabel = (account: BankAccountOption) => {
  let label = account.Name;
  if (account.BankName) {
    label += ` (${account.BankName}${account.BranchName ? ` — ${account.BranchName}` : ''})`;
  }
  return label;
};

// Loads the active bank accounts for the logged-in business line.
export function useBankAccounts() {
  const { getBusinessLineID } = useAuth();
  const businessLineId = getBusinessLineID();
  const [accounts, setAccounts] = useState<BankAccountOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessLineId) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await axios.get('/cashbook/bank-accounts', { params: { businessLineId } });
        if (!cancelled) setAccounts(response.data?.data ?? []);
      } catch (error) {
        console.error('Error loading bank accounts:', error);
        if (!cancelled) setAccounts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessLineId]);

  return { accounts, loading };
}

interface BankAccountSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export default function BankAccountSelect({
  value,
  onChange,
  disabled,
  placeholder = 'Select bank account',
  className,
}: BankAccountSelectProps) {
  const { accounts, loading } = useBankAccounts();
  const noAccounts = !loading && accounts.length === 0;

  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled || loading || noAccounts}>
      <SelectTrigger className={className}>
        <SelectValue
          placeholder={
            loading ? 'Loading accounts…' : noAccounts ? 'No bank accounts — add one in Cashbook' : placeholder
          }
        />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.BankAccountID} value={String(account.BankAccountID)}>
            {bankAccountLabel(account)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
