"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, MessageCircle, Trash2 } from "lucide-react";
import { track } from "@/lib/telemetry/client";
import type { SceneId } from "@/lib/telemetry/scenes";
import { cn } from "@/lib/utils";

type Scene = SceneId | "default";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
}

const QUICK_QUESTIONS: Record<Scene, string[]> = {
  onboarding: [
    "С чего начать?",
    "Как сохранить финансовые активы для семьи?",
    "Что оформляется у нотариуса?",
  ],
  vault: [
    "Какие документы важнее всего?",
    "Как описать банковские счета?",
    "Нужно ли указывать пароли от Госуслуг?",
  ],
  finance: [
    "Как сохранить финансовые активы для семьи?",
    "Что делать с наследством — с чего начать?",
    "Какие бумаги нужны наследнику?",
  ],
  recipients: [
    "Сколько доверенных лиц нужно?",
    "Можно ли изменить список позже?",
    "Что видит близкий до события?",
  ],
  simulate: [
    "Как подтверждается событие через ЗАГС?",
    "Можно ли отменить триггер?",
  ],
  default: [
    "Какие документы важнее всего?",
    "Как сохранить финансовые активы для семьи?",
    "Что оформляется у нотариуса?",
  ],
};

// Пока ассистент в демо-режиме: возвращаем одну заглушку, но явно
// перечисляем, по чему он будет помогать в проде — включая правовые
// вопросы (сохранение активов, наследство) и отсылку к нотариусу.
const STUB_ANSWER =
  "Это демо-режим — полноценного ответа пока нет. В рабочей версии подскажу по текущему шагу и по правовым вопросам: как сохранить финансовые активы для семьи и как разобраться с наследством. Юридические решения всё равно с нотариусом.";

function sceneFromPath(pathname: string | null): Scene {
  if (!pathname) return "default";
  if (pathname.startsWith("/vault")) return "vault";
  if (pathname.startsWith("/finance")) return "finance";
  if (pathname.startsWith("/recipients")) return "recipients";
  if (pathname.startsWith("/simulate")) return "simulate";
  if (pathname.startsWith("/welcome") || pathname === "/") return "onboarding";
  return "default";
}

interface AssistantWidgetProps {
  userId: string;
}

export function AssistantWidget({ userId }: AssistantWidgetProps) {
  const pathname = usePathname();
  const scene = sceneFromPath(pathname);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const storageKey = `assistant-history:${userId}`;
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const hasMessages = messages.length > 0;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Message[];
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {
      // ignore malformed history
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      // storage full — silently ignore for demo
    }
  }, [messages, storageKey]);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open, thinking]);

  function openPanel() {
    if (!open) {
      track("ai_opened", { scene });
    }
    setOpen(true);
  }

  function closePanel() {
    setOpen(false);
  }

  function clearHistory() {
    setMessages([]);
  }

  function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || thinking) return;

    track("ai_question_asked", { scene, length: trimmed.length });

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setThinking(true);

    setTimeout(() => {
      const botMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: STUB_ANSWER,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setThinking(false);
    }, 700);
  }

  const quick = QUICK_QUESTIONS[scene] ?? QUICK_QUESTIONS.default;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={openPanel}
          aria-label="Открыть ассистента"
          className="fixed bottom-6 left-6 z-40 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          <MessageCircle className="h-4 w-4" />
          Спросить ассистента
        </button>
      )}

      {open && (
        <>
          <div
            onClick={closePanel}
            aria-hidden
            className="fixed inset-0 z-40 bg-foreground/10"
          />
          <aside
            role="dialog"
            aria-label="ИИ-ассистент"
            className="fixed inset-y-0 left-0 z-50 flex w-full max-w-sm flex-col border-r border-border bg-background shadow-xl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground">
                  а
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    ИИ-ассистент
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Поможет разобраться, без спешки
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {hasMessages && (
                  <button
                    type="button"
                    onClick={clearHistory}
                    aria-label="Очистить историю"
                    className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={closePanel}
                  aria-label="Закрыть"
                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm">
                <p className="font-medium text-foreground">
                  О чём подумать вместе?
                </p>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  Я могу помочь разобраться с текущим шагом, подсказать, о чём
                  писать, или ответить на вопрос — в том числе по правовым: как
                  сохранить финансовые активы для семьи и как оформить
                  наследство. Отвечаю коротко. Ничего не запоминаю у себя —
                  только в этом окне.
                </p>
              </div>

              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    m.role === "user"
                      ? "ml-8 bg-primary/15 text-foreground"
                      : "mr-8 border border-border bg-card text-foreground"
                  )}
                >
                  {m.content}
                </div>
              ))}

              {thinking && (
                <div className="mr-8 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                  Думаю…
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            <div className="space-y-3 border-t border-border px-5 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Быстрые вопросы
                </p>
                <div className="mt-2 space-y-1.5">
                  {quick.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => ask(q)}
                      disabled={thinking}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  ask(input);
                }}
                className="flex items-center gap-2"
              >
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Спросите что-нибудь…"
                  disabled={thinking}
                  className="h-9 flex-1 rounded-full border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || thinking}
                  aria-label="Отправить"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <p className="text-[11px] leading-relaxed text-muted-foreground/80">
                Ассистент может ошибаться. Юридические решения — с нотариусом.
              </p>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
