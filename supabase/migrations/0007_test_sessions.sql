-- Миграция 0007: тестовые сессии для изолированных multi-user тестов.
-- Вводит таблицу test_sessions (токен + два пользователя) и расширяет users
-- полями для связи с сессией и флагом «тестовый».

-- Таблица тестовых сессий
CREATE TABLE test_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name           TEXT NOT NULL,
  breadwinner_user_id UUID NOT NULL REFERENCES users(id),
  recipient_user_id   UUID NOT NULL REFERENCES users(id),
  session_token       TEXT NOT NULL UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  cleaned_up          BOOLEAN DEFAULT FALSE
);

-- Колонки в users для связи с сессией
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS test_session_id UUID REFERENCES test_sessions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_test_user BOOLEAN DEFAULT FALSE;

-- Индексы
CREATE INDEX idx_test_sessions_token        ON test_sessions(session_token);
CREATE INDEX idx_test_sessions_not_cleaned  ON test_sessions(cleaned_up) WHERE cleaned_up = FALSE;
CREATE INDEX idx_users_test_session         ON users(test_session_id);
CREATE INDEX idx_users_is_test              ON users(is_test_user) WHERE is_test_user = TRUE;

-- RLS: только service_role может читать/писать test_sessions
ALTER TABLE test_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON test_sessions
  FOR ALL USING (auth.role() = 'service_role');
