"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (options: { message: string; title?: string; type?: ToastType; duration?: number }) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({
      message,
      title,
      type = "info",
      duration = 4000,
    }: {
      message: string;
      title?: string;
      type?: ToastType;
      duration?: number;
    }) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = { id, title, message, type };
      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, title?: string) => toast({ message, title, type: "success" }),
    [toast]
  );
  const error = useCallback(
    (message: string, title?: string) => toast({ message, title, type: "error" }),
    [toast]
  );
  const info = useCallback(
    (message: string, title?: string) => toast({ message, title, type: "info" }),
    [toast]
  );

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 start-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 p-3.5 border bg-card text-card-foreground shadow-lg transition-all animate-in slide-in-from-bottom-2",
              t.type === "success" && "border-emerald-500/30 bg-emerald-50/90 dark:bg-emerald-950/80 text-emerald-950 dark:text-emerald-100",
              t.type === "error" && "border-destructive/30 bg-red-50/90 dark:bg-red-950/80 text-red-950 dark:text-red-100",
              t.type === "info" && "border-border bg-card text-foreground"
            )}
          >
            {t.type === "success" && <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />}
            {t.type === "error" && <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />}
            {t.type === "info" && <Info className="size-5 text-primary shrink-0 mt-0.5" />}
            <div className="flex-1 text-sm">
              {t.title && <div className="font-semibold">{t.title}</div>}
              <div className={t.title ? "text-xs mt-0.5 opacity-90" : "text-sm"}>{t.message}</div>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="opacity-70 hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="إغلاق التنبيه"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
