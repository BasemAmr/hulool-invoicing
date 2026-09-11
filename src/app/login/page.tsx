"use client";

import React, { useActionState } from "react";
import { Lock, Mail, ArrowLeft, Shield } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md bg-card border border-border p-6 sm:p-8 shadow-xs flex flex-col gap-6">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-1 border-b border-border pb-5">
          <div className="size-10 bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-2">
            <Shield className="size-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            حلول — تسجيل الدخول
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            لوحة إدارة وإصدار الفواتير
          </p>
        </div>

        {/* Error Alert */}
        {state?.error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
            {state.error}
          </div>
        )}

        {/* Login Form */}
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" className="text-xs font-semibold flex items-center gap-1.5">
              <Mail className="size-3.5 text-muted-foreground" />
              <span>البريد الإلكتروني</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="admin@example.com"
              required
              autoFocus
              className="text-xs"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" className="text-xs font-semibold flex items-center gap-1.5">
              <Lock className="size-3.5 text-muted-foreground" />
              <span>كلمة المرور</span>
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              className="text-xs"
            />
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="w-full mt-2 font-semibold text-xs gap-1.5"
          >
            {isPending ? "جاري التحقق..." : "تسجيل الدخول"}
          </Button>
        </form>

      </div>
    </div>
  );
}
