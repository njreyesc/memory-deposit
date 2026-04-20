import { createClient } from "@/lib/supabase/server";
import { SimulateActions } from "@/components/admin/simulate-actions";
import { SceneTracker } from "@/components/telemetry/scene-tracker";

interface Stats {
  notes: number;
  video: number;
  recipients: number;
  activeTriggers: number;
  deliveredTrigger: boolean;
}

export default async function SimulatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Layout already guarded for auth + role; user is Alexey here.
  const ownerId = user!.id;

  const [notesRes, videoRes, recipientsRes, triggersRes] = await Promise.all([
    supabase
      .from("vault_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("type", "note"),
    supabase
      .from("vault_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("type", "video"),
    supabase
      .from("recipients")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId),
    supabase
      .from("triggers")
      .select("id, status")
      .eq("owner_id", ownerId),
  ]);

  const triggers = (triggersRes.data ?? []) as { id: string; status: string }[];
  const stats: Stats = {
    notes: notesRes.count ?? 0,
    video: videoRes.count ?? 0,
    recipients: recipientsRes.count ?? 0,
    activeTriggers: triggers.length,
    deliveredTrigger: triggers.some((t) => t.status === "delivered"),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <SceneTracker scene="simulate" />
      <div>
        <h1 className="text-2xl font-bold">Админ-панель (демо)</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Только для демонстрации. В продакшне эти действия выполняются
          автоматически через интеграцию с СМЭВ/ЗАГС.
        </p>
      </div>

      <section className="rounded-lg border border-white/10 bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Текущий статус
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Counter label="Писем" value={stats.notes} />
          <Counter label="Видео" value={stats.video} />
          <Counter label="Получателей" value={stats.recipients} />
          <Counter label="Триггеров" value={stats.activeTriggers} />
        </div>
        {stats.deliveredTrigger && (
          <p className="mt-4 rounded-md border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
            Событие уже подтверждено. Сбросьте демо для нового сценария.
          </p>
        )}
      </section>

      <SimulateActions
        alreadyDelivered={stats.deliveredTrigger}
        hasData={
          stats.notes + stats.video + stats.recipients + stats.activeTriggers >
          0
        }
      />
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/10 bg-background/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
