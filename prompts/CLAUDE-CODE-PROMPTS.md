# Промпты для Claude Code: Multi-User Test Mode

Каждый шаг следует циклу **Plan → Build → Audit**.
Каждая фаза — **отдельный свежий чат** (новая сессия Claude Code).
State между фазами — через файлы в `.claude/work/N/`.

---

## Подготовка: настройка `.claude/settings.json`

Перед началом работы убедись, что в `.claude/settings.json` есть хуки и permissions:

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write|MultiEdit",
      "hooks": [{
        "type": "command",
        "command": "npx tsc --noEmit 2>&1 | head -30 || true"
      }]
    }]
  },
  "permissions": {
    "allow": ["Bash(npm:*)", "Bash(npx:*)", "Bash(git status)", "Bash(git diff:*)"],
    "deny": ["Bash(git push:*)", "Bash(git commit:*)", "Read(.env.local)", "Read(.env)"]
  }
}
```

---

## Подготовка: создание рабочих директорий

```bash
mkdir -p .claude/work/{1,2,3,4,5,6,7,8}
```

---

## Шаг 1: Миграция БД (`0007_test_sessions.sql`)

### 1A — Plan

```
Работаем над Шагом 1 — «Миграция БД: таблица test_sessions».

Прочитай CLAUDE.md, затем docs/IMPLEMENTATION-PLAN.md (Шаг 1) и docs/ADR-001-multi-user-test-isolation.md.

Создай план в .claude/work/1/plan.md. Формат:

## Цель
Одно предложение.

## Файлы для создания
- путь, что внутри

## SQL-миграция (полный текст)
Скопируй из IMPLEMENTATION-PLAN.md, проверь на ошибки.

## Риски
- Что может пойти не так

## Проверка готовности
- Какие SQL-запросы выполнить чтобы убедиться что всё ок

## Вне скоупа
- Что НЕ делать в этом шаге

Не пиши код. Только план в файл.
```

### 1B — Build

```
План утверждён. Прочитай CLAUDE.md и .claude/work/1/plan.md.

Создай файл supabase/migrations/0007_test_sessions.sql строго по плану.

После создания:
1. Выведи полный текст файла
2. Напиши .claude/work/1/build-summary.md с перечнем созданных/изменённых файлов и SQL-объектов

Не делай ничего кроме того, что в плане. Не создавай коммит.
```

### 1C — Audit

```
Запускай аудит на Шаг 1.

Прочитай:
- CLAUDE.md
- .claude/work/1/plan.md
- .claude/work/1/build-summary.md
- supabase/migrations/0007_test_sessions.sql

