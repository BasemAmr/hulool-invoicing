"use client";

import { ErrorFallback } from "@/components/error-fallback";

/**
 * Error boundary for the company-scoped routes (`/c/[companyId]/...`) — the
 * invoice list, the new/edit invoice wizard, the invoice detail and preview.
 *
 * WHY it matters most here: the invoice save is a Server Action that ends in
 * `redirect()`. When the action response cannot be delivered (aborted render,
 * proxy timeout, truncated flight stream) the client throws a plain error with
 * no digest, and without a boundary that error reached the ROOT boundary and
 * replaced the entire app with "This page couldn't load" — the invoice was
 * actually saved, the user just never saw it. A boundary here keeps the
 * sidebar and offers a retry instead.
 */
export default function CompanyError({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  retry?: () => void;
}) {
  return (
    <ErrorFallback
      error={error}
      reset={reset}
      retry={retry}
      title="تعذّر عرض هذه الصفحة"
      description="حدث خطأ أثناء عرض هذه الصفحة. إن كنت تحفظ فاتورة فقد تم الحفظ بالفعل — أعد المحاولة أو ارجع إلى قائمة الفواتير."
    />
  );
}
