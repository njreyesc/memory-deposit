"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  Lock,
  Mail,
  Pencil,
  Plus,
  Quote,
  RotateCcw,
  Trash2,
  Users,
  Video as VideoIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  AccessRulesDialog,
  createSpouseDefaultRule,
  formatAccessRulesLabel,
  type AccessRule,
  type Recipient,
} from "@/components/vault/access-rules-dialog";
import {
  VideoRecorder,
  type SavedVideo,
} from "@/components/recorder/VideoRecorder";
import type { Note } from "@/components/vault/notes-section";
import type { VideoItem } from "@/components/vault/video-section";

interface LettersCapsulesProps {
  ownerId: string;
  initialNotes: Note[];
  initialVideo: VideoItem | null;
  recipients: Recipient[];
  initialRulesByItem: Record<string, AccessRule[]>;
  initialVideoRules: AccessRule[];
}

const noteSchema = z.object({
  title: z.string().trim().min(1, "Заголовок обязателен").max(200),
  content: z.string().trim().min(1, "Текст обязателен").max(10000),
});

type NoteForm = z.infer<typeof noteSchema>;

const PROMPTS: readonly string[] = [
  "Что я понял к этим годам",
  "Рецепт, который я хочу передать",
  "День, о котором я никогда не рассказывал",
  "Три вещи, за которые я благодарен",
  "Совет, который мне самому дали поздно",
];

const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
] as const;

function formatDayMonth(iso: string, withYear = false): string {
  const d = new Date(iso);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  if (withYear && d.getFullYear() !== new Date().getFullYear()) {
    return `${base} ${d.getFullYear()}`;
  }
  return base;
}

function parseTitle(raw: string): { head: string; tail: string | null } {
  const parts = raw.split(" — ");
  if (parts.length < 2) return { head: raw, tail: null };
  const [head, ...rest] = parts;
  return { head, tail: rest.join(" — ") };
}

function excerpt(text: string, max = 140): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  return clean.slice(0, max).trimEnd() + "…";
}

