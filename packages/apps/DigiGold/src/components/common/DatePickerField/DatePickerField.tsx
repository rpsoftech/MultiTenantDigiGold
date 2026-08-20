'use client';

import { useState, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Input } from '@/components/common/Input/Input';
import { Calendar } from '@/components/common/Calendar/Calendar';
import { CalendarIcon } from '@/components/common/icons/Icons';
import styles from './DatePickerField.module.scss';

export type DatePickerFieldProps = {
  label?: string;
  labelHint?: ReactNode;
  placeholder?: string;
  error?: string;
  value?: Date;
  onChange: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  name?: string;
};

function formatDate(date: Date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

export function DatePickerField({
  label,
  labelHint,
  placeholder = 'DD/MM/YYYY',
  error,
  value,
  onChange,
  minDate,
  maxDate,
  name,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <div className={styles.trigger}>
          <Input
            label={label}
            labelSuffix={labelHint}
            name={name}
            placeholder={placeholder}
            readOnly
            value={value ? formatDate(value) : ''}
            rightIcon={<CalendarIcon width={16} height={16} />}
            error={error}
          />
        </div>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.content} sideOffset={8} align="start">
          <Calendar
            value={value}
            minDate={minDate}
            maxDate={maxDate}
            onSelect={(date) => {
              onChange(date);
              setOpen(false);
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
