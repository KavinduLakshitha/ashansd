import React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerWithRangeProps {
  className?: string;
  // Allow either selected/onChange or dateRange/onDateRangeChange pattern
  selected?: DateRange | undefined;
  onChange?: (dateRange: DateRange | undefined) => void;
  dateRange?: DateRange | undefined;
  onDateRangeChange?: (dateRange: DateRange | undefined) => void;
  placeholder?: string;
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
  const range = selected || dateRange;
  const handleChange = onChange || onDateRangeChange;

  if (!range || !handleChange) {
    console.warn("DatePickerWithRange: Must provide either selected+onChange or dateRange+onDateRangeChange");
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !range?.from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {range?.from ? (
              range.to ? (
                <>
                  {format(range.from, "LLL dd, y")} -{" "}
                  {format(range.to, "LLL dd, y")}
                </>
              ) : (
                format(range.from, "LLL dd, y")
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
            defaultMonth={range?.from}
            selected={range}
            onSelect={handleChange}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default DatePickerWithRange;