Проверь:
1. SQL синтаксис корректен (PostgreSQL)
2. RLS включён на test_sessions
3. Политика ограничивает доступ service_role
4. Индексы созданы для session_token и частых запросов
5. ALTER TABLE users — колонки добавлены с IF NOT EXISTS
6. CASCADE на test_session_id FK
7. Нет конфликтов с существующими миграциями (проверь supabase/migrations/*.sql)

Напиши .claude/work/1/audit-report.md:
- ❌ Блокеры (нужно исправить до коммита)
- ⚠️ Предупреждения (желательно)
- ✅ Что хорошо

НЕ исправляй код, только опиши проблемы.
```

---

## Шаг 2: API создания тестовой сессии

### 2A — Plan

```
Работаем над Шагом 2 — «API: POST /api/test-session/create».

Прочитай CLAUDE.md, docs/IMPLEMENTATION-PLAN.md (Шаг 2), .claude/work/1/audit-report.md.

Перед планированием изучи существующий код:
- lib/supabase/admin.ts (как создан admin client)
- lib/supabase/server.ts (как создан server client)
- lib/auth/demo-users.ts (структура существующих пользователей)
- app/api/mock-login/route.ts (как работает текущий логин)

Создай план в .claude/work/2/plan.md:

## Цель
Одно предложение.

## Файлы для создания
- app/api/test-session/create/route.ts — полная логика

## Типы
- Какие TypeScript-типы нужны (interface TestSession, etc.)
- Где их разместить (lib/types/ или рядом с route)

## Пошаговая логика API
1. Валидация входных данных (testName)
2. Генерация sessionId, sessionToken
3. Создание auth-пользователей через admin client
4. Вставка в users
5. Вставка в test_sessions
6. Вставка в recipients (Мария как получатель Алексея)
7. signInWithPassword
8. Возврат токенов

## Обработка ошибок
- Что делать если шаг 3 упал на втором пользователе
- Rollback стратегия

## Развилки
- [Развилка 1]: Где хранить типы — в lib/types.ts или в папке route?
  Рекомендация: ...

## Вне скоупа
- cleanup API (это Шаг 8)
- UI логина (это Шаг 4)

Не пиши код. Только план.
```

### 2B — Build

```
План утверждён. Развилка 1 — [вставь выбранный вариант].

Прочитай CLAUDE.md и .claude/work/2/plan.md.

Создай app/api/test-session/create/route.ts строго по плану.

Правила:
- TypeScript strict, any запрещён
- Используй существующий admin client из lib/supabase/admin.ts
- Все ошибки — try/catch, возвращай корректные HTTP-коды (400, 500)
- Логируй ошибки через console.error
- Пароль для тестовых пользователей: "test-demo-2024"
- Email формат: test-{sessionId}-alexey@test.local

После создания:
1. Запусти npx tsc --noEmit — убедись что нет ошибок типов
2. Напиши .claude/work/2/build-summary.md

Не делай ничего кроме плана. Не создавай коммит.
```

### 2C — Audit

```
Запускай аудит на Шаг 2.

Прочитай:
- CLAUDE.md
- .claude/work/2/plan.md
- .claude/work/2/build-summary.md
- app/api/test-session/create/route.ts
- lib/supabase/admin.ts

Проверь:
1. TypeScript strict: нет any, нет @ts-ignore
2. Безопасность: service_role key не утекает в response
3. Rollback: если создание второго auth-юзера упало, первый удаляется
4. Валидация: testName проверяется на пустоту
5. session_token генерируется криптографически безопасно (crypto.randomUUID)
6. HTTP-коды: 400 на bad input, 500 на серверные ошибки, 200 на успех
7. Response содержит нужные поля (session_token, access_token, refresh_token)
8. Нет .data! без проверки .error
9. Соответствие плану: все пункты реализованы

Напиши .claude/work/2/audit-report.md.
НЕ исправляй код.
```

---

## Шаг 3: Обновление mock-login

### 3A — Plan

```
Работаем над Шагом 3 — «Обновить mock-login: поддержка sessionToken».

Прочитай CLAUDE.md, docs/IMPLEMENTATION-PLAN.md (Шаг 3).

Изучи текущий файл: app/api/mock-login/route.ts

Создай план в .claude/work/3/plan.md:

## Цель
Добавить в mock-login поддержку sessionToken без поломки существующей логики.

## Файлы для правки
- app/api/mock-login/route.ts — что добавить, что НЕ трогать

## Изменения (diff-формат)
Опиши какой блок кода добавляется и куда (до/после какой строки).

## Обратная совместимость
- Старый вызов { role: "alexey" } — должен работать как раньше
- Новый вызов { role: "alexey", sessionToken: "test_xxx" } — через test_sessions

## Cookie
- Имя: test_session_token
- httpOnly: true
- maxAge: 86400 (24h)
- path: /

## Проверка готовности
- curl-команды для обоих сценариев

Не пиши код. Только план.
```

### 3B — Build

```
План утверждён. Прочитай CLAUDE.md и .claude/work/3/plan.md.

Отредактируй app/api/mock-login/route.ts строго по плану.

Главное правило: существующая логика для DEMO_USERS не меняется.
Новый код оборачивается в if (sessionToken) { ... }.

После правки:
1. Запусти npx tsc --noEmit
2. Напиши .claude/work/3/build-summary.md (что изменилось, diff)

Не создавай коммит.
```

### 3C — Audit

```
Запускай аудит на Шаг 3.

Прочитай:
- CLAUDE.md
- .claude/work/3/plan.md
- .claude/work/3/build-summary.md
- app/api/mock-login/route.ts
- lib/auth/demo-users.ts

Проверь:
1. Обратная совместимость: старый путь (без sessionToken) не сломан
2. Cookie устанавливается с httpOnly, secure (на проде), path=/
3. Тестовая сессия ищется через admin client (не через anon)
4. signInWithPassword использует email из тестового пользователя
5. Нет .data! без .error проверки
6. Нет any, strict TypeScript
7. При невалидном sessionToken — 401, не 500

Напиши .claude/work/3/audit-report.md.
НЕ исправляй код.
```

---

## Шаг 4: UI формы логина для тестировщиков

### 4A — Plan

```
Работаем над Шагом 4 — «Форма логина для тестировщиков».

Прочитай CLAUDE.md, docs/IMPLEMENTATION-PLAN.md (Шаг 4).

Изучи:
- app/(auth)/login/page.tsx (текущая страница логина)
- components/sber/ (примеры брендированных компонентов)
- Стиль: #21A038 акцент, #0A1628 фон, Montserrat, тёмная тема, shadcn/ui

Создай план в .claude/work/4/plan.md:

## Цель
Новая форма «Тестирование продукта» на странице логина.

## Файлы
- app/(auth)/login/test-login-form.tsx — НОВЫЙ (клиентский компонент)
- app/(auth)/login/page.tsx — ПРАВКА (добавить TestLoginForm)

## UI-спецификация test-login-form.tsx
- Заголовок: «Тестирование продукта»
- Input: «Введите ваше имя» (обязательное, placeholder: «Иван Петров»)
- Кнопка: «Начать тестирование» (#21A038)
- Состояния: idle, loading (спиннер), error (toast)
- Под формой: разделитель «── или ──» и ссылка на демо-вход

## Логика
1. Пользователь вводит имя → кнопка
2. fetch POST /api/test-session/create { testName }
3. Получить session_token
4. fetch POST /api/mock-login { role: "alexey", sessionToken }
5. router.push("/vault")

## Компоненты shadcn/ui
- Input, Button, Card (или просто div с стилями)

## Интеграция в page.tsx
- Как именно добавить: Tabs? Или TestLoginForm сверху, демо-форма снизу?
- Рекомендация: ...

Не пиши код. Только план.
```

### 4B — Build

```
План утверждён. Интеграция: [вставь выбранный вариант из развилки].

Прочитай CLAUDE.md и .claude/work/4/plan.md.

Создай app/(auth)/login/test-login-form.tsx и отредактируй app/(auth)/login/page.tsx.

Правила:
- "use client" в test-login-form.tsx
- shadcn/ui компоненты (Input, Button)
- Стиль: #21A038 акцент, тёмная тема
- Все тексты на русском
- Обработка ошибок: показать toast или inline-сообщение
- При загрузке: кнопка disabled + спиннер
- Иконки только из lucide-react

После создания:
1. npx tsc --noEmit
2. .claude/work/4/build-summary.md

Не создавай коммит.
```

### 4C — Audit

```
Запускай аудит на Шаг 4.

Прочитай:
- CLAUDE.md
- .claude/work/4/plan.md
- .claude/work/4/build-summary.md
- app/(auth)/login/test-login-form.tsx
- app/(auth)/login/page.tsx

Проверь:
1. "use client" есть в test-login-form.tsx
2. Брендинг: #21A038 акцент, тёмная тема, Montserrat (через next/font из layout)
3. Все тексты на русском
4. Иконки из lucide-react (не heroicons, не font-awesome)
5. Нет any, strict TypeScript
6. fetch вызовы обёрнуты в try/catch
7. Loading state: кнопка disabled, спиннер
8. Error state: пользователь видит понятное сообщение
9. Обратная совместимость: демо-вход (Сбер ID) не сломан
10. Props типизированы через interface

Напиши .claude/work/4/audit-report.md.
НЕ исправляй код.
```

---

## Шаг 5: Обновление role-switcher

### 5A — Plan

```
Работаем над Шагом 5 — «Обновить role-switcher для тестовых сессий».

Прочитай CLAUDE.md, docs/IMPLEMENTATION-PLAN.md (Шаг 5).

Изучи:
- components/sber/role-switcher.tsx (текущая реализация)
- lib/auth/demo-users.ts (DEMO_USERS)

Создай план в .claude/work/5/plan.md:

## Цель
Role-switcher переключает между тестовыми breadwinner/recipient по sessionToken из cookie.

## Изменения в role-switcher.tsx
1. Читать cookie test_session_token
2. Если есть sessionToken → переключение через /api/mock-login с sessionToken
3. Если нет → старая логика DEMO_USERS
4. Имена: из user.full_name (а не захардкоженные)

## Развилки
- Откуда читать cookie: document.cookie или серверный prop?
  Рекомендация: ...

## Обратная совместимость
- Без cookie → работает как раньше (Алексей Иванов / Мария Иванова)

Не пиши код. Только план.
```

### 5B — Build

```
План утверждён. Развилка: [вставь вариант].

Прочитай CLAUDE.md и .claude/work/5/plan.md.
Отредактируй components/sber/role-switcher.tsx строго по плану.

После правки:
1. npx tsc --noEmit
2. .claude/work/5/build-summary.md

Не создавай коммит.
```

### 5C — Audit

```
Запускай аудит на Шаг 5.

Прочитай:
- CLAUDE.md
- .claude/work/5/plan.md
- .claude/work/5/build-summary.md
- components/sber/role-switcher.tsx
- lib/auth/demo-users.ts

Проверь:
1. Обратная совместимость: без cookie работает как раньше
2. signOut() вызывается перед новым signIn (иначе старая сессия держится)
3. Имена берутся из full_name, не захардкожены
4. cookie читается безопасно (проверка на undefined)
5. Нет any
6. После переключения — router.refresh() или window.location.reload()

Напиши .claude/work/5/audit-report.md.
НЕ исправляй код.
```

---

## Шаг 6: Admin guard для тестовых breadwinner-ов

### 6A — Plan + Build (совмещаем — шаг маленький)

```
Работаем над Шагом 6 — «Admin guard: /simulate для тестовых breadwinner-ов».

Прочитай CLAUDE.md, docs/IMPLEMENTATION-PLAN.md (Шаг 6).
Изучи app/(admin)/layout.tsx (или app/(admin)/simulate/layout.tsx).

Шаг маленький — совмещаем Plan и Build.

Задача: разрешить доступ к /simulate если:
1. user.id === DEMO_USERS.alexey.id (старый демо), ИЛИ
2. user.role === "breadwinner" (тестовый пользователь)

Логика из IMPLEMENTATION-PLAN.md:
```typescript
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

Внеси правку. После:
1. npx tsc --noEmit
2. Напиши .claude/work/6/build-summary.md (что было, что стало)

Не создавай коммит.
```

### 6B — Audit

```
Запускай аудит на Шаг 6.

Прочитай:
- CLAUDE.md
- .claude/work/6/build-summary.md
- app/(admin)/layout.tsx (или где находится guard)

Проверь:
1. DEMO_USERS.alexey.id по-прежнему проходит (обратная совместимость)
2. Тестовый breadwinner проходит
3. Тестовая Мария (recipient) → redirect на /vault
4. Запрос к users безопасен (через серверный Supabase client)
5. Нет .data! без .error

Напиши .claude/work/6/audit-report.md.
НЕ исправляй код.
```

---

## Шаг 7: Проверка Storage paths

### 7A — Только проверка (код не меняется)

```
Работаем над Шагом 7 — «Проверка Storage paths для изоляции видео».

Прочитай CLAUDE.md, docs/IMPLEMENTATION-PLAN.md (Шаг 7).

Найди в проекте ВСЕ места, где формируется путь к файлу в Supabase Storage.
Используй grep по: `.upload(`, `.from("videos")`, `storage`, `bucket`.

Для каждого найденного места проверь:
- Путь содержит userId из auth session (а не захардкоженный UUID)
- Два разных auth-пользователя получат разные пути

Напиши .claude/work/7/audit-report.md:
- Список файлов, где используется Storage
- Для каждого: используется ли userId — да/нет
- Вердикт: нужны ли изменения

Если изменения НЕ нужны (ожидаемо) — просто подтверди и объясни почему.
```

---

## Шаг 8: API очистки тестовых данных

### 8A — Plan

```
Работаем над Шагом 8 — «API cleanup: очистка тестовых сессий».

Прочитай CLAUDE.md, docs/IMPLEMENTATION-PLAN.md (Шаг 8).

Изучи:
- app/api/test-session/create/route.ts (чтобы понять что создаётся)
- supabase/migrations/ (все таблицы и FK constraints)
- Понять порядок удаления с учётом foreign keys

Создай план в .claude/work/8/plan.md:

## Цель
Два API для очистки тестовых данных.

## Файлы для создания
1. app/api/test-session/cleanup/route.ts — очистка одной сессии
2. app/api/test-session/cleanup-all/route.ts — очистка всех

## cleanup (одна сессия)
- Вход: { sessionToken }
- Порядок удаления (с учётом FK):
  1. Storage файлы (videos/)
  2. access_rules (FK на vault_items и recipients)
  3. vault_items (FK на users)
  4. triggers (FK на users)
  5. recipients (FK на users)
  6. users (FK на test_sessions)
  7. auth-пользователи через admin.auth.admin.deleteUser()
  8. test_sessions.cleaned_up = true
- Ошибки: если шаг N упал — логировать, продолжить остальные

## cleanup-all
- Вход: Header X-Admin-Key (сравнить с env переменной)
- Логика: найти все test_sessions WHERE cleaned_up = false, вызвать cleanup для каждой

## Безопасность
- cleanup-all защищён секретным ключом
- cleanup доступен только по session_token (знает только тестировщик)

Не пиши код. Только план.
```

### 8B — Build

```
План утверждён. Прочитай CLAUDE.md и .claude/work/8/plan.md.

Создай:
1. app/api/test-session/cleanup/route.ts
2. app/api/test-session/cleanup-all/route.ts

Правила:
- TypeScript strict, any запрещён
- Каждый шаг удаления в try/catch (один failed шаг не останавливает остальные)
- Логирование: console.error с контекстом (sessionId, шаг)
- HTTP-коды: 200 успех (с деталями что удалено), 400/401/500 ошибки
- cleanup-all: проверка X-Admin-Key через process.env.ADMIN_KEY

После создания:
1. npx tsc --noEmit
2. .claude/work/8/build-summary.md

Не создавай коммит.
```

### 8C — Audit

```
Запускай аудит на Шаг 8.

Прочитай:
- CLAUDE.md
- .claude/work/8/plan.md
- .claude/work/8/build-summary.md
- app/api/test-session/cleanup/route.ts
- app/api/test-session/cleanup-all/route.ts

Проверь:
1. Порядок удаления корректен (FK constraints не нарушаются)
2. Каждый шаг в try/catch, сбой одного не блокирует остальные
3. auth-пользователи удаляются через admin client
4. Storage файлы удаляются
5. cleanup-all защищён X-Admin-Key
6. X-Admin-Key берётся из process.env, не захардкожен
7. Нет any, нет .data! без .error
8. Response содержит полезную информацию (сколько удалено, были ли ошибки)

Напиши .claude/work/8/audit-report.md.
НЕ исправляй код.
```

---

## Шаг 9: Smoke Test

### 9A — Ручной тест (не через Claude Code)

Этот шаг выполняется руками. Чеклист из IMPLEMENTATION-PLAN.md:

**Тест 1 — Обратная совместимость:**
- [ ] Открыть `/login`
- [ ] Нажать "Войти через Сбер ID" → выбрать Алексея
- [ ] Пройти полный демо-сценарий
- [ ] Всё работает как раньше

**Тест 2 — Одна тестовая сессия:**
- [ ] Ввести имя → "Начать тестирование"
- [ ] Попасть на `/vault` как "Тест-1 (Алексей)"
- [ ] Записать видео, создать заметку
- [ ] `/simulate` → подтвердить событие
- [ ] Переключиться на Марию → видит контент

**Тест 3 — Две параллельные сессии (два браузера):**
- [ ] Браузер A: сессия "Тест-А", заметка "Привет от А"
- [ ] Браузер B: сессия "Тест-Б", заметка "Привет от Б"
- [ ] A не видит заметку Б, и наоборот
- [ ] Подтвердить событие в A → у Б НЕ подтверждено

**Тест 4 — Cleanup:**
- [ ] `curl -X POST /api/test-session/cleanup -d '{"sessionToken":"test_..."}'`
- [ ] В БД и Storage нет данных от сессии

---

## Порядок работы (TL;DR)

```
День 1:
  Шаг 1: Plan → Build → Audit → Commit
  Шаг 2: Plan → Build → Audit → Commit
  Шаг 3: Plan → Build → Audit → Commit
  Шаг 4: Plan → Build → Audit → Commit
  Шаг 5: Plan → Build → Audit → Commit

День 2:
  Шаг 6: Plan+Build → Audit → Commit
  Шаг 7: Audit only (проверка)
  Шаг 8: Plan → Build → Audit → Commit
  Шаг 9: Ручной smoke test
```

**Между каждым шагом:**
1. Запусти `npm run build` — убедись что билд зелёный
2. Сделай коммит: `git add . && git commit -m "feat(N): <название>"`
3. Открой `npm run dev` → кликни быстрый smoke (30 сек)

**Каждая фаза — новый чат Claude Code.** Не продолжай в том же чате.

---

## Шаблоны промптов для fix-цикла

Если аудит нашёл ❌ блокеры:

```
В .claude/work/N/audit-report.md есть ❌ блокеры.
Прочитай CLAUDE.md, план (.claude/work/N/plan.md) и audit-report.

Исправь ТОЛЬКО блокеры:
- [C1] описание
- [C2] описание

Предупреждения (⚠️) НЕ трогай.
После исправлений — npx tsc --noEmit.
Обнови .claude/work/N/build-summary.md с описанием фиксов.
Не создавай коммит.
```

После fix — снова запусти Audit (в свежем чате).

---

## Финализация: создание PR

После прохождения всех шагов и smoke test:

```
Все 8 шагов реализованы и прошли аудит. Smoke test пройден.

Создай PR из текущей ветки feat/multi-user-test в main.

Title: feat: multi-user test isolation for 50 concurrent UX testers

Body:
- Summary: что добавлено (test_sessions, dynamic auth users, cleanup API)
- Список изменённых файлов
- Test plan: 4 smoke-теста из Шага 9
```
