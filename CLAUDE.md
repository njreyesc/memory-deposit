# Memory Deposit — Project Context

## What This Is
A prototype of a digital family vault and automatic inheritance transfer for the Sber ecosystem. The purpose of this repo is a demo for a 7-minute internal pitch at Sber. **This is NOT production.**

## Demo Audience
Sber top management, SberDisk product team, CISO. Scenario: a click-through tour from user login to an heir gaining access after "event confirmation via civil registry (ZAGS)."

## Demo Scenario (Project Readiness Criteria)
1. Log in as Alexey (breadwinner, 45 years old)
2. Upload document "Will.pdf" (encrypted blob visible in DevTools)
3. Record a 15-second video message
4. Add wife Maria as a recipient, configure access rules
5. Navigate to /simulate, click "Event confirmed via SMEV/ZAGS"
6. Switch to Maria's role
7. Maria sees the message, documents, and video from Alexey

## Tech Stack (do not change without my explicit permission)
- Next.js 14 App Router + TypeScript (strict mode)
- Tailwind + shadcn/ui (slate theme, dark mode by default)
- Supabase (auth, Postgres, storage, RLS)
- Zustand for global state
- react-hook-form + zod for forms
- Web Crypto API for document encryption (no third-party libraries)
- MediaRecorder API for video
- lucide-react for icons

## Branding
- Accent color: #21A038 (Sber green)
- Background: #0A1628 (dark navigation)
- Font: Montserrat via next/font
- Interface: always dark theme

## Key Architectural Principles
1. **Zero-knowledge for documents**: the server never sees decrypted files. Encryption happens in the browser via Web Crypto; the key is derived from the user's master password (PBKDF2, 100k iterations, SHA-256); the key itself never leaves the client.
2. **Video is NOT encrypted in this prototype.** In production it will be encrypted using the same mechanism — architecturally identical. Omitted in the prototype for demo performance (20 MB through Web Crypto hangs the UI for several seconds, which would ruin the pitch).
3. **RLS is enabled on all tables from day one.**
4. **SberID — fake button.** No real OAuth integration. There is a role switcher "Alexey / Maria" for the demo.
5. **SMEV/ZAGS — mocked via admin endpoint /simulate.** One button: "Simulate event confirmation."

## Rules for Working with Claude Code
- Work on ONE feature at a time. Do not start the next one without my OK.
- At the end of each feature — a short summary: what was done, how to verify.
- If there's a fork in implementation — ask, don't assume.
- No tests, CI, or Storybook. This is a demo.
- TypeScript strict, `any` is forbidden.
- I make commits myself; do not create them.
- Do not "optimize on the side" or "add bonus features."

## Folder Structure (created incrementally)
```
app/
  (auth)/login/
  (app)/vault/
  (app)/recipients/
  (app)/triggers/
  (app)/timeline/
  (admin)/simulate/
  api/
components/
  ui/           # shadcn
  vault/
  recorder/
  sber/         # branded elements
lib/
  crypto.ts     # Web Crypto AES-GCM + PBKDF2
  supabase/
  mock-smev.ts
  role-switch.ts  # Alexey/Maria switcher
supabase/migrations/
public/
  fallback-video.webm  # pre-recorded backup for demo
```

## Database Schema (minimal)
- `users` (id, role, full_name, email, last_seen_at)
- `vault_items` (id, owner_id, type, name, encrypted_blob_path, iv, created_at) — type: document | video
- `recipients` (id, owner_id, full_name, relation, user_id)
- `access_rules` (id, vault_item_id, recipient_id, delay_days)
- `triggers` (id, owner_id, type, status, confirmed_at) — type: zags_event | dead_man_switch
- `audit_log` (id, actor_id, action, meta, created_at)

## Demo Characters (seed data)
- Alexey Ivanov, 45 years old, breadwinner
- Maria Ivanova, 42 years old, wife and primary recipient

Switching between them — dropdown in the corner of the interface.

## Out of Scope for the Prototype (do not suggest implementing)
- Real SberID OAuth
- Video encryption
- GOST cryptography, CryptoPro, HSM
- Real SMEV/ZAGS integration
- Password manager
- Integrations with SberInsurance/Investments/Health
- Onboarding, profile, 2FA
- Mobile version
- Tests, CI/CD, Storybook

## Demo Environment Requirements
HTTPS (Vercel OK), Chrome, camera pre-allowed in the browser, pre-recorded fallback video in /public in case of issues.
