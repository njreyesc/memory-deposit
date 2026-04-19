import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_USERS, DEMO_PASSWORD, type DemoRole } from "@/lib/auth/demo-users";

// must match test-session create route
const TEST_PASSWORD = "demo123456";

/**
 * Mock login for the demo prototype.
 *
 * Approach: signInWithPassword with a pre-set demo password.
 * Chosen over generateLink/magiclink because it's a single step —
 * no token extraction or verifyOtp round-trip needed.
 * The password is hardcoded and visible — acceptable for a demo,
 * never for production.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const role = body.role as DemoRole;
    const rawToken: unknown = body.sessionToken;
    const sessionToken =
      typeof rawToken === "string" && rawToken.length > 0 ? rawToken : undefined;

    if (sessionToken) {
      return await loginTestSession(role, sessionToken);
    }

    if (!role || !(role in DEMO_USERS)) {
      return NextResponse.json(
        { error: "Invalid role. Use 'alexey' or 'maria'." },
        { status: 400 }
      );
    }

    const demoUser = DEMO_USERS[role];
    const admin = createAdminClient();

    // Ensure auth user exists (idempotent — skips if already created)
    const { data: existing } = await admin.auth.admin.getUserById(demoUser.id);
    if (!existing.user) {
      const { error: createError } = await admin.auth.admin.createUser({
        id: demoUser.id,
        email: demoUser.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: demoUser.full_name,
          role: demoUser.role,
        },
      });
      if (createError) {
        return NextResponse.json(
          { error: `Failed to create auth user: ${createError.message}` },
          { status: 500 }
        );
      }
    }

    // Sign in with a plain anon client to get tokens
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: signInData, error: signInError } =
      await anonClient.auth.signInWithPassword({
        email: demoUser.email,
        password: DEMO_PASSWORD,
      });

    if (signInError || !signInData.session) {
      return NextResponse.json(
        { error: `Sign-in failed: ${signInError?.message ?? "no session"}` },
        { status: 500 }
      );
    }

    // Audit log
    await admin.from("audit_log").insert({
      actor_id: demoUser.id,
      action: "mock_login",
      meta: { role },
    });

    return NextResponse.json({
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
      user: signInData.user,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function loginTestSession(role: DemoRole, sessionToken: string) {
  // Match demo-branch behavior for an invalid role value.
  if (!role || !(role in DEMO_USERS)) {
    return NextResponse.json(
      { error: "Invalid role. Use 'alexey' or 'maria'." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: sessionRow, error: sessionError } = await admin
    .from("test_sessions")
    .select("breadwinner_user_id, recipient_user_id, cleaned_up, expires_at")
    .eq("session_token", sessionToken)
    .maybeSingle();

  if (
    sessionError ||
    !sessionRow ||
    sessionRow.cleaned_up === true ||
    new Date(sessionRow.expires_at).getTime() < Date.now()
  ) {
    return NextResponse.json(
      { error: "invalid or expired test session" },
      { status: 401 }
    );
  }

  const targetAuthId: string =
    role === "alexey"
      ? sessionRow.breadwinner_user_id
      : sessionRow.recipient_user_id;

  // Pull email from auth.users, not public.users — avoids any drift and
  // doesn't depend on the email column being populated there.
  const { data: authUser, error: getUserError } =
    await admin.auth.admin.getUserById(targetAuthId);
  if (getUserError || !authUser.user || !authUser.user.email) {
    return NextResponse.json(
      {
        error: `Failed to load test auth user: ${
          getUserError?.message ?? "no user or empty email"
        }`,
      },
      { status: 500 }
    );
  }
  const email = authUser.user.email;

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: signInData, error: signInError } =
    await anonClient.auth.signInWithPassword({
      email,
      password: TEST_PASSWORD,
    });

  if (signInError || !signInData.session) {
    return NextResponse.json(
      { error: `Sign-in failed: ${signInError?.message ?? "no session"}` },
      { status: 500 }
    );
  }

  const response = NextResponse.json({
    access_token: signInData.session.access_token,
    refresh_token: signInData.session.refresh_token,
    user: signInData.user,
  });

  response.cookies.set({
    name: "test_session_token",
    value: sessionToken,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24,
  });

  return response;
}
