import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "videos";

// Upload is done client-side directly to Supabase Storage — Vercel
// serverless functions cap request bodies at ~4.5 MB, which we'd hit on
// any reasonable webm recording.

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: row } = await supabase
    .from("vault_items")
    .select("id, video_path")
    .eq("owner_id", user.id)
    .eq("type", "video")
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ ok: true });
  }

  if (row.video_path) {
    const { error: removeError } = await supabase.storage
      .from(BUCKET)
      .remove([row.video_path as string]);
    if (removeError) {
      return NextResponse.json(
        { error: `Storage delete failed: ${removeError.message}` },
        { status: 500 }
      );
    }
  }

  const { error: dbError } = await supabase
    .from("vault_items")
    .delete()
    .eq("id", row.id);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
