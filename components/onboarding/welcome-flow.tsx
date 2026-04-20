"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { SceneTracker } from "@/components/telemetry/scene-tracker";
import { track } from "@/lib/telemetry/client";

interface WelcomeFlowProps {
  firstName: string;
  userId: string;
}

type Step = "hello" | "write" | "saving";

const MIN_TEXT_LENGTH = 10;
const TEXT_EVENT_THROTTLE_MS = 10_000;
const PAUSE_THRESHOLD_MS = 5_000;

export function WelcomeFlow({ firstName, userId }: WelcomeFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("hello");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const startedAtRef = useRef<number>(Date.now());
  const lastKeyAtRef = useRef<number>(0);
  const lastEventAtRef = useRef<number>(0);
  const pausesRef = useRef<number>(0);
  const completedRef = useRef<boolean>(false);

  useEffect(() => {
    startedAtRef.current = Date.now();
    track("onboarding_started", { framing: "letter" }, "onboarding");
    return () => {
      if (completedRef.current) return;
      track(
        "onboarding_abandoned",
        { lastStep: step, length: text.trim().length },
        "onboarding"
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(value: string) {
    setText(value);
    const now = Date.now();
    if (lastKeyAtRef.current > 0 && now - lastKeyAtRef.current > PAUSE_THRESHOLD_MS) {
      pausesRef.current += 1;
    }
    lastKeyAtRef.current = now;
    if (now - lastEventAtRef.current >= TEXT_EVENT_THROTTLE_MS) {
      lastEventAtRef.current = now;
      track(
        "onboarding_name_entered",
        { length: value.length, pausesOver5s: pausesRef.current },
        "onboarding"
      );
    }
  }

  function goToVault(withWelcomeFlag: boolean) {
    startTransition(() => {
      router.replace(withWelcomeFlag ? "/vault?welcome=1" : "/vault");
    });
  }

  async function handleSave() {
    const body = text.trim();
    if (body.length < MIN_TEXT_LENGTH) return;

    setError(null);
    setStep("saving");

    const supabase = createClient();
    const { error: insertError } = await supabase.from("vault_items").insert({
      owner_id: userId,
      type: "note",
      title: "Первое письмо",
      content: body,
    });

    if (insertError) {
      setError(`Не удалось сохранить: ${insertError.message}`);
      setStep("write");
      return;
    }

    completedRef.current = true;
    track(
      "onboarding_completed",
      {
        letterLength: body.length,
        totalMs: Date.now() - startedAtRef.current,
        pauses: pausesRef.current,
      },
      "onboarding"
    );
    goToVault(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <SceneTracker scene="onboarding" />
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        {step === "hello" && (
          <div className="space-y-5">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--primary) 12%, transparent)",
                color: "var(--primary)",
              }}
            >
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold leading-tight">
                {firstName}, начнём с одного письма.
              </h1>
              <p className="text-sm text-muted-foreground">
                Это займёт 3 минуты. Потом вы сможете добавить видео, фото и
                других близких — когда будет настроение.
              </p>
            </div>
            <Button
              size="lg"
              className="w-full"
              onClick={() => setStep("write")}
            >
              Начать
            </Button>
          </div>
        )}

        {step === "write" && (
          <div className="space-y-5">
            <h1 className="text-xl font-semibold leading-snug">
              Напишите одну вещь, которую хотите, чтобы они помнили.
            </h1>
            <textarea
              autoFocus
              rows={7}
              value={text}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Можно одним абзацем. Это черновик — его можно переписать потом."
              className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => {
                  completedRef.current = true;
                  track(
                    "onboarding_abandoned",
                    {
                      lastStep: "write",
                      length: text.trim().length,
                      totalMs: Date.now() - startedAtRef.current,
                    },
                    "onboarding"
                  );
                  goToVault(false);
                }}
              >
                Пропустить
              </Button>
              <Button
                size="lg"
                onClick={handleSave}
                disabled={text.trim().length < MIN_TEXT_LENGTH}
              >
                Сохранить
              </Button>
            </div>
          </div>
        )}

        {step === "saving" && (
          <p className="text-center text-sm text-muted-foreground">
            Сохраняем…
          </p>
        )}
      </div>
    </div>
  );
}
