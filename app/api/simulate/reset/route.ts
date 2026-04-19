import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_USERS } from "@/lib/auth/demo-users";
import { isBreadwinner } from "@/lib/auth/current-role";

const VIDEO_BUCKET = "videos";
const MARIA_RECIPIENT_SEED_ID = "33333333-3333-3333-3333-333333333333";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isBreadwinner(supabase, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 1. Remove any video files from storage first (DB delete won't cascade there).
  const { data: videoRows } = await supabase
    .from("vault_items")
    .select("video_path")
    .eq("owner_id", user.id)
    .eq("type", "video");

  const videoPaths = ((videoRows ?? []) as { video_path: string | null }[])
    .map((r) => r.video_path)
    .filter((p): p is string => Boolean(p));

  if (videoPaths.length > 0) {
    await supabase.storage.from(VIDEO_BUCKET).remove(videoPaths);
  }

  // 2. Delete DB rows. access_rules cascade from both vault_items and recipients.
  const vaultDel = await supabase
    .from("vault_items")
    .delete()
    .eq("owner_id", user.id);
  if (vaultDel.error) {
    return NextResponse.json({ error: vaultDel.error.message }, { status: 500 });
  }

  const recipientsDel = await supabase
    .from("recipients")
    .delete()
    .eq("owner_id", user.id);
  if (recipientsDel.error) {
    return NextResponse.json(
      { error: recipientsDel.error.message },
      { status: 500 }
    );
  }

  const triggersDel = await supabase
    .from("triggers")
    .delete()
    .eq("owner_id", user.id);
  if (triggersDel.error) {
    return NextResponse.json(
      { error: triggersDel.error.message },
      { status: 500 }
    );
  }

  // 3. Re-seed the recipient so future access-rule edits have a target.
  // Demo seed uses the stable MARIA_RECIPIENT_SEED_ID (kept for backwards
  // compat with any fixture that references it); test sessions look up
  // their own paired recipient from test_sessions.
  const cookieStore = await cookies();
  const testToken = cookieStore.get("test_session_token")?.value;

  if (testToken) {
    const admin = createAdminClient();
    const { data: sess } = await admin
      .from("test_sessions")
      .select("recipient_user_id")
      .eq("session_token", testToken)
      .maybeSingle();

    if (!sess) {
      return NextResponse.json(
        { error: "test session not found" },
        { status: 400 }
      );
    }

    const { data: partnerRow } = await admin
      .from("users")
      .select("full_name")
      .eq("id", sess.recipient_user_id)
      .single();
    const partnerName = partnerRow?.full_name ?? "Получатель";

    const reseed = await supabase.from("recipients").insert({
      owner_id: user.id,
      full_name: partnerName,
      relation: "wife",
      user_id: sess.recipient_user_id,
    });
    if (reseed.error) {
      return NextResponse.json({ error: reseed.error.message }, { status: 500 });
    }
  } else {
    const reseed = await supabase.from("recipients").upsert({
      id: MARIA_RECIPIENT_SEED_ID,
      owner_id: user.id,
      full_name: "Мария Иванова",
      relation: "wife",
      user_id: DEMO_USERS.maria.id,
    });
    if (reseed.error) {
      return NextResponse.json({ error: reseed.error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
