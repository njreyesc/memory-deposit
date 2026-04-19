"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SimulateActionsProps {
  alreadyDelivered: boolean;
  hasData: boolean;
}

type EventState = "idle" | "submitting" | "done";

export function SimulateActions({
  alreadyDelivered,
  hasData,
}: SimulateActionsProps) {
  const router = useRouter();
  const [eventState, setEventState] = useState<EventState>("idle");
  const [eventError, setEventError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    if (eventState !== "done") return;
    const t = setTimeout(() => {
      router.push("/vault");
      router.refresh();
    }, 3000);
    return () => clearTimeout(t);
  }, [eventState, router]);

  useEffect(() => {
    if (!resetDone) return;
    const t = setTimeout(() => {
      router.push("/vault");
      router.refresh();
    }, 1200);
    return () => clearTimeout(t);
  }, [resetDone, router]);

  async function handleConfirmEvent() {
    if (
      !confirm(
        "Это действие активирует передачу всех материалов получателям. Продолжить?"
      )
    )
      return;

    setEventState("submitting");
    setEventError(null);
    try {
      const res = await fetch("/api/simulate/event", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        request_id?: string;
        error?: string;
      };
      if (!res.ok || !body.ok || !body.request_id) {
        setEventError(body.error ?? `HTTP ${res.status}`);
        setEventState("idle");
        return;
      }
      setRequestId(body.request_id);
      setEventState("done");
    } catch (err) {
      setEventError(err instanceof Error ? err.message : "Неизвестная ошибка");
      setEventState("idle");
    }
  }

  async function handleReset() {
    if (!confirm("Удалить все данные демо? Действие необратимо.")) return;

    setResetting(true);
    setResetError(null);
    try {
      const res = await fetch("/api/simulate/reset", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !body.ok) {
        setResetError(body.error ?? `HTTP ${res.status}`);
        setResetting(false);
        return;
      }
      setResetDone(true);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Неизвестная ошибка");
      setResetting(false);
    }
  }

  return (
    <>
      {/* Event simulation */}
      <section className="rounded-lg border border-white/10 bg-card p-5">
        <h2 className="text-lg font-semibold">
          Подтверждение события через СМЭВ/ЗАГС
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Нажмите для имитации автоматического получения подтверждения от
          государственной системы. Запустит процесс передачи материалов
          получателям.
        </p>

        {eventState === "done" && requestId ? (
          <div className="mt-5 space-y-1 rounded-md border border-border bg-background/40 p-4">
            <p className="font-medium">Событие подтверждено.</p>
            <p className="text-sm text-muted-foreground">
              Идентификатор ответа СМЭВ:{" "}
              <span className="font-mono">№{requestId}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Инициирована передача доступа получателям.
            </p>
            <p className="pt-2 text-xs text-muted-foreground">
              Переключение на /vault через 3 секунды…
            </p>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-3">
            <Button
              type="button"
              variant="destructive"
              size="lg"
              onClick={handleConfirmEvent}
              disabled={eventState === "submitting" || alreadyDelivered}
              className="gap-2 self-start"
            >
              <ShieldCheck className="h-4 w-4" />
              {eventState === "submitting"
                ? "Отправка запроса…"
                : "Подтвердить событие"}
            </Button>
            {alreadyDelivered && (
              <p className="text-xs text-muted-foreground">
                Подтверждение уже выполнено в рамках текущей сессии.
              </p>
            )}
            {eventError && (
              <p className="text-sm text-destructive">{eventError}</p>
            )}
          </div>
        )}
      </section>

      {/* Reset */}
      <section className="rounded-lg border border-white/10 bg-card p-5">
        <h2 className="text-lg font-semibold">Сброс данных для тестирования</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Удалит все ваши письма, видео, получателей, правила доступа и
          триггеры. Используется между сессиями тестирования.
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={resetting || resetDone || !hasData}
            className="gap-2 self-start"
          >
            <RefreshCw className="h-4 w-4" />
            {resetting ? "Удаляем…" : resetDone ? "Демо сброшено" : "Сбросить демо"}
          </Button>
          {!hasData && !resetDone && (
            <p className="text-xs text-muted-foreground">
              Удалять пока нечего — состояние уже чистое.
            </p>
          )}
          {resetDone && (
            <p className="text-xs text-muted-foreground">
              Возвращаемся на /vault…
            </p>
          )}
          {resetError && <p className="text-sm text-destructive">{resetError}</p>}
        </div>
      </section>
    </>
  );
}
