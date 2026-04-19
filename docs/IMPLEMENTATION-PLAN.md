# План реализации: Multi-User Test Mode

**Стек:** Next.js API Routes (без FastAPI)
**Срок:** 9 шагов, ~1.5-2 дня
**Ветка:** `feat/multi-user-test`

---

## Порядок выполнения и зависимости

```
Шаг 0: Supabase Pro  ─────────────────────────────────┐
Шаг 1: Миграция БД   ─────────────────────────────────┤
Шаг 2: API create     ← зависит от Шага 1             │
Шаг 3: API mock-login ← зависит от Шага 2             ├── День 1
Шаг 4: Логин UI       ← зависит от Шага 3             │
Шаг 5: Role-switcher  ← зависит от Шага 3             │
                                                       │
Шаг 6: Admin guard    ← зависит от Шага 1             ├── День 2
Шаг 7: Storage paths  ← зависит от Шага 2             │
Шаг 8: API cleanup    ← зависит от Шага 1             │
Шаг 9: Smoke test     ← зависит от всех               ┘
```

---

## Шаг 0: Апгрейд Supabase до Pro

**Зачем:** Free tier = 5-10 соединений. 50 юзеров = 50 параллельных запросов.
**Что сделать:** Supabase Dashboard → Billing → Upgrade to Pro ($25/мес).
**Критерий готовности:** В Dashboard видно "Pro" план.
**Время:** 5 минут.

---

## Шаг 1: Миграция БД

**Файл:** `supabase/migrations/0007_test_sessions.sql`
**Зависит от:** Шаг 0
**Что делает:**

```sql
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
CREATE INDEX idx_test_sessions_token ON test_sessions(session_token);
CREATE INDEX idx_test_sessions_not_cleaned ON test_sessions(cleaned_up) WHERE cleaned_up = FALSE;
CREATE INDEX idx_users_test_session ON users(test_session_id);
CREATE INDEX idx_users_is_test ON users(is_test_user) WHERE is_test_user = TRUE;

-- RLS: только service_role может читать/писать test_sessions
ALTER TABLE test_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON test_sessions
  FOR ALL USING (auth.role() = 'service_role');
```

**Как применить:** Supabase Dashboard → SQL Editor → вставить и выполнить.
**Критерий готовности:** `SELECT * FROM test_sessions LIMIT 1;` не падает. Колонки `is_test_user` и `test_session_id` видны в таблице `users`.
**Время:** 10 минут.

---

## Шаг 2: API — создание тестовой сессии

**Файл:** `app/api/test-session/create/route.ts`
**Зависит от:** Шаг 1

**Логика:**
1. Принять `{ testName: string }` из body
2. Сгенерировать `sessionId = uuid()`, `sessionToken = "test_" + sessionId`
3. Через admin client создать 2 auth-пользователей:
   - `test-{sessionId}-alexey@test.local` / password: `demo123456`
   - `test-{sessionId}-maria@test.local` / password: `demo123456`
4. Вставить 2 записи в `users`:
   - breadwinner: `{ id: alexeyAuthId, role: "breadwinner", full_name: "{testName} (Алексей)", is_test_user: true, test_session_id: sessionId }`
   - recipient: `{ id: mariaAuthId, role: "recipient", full_name: "{testName} (Мария)", is_test_user: true, test_session_id: sessionId }`
5. Вставить `test_sessions` запись
6. Вставить `recipients` запись (Мария как получатель Алексея)
7. Залогинить как breadwinner через `signInWithPassword`
8. Вернуть `{ session_token, access_token, refresh_token, user }`

**Обработка ошибок:**
- Если создание auth-пользователя упало — удалить первого (если создан), вернуть 500
- Если тестовое имя пустое — 400

**Критерий готовности:** `curl -X POST /api/test-session/create -d '{"testName":"Тест-1"}'` возвращает токены. В Supabase Auth видно двух новых пользователей. В таблице `test_sessions` появилась запись.
**Время:** 30-40 минут.

---

## Шаг 3: Обновить mock-login — поддержка session_token

**Файл:** `app/api/mock-login/route.ts` (правка)
**Зависит от:** Шаг 2

**Что добавить:**
- В body принимать опциональный `sessionToken?: string`
- Если `sessionToken` передан:
  - Найти `test_sessions` по токену через admin client
  - Определить `targetUserId` по роли из сессии (breadwinner или recipient)
  - Найти email этого пользователя в таблице `users`
  - Залогинить через `signInWithPassword` с этим email
- Если `sessionToken` не передан — старая логика (DEMO_USERS)
- Сохранить `sessionToken` в cookie `test_session_token` (httpOnly, 24h)

