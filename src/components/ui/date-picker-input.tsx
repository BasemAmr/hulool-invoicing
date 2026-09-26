"use client";

import React, { useRef } from "react";
import { Calendar } from "lucide-react";
import { Input } from "./input";
import { toWesternDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DatePickerInputProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function DatePickerInput({
  id,
  name,
  value,
  onChange,
  required,
  disabled,
  placeholder = "YYYY-MM-DD",
  className,
}: DatePickerInputProps) {
  const nativePickerRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = toWesternDigits(e.target.value);
    onChange(normalized);
  };

  const handleOpenPicker = () => {
    if (nativePickerRef.current && !disabled) {
      if (typeof nativePickerRef.current.showPicker === "function") {
        nativePickerRef.current.showPicker();
      } else {
        nativePickerRef.current.focus();
      }
    }
  };

  return (
    <div className={cn("relative flex items-center w-full", className)}>
      {/* Visible Clean Western-Formatted Input */}
      <Input
        id={id}
        name={name}
        type="text"
        dir="ltr"
        inputMode="numeric"
        value={value}
        onChange={handleTextChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="text-xs font-mono tabular-nums h-full min-h-6.5 pl-8 pr-2 text-start bg-background tracking-normal"
      />

      {/* Calendar Trigger Button */}
      <button
        type="button"
        onClick={handleOpenPicker}
        disabled={disabled}
        className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
        title="اختر التاريخ من التقويم"
        aria-label="فتح التقويم"
      >
        <Calendar className="size-3.5" />
      </button>

      {/* Hidden Native Picker to provide calendar popup */}
      <input
        ref={nativePickerRef}
        type="date"
        tabIndex={-1}
        value={value || ""}
        onChange={(e) => {
          if (e.target.value) {
            onChange(toWesternDigits(e.target.value));
          }
        }}
        disabled={disabled}
        aria-hidden="true"
        className="sr-only pointer-events-none opacity-0 absolute"
      />
    </div>
  );
}
