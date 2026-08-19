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

type ViewMode = 'day' | 'month' | 'year';

const YEARS_PER_PAGE = 12;

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

const MONTH_SHORT_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
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

function buildYearPage(pageStartYear: number) {
  return Array.from({ length: YEARS_PER_PAGE }, (_, i) => pageStartYear + i);
}

export function Calendar({ value, onSelect, minDate, maxDate, className }: CalendarProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState((value ?? today).getFullYear());
  const [viewMonth, setViewMonth] = useState((value ?? today).getMonth());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [yearPageStart, setYearPageStart] = useState(
    Math.floor((value ?? today).getFullYear() / YEARS_PER_PAGE) * YEARS_PER_PAGE
  );

  const weeks = buildWeeks(viewYear, viewMonth);
  const yearPage = buildYearPage(yearPageStart);

  const isMonthDisabled = (month: number) => {
    if (minDate && (viewYear < minDate.getFullYear() ||
      (viewYear === minDate.getFullYear() && month < minDate.getMonth()))) return true;
    if (maxDate && (viewYear > maxDate.getFullYear() ||
      (viewYear === maxDate.getFullYear() && month > maxDate.getMonth()))) return true;
    return false;
  };

  const isYearDisabled = (year: number) => {
    if (minDate && year < minDate.getFullYear()) return true;
    if (maxDate && year > maxDate.getFullYear()) return true;
    return false;
  };

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

  const handleHeaderPrev = () => {
    if (viewMode === 'day') goToPreviousMonth();
    else if (viewMode === 'year') setYearPageStart((y) => y - YEARS_PER_PAGE);
    else setViewYear((y) => y - 1);
  };

  const handleHeaderNext = () => {
    if (viewMode === 'day') goToNextMonth();
    else if (viewMode === 'year') setYearPageStart((y) => y + YEARS_PER_PAGE);
    else setViewYear((y) => y + 1);
  };

  const openYearView = () => {
    setYearPageStart(Math.floor(viewYear / YEARS_PER_PAGE) * YEARS_PER_PAGE);
    setViewMode('year');
  };

  return (
    <div className={cn(styles.calendar, className)}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.navButton}
          onClick={handleHeaderPrev}
          aria-label={viewMode === 'day' ? 'Previous month' : viewMode === 'year' ? 'Previous years' : 'Previous year'}
        >
          <ChevronLeftIcon width={18} height={18} />
        </button>
        {viewMode === 'day' && (
          <div className={styles.monthYearRow}>
            <button
              type="button"
              className={styles.monthLabel}
              onClick={() => setViewMode('month')}
            >
              {MONTH_LABELS[viewMonth]}
            </button>
            <button type="button" className={styles.monthLabel} onClick={openYearView}>
              {viewYear}
            </button>
          </div>
        )}
        {viewMode === 'month' && (
          <button type="button" className={styles.monthLabel} onClick={openYearView}>
            {viewYear}
          </button>
        )}
        {viewMode === 'year' && (
          <span className={styles.monthLabel}>
            {yearPage[0]} – {yearPage[yearPage.length - 1]}
          </span>
        )}
        <button
          type="button"
          className={styles.navButton}
          onClick={handleHeaderNext}
          aria-label={viewMode === 'day' ? 'Next month' : viewMode === 'year' ? 'Next years' : 'Next year'}
        >
          <ChevronRightIcon width={18} height={18} />
        </button>
      </div>

      {viewMode === 'year' && (
        <div className={styles.yearGrid}>
          {yearPage.map((year) => (
            <button
              key={year}
              type="button"
              className={cn(styles.yearCell, year === viewYear && styles.yearSelected)}
              disabled={isYearDisabled(year)}
              onClick={() => {
                setViewYear(year);
                setViewMode('month');
              }}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      {viewMode === 'month' && (
        <div className={styles.monthGrid}>
          {MONTH_SHORT_LABELS.map((label, index) => (
            <button
              key={label}
              type="button"
              className={cn(styles.monthCell, index === viewMonth && styles.monthSelected)}
              disabled={isMonthDisabled(index)}
              onClick={() => {
                setViewMonth(index);
                setViewMode('day');
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {viewMode === 'day' && (
        <>
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
        </>
      )}
    </div>
  );
}