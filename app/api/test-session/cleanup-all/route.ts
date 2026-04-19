import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanupSession } from "@/lib/test-sessions/cleanup";

export const runtime = "nodejs";

interface FailedEntry {
  session_token: string;
  error: string;
}

export async function POST(request: Request) {
  const expectedKey = process.env.ADMIN_CLEANUP_KEY;
  if (!expectedKey) {
    return NextResponse.json(
      { error: "server not configured" },
      { status: 500 }
    );
  }

  const providedKey = request.headers.get("x-admin-key");
  if (!providedKey || providedKey !== expectedKey) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const expiredQuery = await admin
    .from("test_sessions")
    .select("session_token")
    .lt("expires_at", new Date().toISOString());

  if (expiredQuery.error) {
    return NextResponse.json(
      { error: "cleanup failed", detail: expiredQuery.error.message },
      { status: 500 }
    );
  }

  const tokens = ((expiredQuery.data ?? []) as { session_token: string }[]).map(
    (r) => r.session_token
  );

  const failed: FailedEntry[] = [];
  let succeeded = 0;

  for (const token of tokens) {
    try {
      await cleanupSession(token);
      succeeded += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      console.error(`cleanup-all: cleanupSession(${token}) failed: ${msg}`);
      failed.push({ session_token: token, error: msg });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: tokens.length,
    succeeded,
    failed,
  });
}
