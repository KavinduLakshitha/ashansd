import React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange as DayPickerDateRange } from "react-day-picker";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Define both DateRange types explicitly to avoid confusion
interface ComponentDateRange {
  from: Date | undefined;
  to: Date | undefined;
}

// Use interface merging to make the props clearer
interface DatePickerWithRangeProps {
  className?: string;
  placeholder?: string;
  // First pattern
  selected?: DayPickerDateRange | undefined;
  onChange?: (dateRange: DayPickerDateRange | undefined) => void;
  // Second pattern
  dateRange?: ComponentDateRange;
  onDateRangeChange?: (dateRange: ComponentDateRange | undefined) => void;
}

export function DatePickerWithRange({
  className,
  selected,
  onChange,
  dateRange,
  onDateRangeChange,
  placeholder = "Pick a date range"
}: DatePickerWithRangeProps) {
  // Use whichever props are provided
  const handleCalendarSelect = (selectedRange: DayPickerDateRange | undefined) => {
    // If using the onChange pattern
    if (onChange) {
      onChange(selectedRange);
    }
    // If using the onDateRangeChange pattern
    else if (onDateRangeChange) {
      // Convert from DayPickerDateRange to ComponentDateRange
      onDateRangeChange(selectedRange ? {
        from: selectedRange.from,
        to: selectedRange.to
      } : undefined);
    }
  };
  
  // Prepare the display range based on whichever input is provided
  const displayRange = selected || dateRange;

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !displayRange?.from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayRange?.from ? (
              displayRange.to ? (
                <>
                  {format(displayRange.from, "LLL dd, y")} -{" "}
                  {format(displayRange.to, "LLL dd, y")}
                </>
              ) : (
                format(displayRange.from, "LLL dd, y")
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={displayRange?.from}
            selected={selected || (dateRange ? {
              from: dateRange.from,
              to: dateRange.to
            } : undefined)}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default DatePickerWithRange;