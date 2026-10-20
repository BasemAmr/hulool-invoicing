"use client";

import { ErrorFallback } from "@/components/error-fallback";

/**
 * Root route-segment error boundary. Catches anything that escapes the
 * (dashboard) / (company) segment boundaries so a single broken page can
 * never take down the whole app.
 */
export default function RootError({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  retry?: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} retry={retry} />;
}
