-- 0010_telemetry_user_name.sql
-- Добавляем человекочитаемое имя пользователя в telemetry_events, чтобы можно
-- было отследить конкретного тестера без JOIN'a по users на каждом запросе
-- дашборда. Для анонимных/вышедших из сессии событий — null.

alter table telemetry_events
  add column if not exists user_name text;
