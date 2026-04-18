"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  AccessRulesDialog,
  createSpouseDefaultRule,
  formatAccessRulesLabel,
  type AccessRule,
  type Recipient,
} from "@/components/vault/access-rules-dialog";

export interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

const noteSchema = z.object({
  title: z.string().trim().min(1, "Заголовок обязателен").max(200),
  content: z.string().trim().min(1, "Текст обязателен").max(10000),
});

type NoteForm = z.infer<typeof noteSchema>;

interface NotesSectionProps {
  ownerId: string;
  initialNotes: Note[];
  recipients: Recipient[];
  initialRulesByItem: Record<string, AccessRule[]>;
}

export function NotesSection({
  ownerId,
  initialNotes,
  recipients,
  initialRulesByItem,
}: NotesSectionProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [rulesByItem, setRulesByItem] =
    useState<Record<string, AccessRule[]>>(initialRulesByItem);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rulesNoteId, setRulesNoteId] = useState<string | null>(null);

  const form = useForm<NoteForm>({
    resolver: zodResolver(noteSchema),
    defaultValues: { title: "", content: "" },
  });

  function openCreate() {
    setEditingId(null);
    setError(null);
    form.reset({ title: "", content: "" });
    setOpen(true);
  }

  function openEdit(note: Note) {
    setEditingId(note.id);
    setError(null);
    form.reset({ title: note.title, content: note.content });
    setOpen(true);
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
    setOpen(false);
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
  }

  function handleRulesSaved(noteId: string, newRules: AccessRule[]) {
    setRulesByItem((prev) => ({ ...prev, [noteId]: newRules }));
  }

  const rulesNote = rulesNoteId
    ? notes.find((n) => n.id === rulesNoteId) ?? null
    : null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Письма и заметки</h2>
          <p className="text-sm text-muted-foreground">
            Короткие тексты для ваших близких
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="gap-2 text-white"
          style={{ backgroundColor: "#21A038" }}
        >
          <Plus className="h-4 w-4" />
          Новое письмо
        </Button>
      </div>

      {notes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
          Пока нет писем. Напишите первое — оно будет доступно вашим близким
          после подтверждения события.
        </div>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => {
            const rules = rulesByItem[note.id] ?? [];
            const label = formatAccessRulesLabel(rules, recipients);
            const empty = rules.length === 0;
            return (
              <li
                key={note.id}
                className="flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-card p-4"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-medium">{note.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {new Date(note.created_at).toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <p
                    className={
                      empty
                        ? "mt-2 text-xs text-muted-foreground/60"
                        : "mt-2 text-xs text-muted-foreground"
                    }
                  >
                    {label}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setRulesNoteId(note.id)}
                    aria-label="Кому передать"
                  >
                    <Users />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openEdit(note)}
                    aria-label="Редактировать"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(note.id)}
                    aria-label="Удалить"
                    className="text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Редактировать письмо" : "Новое письмо"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="title"
                className="text-sm font-medium text-foreground"
              >
                Заголовок
              </label>
              <input
                id="title"
                type="text"
                disabled={saving}
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
                htmlFor="content"
                className="text-sm font-medium text-foreground"
              >
                Текст письма
              </label>
              <textarea
                id="content"
                rows={7}
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

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
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
          </form>
        </DialogContent>
      </Dialog>

      {rulesNote && (
        <AccessRulesDialog
          open={true}
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
    </section>
  );
}
