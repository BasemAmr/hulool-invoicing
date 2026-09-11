"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { AuthenticateUser } from "@/application/use-cases/authenticate-user";
import { LogoutUser } from "@/application/use-cases/logout-user";
import { GenerateSignedInvoiceUrl } from "@/application/use-cases/generate-signed-invoice-url";
import { DomainError } from "@/domain/errors";

const container = createContainer(db);
const SESSION_COOKIE_NAME = "app_session";

export interface AuthActionState {
  error?: string;
  success?: boolean;
}

export async function loginAction(
  _prevState: AuthActionState | null,
  formData: FormData,
): Promise<AuthActionState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "يرجى إدخال البريد الإلكتروني وكلمة المرور" };
  }

  try {
    const useCase = new AuthenticateUser(
      container.userRepository,
      container.sessionRepository,
      container.passwordHasher,
    );

    const result = await useCase.execute({ email, password });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, result.session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: result.session.expiresAt,
      path: "/",
    });
  } catch (err) {
    if (err instanceof DomainError) {
      return { error: err.message };
    }
    return { error: "حدث خطأ أثناء تسجيل الدخول، يرجى المحاولة لاحقاً" };
  }

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId) {
    const useCase = new LogoutUser(container.sessionRepository);
    await useCase.execute(sessionId);
    cookieStore.delete(SESSION_COOKIE_NAME);
  }

  redirect("/login");
}

/**
 * Generate a signed, public, unauthenticated shareable link for an invoice.
 * Valid for 7 days via HMAC signature code & expiration timestamp.
 */
export async function generateShareLinkAction(
  invoiceId: string,
): Promise<{ error?: string; shareUrl?: string; pdfUrl?: string }> {
  try {
    const useCase = new GenerateSignedInvoiceUrl(
      container.invoiceRepository,
      container.urlSigner,
    );

    const result = await useCase.execute(invoiceId);
    return {
      shareUrl: result.sharePath,
      pdfUrl: result.pdfPath,
    };
  } catch (err) {
    console.error("[generateShareLinkAction] Error:", err);
    if (err instanceof DomainError) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : "تعذر إنشاء رابط المشاركة" };
  }
}

/**
 * Generate a signed, public, unauthenticated shareable link for a receipt voucher.
 * Valid for 7 days via HMAC signature code & expiration timestamp.
 */
export async function generateReceiptShareLinkAction(
  receiptId: string,
  expiresInSeconds: number = 7 * 24 * 60 * 60,
): Promise<{ error?: string; shareUrl?: string; pdfUrl?: string }> {
  try {
    const receipt = await container.receiptVoucherRepository.findById(receiptId);
    if (!receipt) {
      return { error: "سند القبض غير موجود" };
    }

    const { signature, expiresAt } = container.urlSigner.sign(
      receipt.id,
      expiresInSeconds,
    );

    const sharePath = `/api/documents/receipts/${receipt.id}/pdf?sig=${signature}&exp=${expiresAt}`;
    const pdfPath = `/api/documents/receipts/${receipt.id}/pdf?sig=${signature}&exp=${expiresAt}&download=true`;

    return {
      shareUrl: sharePath,
      pdfUrl: pdfPath,
    };
  } catch (err) {
    console.error("[generateReceiptShareLinkAction] Error:", err);
    if (err instanceof DomainError) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : "تعذر إنشاء رابط المشاركة" };
  }
}
