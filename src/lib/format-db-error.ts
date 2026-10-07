/**
 * Maps database and domain errors into user-friendly localized messages.
 * Prevents throwing raw Postgres driver exceptions into Next.js Server Actions,
 * which would otherwise cause opaque 500 fatal errors in production logs.
 */

export function formatDatabaseError(
  error: unknown,
  fallbackMessage = "حدث خطأ أثناء معالجة الطلب"
): string {
  if (!error) return fallbackMessage;

  // 1. Validation or Domain error classes with explicit messages
  if (
    error instanceof Error &&
    (error.name === "ValidationError" ||
      error.name === "DomainError" ||
      error.name === "ConflictError" ||
      error.name === "NotFoundError")
  ) {
    return error.message;
  }

  // 2. Extract underlying Postgres driver error (may be wrapped in error.cause)
  const pgErr = (error as { cause?: unknown })?.cause ?? error;
  const code = (pgErr as { code?: string })?.code;
  const constraint = String((pgErr as { constraint?: string })?.constraint ?? "").toLowerCase();
  const detail = String((pgErr as { detail?: string })?.detail ?? "").toLowerCase();
  const message = String((pgErr as { message?: string })?.message ?? "").toLowerCase();

  // Unique constraint violation (PostgreSQL code 23505)
  if (
    code === "23505" ||
    message.includes("duplicate key") ||
    message.includes("unique constraint")
  ) {
    if (constraint.includes("vat_number") || detail.includes("vat_number")) {
      return "الرقم الضريبي مسجل بالفعل لمنشأة أخرى";
    }
    if (constraint.includes("prefix") || detail.includes("prefix")) {
      return "بادئة الفواتير (Prefix) مستخدمة بالفعل لمنشأة أخرى، يرجى اختيار بادئة مختلفة";
    }
    if (constraint.includes("invoice_number") || detail.includes("invoice_number")) {
      return "رقم الفاتورة مستخدم بالفعل لهذه المنشأة";
    }
    if (constraint.includes("voucher_number") || detail.includes("voucher_number")) {
      return "رقم السند مستخدم بالفعل لهذه المنشأة";
    }
    if (constraint.includes("email") || detail.includes("email")) {
      return "البريد الإلكتروني مسجل بالفعل";
    }
    return "توجد بيانات مسجلة مسبقاً بنفس القيمة الفريدة (قيمة مكررة)";
  }

  // Foreign key violation (PostgreSQL code 23503)
  if (code === "23503" || message.includes("foreign key")) {
    return "السجل المرتبط غير موجود أو تم حذفه";
  }

  // Check constraint violation (PostgreSQL code 23514)
  if (code === "23514" || message.includes("check constraint")) {
    return "البيانات المدخلة لا تستوفي شروط التحقق المعتمدة";
  }

  // Not-null constraint violation (PostgreSQL code 23502)
  if (code === "23502" || message.includes("not-null")) {
    return "أحد الحقول الإلزامية مفقود، يرجى تعبئة كافة الحقول المطلوبة";
  }

  // Plain standard Error instance with human-readable message (avoiding raw SQL snippets)
  if (
    error instanceof Error &&
    error.message &&
    !error.message.includes("Failed query") &&
    !error.message.includes("insert into") &&
    !error.message.includes("update \"") &&
    !error.message.includes("syntax error")
  ) {
    return error.message;
  }

  return fallbackMessage;
}
