import { createAdminClient } from "@/lib/supabase/admin";
import {
  TelemetryDashboard,
  type ExtraMilestone,
  type FunnelStep,
  type SceneStat,
  type SessionRow,
  type TelemetryKpis,
  type TopEvent,
} from "@/components/admin/telemetry-dashboard";
import {
  TelemetryExport,
  type TelemetryRowExport,
} from "@/components/admin/telemetry-export";

// Публичный дашборд. Чтение идёт через service-role (обход RLS),
// поэтому страница доступна без auth и без проверки роли.
export const dynamic = "force-dynamic";

interface RawRow {
  id: string;
  created_at: string;
  session_id: string;
  user_id: string | null;
  event_name: string;
  scene: string | null;
  props: unknown;
  path: string | null;
}

const RAW_LIMIT = 2000;

export default async function TelemetryPage() {
  const supabase = createAdminClient();

  const [
    totalRes,
    rawRes,
    funnelRes,
    sceneTimeRes,
    topEventsRes,
  ] = await Promise.all([
    supabase
      .from("telemetry_events")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("telemetry_events")
      .select("id, created_at, session_id, user_id, event_name, scene, props, path")
      .order("created_at", { ascending: false })
      .limit(RAW_LIMIT),
    supabase.rpc("telemetry_funnel"),
    supabase.rpc("telemetry_scene_time"),
    supabase.rpc("telemetry_top_events", { top_n: 10 }),
  ]);

  const totalEvents = totalRes.count ?? 0;
  const raw = (rawRes.data ?? []) as RawRow[];
  const funnel = (funnelRes.data ?? []) as FunnelStep[];
  const sceneTime = (sceneTimeRes.data ?? []) as SceneStat[];
  const topEvents = (topEventsRes.data ?? []) as TopEvent[];

  const rawError =
    totalRes.error ||
    rawRes.error ||
    funnelRes.error ||
    sceneTimeRes.error ||
    topEventsRes.error;

  const sessionsMap = new Map<
    string,
    {
      session_id: string;
      start: number;
      end: number;
      events: number;
      user_id: string | null;
      reached_trigger: boolean;
    }
  >();
  const uniqueUsers = new Set<string>();
  let onboardingEnter = 0;
  let onboardingCompleted = 0;
  const onboardingEnterSessions = new Set<string>();
  const onboardingCompletedSessions = new Set<string>();
  const financeSessions = new Set<string>();
  const assistantSessions = new Set<string>();

  for (const row of raw) {
    const ts = new Date(row.created_at).getTime();
    const prev = sessionsMap.get(row.session_id);
    if (prev) {
      prev.start = Math.min(prev.start, ts);
      prev.end = Math.max(prev.end, ts);
      prev.events += 1;
      if (!prev.user_id && row.user_id) prev.user_id = row.user_id;
      if (row.event_name === "trigger_simulated") prev.reached_trigger = true;
    } else {
      sessionsMap.set(row.session_id, {
        session_id: row.session_id,
        start: ts,
        end: ts,
        events: 1,
        user_id: row.user_id,
        reached_trigger: row.event_name === "trigger_simulated",
      });
    }
    if (row.user_id) uniqueUsers.add(row.user_id);
    if (row.event_name === "scene_enter" && row.scene === "onboarding") {
      if (!onboardingEnterSessions.has(row.session_id)) {
        onboardingEnterSessions.add(row.session_id);
        onboardingEnter += 1;
      }
    }
    if (row.event_name === "onboarding_completed") {
      if (!onboardingCompletedSessions.has(row.session_id)) {
        onboardingCompletedSessions.add(row.session_id);
        onboardingCompleted += 1;
      }
    }
    if (row.event_name === "scene_enter" && row.scene === "finance") {
      financeSessions.add(row.session_id);
    }
    if (row.event_name === "ai_opened") {
      assistantSessions.add(row.session_id);
    }
  }

  const sessions: SessionRow[] = Array.from(sessionsMap.values())
    .sort((a, b) => b.end - a.end)
    .slice(0, 50)
    .map((s) => ({
      session_id: s.session_id,
      start_at: new Date(s.start).toISOString(),
      end_at: new Date(s.end).toISOString(),
      events: s.events,
      user_id: s.user_id,
      reached_trigger: s.reached_trigger,
    }));

  const allSessions = Array.from(sessionsMap.values());
  const avgSessionMs =
    allSessions.length > 0
      ? Math.round(
          allSessions.reduce((acc, s) => acc + (s.end - s.start), 0) /
            allSessions.length
        )
      : 0;

  const kpis: TelemetryKpis = {
    totalEvents,
    sessions: sessionsMap.size,
    users: uniqueUsers.size,
    onboardingEnter,
    onboardingCompleted,
    avgSessionMs,
  };

  const extras: ExtraMilestone[] = [
    {
      key: "finance_opened",
      label: "Открыл финансовую карту",
      sessions: financeSessions.size,
    },
    {
      key: "assistant_opened",
      label: "Открыл ассистента",
      sessions: assistantSessions.size,
    },
  ];

  const exportRows: TelemetryRowExport[] = raw.map((r) => ({
    id: r.id,
    created_at: r.created_at,
    session_id: r.session_id,
    user_id: r.user_id,
    event_name: r.event_name,
    scene: r.scene,
    props: r.props,
    path: r.path,
  }));

  return (
    <div className="telemetry-paper min-h-screen p-6 md:p-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Телеметрия
            </p>
            <h1 className="mt-2 font-heading text-3xl font-medium leading-tight tracking-tight md:text-4xl">
              Что происходит у тестеров
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Поведенческие метрики тестеров прототипа — без содержимого писем
              и личных данных, только длины, enum-выборы и длительности.
            </p>
          </div>
          <TelemetryExport rows={exportRows} />
        </div>

        {rawError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Ошибка загрузки: {rawError.message}
          </div>
        )}

        <TelemetryDashboard
          kpis={kpis}
          funnel={funnel}
          extras={extras}
          sceneTime={sceneTime}
          topEvents={topEvents}
          sessions={sessions}
        />
      </div>
    </div>
  );
}
