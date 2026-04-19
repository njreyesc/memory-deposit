# System Design: Миграция бэкенда на Python (FastAPI)

**Date:** 2026-04-19
**Context:** Депозит Памяти — переход от Next.js API routes к FastAPI для поддержки 50 параллельных тестировщиков

---

## 1. Requirements

### Функциональные
- Все 4 существующих API-эндпоинта работают идентично текущим
- Новые эндпоинты для тестовых сессий (создание, очистка)
- 50 параллельных пользователей, каждый в изолированной песочнице
- Переключение ролей (breadwinner ↔ recipient) в рамках сессии
- Обратная совместимость: демо-режим (Алексей/Мария) продолжает работать

### Нефункциональные
- Время ответа < 500ms на каждый запрос
- 50 одновременных соединений к Supabase
- Деплой за 1 день, без CI/CD
- Нет тестов — ошибки находим руками

### Ограничения
- Тест нужен в ближайшие дни
- Бюджет: $25/мес (Supabase Pro) + $0-7/мес (хостинг FastAPI)
- Фронтенд остаётся на Next.js (Vercel)
- БД и Storage остаются в Supabase

---

## 2. Сравнение: Next.js API Routes vs FastAPI

### Вариант 1: Оставить Next.js API Routes + добавить эндпоинты

```
┌─────────────────────────────────────────┐
│           Vercel (Next.js)              │
│  ┌──────────┐  ┌──────────────────┐     │
│  │  Фронт   │  │  API Routes      │     │
│  │  React   │──│  /api/mock-login  │     │
│  │  Pages   │  │  /api/simulate/* │     │
│  └──────────┘  │  /api/test-sess* │     │
│                └────────┬─────────┘     │
└─────────────────────────┼───────────────┘
                          │
                    ┌─────▼─────┐
                    │  Supabase │
                    │  Auth+DB  │
                    │  Storage  │
                    └───────────┘
```

| Dimension | Assessment |
|-----------|------------|
| Время реализации | 1-2 дня (добавить 3 эндпоинта, поправить 4 существующих) |
| Сложность деплоя | Нулевая — всё уже на Vercel |
| Стоимость | $0 (Vercel Free) + $25 (Supabase Pro) |
| Риск | Низкий — минимальные изменения в работающем коде |
| Cold start | ~200-500ms (Vercel serverless) |
| Concurrency | Без ограничений (каждый запрос = отдельная Lambda) |

### Вариант 2: FastAPI — отдельный сервис

```
┌──────────────────┐        ┌──────────────────┐
│  Vercel (Next.js)│        │  Railway/Render   │
│  ┌──────────┐    │        │  ┌────────────┐   │
│  │  Фронт   │    │  HTTP  │  │  FastAPI    │   │
│  │  React   │────┼────────┼─▶│  /api/*     │   │
│  │  Pages   │    │        │  │  uvicorn    │   │
│  └──────────┘    │        │  └──────┬─────┘   │
│  (no API routes) │        │         │         │
└──────────────────┘        └─────────┼─────────┘
                                      │
                                ┌─────▼─────┐
                                │  Supabase │
                                │  Auth+DB  │
                                │  Storage  │
                                └───────────┘
```

| Dimension | Assessment |
|-----------|------------|
| Время реализации | 3-5 дней (переписать 4 эндпоинта + написать 3 новых + настроить деплой) |
| Сложность деплоя | Средняя — два сервиса, CORS, два домена |
| Стоимость | $0-7/мес (Railway/Render) + $25 (Supabase Pro) |
| Риск | Средний — полная переписка бэкенда, новые баги |
| Cold start | 0ms (постоянно запущен) или ~2-5s (cold start на Render Free) |
| Concurrency | Зависит от плана хостинга (512MB RAM = ~50 запросов OK) |

---

## 3. Критический Trade-off анализ

### Почему FastAPI — это ДВА сервиса, а не один

С Next.js API routes фронт и бэк деплоятся в одном месте, на одном домене, без CORS. С FastAPI появляются новые проблемы:

**CORS**: Фронт на `vercel.app`, бэк на `railway.app` — нужно настроить CORS headers для каждого эндпоинта. Одна ошибка = белый экран для 50 тестировщиков.

