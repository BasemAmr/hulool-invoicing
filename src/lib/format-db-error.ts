export type DatabaseEntityContext = "customer" | "company" | "invoice" | "receipt";

/**
 * Maps database and domain errors into user-friendly localized messages.
 * Prevents throwing raw Postgres driver exceptions into Next.js Server Actions,
 * which would otherwise cause opaque 500 fatal errors in production logs.
 */
export function formatDatabaseError(
  error: unknown,
  fallbackMessage = "حدث خطأ أثناء معالجة الطلب",
  context?: DatabaseEntityContext,
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
    // ── Customer specific constraints ──────────────────────────────
    if (
      constraint.includes("customers_name_ar") ||
      (context === "customer" && (constraint.includes("name_ar") || detail.includes("name_ar")))
    ) {
      return "اسم العميل مسجل بالفعل لعميل آخر، يرجى اختيار اسم مختلف";
    }

    if (
      constraint.includes("customers_vat_number") ||
      (context === "customer" && (constraint.includes("vat_number") || detail.includes("vat_number")))
    ) {
      return "الرقم الضريبي مسجل بالفعل لعميل آخر";
    }

    if (
      constraint.includes("customers_unified_number") ||
      constraint.includes("unified_number") ||
      detail.includes("unified_number")
    ) {
      return "الرقم الموحد (700) مسجل بالفعل لعميل آخر";
    }

    // ── Company specific constraints ───────────────────────────────
    if (
      constraint.includes("companies_name_ar") ||
      (context === "company" && (constraint.includes("name_ar") || detail.includes("name_ar")))
    ) {
      return "اسم المنشأة مسجل بالفعل لمنشأة أخرى، يرجى اختيار اسم مختلف";
    }

    if (
      constraint.includes("companies_vat_number") ||
      (context === "company" && (constraint.includes("vat_number") || detail.includes("vat_number")))
    ) {
      return "الرقم الضريبي مسجل بالفعل لمنشأة أخرى";
    }

    if (
      constraint.includes("companies_cr_number") ||
      constraint.includes("cr_number") ||
      detail.includes("cr_number")
    ) {
      return "رقم السجل التجاري مسجل بالفعل لمنشأة أخرى";
    }

    if (
      constraint.includes("companies_prefix") ||
      constraint.includes("prefix") ||
      detail.includes("prefix")
    ) {
      return "بادئة الفواتير (Prefix) مستخدمة بالفعل لمنشأة أخرى، يرجى اختيار بادئة مختلفة";
    }

    // ── General name / vat fallbacks if constraint didn't specify table ─
    if (constraint.includes("name_ar") || detail.includes("name_ar")) {
      return context === "customer"
        ? "اسم العميل مسجل بالفعل لعميل آخر، يرجى اختيار اسم مختلف"
        : "اسم المنشأة مسجل بالفعل لمنشأة أخرى، يرجى اختيار اسم مختلف";
    }

    if (constraint.includes("vat_number") || detail.includes("vat_number")) {
      return context === "customer"
        ? "الرقم الضريبي مسجل بالفعل لعميل آخر"
        : "الرقم الضريبي مسجل بالفعل لمنشأة أخرى";
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
