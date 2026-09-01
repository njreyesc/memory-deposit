"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { LOGIN_PATTERN, LOGIN_RULE_MESSAGE } from "@/lib/auth/login-identity";

const registerSchema = z.object({
  login: z
    .string()
    .trim()
    .min(1, "Введите логин")
    .regex(LOGIN_PATTERN, LOGIN_RULE_MESSAGE),
  password: z.string().min(6, "Пароль не короче 6 символов"),
});

type RegisterValues = z.infer<typeof registerSchema>;

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export default function RegisterForm() {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { login: "", password: "" },
  });

  async function onSubmit(values: RegisterValues) {
    setSubmitting(true);
    setServerError(null);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        let message = "Не удалось зарегистрироваться";
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          // keep the generic message
        }
        setServerError(message);
        setSubmitting(false);
        return;
      }

      const { access_token, refresh_token } = (await res.json()) as {
        access_token: string;
        refresh_token: string;
      };

      const supabase = createClient();
      await supabase.auth.setSession({ access_token, refresh_token });

      // Full navigation so the server sees the freshly written auth cookies.
      window.location.assign("/welcome");
    } catch {
      setServerError("Сетевая ошибка. Попробуйте ещё раз.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-3 text-left"
      noValidate
    >
      <div className="space-y-1.5">
        <label
          htmlFor="reg-login"
          className="text-sm font-medium text-foreground"
        >
          Логин
        </label>
        <input
          id="reg-login"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="ivan.petrov"
          disabled={submitting}
          className={inputClass}
          {...form.register("login")}
        />
        {form.formState.errors.login && (
          <p className="text-xs text-destructive">
            {form.formState.errors.login.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="reg-password"
          className="text-sm font-medium text-foreground"
        >
          Пароль
        </label>
        <input
          id="reg-password"
          type="password"
          autoComplete="new-password"
          placeholder="не короче 6 символов"
          disabled={submitting}
          className={inputClass}
          {...form.register("password")}
        />
        {form.formState.errors.password && (
          <p className="text-xs text-destructive">
            {form.formState.errors.password.message}
          </p>
        )}
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <Button
        type="submit"
        size="lg"
        variant="default"
        disabled={submitting}
        className="w-full gap-2 rounded-full bg-foreground text-base font-medium text-background hover:bg-foreground/90"
      >
        {submitting ? "Создаём аккаунт..." : "Зарегистрироваться"}
        {!submitting && <ArrowRight className="h-5 w-5" />}
      </Button>
    </form>
  );
}