**Cookies**: Сейчас `mock-login` ставит auth cookies через `Set-Cookie` на том же домене. FastAPI на другом домене не сможет ставить cookies для фронта (SameSite policy). Нужен переход на Bearer tokens в headers.

**Двойной деплой**: Изменение в API = пуш в другой репозиторий/сервис + ожидание деплоя. С Next.js — один `git push`.

**Сетевая задержка**: Каждый API-вызов теперь проходит через интернет (Vercel → Railway → Supabase) вместо (Vercel edge → Supabase). +50-200ms на каждый запрос.

### Почему FastAPI может быть лучше В БУДУЩЕМ (но не сейчас)

- Python-экосистема для ML/AI (если продукт пойдёт в продакшен)
- Более явная структура бэкенда (роутеры, сервисы, модели)
- Swagger-документация из коробки
- Легче нанять Python-разработчиков

### Вердикт

Для задачи «провести тест на 50 человек в ближайшие дни» **FastAPI создаёт больше проблем, чем решает**. Все преимущества FastAPI проявляются в долгосрочной разработке, а не в sprint-прототипе.

Однако, если решение принято в пользу FastAPI (например, для портфолио, учебных целей, или будущего продакшена) — ниже полный дизайн.

---

## 4. FastAPI Backend — полный дизайн

### 4.1 Структура проекта

```
backend/
├── main.py                    # FastAPI app, CORS, lifespan
├── config.py                  # Settings из environment
├── requirements.txt
├── Dockerfile
├── .env.example
│
├── routers/
│   ├── __init__.py
│   ├── auth.py                # POST /api/mock-login
│   ├── test_session.py        # POST /api/test-session/create, cleanup
│   ├── simulate.py            # POST /api/simulate/event, reset
│   └── vault.py               # DELETE /api/vault/video
│
├── services/
│   ├── __init__.py
│   ├── supabase_client.py     # Admin + anon Supabase clients
│   ├── session_service.py     # Создание/очистка тестовых сессий
│   └── demo_users.py          # Захардкоженные Алексей/Мария
│
├── models/
│   ├── __init__.py
│   └── schemas.py             # Pydantic request/response models
│
└── middleware/
    ├── __init__.py
    └── auth.py                # Dependency: проверка Bearer token
```

### 4.2 API Contract

#### Существующие эндпоинты (1:1 миграция)

```
POST /api/mock-login
  Request:  { "role": "alexey" | "maria", "session_token"?: string }
  Response: { "access_token": string, "refresh_token": string, "user": {...} }
  Auth:     None

POST /api/simulate/event
  Request:  (empty)
  Response: { "ok": true, "request_id": string, "trigger_id": string }
  Auth:     Bearer token, must be breadwinner

POST /api/simulate/reset
  Request:  (empty)
  Response: { "ok": true }
  Auth:     Bearer token, must be breadwinner

DELETE /api/vault/video
  Request:  (empty)
  Response: { "ok": true }
  Auth:     Bearer token
```

#### Новые эндпоинты (тестовые сессии)

```
POST /api/test-session/create
  Request:  { "test_name": string }
  Response: { "session_token": string, "access_token": string,
              "refresh_token": string, "user": {...},
              "breadwinner_name": string, "recipient_name": string }
  Auth:     None

POST /api/test-session/cleanup
  Request:  { "session_token": string }
  Response: { "ok": true, "deleted_items": int }
  Auth:     None (token is secret enough for prototype)

POST /api/test-session/cleanup-all
  Request:  (empty)
  Response: { "ok": true, "cleaned": int }
  Auth:     X-Admin-Key header
```

### 4.3 Ключевые файлы

#### `config.py`
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    demo_password: str = "demo123456"
    cors_origins: list[str] = ["http://localhost:3000"]
    admin_key: str = "change-me-in-production"

    class Config:
        env_file = ".env"

settings = Settings()
```

#### `main.py`
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from routers import auth, simulate, vault, test_session

app = FastAPI(title="Memory Deposit API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(simulate.router, prefix="/api/simulate")
app.include_router(vault.router, prefix="/api/vault")
app.include_router(test_session.router, prefix="/api/test-session")
```

