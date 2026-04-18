import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEMO_USERS } from "@/lib/auth/demo-users";

const VIDEO_BUCKET = "videos";
const MARIA_RECIPIENT_SEED_ID = "33333333-3333-3333-3333-333333333333";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== DEMO_USERS.alexey.id) {
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

  // 3. Re-seed Maria as recipient of Alexey (stable UUID for future rules).
  const reseed = await supabase.from("recipients").upsert({
    id: MARIA_RECIPIENT_SEED_ID,
    owner_id: DEMO_USERS.alexey.id,
    full_name: "Мария Иванова",
    relation: "wife",
    user_id: DEMO_USERS.maria.id,
  });
  if (reseed.error) {
    return NextResponse.json({ error: reseed.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
