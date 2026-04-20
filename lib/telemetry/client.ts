import { createClient } from "@/lib/supabase/client";
import type { SceneId } from "@/lib/telemetry/scenes";

export type ConsentState = "granted" | "declined" | null;

export type EventName =
  | "session_start"
  | "consent_granted"
  | "consent_declined"
  | "scene_enter"
  | "scene_leave"
  | "onboarding_started"
  | "onboarding_name_entered"
  | "onboarding_completed"
  | "onboarding_abandoned"
  | "letter_started"
  | "letter_prompt_used"
  | "letter_text_input"
  | "letter_saved"
  | "letter_abandoned"
  | "letter_deleted"
  | "letter_sealed"
  | "video_recording_started"
  | "video_recording_stopped"
  | "video_sealed"
  | "trigger_simulated";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [k: string]: JsonValue };
export type EventProps = Record<string, JsonValue>;

type QueuedEvent = {
  session_id: string;
  event_name: EventName;
  scene: SceneId | null;
  props: EventProps;
  path: string | null;
  user_agent: string | null;
};

const LS_SID = "md.telemetry.sid";
const LS_LAST = "md.telemetry.last";
const LS_CONSENT = "md.telemetry.consent";
const LS_EVER = "md.telemetry.everSeen";
const LS_STARTED_SID = "md.telemetry.startedSid";
const SESSION_IDLE_MS = 30 * 60 * 1000;
const FLUSH_DEBOUNCE_MS = 1500;
const FLUSH_BATCH_SIZE = 10;
const PRE_CONSENT_CAP = 50;
const RETRY_LIMIT = 3;

const queue: QueuedEvent[] = [];
let preConsentBuffer: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let retries = 0;
let sessionStartEmitted = false;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(): string {
  if (isBrowser() && typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `s-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function getSessionId(): string {
  if (!isBrowser()) return "s-server";
  const last = Number(localStorage.getItem(LS_LAST) ?? 0);
  const stored = localStorage.getItem(LS_SID);
  const now = Date.now();
  if (stored && last > 0 && now - last < SESSION_IDLE_MS) {
    localStorage.setItem(LS_LAST, String(now));
    return stored;
  }
  const fresh = randomId();
  localStorage.setItem(LS_SID, fresh);
  localStorage.setItem(LS_LAST, String(now));
  localStorage.removeItem(LS_STARTED_SID);
  sessionStartEmitted = false;
  return fresh;
}

export function getConsent(): ConsentState {
  if (!isBrowser()) return null;
  const v = localStorage.getItem(LS_CONSENT);
  if (v === "granted" || v === "declined") return v;
  return null;
}

export function setConsent(value: "granted" | "declined"): void {
  if (!isBrowser()) return;
  localStorage.setItem(LS_CONSENT, value);
  window.dispatchEvent(new CustomEvent("md:consent", { detail: value }));
  if (value === "granted") {
    emitConsentGranted();
    flushPreConsentBuffer();
  } else {
    preConsentBuffer = [];
  }
}

function emitConsentGranted(): void {
  ensureSessionStart();
  enqueue({
    session_id: getSessionId(),
    event_name: "consent_granted",
    scene: null,
    props: {},
    path: safePath(),
    user_agent: safeUA(),
  });
}

function ensureSessionStart(): void {
  if (sessionStartEmitted) return;
  sessionStartEmitted = true;
  const sid = getSessionId();
  // В течение одной сессии session_start должен быть один — даже если
  // страница перезагружалась несколько раз. Храним флаг в LS по sid.
  if (isBrowser()) {
    const startedFor = localStorage.getItem(LS_STARTED_SID);
    if (startedFor === sid) return;
    localStorage.setItem(LS_STARTED_SID, sid);
  }
  const everSeen = isBrowser() && localStorage.getItem(LS_EVER) === "1";
  if (isBrowser()) localStorage.setItem(LS_EVER, "1");
  enqueue({
    session_id: sid,
    event_name: "session_start",
    scene: null,
    props: { returnVisit: everSeen, ts: nowIso() },
    path: safePath(),
    user_agent: safeUA(),
  });
}

function safePath(): string | null {
  if (!isBrowser()) return null;
  return (window.location.pathname + window.location.search).split("?")[0];
}

function safeUA(): string | null {
  if (!isBrowser()) return null;
  return (navigator.userAgent ?? "").slice(0, 200);
}

function enqueue(evt: QueuedEvent): void {
  const consent = getConsent();
  if (consent !== "granted") {
    preConsentBuffer.push(evt);
    if (preConsentBuffer.length > PRE_CONSENT_CAP) {
      preConsentBuffer = preConsentBuffer.slice(-PRE_CONSENT_CAP);
    }
    return;
  }
  queue.push(evt);
  if (queue.length >= FLUSH_BATCH_SIZE) {
    void flushQueue();
    return;
  }
  scheduleFlush();
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushQueue();
  }, FLUSH_DEBOUNCE_MS);
}

function flushPreConsentBuffer(): void {
  if (preConsentBuffer.length === 0) return;
  for (const e of preConsentBuffer) queue.push(e);
  preConsentBuffer = [];
  void flushQueue();
}

async function flushQueue(): Promise<void> {
  if (!isBrowser()) return;
  if (queue.length === 0) return;

  const batch = queue.splice(0, queue.length);
  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? null;

    const rows = batch.map((e) => ({
      session_id: e.session_id,
      user_id: userId,
      event_name: e.event_name,
      scene: e.scene,
      props: e.props,
      path: e.path,
      user_agent: e.user_agent,
    }));

    const { error } = await supabase.from("telemetry_events").insert(rows);
    if (error) throw error;
    retries = 0;
  } catch (err) {
    retries += 1;
    if (retries <= RETRY_LIMIT) {
      for (let i = batch.length - 1; i >= 0; i--) queue.unshift(batch[i]);
      setTimeout(() => void flushQueue(), 1000 * retries);
    } else {
      retries = 0;
      if (process.env.NODE_ENV !== "production") {
        console.warn("[telemetry] dropped batch after retries", err);
      }
    }
  }
}

export function track(
  name: EventName,
  props: EventProps = {},
  scene: SceneId | null = null
): void {
  if (!isBrowser()) return;
  const sid = getSessionId();
  if (getConsent() === "granted") ensureSessionStart();
  enqueue({
    session_id: sid,
    event_name: name,
    scene,
    props,
    path: safePath(),
    user_agent: safeUA(),
  });
}

export function flushNow(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  void flushQueue();
}
