"use client";

import * as React from "react";
import {
  startOfMonth,
  endOfMonth,
  subDays,
  subMonths,
  startOfYear,
} from "date-fns";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { DateRange } from "react-day-picker";
import { idLocale, formatDate } from "@/lib/date-utils";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerWithPresetsProps {
  className?: string;
  date?: DateRange;
  onSelect?: (date: DateRange | undefined) => void;
}

export function DatePickerWithPresets({
  className,
  date,
  onSelect,
}: DatePickerWithPresetsProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedLabel, setSelectedLabel] = React.useState<
    string | undefined
  >();

  // Reset label if date is cleared externally
  React.useEffect(() => {
    if (!date) {
      setSelectedLabel(undefined);
    }
  }, [date]);

  const handlePresetSelect = (preset: string, label: string) => {
    const today = new Date();
    let newDate: DateRange | undefined;

    switch (preset) {
      case "today":
        newDate = { from: today, to: today };
        break;
      case "yesterday":
        const yesterday = subDays(today, 1);
        newDate = { from: yesterday, to: yesterday };
        break;
      case "last7":
        newDate = { from: subDays(today, 6), to: today };
        break;
      case "last30":
        newDate = { from: subDays(today, 29), to: today };
        break;
      case "thisMonth":
        newDate = { from: startOfMonth(today), to: endOfMonth(today) };
        break;
      case "lastMonth":
        const lastMonth = subMonths(today, 1);
        newDate = { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
        break;
      case "thisYear":
        newDate = { from: startOfYear(today), to: today };
        break;
    }

    if (onSelect) {
      onSelect(newDate);
    }
    setSelectedLabel(label);
    setOpen(false);
  };

  return (
    <div className="grid gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal h-9",
              !date && "text-muted-foreground",
              className,
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedLabel ? (
              selectedLabel
            ) : date?.from ? (
              date.to ? (
                <>
                  {formatDate(date.from, "dd MMM yyyy")} -{" "}
                  {formatDate(date.to, "dd MMM yyyy")}
                </>
              ) : (
                formatDate(date.from, "dd MMM yyyy")
              )
            ) : (
              <span>Pilih Tanggal</span>
            )}
            <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col sm:flex-row">
            <div className="flex flex-col gap-1 p-2 w-full sm:w-40 border-b sm:border-b-0 sm:border-r border-slate-100 bg-slate-50/50">
              <p className="px-2 py-1.5 text-xs font-medium text-slate-500 mb-1">
                Presets
              </p>
              {[
                { label: "Hari Ini", value: "today" },
                { label: "Kemarin", value: "yesterday" },
                { label: "7 Hari Terakhir", value: "last7" },
                { label: "30 Hari Terakhir", value: "last30" },
                { label: "Bulan Ini", value: "thisMonth" },
                { label: "Bulan Lalu", value: "lastMonth" },
              ].map((item) => (
                <Button
                  key={item.value}
                  variant="ghost"
                  className="justify-start text-xs h-8 px-2 font-normal"
                  onClick={() => handlePresetSelect(item.value, item.label)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <div className="p-2">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={(newDate) => {
                  setSelectedLabel(undefined);
                  if (onSelect) onSelect(newDate);
                }}
                numberOfMonths={1}
                locale={idLocale}
                className="rounded-md border-0"
                captionLayout="dropdown"
                fromYear={2020}
                toYear={2030}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
