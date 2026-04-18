"use client";

import { useState } from "react";
import { RotateCcw, Trash2, Video as VideoIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  VideoRecorder,
  type SavedVideo,
} from "@/components/recorder/VideoRecorder";

export interface VideoItem {
  id: string;
  signedUrl: string;
  createdAt: string;
}

interface VideoSectionProps {
  initialVideo: VideoItem | null;
}

export function VideoSection({ initialVideo }: VideoSectionProps) {
  const [video, setVideo] = useState<VideoItem | null>(initialVideo);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSaved(saved: SavedVideo) {
    setVideo({
      id: saved.id,
      signedUrl: saved.signedUrl,
      createdAt: saved.createdAt,
    });
    setOpen(false);
  }

  async function handleDelete() {
    if (!confirm("Удалить видеообращение?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/vault/video", { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setVideo(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Видеообращение</h2>
          <p className="text-sm text-muted-foreground">
            Короткое видео для ваших близких — до 30 секунд
          </p>
        </div>
        {!video && (
          <Button
            onClick={() => setOpen(true)}
            className="gap-2 text-white"
            style={{ backgroundColor: "#21A038" }}
          >
            <VideoIcon className="h-4 w-4" />
            Записать видеообращение
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {video ? (
        <div className="space-y-3 rounded-lg border border-white/10 bg-card p-4">
          <video
            key={video.signedUrl}
            src={video.signedUrl}
            controls
            className="aspect-video w-full rounded-md bg-black"
          />
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto text-xs text-muted-foreground">
              Записано{" "}
              {new Date(video.createdAt).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            <Button
              variant="outline"
              onClick={() => setOpen(true)}
              disabled={busy}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Перезаписать
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={busy}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {busy ? "Удаляем…" : "Удалить"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
          Пока нет видеообращения. Запишите его, чтобы близкие услышали ваш
          голос.
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Запись видеообращения</DialogTitle>
          </DialogHeader>
          <VideoRecorder
            onSaved={handleSaved}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}
