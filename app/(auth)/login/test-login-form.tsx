"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const testLoginSchema = z.object({
  testName: z
    .string()
    .trim()
    .min(1, "Имя не может быть пустым")
    .max(60, "Не длиннее 60 символов"),
});

type TestLoginValues = z.infer<typeof testLoginSchema>;

interface TestSessionCreateResponse {
  session_token: string;
}

interface MockLoginResponse {
  access_token: string;
  refresh_token: string;
}

export default function TestLoginForm() {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<TestLoginValues>({
    resolver: zodResolver(testLoginSchema),
    defaultValues: { testName: "" },
  });

  async function onSubmit(values: TestLoginValues) {
    setSubmitting(true);
    setServerError(null);

    try {
      const sessionRes = await fetch("/api/test-session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testName: values.testName }),
      });

      if (!sessionRes.ok) {
        let message = "Не удалось создать сессию";
        try {
          const body = (await sessionRes.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          // ignore json parse failure, keep generic message
        }
        setServerError(message);
        setSubmitting(false);
        return;
      }

      const { session_token } =
        (await sessionRes.json()) as TestSessionCreateResponse;

      const loginRes = await fetch("/api/mock-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "alexey", sessionToken: session_token }),
      });

      if (!loginRes.ok) {
        setServerError("Не удалось залогинить тестовую сессию");
        setSubmitting(false);
        return;
      }

      const { access_token, refresh_token } =
        (await loginRes.json()) as MockLoginResponse;

      // Without this, supabase-ssr auth cookies stay unset on the client and
      // /vault's server component redirects back to /login. Demo login-form
      // does the same step (login-form.tsx).
      const supabase = createClient();
      await supabase.auth.setSession({ access_token, refresh_token });

      window.location.assign("/welcome");
    } catch {
      setServerError("Сетевая ошибка. Попробуйте ещё раз.");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 text-left">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Тестирование продукта</h2>
      </div>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-3"
        noValidate
      >
        <div className="space-y-1.5">
          <label
            htmlFor="testName"
            className="text-sm font-medium text-foreground"
          >
            Ваше имя
          </label>
          <input
            id="testName"
            type="text"
            autoComplete="off"
            placeholder="Иван Петров"
            disabled={submitting}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            {...form.register("testName")}
          />
          {form.formState.errors.testName && (
            <p className="text-xs text-destructive">
              {form.formState.errors.testName.message}
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
          {submitting ? "Создаём сессию..." : "Начать тестирование"}
          {!submitting && <ArrowRight className="h-5 w-5" />}
        </Button>
      </form>
    </div>
  );
}
