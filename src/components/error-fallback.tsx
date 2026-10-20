"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Shared fallback UI for the route-segment error boundaries (`error.tsx`).
 *
 * WHY: without an `error.tsx`, ANY uncaught error in a client component
 * bubbles all the way up to the root boundary and replaces the whole app
 * with Next's built-in "This page couldn't load" screen — the user loses the
 * sidebar, the form, everything, with no way back except Reload/Back.
 * A segment boundary keeps the shell and offers a retry.
 */
export function ErrorFallback({
  error,
  reset,
  retry,
  title = "حدث خطأ غير متوقع",
  description = "تعذّر عرض هذه الصفحة. يمكنك إعادة المحاولة، وإن تكرّر الخطأ راجع سجلات الخادم.",
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  retry?: () => void;
  title?: string;
  description?: string;
}) {
  useEffect(() => {
    // Server errors arrive redacted (message + digest only) in production —
    // log what we got so it can be matched against the server-side stack.
    console.error("[error-boundary]", error);
  }, [error]);

  // Next 16 passes both; `retry` also re-fetches the route, `reset` only
  // clears the boundary state. Prefer retry, fall back to reset.
  const recover = retry ?? reset;

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      {error.digest ? (
        <p className="font-mono text-[10px] text-muted-foreground">
          ERROR {error.digest}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => recover?.()}>
          إعادة المحاولة
        </Button>
        <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}
