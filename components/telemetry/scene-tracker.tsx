"use client";

import { useEffect } from "react";
import { track } from "@/lib/telemetry/client";
import type { SceneId } from "@/lib/telemetry/scenes";

// Эмитим scene_enter с задержкой: если компонент отмонтировался быстрее
// (StrictMode двойной mount/cleanup, навигация-пролёт, HMR) — ни enter, ни leave
// в БД не уходят. Это гарантирует симметричные и осмысленные пары.
const ENTER_DELAY_MS = 200;

export function SceneTracker({ scene }: { scene: SceneId }) {
  useEffect(() => {
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    let enterSent = false;
    const timer = setTimeout(() => {
      enterSent = true;
      track("scene_enter", {}, scene);
    }, ENTER_DELAY_MS);

    return () => {
      clearTimeout(timer);
      if (!enterSent) return;
      const end =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      track(
        "scene_leave",
        { msSpent: Math.round(end - now - ENTER_DELAY_MS) },
        scene
      );
    };
  }, [scene]);

  return null;
}
