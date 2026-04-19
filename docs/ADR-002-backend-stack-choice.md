# ADR-002: Выбор стека бэкенда для многопользовательского теста

**Status:** Accepted
**Date:** 2026-04-19
**Deciders:** Sim

---

## Context

У нас есть работающий прототип на Next.js 14 (фронт + API routes) + Supabase. Нужно добавить поддержку 50 параллельных тестировщиков. Есть два варианта: добавить эндпоинты в существующий Next.js или переписать бэкенд на FastAPI.

Ограничения: один разработчик, дедлайн "ближайшие дни", нет CI/CD, прототип уже задеплоен на Vercel.

## Decision

**Оставляем Next.js API Routes.** FastAPI откладываем как отдельный этап после теста (если будет нужен для портфолио/продакшена).

## Options Considered

### Option A: Next.js API Routes (добавить эндпоинты)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low — 3 новых файла, 4 правки в существующих |
| Cost | $25/мес (только Supabase Pro) |
| Scalability | 50 юзеров — ОК (каждый запрос = отдельная Lambda) |
| Team familiarity | Высокая — код уже написан и работает |
| Time to ship | 1-2 дня |

**Pros:** один деплой, нет CORS, cookies работают, SSR-авторизация сохраняется, минимальный риск регрессии

**Cons:** нет Swagger, TypeScript вместо Python, менее явная структура бэкенда

### Option B: FastAPI (отдельный сервис)

| Dimension | Assessment |
|-----------|------------|
| Complexity | High — 15 файлов, Dockerfile, CORS, переход на Bearer tokens |
| Cost | $30-32/мес (Supabase Pro + Railway/Render) |
| Scalability | 50 юзеров — ОК (uvicorn async) |
| Team familiarity | Средняя — новый стек для этого проекта |
| Time to ship | 3-5 дней |

**Pros:** Swagger из коробки, Python-экосистема, явная структура (routers/services/models), полезно для портфолио

**Cons:** CORS-настройка, потеря SSR-авторизации (cookies → Bearer tokens), двойной деплой, +$5-7/мес, латентность +50-200ms

## Trade-off Analysis

Главный вопрос: **решает ли FastAPI проблему изоляции лучше, чем Next.js?** Нет. Проблема изоляции решается на уровне БД (таблица `test_sessions` + динамические auth-пользователи + RLS). Язык бэкенда на это не влияет. FastAPI добавляет работу, не связанную с целью.

## Failure Modes

| Сценарий | Next.js | FastAPI |
|----------|---------|---------|
| CORS-ошибка блокирует всех 50 | Невозможно (один домен) | Вероятно при первом деплое |
| Cookie не ставится | Невозможно (same-origin) | SameSite policy на разных доменах |
| Cold start > 5 сек | ~200ms (Vercel edge) | 2-5 сек (Render Free) |
| SSR-страница не видит auth | Невозможно (cookies) | Гарантировано (Bearer в localStorage) |

## Consequences

**Что становится проще:** реализация за 1-2 дня, один деплой, один репозиторий.

**Что становится сложнее:** если позже захотим Python-бэкенд, придётся мигрировать.

**Что пересмотреть:** после теста — нужен ли отдельный бэкенд для продакшена.

## Action Items

1. [ ] Миграция `0007_test_sessions.sql`
2. [ ] `POST /api/test-session/create` — создание сессии
3. [ ] `POST /api/test-session/cleanup` — очистка
4. [ ] Обновить `mock-login` — поддержка `session_token`
5. [ ] Новая форма логина — "Введите имя"
6. [ ] Обновить `role-switcher` — переключение по сессии
7. [ ] Обновить admin guard — тестовые breadwinner-ы
8. [ ] Апгрейд Supabase до Pro
9. [ ] Smoke test: 3-5 параллельных сессий

---
