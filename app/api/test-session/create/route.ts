import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// shared test-contour password, not a secret
const TEST_PASSWORD = "demo123456";

const bodySchema = z.object({
  testName: z
    .string()
    .trim()
    .min(1, "testName is required")
    .max(60, "testName is required"),
});

type RequestBody = z.infer<typeof bodySchema>;

export async function POST(request: Request) {
  let parsed: RequestBody;
  try {
    const raw = (await request.json()) as unknown;
    parsed = bodySchema.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "testName is required" },
      { status: 400 }
    );
  }

  const { testName } = parsed;
  const sessionId = crypto.randomUUID();
  const sessionToken = `test_${sessionId}`;
  const alexeyEmail = `test-${sessionId}-alexey@test.local`;
  const mariaEmail = `test-${sessionId}-maria@test.local`;
  const alexeyFullName = testName;
  const mariaFullName = "Мария Иванова";

  const admin = createAdminClient();

  let alexeyAuthId: string | null = null;
  let mariaAuthId: string | null = null;

  // Best-effort unwind of whatever we managed to create so far.
  // test_sessions.breadwinner_user_id / recipient_user_id reference users(id)
  // with default NO ACTION, and users.test_session_id references
  // test_sessions(id) ON DELETE CASCADE — so test_sessions must be deleted
  // BEFORE the users rows it points to.
  const rollback = async () => {
    if (alexeyAuthId && mariaAuthId) {
      await admin
        .from("recipients")
        .delete()
        .eq("owner_id", alexeyAuthId);
    }
    await admin.from("test_sessions").delete().eq("id", sessionId);
    if (alexeyAuthId) {
      await admin.from("users").delete().eq("id", alexeyAuthId);
      await admin.auth.admin.deleteUser(alexeyAuthId);
    }
    if (mariaAuthId) {
      await admin.from("users").delete().eq("id", mariaAuthId);
      await admin.auth.admin.deleteUser(mariaAuthId);
    }
  };

  const fail = async (detail: string) => {
    await rollback();
    return NextResponse.json(
      { error: "failed to create test session", detail },
      { status: 500 }
    );
  };

  try {
    const alexeyAuth = await admin.auth.admin.createUser({
      email: alexeyEmail,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (alexeyAuth.error || !alexeyAuth.data.user) {
      return await fail(
        `createUser(alexey): ${alexeyAuth.error?.message ?? "no user"}`
      );
    }
    alexeyAuthId = alexeyAuth.data.user.id;

    const mariaAuth = await admin.auth.admin.createUser({
      email: mariaEmail,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (mariaAuth.error || !mariaAuth.data.user) {
      return await fail(
        `createUser(maria): ${mariaAuth.error?.message ?? "no user"}`
      );
    }
    mariaAuthId = mariaAuth.data.user.id;

    // users.test_session_id FK and test_sessions.breadwinner/recipient_user_id FK
    // form a cycle; insert users first without test_session_id, then link after.
    const usersInsert = await admin.from("users").insert([
      {
        id: alexeyAuthId,
        role: "breadwinner",
        full_name: alexeyFullName,
        email: alexeyEmail,
        is_test_user: true,
      },
      {
        id: mariaAuthId,
        role: "recipient",
        full_name: mariaFullName,
        email: mariaEmail,
        is_test_user: true,
      },
    ]);
    if (usersInsert.error) {
      return await fail(`insert users: ${usersInsert.error.message}`);
    }

    const sessionInsert = await admin.from("test_sessions").insert({
      id: sessionId,
      test_name: testName,
      breadwinner_user_id: alexeyAuthId,
      recipient_user_id: mariaAuthId,
      session_token: sessionToken,
    });
    if (sessionInsert.error) {
      return await fail(
        `insert test_sessions: ${sessionInsert.error.message}`
      );
    }

    const usersLink = await admin
      .from("users")
      .update({ test_session_id: sessionId })
      .in("id", [alexeyAuthId, mariaAuthId]);
    if (usersLink.error) {
      return await fail(`link users: ${usersLink.error.message}`);
    }

    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const signIn = await anonClient.auth.signInWithPassword({
      email: alexeyEmail,
      password: TEST_PASSWORD,
    });
    if (signIn.error || !signIn.data.session) {
      return await fail(
        `signIn(alexey): ${signIn.error?.message ?? "no session"}`
      );
    }

    return NextResponse.json({
      session_token: sessionToken,
      access_token: signIn.data.session.access_token,
      refresh_token: signIn.data.session.refresh_token,
      user: {
        id: alexeyAuthId,
        role: "breadwinner" as const,
        full_name: alexeyFullName,
        test_session_id: sessionId,
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    return await fail(detail);
  }
}
