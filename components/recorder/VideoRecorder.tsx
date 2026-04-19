"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "videos";
const MAX_BYTES = 20 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const MAX_SECONDS = 30;

type RecorderState = "idle" | "requesting" | "recording" | "preview" | "saving";

export interface SavedVideo {
  id: string;
  signedUrl: string;
  createdAt: string;
}

interface VideoRecorderProps {
  onSaved: (video: SavedVideo) => void;
  onCancel: () => void;
}

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  if (MediaRecorder.isTypeSupported("video/webm")) return "video/webm";
  if (MediaRecorder.isTypeSupported("video/mp4")) return "video/mp4";
  return undefined;
}

function extFromType(mime: string): string {
  return mime.includes("mp4") ? "mp4" : "webm";
}

export function VideoRecorder({ onSaved, onCancel }: VideoRecorderProps) {
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cameraMissing, setCameraMissing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(MAX_SECONDS);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      stopStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Callback ref fires synchronously when the <video> element mounts/unmounts
  // inside the Dialog portal. This is more reliable than a useEffect on state,
  // which can race with the portal's mount animation.
  const attachLiveVideo = useCallback((el: HTMLVideoElement | null) => {
    if (!el) return;
    const stream = streamRef.current;
    if (!stream) return;
    el.srcObject = stream;
    const p = el.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }, []);

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function startRecording() {
    setError(null);
    setCameraMissing(false);
    setState("requesting");

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setRecordedBlob(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Браузер не поддерживает запись с камеры.");
      setState("idle");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;

      const mime = pickMime();
      const recorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined
      );
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const finalType = recorder.mimeType || mime || "video/webm";
        const blob = new Blob(chunksRef.current, { type: finalType });
        stopStream();
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setPreviewUrl(url);
        setState("preview");
      };

      recorder.start();
      setSecondsLeft(MAX_SECONDS);
      setState("recording");
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError(
          "Нет разрешения на доступ к камере. Разрешите доступ в настройках браузера."
        );
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setError("Камера не найдена. Подключите камеру и попробуйте снова.");
        setCameraMissing(true);
      } else {
        setError(
          err instanceof Error ? err.message : "Не удалось запустить запись."
        );
      }
      setState("idle");
      stopStream();
    }
  }

  useEffect(() => {
    if (state !== "recording") return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          const rec = recorderRef.current;
          if (rec && rec.state !== "inactive") rec.stop();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [state]);

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  async function saveBlob(blob: Blob) {
    setState("saving");
    setError(null);

    if (blob.size > MAX_BYTES) {
      setError(
        `Видео превышает 20 MB (${(blob.size / 1024 / 1024).toFixed(1)} MB).`
      );
      setState("preview");
      return;
    }

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Сессия не найдена — войдите заново.");

      const ext = extFromType(blob.type || "video/webm");
      const path = `${user.id}/main.${ext}`;
      const contentType = blob.type || `video/${ext}`;

      // Clean up old file if its extension differs from the new one
      const { data: existing } = await supabase
        .from("vault_items")
        .select("id, video_path")
        .eq("owner_id", user.id)
        .eq("type", "video")
        .maybeSingle();

      const existingRow = existing as
        | { id: string; video_path: string | null }
        | null;

      if (existingRow?.video_path && existingRow.video_path !== path) {
        await supabase.storage.from(BUCKET).remove([existingRow.video_path]);
      }

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType, upsert: true });
      if (uploadError) {
        throw new Error(`Загрузка: ${uploadError.message}`);
      }

      let rowId: string;
      let createdAt: string;

      if (existingRow?.id) {
        const { data, error } = await supabase
          .from("vault_items")
          .update({ video_path: path, name: `main.${ext}` })
          .eq("id", existingRow.id)
          .select("id, created_at")
          .single();
        if (error || !data) {
          throw new Error(error?.message ?? "Не удалось обновить запись.");
        }
        rowId = data.id as string;
        createdAt = data.created_at as string;
      } else {
        const { data, error } = await supabase
          .from("vault_items")
          .insert({
            owner_id: user.id,
            type: "video",
            name: `main.${ext}`,
            video_path: path,
          })
          .select("id, created_at")
          .single();
        if (error || !data) {
          throw new Error(error?.message ?? "Не удалось создать запись.");
        }
        rowId = data.id as string;
        createdAt = data.created_at as string;
      }

      const { data: signed, error: signError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (signError || !signed) {
        throw new Error(
          `Не удалось получить ссылку: ${signError?.message ?? "unknown"}`
        );
      }

      onSaved({
        id: rowId,
        signedUrl: signed.signedUrl,
        createdAt,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить.");
      setState("preview");
    }
  }

  async function handleSave() {
    if (!recordedBlob) return;
    await saveBlob(recordedBlob);
  }

  async function handleUseFallback() {
    setError(null);
    try {
      const res = await fetch("/fallback-video.webm");
      if (!res.ok) throw new Error(`fallback HTTP ${res.status}`);
      const blob = await res.blob();
      if (blob.size === 0) {
        throw new Error(
          "Файл public/fallback-video.webm пуст. Замените его на реальное видео."
        );
      }
      await saveBlob(new Blob([blob], { type: "video/webm" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить fallback.");
    }
  }

  const showIdle = state === "idle" || state === "requesting";
  const showRecording = state === "recording";
  const showPreview = state === "preview" || state === "saving";
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="space-y-4">
      {showIdle && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Разрешите доступ к камере и микрофону. Запись остановится
            автоматически через 30 секунд.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={startRecording}
              disabled={state === "requesting"}
              className="gap-2 text-white"
              style={{ backgroundColor: "#21A038" }}
            >
              <Circle className="h-3 w-3 fill-current" />
              {state === "requesting" ? "Запрашиваем камеру…" : "Начать запись"}
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Отмена
            </Button>
            {(isDev || cameraMissing) && (
              <Button
                variant="ghost"
                onClick={handleUseFallback}
                className="ml-auto text-xs text-muted-foreground"
              >
                {isDev ? "Использовать fallback (dev)" : "Использовать запасное видео"}
              </Button>
            )}
          </div>
        </div>
      )}

      {showRecording && (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black">
            <video
              ref={attachLiveVideo}
              autoPlay
              muted
              playsInline
              className="aspect-video w-full"
            />
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
              REC
            </div>
            <div className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium tabular-nums text-white">
              0:{String(secondsLeft).padStart(2, "0")}
            </div>
          </div>
          <Button variant="destructive" onClick={stopRecording} className="gap-2">
            <Square className="h-3 w-3 fill-current" />
            Остановить
          </Button>
        </div>
      )}

      {showPreview && (
        <div className="space-y-3">
          <video
            src={previewUrl ?? undefined}
            controls
            className="aspect-video w-full rounded-lg border border-white/10 bg-black"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={state === "saving"}>
              {state === "saving" ? "Сохраняем…" : "Сохранить"}
            </Button>
            <Button
              variant="outline"
              onClick={startRecording}
              disabled={state === "saving"}
            >
              Перезаписать
            </Button>
            <Button
              variant="ghost"
              onClick={onCancel}
              disabled={state === "saving"}
            >
              Отмена
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
