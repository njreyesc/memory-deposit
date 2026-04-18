import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEMO_USERS } from "@/lib/auth/demo-users";
import { NotesSection, type Note } from "@/components/vault/notes-section";
import {
  VideoSection,
  type VideoItem,
} from "@/components/vault/video-section";
import type {
  AccessRule,
  Recipient,
} from "@/components/vault/access-rules-dialog";

const VIDEO_BUCKET = "videos";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export default async function VaultPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const isAlexey = user.id === DEMO_USERS.alexey.id;

  if (!isAlexey) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Хранилище</h1>
        <div className="mt-6 rounded-lg border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
          Материалы будут доступны после подтверждения события.
        </div>
      </div>
    );
  }

  const [notesRes, videoRes, recipientsRes, rulesRes] = await Promise.all([
    supabase
      .from("vault_items")
      .select("id, title, content, created_at")
      .eq("owner_id", user.id)
      .eq("type", "note")
      .order("created_at", { ascending: false }),
    supabase
      .from("vault_items")
      .select("id, video_path, created_at")
      .eq("owner_id", user.id)
      .eq("type", "video")
      .maybeSingle(),
    supabase
      .from("recipients")
      .select("id, full_name, relation")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("access_rules")
      .select("id, vault_item_id, recipient_id, delay_days"),
  ]);

  if (notesRes.error) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Хранилище</h1>
        <p className="text-sm text-destructive">
          Не удалось загрузить письма: {notesRes.error.message}
        </p>
      </div>
    );
  }

  const notes = (notesRes.data ?? []) as Note[];
  const recipients = (recipientsRes.data ?? []) as Recipient[];
  const allRules = (rulesRes.data ?? []) as AccessRule[];

  const rulesByItem: Record<string, AccessRule[]> = {};
  for (const rule of allRules) {
    (rulesByItem[rule.vault_item_id] ??= []).push(rule);
  }

  let initialVideo: VideoItem | null = null;
  const videoRow = videoRes.data as
    | { id: string; video_path: string | null; created_at: string }
    | null;

  if (videoRow?.video_path) {
    const { data: signed } = await supabase.storage
      .from(VIDEO_BUCKET)
      .createSignedUrl(videoRow.video_path, SIGNED_URL_TTL_SECONDS);

    if (signed?.signedUrl) {
      initialVideo = {
        id: videoRow.id,
        signedUrl: signed.signedUrl,
        createdAt: videoRow.created_at,
      };
    }
  }

  const videoRules = initialVideo ? rulesByItem[initialVideo.id] ?? [] : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Хранилище</h1>
        <p className="text-sm text-muted-foreground">
          Видеообращение, письма и заметки для близких
        </p>
      </div>
      <VideoSection
        initialVideo={initialVideo}
        recipients={recipients}
        initialRules={videoRules}
      />
      <NotesSection
        ownerId={user.id}
        initialNotes={notes}
        recipients={recipients}
        initialRulesByItem={rulesByItem}
      />
    </div>
  );
}