#### `services/supabase_client.py`
```python
from supabase import create_client, Client
from config import settings

def get_admin_client() -> Client:
    """Service role — для создания пользователей, обхода RLS."""
    return create_client(settings.supabase_url, settings.supabase_service_role_key)

def get_anon_client() -> Client:
    """Anon key — для аутентификации пользователей."""
    return create_client(settings.supabase_url, settings.supabase_anon_key)
```

#### `middleware/auth.py`
```python
from fastapi import Depends, HTTPException, Header
from services.supabase_client import get_admin_client

async def get_current_user(authorization: str = Header(...)):
    """Извлекает пользователя из Bearer token."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing Bearer token")
    
    token = authorization.replace("Bearer ", "")
    admin = get_admin_client()
    user_response = admin.auth.get_user(token)
    
    if not user_response or not user_response.user:
        raise HTTPException(401, "Invalid token")
    
    return user_response.user

async def require_breadwinner(user = Depends(get_current_user)):
    """Проверяет что пользователь — breadwinner (Алексей или тестовый)."""
    admin = get_admin_client()
    db_user = admin.table("users").select("role").eq("id", str(user.id)).single().execute()
    
    if not db_user.data or db_user.data["role"] != "breadwinner":
        raise HTTPException(403, "Only breadwinner can access this endpoint")
    
    return user
```

#### `routers/auth.py`
```python
from fastapi import APIRouter, HTTPException
from models.schemas import LoginRequest, LoginResponse
from services.supabase_client import get_admin_client, get_anon_client
from services.demo_users import DEMO_USERS, DEMO_PASSWORD

router = APIRouter()

@router.post("/mock-login", response_model=LoginResponse)
async def mock_login(body: LoginRequest):
    admin = get_admin_client()
    anon = get_anon_client()
    
    if body.session_token:
        # Тестовый режим: найти пользователя по session_token
        session = admin.table("test_sessions") \
            .select("breadwinner_user_id, recipient_user_id") \
            .eq("session_token", body.session_token) \
            .single().execute()
        
        if not session.data:
            raise HTTPException(400, "Invalid session token")
        
        target_id = (session.data["breadwinner_user_id"] 
                     if body.role == "alexey" 
                     else session.data["recipient_user_id"])
        
        db_user = admin.table("users").select("email").eq("id", target_id).single().execute()
        email = db_user.data["email"]
    else:
        # Демо-режим: захардкоженный Алексей/Мария
        demo = DEMO_USERS.get(body.role)
        if not demo:
            raise HTTPException(400, f"Unknown role: {body.role}")
        email = demo["email"]
    
    auth_response = anon.auth.sign_in_with_password({
        "email": email,
        "password": DEMO_PASSWORD,
    })
    
    # Audit log
    admin.table("audit_log").insert({
        "actor_id": str(auth_response.user.id),
        "action": "login",
        "meta": {"role": body.role}
    }).execute()
    
    return LoginResponse(
        access_token=auth_response.session.access_token,
        refresh_token=auth_response.session.refresh_token,
        user=auth_response.user,
    )
```

