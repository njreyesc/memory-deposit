import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TestSessionInfo } from "@/components/sber/role-switcher";

/**
 * Resolves the active test session for the current user, if any.
 * Reads `test_session_token` cookie, validates against test_sessions
 * (service-role — RLS allows only service_role per 0007), and ensures
 * the caller actually belongs to that session.
 * Returns undefined on anything stale, expired, cleaned up, or mismatched.
 */
export async function resolveTestSession(
  currentUserId: string
): Promise<TestSessionInfo | undefined> {
  const cookieStore = await cookies();
  const token = cookieStore.get("test_session_token")?.value;
  if (!token) return undefined;

  const admin = createAdminClient();
  const { data: sess } = await admin
    .from("test_sessions")
    .select("breadwinner_user_id, recipient_user_id, cleaned_up, expires_at")
    .eq("session_token", token)
    .maybeSingle();

  if (
    !sess ||
    sess.cleaned_up === true ||
    new Date(sess.expires_at) <= new Date() ||
    (currentUserId !== sess.breadwinner_user_id &&
      currentUserId !== sess.recipient_user_id)
  ) {
    return undefined;
  }

  const { data: testUsers } = await admin
    .from("users")
    .select("id, full_name")
    .in("id", [sess.breadwinner_user_id, sess.recipient_user_id]);

  const b = testUsers?.find((u) => u.id === sess.breadwinner_user_id);
  const m = testUsers?.find((u) => u.id === sess.recipient_user_id);
  if (!b || !m) return undefined;

  return {
    token,
    breadwinnerUserId: sess.breadwinner_user_id,
    recipientUserId: sess.recipient_user_id,
    breadwinnerName: b.full_name,
    recipientName: m.full_name,
  };
}
