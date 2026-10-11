'use client';

import { useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Badge } from '@/components/common/Badge/Badge';
import { Button } from '@/components/common/Button/Button';
import { Loader } from '@/components/common/Loader/Loader';
import { ChevronDownIcon } from '@/components/common/icons/Icons';
import {
  KYC_BADGE_VARIANT,
  KYC_LABEL,
} from '@/components/admin/adminStatusBadge';
import { useCustomerPicker } from '@/features/admin/hooks/useCustomerPicker';
import type { AdminUserSummary } from '@/features/admin/admin.types';
import { cn } from '@/lib/utils/cn';
import styles from './CustomerPicker.module.scss';

type CustomerPickerProps = {
  selected: AdminUserSummary | null;
  onSelect: (customer: AdminUserSummary) => void;
  disabled?: boolean;
  error?: string;
};

// One field: it shows the chosen customer and reopens the same list to change them, so
// picking and changing a customer are the same gesture.
export function CustomerPicker({
  selected,
  onSelect,
  disabled,
  error,
}: CustomerPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const {
    customers,
    isLoading,
    isError,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useCustomerPicker();

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(term) ||
        customer.mobileNumber.includes(term) ||
        (customer.email ?? '').toLowerCase().includes(term),
    );
  }, [customers, search]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setSearch('');
  }

  function choose(customer: AdminUserSummary) {
    onSelect(customer);
    handleOpenChange(false);
  }

  return (
    <div className={styles.field}>
      <span className={styles.label} id="counter-customer-label">
        Customer
      </span>
      <Popover.Root open={open} onOpenChange={handleOpenChange}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={cn(styles.trigger, error && styles.triggerError)}
            aria-labelledby="counter-customer-label"
            disabled={disabled}
          >
            {selected ? (
              <>
                <span className={styles.person}>
                  <strong>{selected.name}</strong>
                  <span>
                    {selected.mobileNumber} · Vault{' '}
                    {selected.goldBalanceGrams.toFixed(4)} g
                  </span>
                </span>
                <Badge variant={KYC_BADGE_VARIANT[selected.kycStatus]}>
                  KYC {KYC_LABEL[selected.kycStatus]}
                </Badge>
              </>
            ) : (
              <span className={styles.placeholder}>Select a customer</span>
            )}
            <ChevronDownIcon width={16} height={16} aria-hidden />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className={styles.content}
            side="bottom"
            sideOffset={6}
            align="start"
            avoidCollisions={false}
          >
            <input
              type="search"
              className={styles.search}
              aria-label="Search customers"
              placeholder="Search by name, mobile or email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoComplete="off"
              autoFocus
            />

            {isLoading ? (
              <div className={styles.state}>
                <Loader label="Loading customers" />
              </div>
            ) : isError ? (
              <div className={styles.state} role="alert">
                <p>Couldn’t load customers.</p>
                <Button
                  variant="secondary"
                  className={styles.small}
                  onClick={() => void refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : matches.length === 0 ? (
              <p className={styles.state}>
                {customers.length === 0
                  ? 'This store has no customers yet.'
                  : 'No loaded customer matches that search.'}
              </p>
            ) : (
              <ul className={styles.list} aria-label="Customers">
                {matches.map((customer) => (
                  <li key={customer.userId}>
                    <button
                      type="button"
                      className={cn(
                        styles.option,
                        customer.userId === selected?.userId &&
                          styles.optionSelected,
                      )}
                      onClick={() => choose(customer)}
                    >
                      <span className={styles.person}>
                        <strong>{customer.name}</strong>
                        <span>{customer.mobileNumber}</span>
                      </span>
                      <Badge variant={KYC_BADGE_VARIANT[customer.kycStatus]}>
                        {KYC_LABEL[customer.kycStatus]}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {hasNextPage && (
              <div className={styles.footer}>
                <Button
                  variant="secondary"
                  className={styles.small}
                  isLoading={isFetchingNextPage}
                  onClick={() => void fetchNextPage()}
                >
                  Load more customers
                </Button>
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
