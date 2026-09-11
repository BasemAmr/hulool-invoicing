"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button
      variant="default"
      size="sm"
      onClick={() => window.print()}
      className="gap-1.5 text-xs font-semibold"
    >
      <Printer className="size-4" />
      <span>طباعة الفاتورة</span>
    </Button>
  );
}