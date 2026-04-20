"use client";

import { useEffect } from "react";
import { flushNow, getSessionId } from "@/lib/telemetry/client";
import { ConsentBanner } from "@/components/telemetry/consent-banner";

export function TelemetryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    getSessionId();

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    const onBeforeUnload = () => flushNow();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  return (
    <>
      {children}
      <ConsentBanner />
    </>
  );
}