#### `routers/test_session.py`
```python
from fastapi import APIRouter, HTTPException, Header
from uuid import uuid4
from services.supabase_client import get_admin_client, get_anon_client
from services.demo_users import DEMO_PASSWORD
from models.schemas import CreateSessionRequest, CreateSessionResponse

router = APIRouter()

@router.post("/create", response_model=CreateSessionResponse)
async def create_test_session(body: CreateSessionRequest):
    admin = get_admin_client()
    anon = get_anon_client()
    session_id = str(uuid4())
    session_token = f"test_{session_id}"
    
    # 1. Создать auth-пользователей
    alexey_email = f"test-{session_id}-alexey@test.local"
    maria_email = f"test-{session_id}-maria@test.local"
    
    alexey_auth = admin.auth.admin.create_user({
        "email": alexey_email,
        "password": DEMO_PASSWORD,
        "email_confirm": True,
    })
    maria_auth = admin.auth.admin.create_user({
        "email": maria_email,
        "password": DEMO_PASSWORD,
        "email_confirm": True,
    })
    
    # 2. Создать записи в users
    admin.table("users").insert([
        {
            "id": str(alexey_auth.user.id),
            "role": "breadwinner",
            "full_name": f"{body.test_name} (Алексей)",
            "email": alexey_email,
            "is_test_user": True,
            "test_session_id": session_id,
        },
        {
            "id": str(maria_auth.user.id),
            "role": "recipient",
            "full_name": f"{body.test_name} (Мария)",
            "email": maria_email,
            "is_test_user": True,
            "test_session_id": session_id,
        },
    ]).execute()
    
    # 3. Создать test_session
    admin.table("test_sessions").insert({
        "id": session_id,
        "test_name": body.test_name,
        "breadwinner_user_id": str(alexey_auth.user.id),
        "recipient_user_id": str(maria_auth.user.id),
        "session_token": session_token,
        "expires_at": "now() + interval '24 hours'",
    }).execute()
    
    # 4. Автоматически добавить Марию как получателя
    admin.table("recipients").insert({
        "owner_id": str(alexey_auth.user.id),
        "full_name": f"{body.test_name} (Мария)",
        "relation": "wife",
        "user_id": str(maria_auth.user.id),
    }).execute()
    
    # 5. Залогинить как breadwinner
    auth_response = anon.auth.sign_in_with_password({
        "email": alexey_email,
        "password": DEMO_PASSWORD,
    })
    
    return CreateSessionResponse(
        session_token=session_token,
        access_token=auth_response.session.access_token,
        refresh_token=auth_response.session.refresh_token,
        user=auth_response.user,
        breadwinner_name=f"{body.test_name} (Алексей)",
        recipient_name=f"{body.test_name} (Мария)",
    )

@router.post("/cleanup")
async def cleanup_session(body: dict):
    session_token = body.get("session_token")
    if not session_token:
        raise HTTPException(400, "session_token required")
    
    admin = get_admin_client()
    
    # Найти сессию
    session = admin.table("test_sessions") \
        .select("*") \
        .eq("session_token", session_token) \
        .single().execute()
    
    if not session.data:
        raise HTTPException(404, "Session not found")
    
    bw_id = session.data["breadwinner_user_id"]
    rc_id = session.data["recipient_user_id"]
    
    # Удалить видео из storage
    videos = admin.table("vault_items") \
        .select("encrypted_blob_path") \
        .eq("owner_id", bw_id) \
        .not_.is_("encrypted_blob_path", "null") \
        .execute()
    
    for v in (videos.data or []):
        if v["encrypted_blob_path"]:
            admin.storage.from_("videos").remove([v["encrypted_blob_path"]])
    
    # Каскадное удаление через таблицы
    admin.table("vault_items").delete().eq("owner_id", bw_id).execute()
    admin.table("recipients").delete().eq("owner_id", bw_id).execute()
    admin.table("triggers").delete().eq("owner_id", bw_id).execute()
    
    # Удалить auth-пользователей
    admin.auth.admin.delete_user(bw_id)
    admin.auth.admin.delete_user(rc_id)
    
    # Удалить записи users
    admin.table("users").delete().eq("test_session_id", session.data["id"]).execute()
    
    # Пометить сессию
    admin.table("test_sessions") \
        .update({"cleaned_up": True}) \
        .eq("id", session.data["id"]).execute()
    
    return {"ok": True}

@router.post("/cleanup-all")
async def cleanup_all(x_admin_key: str = Header(None)):
    from config import settings
    if x_admin_key != settings.admin_key:
        raise HTTPException(403, "Invalid admin key")
    
    admin = get_admin_client()
    sessions = admin.table("test_sessions") \
        .select("session_token") \
        .eq("cleaned_up", False) \
        .execute()
    
    cleaned = 0
    for s in (sessions.data or []):
        await cleanup_session({"session_token": s["session_token"]})
        cleaned += 1
    
    return {"ok": True, "cleaned": cleaned}
```

#### `models/schemas.py`
```python
from pydantic import BaseModel
from typing import Optional, Any

class LoginRequest(BaseModel):
    role: str  # "alexey" | "maria"
    session_token: Optional[str] = None

class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: Any

class CreateSessionRequest(BaseModel):
    test_name: str

class CreateSessionResponse(BaseModel):
    session_token: str
    access_token: str
    refresh_token: str
    user: Any
    breadwinner_name: str
    recipient_name: str
```

### 4.4 Изменения на фронте (Next.js)

