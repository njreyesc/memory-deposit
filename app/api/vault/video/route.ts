import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "videos";
const MAX_BYTES = 20 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function extFromMime(mime: string): "mp4" | "webm" {
  return mime.includes("mp4") ? "mp4" : "webm";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const entry = form.get("video");
  if (!(entry instanceof Blob)) {
    return NextResponse.json({ error: "Missing video file" }, { status: 400 });
  }

  if (entry.size === 0) {
    return NextResponse.json({ error: "Empty video" }, { status: 400 });
  }
  if (entry.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Video exceeds 20 MB" },
      { status: 413 }
    );
  }

  const ext = extFromMime(entry.type || "video/webm");
  const path = `${user.id}/main.${ext}`;
  const contentType = entry.type || `video/${ext}`;

  const { data: existing } = await supabase
    .from("vault_items")
    .select("id, video_path")
    .eq("owner_id", user.id)
    .eq("type", "video")
    .maybeSingle();

  if (existing?.video_path && existing.video_path !== path) {
    await supabase.storage.from(BUCKET).remove([existing.video_path]);
  }

  const bytes = new Uint8Array(await entry.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true });

  if (uploadError) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  let rowId: string;
  let createdAt: string;

  if (existing?.id) {
    const { data, error } = await supabase
      .from("vault_items")
      .update({ video_path: path, name: `main.${ext}` })
      .eq("id", existing.id)
      .select("id, created_at")
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Update failed" },
        { status: 500 }
      );
    }
    rowId = data.id as string;
    createdAt = data.created_at as string;
  } else {
    const { data, error } = await supabase
      .from("vault_items")
      .insert({
        owner_id: user.id,
        type: "video",
        name: `main.${ext}`,
        video_path: path,
      })
      .select("id, created_at")
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Insert failed" },
        { status: 500 }
      );
    }
    rowId = data.id as string;
    createdAt = data.created_at as string;
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed) {
    return NextResponse.json(
      { error: `Sign URL failed: ${signError?.message ?? "unknown"}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    id: rowId,
    signedUrl: signed.signedUrl,
    createdAt,
  });
}

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
