"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Введите email")
    .email("Проверьте формат email"),
  password: z.string().min(1, "Введите пароль"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function RealLoginForm() {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setSubmitting(true);
    setServerError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        // One message for both cases on purpose — telling apart "no such
        // user" from "wrong password" would let anyone probe which emails
        // are registered.
        setServerError("Неверный email или пароль");
        setSubmitting(false);
        return;
      }

      // Full navigation, not router.push: the auth cookies were just written
      // by the browser client, and /welcome is server-rendered — it has to be
      // a fresh request for the server to see them. Same reason as in
      // test-login-form.tsx.
      window.location.assign("/welcome");
    } catch {
      setServerError("Сетевая ошибка. Попробуйте ещё раз.");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 text-left">
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-3"
        noValidate
      >
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="text-sm font-medium text-foreground"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            disabled={submitting}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p className="text-xs text-destructive">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="text-sm font-medium text-foreground"
          >
            Пароль
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            disabled={submitting}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p className="text-xs text-destructive">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        {serverError && (
          <p className="text-sm text-destructive">{serverError}</p>
        )}

        <Button
          type="submit"
          size="lg"
          variant="default"
          disabled={submitting}
          className="w-full gap-2 rounded-full bg-foreground text-base font-medium text-background hover:bg-foreground/90"
        >
          {submitting ? "Входим..." : "Войти"}
          {!submitting && <ArrowRight className="h-5 w-5" />}
        </Button>
      </form>
    </div>
  );
}
