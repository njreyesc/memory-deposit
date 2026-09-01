import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loginToEmail,
  LOGIN_PATTERN,
  LOGIN_RULE_MESSAGE,
} from "@/lib/auth/login-identity";

export const runtime = "nodejs";

/**
 * Public self-registration for the demo: attendees scan a QR code and get
 * their own empty vault.
 *
 * Done server-side with the service role rather than a plain
 * supabase.auth.signUp for two reasons:
 *  - the project requires email confirmation, and a demo cannot wait for
 *    someone to open their inbox — the user is created pre-confirmed;
 *  - public.users has no INSERT policy, so the profile row (which the app
 *    needs to resolve a role) can only be written with the service role.
 *    Without it the user lands in an empty recipient view instead of a vault.
 *
 * The role is pinned to 'breadwinner' here and never taken from the request —
 * every registrant gets their own vault and nothing else.
 */

const bodySchema = z.object({
  login: z
    .string()
    .trim()
    .min(1, "Введите логин")
    .regex(LOGIN_PATTERN, LOGIN_RULE_MESSAGE),
  password: z.string().min(6, "Пароль не короче 6 символов").max(72),
});

export async function POST(request: Request) {
  let parsed: z.infer<typeof bodySchema>;
  try {
    const raw = (await request.json()) as Record<string, unknown> | null;
    // Default missing fields to "" so the schema reports the friendly
    // "Введите логин" instead of Zod's raw "expected string, received undefined".
    parsed = bodySchema.parse({
      login: raw?.login ?? "",
      password: raw?.password ?? "",
    });
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? "Проверьте поля формы")
        : "Проверьте поля формы";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { login, password } = parsed;
  // The address is internal only — the visitor never sees or types it.
  const email = loginToEmail(login);
  const admin = createAdminClient();

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: login },
  });

  if (created.error || !created.data.user) {
    const raw = created.error?.message ?? "не удалось создать пользователя";
    // Supabase reports an existing address as "already been registered".
    const alreadyExists = /already|exists|registered/i.test(raw);
    return NextResponse.json(
      {
        error: alreadyExists
          ? "Этот логин уже занят — войдите с паролем"
          : `Не удалось зарегистрировать: ${raw}`,
      },
      { status: alreadyExists ? 409 : 500 }
    );
  }

  const authId = created.data.user.id;

  const profile = await admin.from("users").insert({
    id: authId,
    role: "breadwinner",
    full_name: login,
    email,
  });

  if (profile.error) {
    // Roll the auth user back — a user without a profile row cannot use the
    // app and would block a retry with the same address.
    await admin.auth.admin.deleteUser(authId);
    return NextResponse.json(
      { error: `Не удалось создать профиль: ${profile.error.message}` },
      { status: 500 }
    );
  }

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const signIn = await anonClient.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) {
    // Account exists and is usable — only the automatic sign-in failed.
    return NextResponse.json(
      { error: "Аккаунт создан, но войти не удалось. Попробуйте войти вручную." },
      { status: 500 }
    );
  }

  await admin.from("audit_log").insert({
    actor_id: authId,
    action: "self_register",
    meta: { source: "public_form" },
  });

  return NextResponse.json({
    access_token: signIn.data.session.access_token,
    refresh_token: signIn.data.session.refresh_token,
  });
}
