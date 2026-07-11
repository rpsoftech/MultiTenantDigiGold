'use client';

import { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/common/icons/Icons';
import { cn } from '@/lib/utils/cn';
import styles from './Calendar.module.scss';

export type CalendarProps = {
  value?: Date;
  onSelect?: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
};

const WEEKDAY_LABELS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildWeeks(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();

  const cells: Array<Date | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: Array<Array<Date | null>> = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export function Calendar({ value, onSelect, minDate, maxDate, className }: CalendarProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState((value ?? today).getFullYear());
  const [viewMonth, setViewMonth] = useState((value ?? today).getMonth());

  const weeks = buildWeeks(viewYear, viewMonth);

  const goToPreviousMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const isDisabled = (date: Date) =>
    (minDate !== undefined && date < minDate) || (maxDate !== undefined && date > maxDate);

  return (
    <div className={cn(styles.calendar, className)}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.navButton}
          onClick={goToPreviousMonth}
          aria-label="Previous month"
        >
          <ChevronLeftIcon width={18} height={18} />
        </button>
        <span className={styles.monthLabel}>
          {MONTH_LABELS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          className={styles.navButton}
          onClick={goToNextMonth}
          aria-label="Next month"
        >
          <ChevronRightIcon width={18} height={18} />
        </button>
      </div>

      <div className={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className={styles.weekdayCell}>
            {label}
          </span>
        ))}
      </div>

      <div className={styles.grid}>
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className={styles.weekRow}>
            {week.map((date, dayIndex) => {
              if (!date) {
                return <span key={dayIndex} className={styles.dayCell} />;
              }
              const isToday = isSameDay(date, today);
              const isSelected = value ? isSameDay(date, value) : false;
              const disabled = isDisabled(date);

              return (
                <button
                  key={dayIndex}
                  type="button"
                  className={cn(
                    styles.dayCell,
                    styles.dayButton,
                    isToday && styles.dayToday,
                    isSelected && styles.daySelected
                  )}
                  disabled={disabled}
                  onClick={() => onSelect?.(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
