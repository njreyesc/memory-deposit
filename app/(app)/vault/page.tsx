import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isBreadwinner } from "@/lib/auth/current-role";
import { NotesSection, type Note } from "@/components/vault/notes-section";
import {
  VideoSection,
  type VideoItem,
} from "@/components/vault/video-section";
import type {
  AccessRule,
  Recipient,
} from "@/components/vault/access-rules-dialog";
import { EventStatusBanner } from "@/components/vault/event-status-banner";
import {
  RecipientView,
  type RecipientMaterial,
} from "@/components/vault/recipient-view";

const VIDEO_BUCKET = "videos";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

interface RecipientEventRow {
  owner_id: string;
  owner_full_name: string;
  confirmed_at: string;
}

interface RecipientMaterialRow {
  vault_item_id: string;
  item_type: "note" | "video";
  title: string | null;
  content: string | null;
  video_path: string | null;
  item_created_at: string;
  owner_id: string;
  owner_full_name: string;
  delay_days: number;
  confirmed_at: string;
  available_at: string;
  available_now: boolean;
}

export default async function VaultPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!(await isBreadwinner(supabase, user.id))) {
    return <RecipientVault />;
  }

  return <BreadwinnerVault userId={user.id} />;
}

// ============================================================
// Recipient (Maria) — emotional message screen post-event.
// ============================================================
async function RecipientVault() {
  const supabase = await createClient();

  const eventRes = await supabase.rpc("recipient_event_status");
  const eventRows = (eventRes.data ?? []) as RecipientEventRow[];

  if (eventRows.length === 0) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Хранилище</h1>
        <div className="mt-6 rounded-lg border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
          Материалы будут доступны после подтверждения события.
        </div>
      </div>
    );
  }

  const ownerFullName = eventRows[0].owner_full_name;

  const materialsRes = await supabase.rpc("get_recipient_materials");
  const rows = (materialsRes.data ?? []) as RecipientMaterialRow[];

  // Sign storage URLs server-side. Maria's user key cannot read Alexey's
  // storage folder directly; the admin client bypasses bucket RLS, which is
  // safe here because the RPC has already authorised access via auth.uid().
  const admin = createAdminClient();
  const materials: RecipientMaterial[] = await Promise.all(
    rows.map(async (row) => {
      let signedUrl: string | null = null;
      if (
        row.item_type === "video" &&
        row.available_now &&
        row.video_path
      ) {
        const { data: signed } = await admin.storage
          .from(VIDEO_BUCKET)
          .createSignedUrl(row.video_path, SIGNED_URL_TTL_SECONDS);
        signedUrl = signed?.signedUrl ?? null;
      }
      return {
        vault_item_id: row.vault_item_id,
        item_type: row.item_type,
        title: row.title,
        content: row.content,
        item_created_at: row.item_created_at,
        delay_days: row.delay_days,
        available_at: row.available_at,
        available_now: row.available_now,
        signed_url: signedUrl,
      };
    })
  );

  return <RecipientView ownerFullName={ownerFullName} materials={materials} />;
}

// ============================================================
// Breadwinner (Alexey) — own vault + post-event status banner.
// ============================================================
async function BreadwinnerVault({ userId }: { userId: string }) {
  const supabase = await createClient();

  const [notesRes, videoRes, recipientsRes, rulesRes, triggerRes] =
    await Promise.all([
      supabase
        .from("vault_items")
        .select("id, title, content, created_at")
        .eq("owner_id", userId)
        .eq("type", "note")
        .order("created_at", { ascending: false }),
      supabase
        .from("vault_items")
        .select("id, video_path, created_at")
        .eq("owner_id", userId)
        .eq("type", "video")
        .maybeSingle(),
      supabase
        .from("recipients")
        .select("id, full_name, relation")
        .eq("owner_id", userId)
        .order("created_at", { ascending: true }),
      supabase
        .from("access_rules")
        .select("id, vault_item_id, recipient_id, delay_days"),
      supabase
        .from("triggers")
        .select("confirmed_at")
        .eq("owner_id", userId)
        .eq("status", "delivered")
        .order("confirmed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
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
  const deliveredTrigger = triggerRes.data as
    | { confirmed_at: string | null }
    | null;

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
      {deliveredTrigger?.confirmed_at && (
        <EventStatusBanner confirmedAt={deliveredTrigger.confirmed_at} />
      )}
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
        ownerId={userId}
        initialNotes={notes}
        recipients={recipients}
        initialRulesByItem={rulesByItem}
      />
    </div>
  );
}
