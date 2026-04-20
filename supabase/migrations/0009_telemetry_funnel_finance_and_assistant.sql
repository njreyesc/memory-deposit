-- 0009_telemetry_funnel_finance_and_assistant.sql
-- Вписываем финкарту и ИИ-ассистента в основную воронку дашборда.
-- Main path (session_start → onboarding → vault → letter → trigger) остаётся
-- строго вложенным — как зафиксировал PR #40, чтобы ни один шаг не превысил
-- session_start. Finance и ассистент — опциональные возможности, их меряем
-- как подмножество session_start (не letter_saved), потому что пользователь
-- может открыть их на любом шаге, но никогда — без старта сессии.

create or replace function telemetry_funnel()
returns table(step int, label text, sessions bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with e as (
    select session_id, event_name, scene from telemetry_events
  ),
  s1 as (
    select distinct session_id from e where event_name = 'session_start'
  ),
  s2 as (
    select distinct e.session_id from e join s1 using (session_id)
    where e.event_name = 'scene_enter' and e.scene = 'onboarding'
  ),
  s3 as (
    select distinct e.session_id from e join s2 using (session_id)
    where e.event_name = 'onboarding_completed'
  ),
  s4 as (
    select distinct e.session_id from e join s3 using (session_id)
    where e.event_name = 'scene_enter' and e.scene = 'vault'
  ),
  s5 as (
    select distinct e.session_id from e join s4 using (session_id)
    where e.event_name = 'letter_saved'
  ),
  sf as (
    select distinct e.session_id from e join s1 using (session_id)
    where e.event_name = 'scene_enter' and e.scene = 'finance'
  ),
  sa as (
    select distinct e.session_id from e join s1 using (session_id)
    where e.event_name = 'ai_opened'
  ),
  s8 as (
    select distinct e.session_id from e join s5 using (session_id)
    where e.event_name = 'trigger_simulated'
  )
  select 1, 'session_start'::text,         (select count(*) from s1)::bigint
  union all select 2, 'onboarding_enter',  (select count(*) from s2)::bigint
  union all select 3, 'onboarding_completed', (select count(*) from s3)::bigint
  union all select 4, 'vault_enter',       (select count(*) from s4)::bigint
  union all select 5, 'letter_saved',      (select count(*) from s5)::bigint
  union all select 6, 'finance_opened',    (select count(*) from sf)::bigint
  union all select 7, 'assistant_opened',  (select count(*) from sa)::bigint
  union all select 8, 'trigger_simulated', (select count(*) from s8)::bigint
  order by 1;
$$;