**Что НЕ менять:** существующую логику для демо-режима. Новый код — в `if (sessionToken)` блоке.

**Критерий готовности:**
- Старый вызов `{ role: "alexey" }` работает как раньше
- Новый вызов `{ role: "alexey", sessionToken: "test_xxx" }` логинит тестового Алексея
**Время:** 20 минут.

---

## Шаг 4: Новая форма логина для тестировщиков

**Файл:** `app/(auth)/login/test-login-form.tsx` (новый)
**Файл:** `app/(auth)/login/page.tsx` (правка)
**Зависит от:** Шаг 3

**UI test-login-form.tsx:**
```
┌──────────────────────────────────┐
│  Тестирование продукта           │
│                                  │
│  Введите ваше имя:               │
│  ┌────────────────────────────┐  │
│  │ Иван Петров                │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │   Начать тестирование  ▶   │  │
│  └────────────────────────────┘  │
│                                  │
│  ─── или ───                     │
│                                  │
│  Войти через Сбер ID (демо)      │
└──────────────────────────────────┘
```

**Логика:**
1. Тестировщик вводит имя, жмёт кнопку
2. `fetch("/api/test-session/create", { body: { testName } })`
3. Получает `session_token` — сохраняет в cookie
4. `fetch("/api/mock-login", { body: { role: "alexey", sessionToken } })`
5. Redirect → `/vault`

**Правка page.tsx:** добавить `<TestLoginForm />` над существующей формой. Или рядом через tab-переключатель "Тестирование / Демо".

**Критерий готовности:** Открыл `/login`, ввёл имя, нажал кнопку → попал на `/vault` как свой Алексей. Данные пустые (чистое хранилище).
**Время:** 30 минут.

---

## Шаг 5: Обновить role-switcher

**Файл:** `components/sber/role-switcher.tsx` (правка)
**Зависит от:** Шаг 3

**Что изменить:**
1. Читать cookie `test_session_token` (через `document.cookie` или из server props)
2. В `handleSwitch()`:
   - Если есть `sessionToken` → отправить `{ role: targetRole, sessionToken }` в `/api/mock-login`
   - Если нет → старая логика с `DEMO_USERS`
3. Показывать имена из `test_sessions` вместо захардкоженных "Алексей"/"Мария":
   - Если тестовый режим: "{testName} (Алексей)" / "{testName} (Мария)"
   - Если демо: "Алексей Иванов" / "Мария Иванова"

**Откуда взять имена:** из текущего `user` в БД (`full_name`), который уже приходит в layout.

**Критерий готовности:** Тестовый юзер видит своё имя в switcher. Переключение на Марию показывает пустой recipient view (нет данных от чужих Алексеев). Переключение обратно на Алексея показывает его данные.
**Время:** 20 минут.

---

## Шаг 6: Обновить admin guard

**Файл:** `app/(admin)/layout.tsx` (правка)
**Зависит от:** Шаг 1

**Текущая логика:**
```typescript
if (user.id !== DEMO_USERS.alexey.id) {
  redirect("/vault");
}
```

**Новая логика:**
```typescript
// Разрешить если:
// 1. Это хардкодный Алексей (демо-режим), ИЛИ
// 2. Это тестовый breadwinner

const { data: dbUser } = await supabase
  .from("users")
  .select("role, is_test_user")
  .eq("id", user.id)
  .single();

const isBreadwinner =
  user.id === DEMO_USERS.alexey.id ||
  (dbUser?.role === "breadwinner");

if (!isBreadwinner) {
  redirect("/vault");
}
```

**Критерий готовности:** Тестовый Алексей видит страницу `/simulate`. Тестовая Мария — redirect на `/vault`.
**Время:** 10 минут.

---

## Шаг 7: Обновить Storage paths

**Файл:** `components/recorder/VideoRecorder.tsx` (правка)
**Зависит от:** Шаг 2

**Текущий путь:** `videos/{userId}/{itemId}.webm`
**Новый путь:** `videos/{userId}/{itemId}.webm` (менять НЕ нужно!)

**Почему:** каждый тестовый Алексей имеет уникальный `userId`. Путь `videos/{userId}/...` уже уникален per-user. Коллизий не будет, потому что UUID разные.

**Что проверить:** убедиться, что `VideoRecorder` использует `userId` из auth session, а не захардкоженный UUID. Если да — ничего менять не нужно.

**Критерий готовности:** Два тестовых юзера записали видео → в Storage два разных файла в разных папках.
**Время:** 5-10 минут (только проверка).

---

