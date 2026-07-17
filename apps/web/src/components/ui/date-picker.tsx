'use client';

import { addDays, addMonths, format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import * as React from 'react';
import type { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/*  DatePicker (single date)                                                  */
/* -------------------------------------------------------------------------- */

export interface DatePickerProps {
  /** The currently selected date. */
  date?: Date;
  /** Callback when the selected date changes. */
  onDateChange?: (date: Date | undefined) => void;
  /** Placeholder text when no date is selected. */
  placeholder?: string;
  /** Additional class names for the trigger button. */
  className?: string;
  /** Whether the picker is disabled. */
  disabled?: boolean;
  /** Date format string (date-fns). Defaults to "PPP". */
  dateFormat?: string;
}

function DatePicker({
  date,
  onDateChange,
  placeholder = 'Pick a date',
  className,
  disabled = false,
  dateFormat = 'PPP',
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !date && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, dateFormat) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(selected) => {
            onDateChange?.(selected);
            setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
DatePicker.displayName = 'DatePicker';

/* -------------------------------------------------------------------------- */
/*  DateRangePicker                                                           */
/* -------------------------------------------------------------------------- */

export interface DateRangePickerProps {
  /** The currently selected date range. */
  dateRange?: DateRange;
  /** Callback when the selected date range changes. */
  onDateRangeChange?: (range: DateRange | undefined) => void;
  /** Placeholder text when no range is selected. */
  placeholder?: string;
  /** Additional class names for the trigger button. */
  className?: string;
  /** Whether the picker is disabled. */
  disabled?: boolean;
  /** Date format string (date-fns). Defaults to "LLL dd, y". */
  dateFormat?: string;
  /** Number of months to display. Defaults to 2. */
  numberOfMonths?: number;
}

function DateRangePicker({
  dateRange,
  onDateRangeChange,
  placeholder = 'Pick a date range',
  className,
  disabled = false,
  dateFormat = 'LLL dd, y',
  numberOfMonths = 2,
}: DateRangePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id="date-range"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !dateRange && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateRange?.from ? (
            dateRange.to ? (
              <>
                {format(dateRange.from, dateFormat)} - {format(dateRange.to, dateFormat)}
              </>
            ) : (
              format(dateRange.from, dateFormat)
            )
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          autoFocus
          mode="range"
          defaultMonth={dateRange?.from}
          selected={dateRange}
          onSelect={onDateRangeChange}
          numberOfMonths={numberOfMonths}
        />
      </PopoverContent>
    </Popover>
  );
}
DateRangePicker.displayName = 'DateRangePicker';

/* -------------------------------------------------------------------------- */
/*  DatePickerWithPresets                                                     */
/* -------------------------------------------------------------------------- */

export interface DatePickerWithPresetsProps {
  /** The currently selected date. */
  date?: Date;
  /** Callback when the selected date changes. */
  onDateChange?: (date: Date | undefined) => void;
  /** Placeholder text when no date is selected. */
  placeholder?: string;
  /** Additional class names for the trigger button. */
  className?: string;
  /** Whether the picker is disabled. */
  disabled?: boolean;
  /** Date format string (date-fns). Defaults to "PPP". */
  dateFormat?: string;
  /** Custom presets. Defaults to Today, Tomorrow, In 3 days, In a week, In a month. */
  presets?: Array<{ label: string; date: Date }>;
}

const defaultPresets = (): Array<{ label: string; date: Date }> => [
  { label: 'Today', date: new Date() },
  { label: 'Tomorrow', date: addDays(new Date(), 1) },
  { label: 'In 3 days', date: addDays(new Date(), 3) },
  { label: 'In a week', date: addDays(new Date(), 7) },
  { label: 'In a month', date: addMonths(new Date(), 1) },
];

function DatePickerWithPresets({
  date,
  onDateChange,
  placeholder = 'Pick a date',
  className,
  disabled = false,
  dateFormat = 'PPP',
  presets,
}: DatePickerWithPresetsProps) {
  const [open, setOpen] = React.useState(false);
  const resolvedPresets = presets ?? defaultPresets();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !date && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, dateFormat) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-auto flex-col gap-2 p-2 sm:flex-row" align="start">
        <Select
          onValueChange={(value) => {
            const preset = resolvedPresets.find((p) => p.label === value);
            if (preset) {
              onDateChange?.(preset.date);
              setOpen(false);
            }
          }}
        >
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Select preset" />
          </SelectTrigger>
          <SelectContent position="popper">
            {resolvedPresets.map((preset) => (
              <SelectItem key={preset.label} value={preset.label}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="rounded-md border">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(selected) => {
              onDateChange?.(selected);
              setOpen(false);
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
DatePickerWithPresets.displayName = 'DatePickerWithPresets';

/* -------------------------------------------------------------------------- */
/*  Exports                                                                   */
/* -------------------------------------------------------------------------- */

export { DatePicker, DateRangePicker, DatePickerWithPresets };