export function LettersCapsules({
  ownerId,
  initialNotes,
  initialVideo,
  recipients,
  initialRulesByItem,
  initialVideoRules,
}: LettersCapsulesProps) {
  const [tab, setTab] = useState<"letters" | "videos">("letters");
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [rulesByItem, setRulesByItem] =
    useState<Record<string, AccessRule[]>>(initialRulesByItem);

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rulesNoteId, setRulesNoteId] = useState<string | null>(null);

  // Video state
  const [video, setVideo] = useState<VideoItem | null>(initialVideo);
  const [videoRules, setVideoRules] = useState<AccessRule[]>(initialVideoRules);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [videoRulesOpen, setVideoRulesOpen] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const form = useForm<NoteForm>({
    resolver: zodResolver(noteSchema),
    defaultValues: { title: "", content: "" },
  });

  function openCreate(titleSeed?: string) {
    setEditingId(null);
    setError(null);
    form.reset({ title: titleSeed ?? "", content: "" });
    setEditorOpen(true);
  }

  function openEdit(note: Note) {
    setEditingId(note.id);
    setError(null);
    form.reset({ title: note.title, content: note.content });
    setEditorOpen(true);
  }

  async function onSubmit(values: NoteForm) {
    setSaving(true);
    setError(null);
    const supabase = createClient();

    if (editingId) {
      const { data, error: dbError } = await supabase
        .from("vault_items")
        .update({ title: values.title, content: values.content })
        .eq("id", editingId)
        .select("id, title, content, created_at")
        .single();

      if (dbError || !data) {
        setError(dbError?.message ?? "Не удалось сохранить");
        setSaving(false);
        return;
      }

      setNotes((prev) =>
        prev.map((n) => (n.id === editingId ? (data as Note) : n))
      );
    } else {
      const { data, error: dbError } = await supabase
        .from("vault_items")
        .insert({
          owner_id: ownerId,
          type: "note",
          title: values.title,
          content: values.content,
        })
        .select("id, title, content, created_at")
        .single();

      if (dbError || !data) {
        setError(dbError?.message ?? "Не удалось сохранить");
        setSaving(false);
        return;
      }

      const note = data as Note;
      setNotes((prev) => [note, ...prev]);

      const defaultRule = await createSpouseDefaultRule(note.id, recipients);
      if (defaultRule) {
        setRulesByItem((prev) => ({ ...prev, [note.id]: [defaultRule] }));
      }
    }

    setSaving(false);
    setEditorOpen(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить письмо?")) return;

    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("vault_items")
      .delete()
      .eq("id", id);

    if (dbError) {
      alert(`Не удалось удалить: ${dbError.message}`);
      return;
    }

    setNotes((prev) => prev.filter((n) => n.id !== id));
    setRulesByItem((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setEditorOpen(false);
  }

  function handleRulesSaved(noteId: string, newRules: AccessRule[]) {
    setRulesByItem((prev) => ({ ...prev, [noteId]: newRules }));
  }

  async function handleVideoSaved(saved: SavedVideo) {
    setVideo({
      id: saved.id,
      signedUrl: saved.signedUrl,
      createdAt: saved.createdAt,
    });
    setRecorderOpen(false);
    if (videoRules.length === 0) {
      const defaultRule = await createSpouseDefaultRule(saved.id, recipients);
      if (defaultRule) setVideoRules([defaultRule]);
    }
  }

  async function handleVideoDelete() {
    if (!confirm("Удалить видеообращение?")) return;
    setVideoBusy(true);
    setVideoError(null);
    try {
      const res = await fetch("/api/vault/video", { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setVideoError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setVideo(null);
      setVideoRules([]);
    } finally {
      setVideoBusy(false);
    }
  }

  const rulesNote = rulesNoteId
    ? notes.find((n) => n.id === rulesNoteId) ?? null
    : null;

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Письма и капсулы
        </p>
        <h1 className="font-heading max-w-3xl text-3xl font-medium leading-[1.15] tracking-tight sm:text-[2.5rem]">
          То, что хочется сказать — и однажды будет прочитано.
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Письма и короткие видео для конкретных людей, к конкретным датам.
          Запечатываются, пока не придёт их время.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Тип капсулы"
        className="inline-flex gap-1 rounded-full bg-muted/70 p-1"
      >
        <TabButton
          active={tab === "letters"}
          onClick={() => setTab("letters")}
          icon={<Mail className="h-3.5 w-3.5" />}
          label="Письма"
        />
        <TabButton
          active={tab === "videos"}
          onClick={() => setTab("videos")}
          icon={<VideoIcon className="h-3.5 w-3.5" />}
          label="Видеокапсулы"
        />
      </div>

      {tab === "letters" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
          <ul className="space-y-4">
            {notes.length === 0 ? (
              <EmptyLetterCard onStart={() => openCreate()} />
            ) : (
              notes.map((note, idx) => {
                const { head, tail } = parseTitle(note.title);
                const rules = rulesByItem[note.id] ?? [];
                const sealed = rules.length > 0;
                const isEmpty = !note.content.trim();
                const accessLabel = formatAccessRulesLabel(rules, recipients);
                return (
                  <li
                    key={note.id}
                    className="group relative rounded-2xl border border-border bg-card p-5 transition hover:shadow-sm sm:p-6"
                  >
                    {sealed && (
                      <span className="absolute right-5 top-5 inline-flex items-center gap-1 text-[11px] lowercase tracking-wide text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        запечатано
                      </span>
                    )}
                    <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-4 gap-y-3 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto]">
                      <span className="pt-1.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">
                        #{String(idx + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-heading text-lg font-medium leading-snug sm:text-xl">
                          <span>{head}</span>
                          {tail && (
                            <>
                              <span className="text-muted-foreground">
                                {" — "}
                              </span>
                              <em className="font-normal text-muted-foreground">
                                {tail}
                              </em>
                            </>
                          )}
                        </h3>
                        <p
                          className={cn(
                            "mt-2 line-clamp-2 text-sm leading-relaxed",
                            isEmpty
                              ? "italic text-muted-foreground/70"
                              : "text-foreground/80"
                          )}
                        >
                          {isEmpty
                            ? "Это письмо пока не написано."
                            : excerpt(note.content)}
                        </p>
                        <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          {isEmpty
                            ? "черновик"
                            : sealed
                            ? "готово"
                            : "черновик"}
                          , {formatDayMonth(note.created_at, true)}
                        </p>
                      </div>
                      <div className="col-span-2 flex items-center gap-2 sm:col-span-1 sm:justify-end">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setRulesNoteId(note.id)}
                          aria-label="Кому передать"
                          title={accessLabel}
                        >
                          <Users />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full px-4"
                          onClick={() => openEdit(note)}
                        >
                          {isEmpty ? "Начать" : "Открыть"}
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          <button
            type="button"
            onClick={() => openCreate()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 py-4 text-sm font-medium text-background transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Новое письмо
          </button>
          </div>

          <aside className="h-fit space-y-4 rounded-2xl border border-border bg-card p-5">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Если не знаете, с чего начать
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Одна из этих тем — хороший повод написать первое короткое
                письмо.
              </p>
            </div>
            <ul className="space-y-2">
              {PROMPTS.map((prompt) => (
                <li key={prompt}>
                  <button
                    type="button"
                    onClick={() => openCreate(prompt)}
                    className="group flex w-full items-center gap-3 rounded-full border border-border bg-background px-4 py-2.5 text-left text-sm transition hover:border-foreground/30"
                  >
                    <Quote
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: "var(--brand-sber)" }}
                    />
                    <span className="flex-1 leading-snug">{prompt}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      ) : (
        <VideoCapsulePanel
          video={video}
          rules={videoRules}
          recipients={recipients}
          busy={videoBusy}
          error={videoError}
          onRecord={() => setRecorderOpen(true)}
          onEditRules={() => setVideoRulesOpen(true)}
          onDelete={handleVideoDelete}
        />
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Редактировать письмо" : "Новое письмо"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="letter-title"
                className="text-sm font-medium text-foreground"
              >
                Заголовок
              </label>
              <input
                id="letter-title"
                type="text"
                disabled={saving}
                placeholder="Для Марии — когда меня не будет рядом"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                {...form.register("title")}
              />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="letter-content"
                className="text-sm font-medium text-foreground"
              >
                Текст письма
              </label>
              <textarea
                id="letter-content"
                rows={8}
                disabled={saving}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                {...form.register("content")}
              />
              {form.formState.errors.content && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.content.message}
                </p>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex items-center justify-between gap-2 pt-2">
              {editingId ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleDelete(editingId)}
                  disabled={saving}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Удалить
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditorOpen(false)}
                  disabled={saving}
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="text-white"
                  style={{ backgroundColor: "#21A038" }}
                >
                  {saving ? "Сохраняем…" : "Сохранить"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {rulesNote && (
        <AccessRulesDialog
          open
          onOpenChange={(v) => {
            if (!v) setRulesNoteId(null);
          }}
          vaultItemId={rulesNote.id}
          itemLabel={rulesNote.title}
          recipients={recipients}
          currentRules={rulesByItem[rulesNote.id] ?? []}
          onSaved={(rules) => handleRulesSaved(rulesNote.id, rules)}
        />
      )}

      <Dialog
        open={recorderOpen}
        onOpenChange={(v) => !videoBusy && setRecorderOpen(v)}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Запись видеообращения</DialogTitle>
          </DialogHeader>
          <VideoRecorder
            onSaved={handleVideoSaved}
            onCancel={() => setRecorderOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {video && (
        <AccessRulesDialog
          open={videoRulesOpen}
          onOpenChange={setVideoRulesOpen}
          vaultItemId={video.id}
          itemLabel="Видеообращение"
          recipients={recipients}
          currentRules={videoRules}
          onSaved={(next) => setVideoRules(next)}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm transition",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyLetterCard({ onStart }: { onStart: () => void }) {
  return (
    <li className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
      <p className="text-sm text-muted-foreground">
        Здесь будут ваши письма. Начните с одной темы справа — или напишите
        своё.
      </p>
      <Button
        size="sm"
        className="mt-4 gap-2 rounded-full px-5 text-white"
        style={{ backgroundColor: "#21A038" }}
        onClick={onStart}
      >
        <Plus className="h-3.5 w-3.5" />
        Написать первое письмо
      </Button>
    </li>
  );
}

function VideoCapsulePanel({
  video,
  rules,
  recipients,
  busy,
  error,
  onRecord,
  onEditRules,
  onDelete,
}: {
  video: VideoItem | null;
  rules: AccessRule[];
  recipients: Recipient[];
  busy: boolean;
  error: string | null;
  onRecord: () => void;
  onEditRules: () => void;
  onDelete: () => void;
}) {
  const label = formatAccessRulesLabel(rules, recipients);
  const empty = rules.length === 0;

  if (!video) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Пока нет видеокапсулы. Короткое видео — до 30 секунд — чтобы близкие
          услышали ваш голос.
        </p>
        <Button
          onClick={onRecord}
          className="mt-5 gap-2 rounded-full px-5 text-white"
          style={{ backgroundColor: "#21A038" }}
        >
          <VideoIcon className="h-4 w-4" />
          Записать видеообращение
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <video
          key={video.signedUrl}
          src={video.signedUrl}
          controls
          className="aspect-video w-full rounded-xl bg-black"
        />
        <div className="flex min-w-[12rem] flex-col justify-between gap-3">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Видеокапсула
            </p>
            <p className="text-sm text-foreground/80">
              Записано {formatDayMonth(video.createdAt, true)}
            </p>
            <p
              className={cn(
                "text-xs",
                empty ? "text-muted-foreground/60" : "text-muted-foreground"
              )}
            >
              {label}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onEditRules}
              disabled={busy}
              className="gap-2 rounded-full"
            >
              <Users className="h-3.5 w-3.5" />
              Кому передать
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRecord}
              disabled={busy}
              className="gap-2 rounded-full"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Перезаписать
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              disabled={busy}
              className="gap-2 rounded-full"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {busy ? "Удаляем…" : "Удалить"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