## Шаг 8: API — очистка тестовых данных

**Файл:** `app/api/test-session/cleanup/route.ts` (новый)
**Файл:** `app/api/test-session/cleanup-all/route.ts` (новый)
**Зависит от:** Шаг 1

### cleanup (одна сессия)

**Вход:** `{ sessionToken: string }`
**Логика:**
1. Найти `test_sessions` по токену
2. Получить `breadwinner_user_id`, `recipient_user_id`
3. Найти все `vault_items.encrypted_blob_path` для owner
4. Удалить файлы из Storage bucket `videos`
5. Удалить `vault_items`, `recipients`, `triggers` (каскад удалит `access_rules`)
6. Удалить `users` записи
7. Удалить auth-пользователей через `admin.auth.admin.deleteUser()`
8. Пометить `test_sessions.cleaned_up = true`

### cleanup-all (все сессии)

**Вход:** Header `X-Admin-Key: <secret>`
**Логика:** Найти все `test_sessions WHERE cleaned_up = false`, вызвать cleanup для каждой.

**Критерий готовности:** После cleanup — в Auth, users, vault_items, recipients, triggers нет данных от этой сессии. `test_sessions.cleaned_up = true`.
**Время:** 30 минут.

---

## Шаг 9: Smoke test

**Зависит от:** Все шаги

**Тест 1 — Обратная совместимость:**
1. Открыть `/login`
2. Нажать "Войти через Сбер ID" → выбрать Алексея
3. Пройти полный демо-сценарий (видео, заметка, получатель, /simulate, Мария)
4. ✅ Всё работает как раньше

**Тест 2 — Одна тестовая сессия:**
1. Открыть `/login`
2. Ввести имя "Тест-1", нажать "Начать тестирование"
3. Попасть на `/vault` как "Тест-1 (Алексей)"
4. Записать видео, создать заметку
5. Перейти на `/simulate`, подтвердить событие
6. Переключиться на Марию
7. ✅ Мария видит контент Алексея

**Тест 3 — Две параллельные сессии (разные браузеры):**
1. Браузер A: создать сессию "Тест-А"
2. Браузер B: создать сессию "Тест-Б"
3. Браузер A: создать заметку "Привет от А"
4. Браузер B: создать заметку "Привет от Б"
5. ✅ A не видит заметку Б, и наоборот
6. Браузер A: подтвердить событие
7. ✅ У Б событие НЕ подтверждено
8. Браузер A: переключиться на Марию → видит "Привет от А"
9. Браузер B: переключиться на Марию → НЕ видит ничего (событие не подтверждено)

**Тест 4 — Cleanup:**
1. Вызвать `POST /api/test-session/cleanup { sessionToken: "test_..." }`
2. ✅ В БД и Storage нет данных от этой сессии
3. Auth пользователи удалены

**Время:** 30 минут.

---

## Итого

| Шаг | Файл | Действие | Время |
|-----|------|----------|-------|
| 0 | — | Supabase Pro | 5 мин |
| 1 | `migrations/0007_test_sessions.sql` | Создать | 10 мин |
| 2 | `api/test-session/create/route.ts` | Создать | 35 мин |
| 3 | `api/mock-login/route.ts` | Правка | 20 мин |
| 4 | `login/test-login-form.tsx` + `page.tsx` | Создать + правка | 30 мин |
| 5 | `sber/role-switcher.tsx` | Правка | 20 мин |
| 6 | `(admin)/layout.tsx` | Правка | 10 мин |
| 7 | `recorder/VideoRecorder.tsx` | Проверка | 10 мин |
| 8 | `api/test-session/cleanup*/route.ts` | Создать (×2) | 30 мин |
| 9 | — | Ручной тест | 30 мин |
| **Итого** | **4 новых файла, 4 правки** | | **~3.5 часа** |

---

## Файлы, которые НЕ меняются

Весь остальной код — без изменений. Это ключевое преимущество подхода:

- `components/vault/video-section.tsx` — ✅ не трогаем
- `components/vault/notes-section.tsx` — ✅ не трогаем
- `components/vault/recipient-view.tsx` — ✅ не трогаем
- `components/vault/access-rules-dialog.tsx` — ✅ не трогаем
- `components/recipients/recipients-section.tsx` — ✅ не трогаем
- `app/(app)/vault/page.tsx` — ✅ не трогаем
- `lib/supabase/*` — ✅ не трогаем
- `lib/auth/demo-users.ts` — ✅ не трогаем (обратная совместимость)
- Все RLS-политики — ✅ не трогаем (уже работают по auth.uid())
- Все RPC-функции — ✅ не трогаем
