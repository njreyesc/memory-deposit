-- 0011_telemetry_funnel_flat.sql
-- Разворачиваем telemetry_funnel() обратно в «плоский» вид без каскадных join.
--
-- Проблема вложенной версии из 0009: если в сессии пропущен любой промежуточный
-- шаг (например, onboarding_completed для вернувшегося тестера, которого
-- /welcome редиректит на /vault), все последующие шаги в этой сессии = 0. В
-- итоге письма и видео реально сохраняются, но в воронке остаются нулями.
--
-- Решение: каждый шаг считает уникальные сессии со своим событием, без join на
-- предыдущие шаги. Плюс добавляем отдельный шаг video_sealed — раньше видео в
-- воронке вообще не учитывалось.

create or replace function telemetry_funnel()
returns table(step int, label text, sessions bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select 1, 'session_start'::text,
    (select count(distinct session_id) from telemetry_events
     where event_name = 'session_start')::bigint
  union all select 2, 'onboarding_enter',
    (select count(distinct session_id) from telemetry_events
     where event_name = 'scene_enter' and scene = 'onboarding')::bigint
  union all select 3, 'onboarding_completed',
    (select count(distinct session_id) from telemetry_events
     where event_name = 'onboarding_completed')::bigint
  union all select 4, 'vault_enter',
    (select count(distinct session_id) from telemetry_events
     where event_name = 'scene_enter' and scene = 'vault')::bigint
  union all select 5, 'letter_saved',
    (select count(distinct session_id) from telemetry_events
     where event_name = 'letter_saved')::bigint
  union all select 6, 'video_sealed',
    (select count(distinct session_id) from telemetry_events
     where event_name = 'video_sealed')::bigint
  union all select 7, 'finance_opened',
    (select count(distinct session_id) from telemetry_events
     where event_name = 'scene_enter' and scene = 'finance')::bigint
  union all select 8, 'assistant_opened',
    (select count(distinct session_id) from telemetry_events
     where event_name = 'ai_opened')::bigint
  union all select 9, 'trigger_simulated',
    (select count(distinct session_id) from telemetry_events
     where event_name = 'trigger_simulated')::bigint
  order by 1;
$$;
