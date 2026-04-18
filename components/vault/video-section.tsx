"use client";

import { useState } from "react";
import { RotateCcw, Trash2, Users, Video as VideoIcon } from "lucide-react";
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
import {
  AccessRulesDialog,
  createSpouseDefaultRule,
  formatAccessRulesLabel,
  type AccessRule,
  type Recipient,
} from "@/components/vault/access-rules-dialog";

export interface VideoItem {
  id: string;
  signedUrl: string;
  createdAt: string;
}

interface VideoSectionProps {
  initialVideo: VideoItem | null;
  recipients: Recipient[];
  initialRules: AccessRule[];
}

export function VideoSection({
  initialVideo,
  recipients,
  initialRules,
}: VideoSectionProps) {
  const [video, setVideo] = useState<VideoItem | null>(initialVideo);
  const [rules, setRules] = useState<AccessRule[]>(initialRules);
  const [open, setOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSaved(saved: SavedVideo) {
    setVideo({
      id: saved.id,
      signedUrl: saved.signedUrl,
      createdAt: saved.createdAt,
    });
    setOpen(false);
    if (rules.length === 0) {
      const defaultRule = await createSpouseDefaultRule(saved.id, recipients);
      if (defaultRule) setRules([defaultRule]);
    }
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
      setRules([]);
    } finally {
      setBusy(false);
    }
  }

  const label = formatAccessRulesLabel(rules, recipients);
  const empty = rules.length === 0;

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
          <p
            className={
              empty
                ? "text-xs text-muted-foreground/60"
                : "text-xs text-muted-foreground"
            }
          >
            {label}
          </p>
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
              onClick={() => setRulesOpen(true)}
              disabled={busy}
              className="gap-2"
            >
              <Users className="h-4 w-4" />
              Кому передать
            </Button>
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

      {video && (
        <AccessRulesDialog
          open={rulesOpen}
          onOpenChange={setRulesOpen}
          vaultItemId={video.id}
          itemLabel="Видеообращение"
          recipients={recipients}
          currentRules={rules}
          onSaved={(next) => setRules(next)}
        />
      )}
    </section>
  );
}
