"use client";

import { useState } from "react";
import { ChevronDown, Clock, Mail } from "lucide-react";

export interface RecipientMaterial {
  vault_item_id: string;
  item_type: "note" | "video";
  title: string | null;
  content: string | null;
  item_created_at: string;
  delay_days: number;
  available_at: string;
  available_now: boolean;
  signed_url: string | null;
}

interface RecipientViewProps {
  ownerFullName: string;
  materials: RecipientMaterial[];
}

function firstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[0] ?? fullName;
}

function formatDate(iso: string): string {
  // ru-RU appends "г." to the year — strip it so trailing punctuation in
  // copy ("…будет доступно <дата>.") doesn't end up doubled.
  return new Date(iso)
    .toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    .replace(/\s*г\.?$/, "");
}

export function RecipientView({ ownerFullName, materials }: RecipientViewProps) {
  const ownerFirst = firstName(ownerFullName);

  const video = materials.find((m) => m.item_type === "video") ?? null;
  const notes = materials.filter((m) => m.item_type === "note");

  const hasAvailableContent =
    (video && video.available_now) || notes.some((n) => n.available_now);

  return (
    <div className="mx-auto max-w-3xl space-y-14 py-4">
      <header className="space-y-4">
        <h1 className="text-3xl font-light leading-tight tracking-tight sm:text-4xl">
          {ownerFirst} оставил вам сообщение
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
          Вы можете посмотреть это, когда будете готовы.{" "}
          <span className="block sm:inline">Материалы сохранятся здесь.</span>
        </p>
      </header>

      {video && <VideoBlock video={video} />}

      {notes.length > 0 && <NotesBlock notes={notes} />}

      {!hasAvailableContent && !video && notes.length === 0 && (
        <p className="rounded-lg border border-dashed border-white/10 px-6 py-12 text-center text-base text-muted-foreground">
          {ownerFirst} пока не оставил сообщений для вас.
        </p>
      )}
    </div>
  );
}

function VideoBlock({ video }: { video: RecipientMaterial }) {
  if (!video.available_now || !video.signed_url) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-normal text-foreground/90">
          Видеообращение
        </h2>
        <DelayedPlaceholder availableAt={video.available_at} kind="video" />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div
        className="overflow-hidden rounded-2xl border border-[#21A038]/25 bg-black"
        style={{ boxShadow: "0 0 60px -10px rgba(33, 160, 56, 0.25)" }}
      >
        <video
          src={video.signed_url}
          controls
          preload="metadata"
          className="aspect-video w-full bg-black"
        />
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Видеообращение
      </p>
    </section>
  );
}

function NotesBlock({ notes }: { notes: RecipientMaterial[] }) {
  return (
    <section className="space-y-5">
      <h2 className="text-xl font-normal text-foreground/90">Письма для вас</h2>
      <ul className="space-y-3">
        {notes.map((note) =>
          note.available_now ? (
            <NoteCard key={note.vault_item_id} note={note} />
          ) : (
            <li key={note.vault_item_id}>
              <DelayedPlaceholder availableAt={note.available_at} kind="note" />
            </li>
          )
        )}
      </ul>
    </section>
  );
}

function NoteCard({ note }: { note: RecipientMaterial }) {
  const [open, setOpen] = useState(false);
  const title = note.title ?? "Письмо";
  const content = note.content ?? "";

  return (
    <li className="overflow-hidden rounded-xl border border-white/10 bg-card/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/5"
        aria-expanded={open}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#21A038]/10 text-[#21A038]">
          <Mail className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-normal">{title}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(note.item_created_at)}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="border-t border-white/10 px-5 py-5">
          <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground/90">
            {content}
          </p>
        </div>
      )}
    </li>
  );
}

function DelayedPlaceholder({
  availableAt,
  kind,
}: {
  availableAt: string;
  kind: "note" | "video";
}) {
  const label = kind === "video" ? "Видеообращение" : "Следующее письмо";
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed border-white/10 px-5 py-5 text-sm text-muted-foreground">
      <Clock className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        {label} станет доступно {formatDate(availableAt)}.
      </p>
    </div>
  );
}
