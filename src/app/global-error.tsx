"use client";

import { useEffect } from "react";

/**
 * Last-resort error boundary: Next renders this INSTEAD of the root layout,
 * so it must ship its own <html>/<body> — and its own styles, because the
 * app's globals.css is not applied to this document (Next's error.md docs).
 *
 * Everything stylable is inline for that reason.
 */
export default function GlobalError({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  retry?: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  const recover = retry ?? reset;

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, 'Segoe UI', Tahoma, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            حدث خطأ غير متوقع
          </h1>
          <p
            style={{
              marginTop: 8,
              fontSize: 14,
              lineHeight: 1.8,
              color: "#475569",
            }}
          >
            تعذّر تحميل هذه الصفحة. أعد المحاولة، وإن تكرّر الخطأ راجع سجلات
            الخادم.
          </p>

          {error.digest ? (
            <p
              style={{
                marginTop: 10,
                fontSize: 11,
                color: "#94a3b8",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              ERROR {error.digest}
            </p>
          ) : null}

          <div
            style={{
              marginTop: 20,
              display: "flex",
              gap: 8,
              justifyContent: "center",
            }}
          >
            <button
              onClick={() => recover?.()}
              style={{
                cursor: "pointer",
                border: "1px solid transparent",
                borderRadius: 4,
                background: "#0f172a",
                color: "#f8fafc",
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              إعادة المحاولة
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
                a hard navigation is deliberate here: the router context may
                itself be the thing that broke, so a full page load is the
                only way to get back to a clean app. */}
            <a
              href="/"
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                background: "#ffffff",
                color: "#0f172a",
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              العودة للرئيسية
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
