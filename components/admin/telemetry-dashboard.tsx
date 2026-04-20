import { SCENE_LABELS, type SceneId } from "@/lib/telemetry/scenes";

export interface TelemetryKpis {
  totalEvents: number;
  sessions: number;
  users: number;
  onboardingEnter: number;
  onboardingCompleted: number;
  avgSessionMs: number;
}

export interface FunnelStep {
  step: number;
  label: string;
  sessions: number;
}

export interface SceneStat {
  scene: string;
  avg_ms: number;
  visits: number;
}

export interface TopEvent {
  event_name: string;
  total: number;
}

export interface SessionRow {
  session_id: string;
  start_at: string;
  end_at: string;
  events: number;
  user_id: string | null;
  user_name: string | null;
  reached_trigger: boolean;
}

const STEP_LABELS: Record<string, string> = {
  session_start: "Запустил прототип",
  onboarding_enter: "Пришёл на онбординг",
  onboarding_completed: "Завершил онбординг",
  vault_enter: "Дошёл до vault",
  letter_saved: "Сохранил письмо",
  video_sealed: "Сохранил видео",
  finance_opened: "Открыл финансовую карту",
  assistant_opened: "Открыл ассистента",
  trigger_simulated: "Подтвердил событие",
};

function formatMs(ms: number): string {
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total}с`;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}м ${s.toString().padStart(2, "0")}с`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${day}.${month} ${hh}:${mm}`;
}

export function TelemetryDashboard({
  kpis,
  funnel,
  sceneTime,
  topEvents,
  sessions,
}: {
  kpis: TelemetryKpis;
  funnel: FunnelStep[];
  sceneTime: SceneStat[];
  topEvents: TopEvent[];
  sessions: SessionRow[];
}) {
  const funnelBase = funnel.find((s) => s.step === 1)?.sessions ?? 0;
  const sceneMaxMs = Math.max(1, ...sceneTime.map((s) => s.avg_ms));
  const topMax = Math.max(1, ...topEvents.map((e) => e.total));

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Сессий"
          value={kpis.sessions}
          hint="уникальные браузеры × 30 мин"
        />
        <KpiCard
          label="Событий"
          value={kpis.totalEvents}
          hint={`от ${kpis.users} пользователей`}
        />
        <KpiCard
          label="Средняя сессия"
          value={kpis.sessions > 0 ? formatMs(kpis.avgSessionMs) : "—"}
          hint="от первого до последнего события"
        />
        <KpiCard
          label="Завершили онбординг"
          value={`${kpis.onboardingCompleted} / ${kpis.sessions}`}
          hint={
            kpis.onboardingEnter > 0
              ? `${kpis.onboardingCompleted} из ${kpis.onboardingEnter} пришедших`
              : "онбординг пока никто не открывал"
          }
        />
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Воронка пользователя
        </p>
        <h2 className="mt-1 font-heading text-xl font-medium">
          От запуска до подтверждённого события
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Считаются уникальные сессии, дошедшие до каждого шага.
        </p>
        <ol className="mt-4 space-y-3">
          {funnel.map((step, idx) => {
            const pct = funnelBase > 0 ? (step.sessions / funnelBase) * 100 : 0;
            const prev = idx > 0 ? funnel[idx - 1].sessions : step.sessions;
            const drop =
              idx > 0 && prev > 0
                ? Math.round(((prev - step.sessions) / prev) * 100)
                : 0;
            const barColor =
              idx === 0
                ? "var(--moss)"
                : pct >= 50
                ? "var(--primary)"
                : "var(--ember)";
            return (
              <li key={step.step} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">
                    {STEP_LABELS[step.label] ?? step.label}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {step.sessions} · {pct.toFixed(0)}%
                    {idx > 0 && drop > 0 && (
                      <span
                        className="ml-2 tabular-nums"
                        style={{ color: "var(--ember)" }}
                      >
                        −{drop}%
                      </span>
                    )}
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full"
                  style={{ backgroundColor: "color-mix(in srgb, var(--muted) 70%, transparent)" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(2, pct)}%`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-5">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Время по сценам
          </p>
          <h2 className="mt-1 font-heading text-xl font-medium">
            Где задерживаются
          </h2>
          {sceneTime.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Пока нет завершённых посещений сцен.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {sceneTime.map((s) => {
                const label =
                  SCENE_LABELS[s.scene as SceneId] ?? s.scene;
                const pct = (s.avg_ms / sceneMaxMs) * 100;
                return (
                  <li key={s.scene} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatMs(s.avg_ms)} · {s.visits} визит
                        {s.visits === 1 ? "" : s.visits < 5 ? "а" : "ов"}
                      </span>
                    </div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full"
                      style={{ backgroundColor: "color-mix(in srgb, var(--muted) 70%, transparent)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(4, pct)}%`,
                          backgroundColor: "var(--primary)",
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Что жмут чаще всего
          </p>
          <h2 className="mt-1 font-heading text-xl font-medium">
            Топ-10 событий
          </h2>
          {topEvents.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Событий ещё нет.
            </p>
          ) : (
            <ol className="mt-4 space-y-2 font-mono text-xs">
              {topEvents.map((e, i) => {
                const pct = (e.total / topMax) * 100;
                return (
                  <li key={e.event_name} className="space-y-1">
                    <div className="flex justify-between">
                      <span>
                        {String(i + 1).padStart(2, "0")} {e.event_name}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        ×{e.total}
                      </span>
                    </div>
                    <div
                      className="h-1 overflow-hidden rounded-full"
                      style={{ backgroundColor: "color-mix(in srgb, var(--muted) 70%, transparent)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(4, pct)}%`,
                          backgroundColor: "color-mix(in srgb, var(--primary) 70%, var(--muted))",
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Таблица сессий
        </p>
        <h2 className="mt-1 font-heading text-xl font-medium">
          Сессии тестеров
        </h2>
        {sessions.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Сессий пока нет — пройдите сценарий, чтобы наполнить данные.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4 font-medium">Session</th>
                  <th className="pb-2 pr-4 font-medium">Начало</th>
                  <th className="pb-2 pr-4 font-medium">Длительность</th>
                  <th className="pb-2 pr-4 font-medium">События</th>
                  <th className="pb-2 pr-4 font-medium">Имя</th>
                  <th className="pb-2 pr-4 font-medium">User</th>
                  <th className="pb-2 font-medium">Trigger</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const duration =
                    new Date(s.end_at).getTime() -
                    new Date(s.start_at).getTime();
                  return (
                    <tr
                      key={s.session_id}
                      className="border-b border-border/40 last:border-0"
                    >
                      <td className="py-2 pr-4 font-mono text-xs">
                        {s.session_id.slice(0, 8)}
                      </td>
                      <td className="py-2 pr-4 tabular-nums">
                        {formatDate(s.start_at)}
                      </td>
                      <td className="py-2 pr-4 tabular-nums">
                        {formatMs(duration)}
                      </td>
                      <td className="py-2 pr-4 tabular-nums">{s.events}</td>
                      <td className="py-2 pr-4">
                        {s.user_name ? (
                          s.user_name
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                        {s.user_id ? s.user_id.slice(0, 8) : "—"}
                      </td>
                      <td className="py-2">
                        {s.reached_trigger ? (
                          <span style={{ color: "var(--moss)" }}>да</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