#### Удалить
```
app/api/mock-login/route.ts       → удалить
app/api/simulate/event/route.ts   → удалить
app/api/simulate/reset/route.ts   → удалить
app/api/vault/video/route.ts      → удалить
```

#### Добавить
```typescript
// lib/api-client.ts — единая точка вызова FastAPI
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiCall<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("access_token");
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "API error");
  }
  return res.json();
}
```

#### Изменить
Все компоненты, вызывающие `fetch("/api/...")`, заменить на `apiCall("/api/...")`:
- `login-form.tsx` — `fetch("/api/mock-login")` → `apiCall("/api/mock-login")`
- `role-switcher.tsx` — аналогично
- `simulate-actions.tsx` — `/api/simulate/event` и `/api/simulate/reset`
- `video-section.tsx` — `/api/vault/video`

#### Cookies → Bearer tokens
Сейчас auth-токены хранятся в httpOnly cookies (через Supabase SSR). При переходе на FastAPI:
- Токены приходят в JSON-ответе
- Фронт сохраняет в `localStorage`
- Каждый запрос отправляет `Authorization: Bearer <token>`
- Server Components (SSR) теряют доступ к auth → перевести vault/page.tsx на client-side fetch

### 4.5 Deployment

```
┌────────────────────────────────┐
│  Vercel                        │
│  NEXT_PUBLIC_API_URL=          │
│  https://memory-api.up.railway │
│  .app                          │
└──────────────┬─────────────────┘
               │ HTTPS
┌──────────────▼─────────────────┐
│  Railway ($5/mo)               │
│  FastAPI + uvicorn             │
│  SUPABASE_URL=...              │
│  SUPABASE_SERVICE_ROLE_KEY=... │
│  CORS_ORIGINS=["https://      │
│    memory-deposit.vercel.app"] │
└──────────────┬─────────────────┘
               │
┌──────────────▼─────────────────┐
│  Supabase Pro ($25/mo)         │
│  Postgres + Auth + Storage     │
└────────────────────────────────┘
```

#### `requirements.txt`
```
fastapi==0.115.0
uvicorn[standard]==0.30.0
supabase==2.10.0
pydantic-settings==2.5.0
python-multipart==0.0.12
```

#### `Dockerfile`
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 5. Миграция БД (одинаковая для обоих вариантов)

```sql
-- 0007_test_sessions.sql

CREATE TABLE test_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name           TEXT NOT NULL,
  breadwinner_user_id UUID NOT NULL REFERENCES users(id),
  recipient_user_id   UUID NOT NULL REFERENCES users(id),
  session_token       TEXT NOT NULL UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours',
  cleaned_up          BOOLEAN DEFAULT FALSE
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS test_session_id UUID REFERENCES test_sessions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_test_user BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_test_sessions_token ON test_sessions(session_token);
CREATE INDEX idx_users_test_session ON users(test_session_id);

-- RLS
ALTER TABLE test_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON test_sessions
  FOR ALL USING (auth.role() = 'service_role');
```

---

## 6. Итоговое сравнение

| Критерий | Next.js API Routes | FastAPI |
|----------|-------------------|---------|
| Файлов изменить/создать | ~8 | ~15 + Dockerfile |
| Время реализации | 1-2 дня | 3-5 дней |
| Новые проблемы | 0 | CORS, cookies→tokens, двойной деплой, SSR auth |
| Стоимость/мес | $25 | $30-32 |
| Риск сломать демо | Низкий | Средний (переписка auth) |
| Swagger документация | Нет | Да, из коробки |
| Долгосрочная польза | Нет | Python-экосистема, ML/AI |
| Скорость запросов | ~100ms (edge) | ~200-400ms (cross-service) |

---

## 7. Рекомендация

**Для задачи "тест через несколько дней"** — Next.js API Routes быстрее, безопаснее, дешевле.

**Для задачи "портфолио + карьера + будущий продакшен"** — FastAPI оправдан, но нужно заложить 3-5 дней и быть готовым к отладке CORS и auth.

Если выбран FastAPI — начинать с `backend/` как отдельной папки в том же репозитории. Деплой на Railway (1-click from GitHub). Фронт переключить через `NEXT_PUBLIC_API_URL`.
