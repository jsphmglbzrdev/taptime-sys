import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col gap-4 sm:flex-row",
        month: "space-y-4",
        caption:
          "relative flex h-10 items-center justify-center px-12 pt-1 text-sm font-black text-gray-800",
        caption_label: "block text-center text-sm font-black",
        nav: "flex items-center gap-1",
        button_previous:
          "absolute left-0 top-1 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-orange-50 hover:text-orange-600",
        button_next:
          "absolute right-0 top-1 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-orange-50 hover:text-orange-600",
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday:
          "w-9 text-[11px] font-black uppercase tracking-wider text-gray-400",
        week: "mt-2 flex w-full",
        day: "h-9 w-9 p-0 text-center text-sm",
        day_button:
          "h-9 w-9 cursor-pointer rounded-lg font-semibold text-gray-700 transition hover:bg-orange-50 hover:text-orange-700",
        selected:
          "rounded-lg bg-orange-500 text-white hover:bg-orange-500 hover:text-white focus:bg-orange-500 focus:text-white",
        today: "border border-orange-200 bg-orange-50 text-orange-700",
        outside: "text-gray-300 opacity-60",
        disabled: "text-gray-300 opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: iconClassName, ...iconProps }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("h-4 w-4", iconClassName)} {...iconProps} />
          ) : (
            <ChevronRight className={cn("h-4 w-4", iconClassName)} {...iconProps} />
          ),
      }}
      {...props}
    />
  );
}

export { Calendar };
