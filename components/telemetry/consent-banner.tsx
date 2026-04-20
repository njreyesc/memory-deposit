"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { getConsent, setConsent, type ConsentState } from "@/lib/telemetry/client";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("md:consent", onChange);
  return () => window.removeEventListener("md:consent", onChange);
}

function getSnapshot(): ConsentState {
  return getConsent();
}

function getServerSnapshot(): ConsentState {
  // On SSR we render nothing — the banner is a purely client-side concern.
  return "granted";
}

export function ConsentBanner() {
  const consent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Согласие на сбор анонимной телеметрии"
      className="pointer-events-auto fixed inset-x-4 bottom-4 z-50 mx-auto max-w-3xl rounded-xl border border-white/10 bg-card/95 p-4 shadow-lg backdrop-blur md:inset-x-auto md:left-1/2 md:-translate-x-1/2"
    >
      <p className="text-sm leading-relaxed text-foreground">
        Мы записываем, на какие экраны вы заходите и какие кнопки нажимаете —
        чтобы улучшать прототип. Без содержимого писем и личных данных.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setConsent("granted")}>
          Помогаю
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setConsent("declined")}
        >
          Не сейчас
        </Button>
      </div>
    </div>
  );
}
