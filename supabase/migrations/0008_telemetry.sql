-- 0008_telemetry.sql
-- Встроенная продуктовая телеметрия прототипа: события сессий, навигации,
-- онбординга, создания писем и видео, подтверждения события СМЭВ/ЗАГС.
-- Пишет любой клиент (anon/authenticated), читает и чистит только breadwinner.

-- ============================================================
-- telemetry_events
-- ============================================================
create table telemetry_events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  session_id  text not null check (length(session_id) between 8 and 40),
  user_id     uuid references users(id) on delete set null,
  event_name  text not null,
  scene       text,
  props       jsonb not null default '{}'::jsonb,
  path        text,
  user_agent  text
);

create index idx_telemetry_events_created on telemetry_events(created_at desc);
create index idx_telemetry_events_event   on telemetry_events(event_name);
create index idx_telemetry_events_session on telemetry_events(session_id);
create index idx_telemetry_events_user    on telemetry_events(user_id);

alter table telemetry_events enable row level security;

-- INSERT: любой клиент (включая неавторизованных) может писать события,
-- но user_id должен быть либо NULL, либо совпадать с auth.uid().
create policy "telemetry_insert_any" on telemetry_events
  for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- SELECT: только breadwinner видит все события.
create policy "telemetry_select_breadwinner" on telemetry_events
  for select
  using (
    exists (
      select 1 from users u
      where u.id = auth.uid() and u.role = 'breadwinner'
    )
  );

-- DELETE: только breadwinner может чистить данные (кнопка «Сбросить» в дашборде).
create policy "telemetry_delete_breadwinner" on telemetry_events
  for delete
  using (
    exists (
      select 1 from users u
      where u.id = auth.uid() and u.role = 'breadwinner'
    )
  );

-- ============================================================
-- RPC: топ N событий по количеству
-- ============================================================
create or replace function telemetry_top_events(top_n int default 10)
returns table(event_name text, total bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select event_name, count(*)::bigint as total
  from telemetry_events
  group by event_name
  order by total desc
  limit greatest(1, top_n);
$$;

-- ============================================================
-- RPC: воронка из 7 шагов демо-сценария.
-- Считаем уникальные сессии на каждом шаге.
-- ============================================================
create or replace function telemetry_funnel()
returns table(step int, label text, sessions bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with steps as (
    select 1 as step, 'session_start'::text as label,
      (select count(distinct session_id) from telemetry_events
       where event_name = 'session_start') as sessions
    union all
    select 2, 'consent_granted',
      (select count(distinct session_id) from telemetry_events
       where event_name = 'consent_granted')
    union all
    select 3, 'onboarding_enter',
      (select count(distinct session_id) from telemetry_events
       where event_name = 'scene_enter' and scene = 'onboarding')
    union all
    select 4, 'onboarding_completed',
      (select count(distinct session_id) from telemetry_events
       where event_name = 'onboarding_completed')
    union all
    select 5, 'vault_enter',
      (select count(distinct session_id) from telemetry_events
       where event_name = 'scene_enter' and scene = 'vault')
    union all
    select 6, 'letter_saved',
      (select count(distinct session_id) from telemetry_events
       where event_name = 'letter_saved')
    union all
    select 7, 'trigger_simulated',
      (select count(distinct session_id) from telemetry_events
       where event_name = 'trigger_simulated')
  )
  select step, label, sessions from steps order by step;
$$;

-- ============================================================
-- RPC: среднее время по сценам из scene_leave.props.msSpent
-- ============================================================
create or replace function telemetry_scene_time()
returns table(scene text, avg_ms bigint, visits bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    scene,
    coalesce(avg((props->>'msSpent')::bigint)::bigint, 0) as avg_ms,
    count(*)::bigint as visits
  from telemetry_events
  where event_name = 'scene_leave' and scene is not null
  group by scene
  order by visits desc;
$$;
