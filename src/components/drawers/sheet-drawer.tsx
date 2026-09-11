"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SheetDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

const maxWidthMap = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export function SheetDrawer({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  maxWidth = "md",
}: SheetDrawerProps) {
  // Lock body scroll when open and handle Escape key
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-modal="true" role="dialog">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer Container (RTL: right side drawer) */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-0 sm:pl-10">
        <div
          className={`w-screen ${maxWidthMap[maxWidth]} bg-card border-s border-border shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-250 ease-out`}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-4 border-b border-border bg-muted/20">
            <div className="flex items-center gap-2.5">
              {icon && (
                <div className="size-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  {icon}
                </div>
              )}
              <div>
                <h2 className="text-sm font-bold text-foreground">{title}</h2>
                {description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground size-7 p-0"
              aria-label="إغلاق"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5">{children}</div>

          {/* Footer (if provided) */}
          {footer && (
            <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-end gap-2">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
