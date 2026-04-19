"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Trash2, UserRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export interface Recipient {
  id: string;
  full_name: string;
  relation: string;
  user_id: string | null;
  created_at: string;
}

const RELATIONS = [
  { value: "wife", label: "Жена" },
  { value: "husband", label: "Муж" },
  { value: "son", label: "Сын" },
  { value: "daughter", label: "Дочь" },
  { value: "brother", label: "Брат" },
  { value: "sister", label: "Сестра" },
  { value: "parent", label: "Родитель" },
  { value: "other", label: "Другое" },
] as const;

const RELATION_VALUES = RELATIONS.map((r) => r.value) as [
  string,
  ...string[],
];
const RELATION_LABELS: Record<string, string> = Object.fromEntries(
  RELATIONS.map((r) => [r.value, r.label])
);

const recipientSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Минимум 2 символа")
    .max(100, "Максимум 100 символов"),
  relation: z.enum(RELATION_VALUES, {
    message: "Выберите отношение",
  }),
});

type RecipientForm = z.infer<typeof recipientSchema>;

interface RecipientsSectionProps {
  ownerId: string;
  initialRecipients: Recipient[];
}

export function RecipientsSection({
  ownerId,
  initialRecipients,
}: RecipientsSectionProps) {
  const [recipients, setRecipients] =
    useState<Recipient[]>(initialRecipients);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<RecipientForm>({
    resolver: zodResolver(recipientSchema),
    defaultValues: { full_name: "", relation: "other" },
  });

  function openCreate() {
    setEditingId(null);
    setError(null);
    form.reset({ full_name: "", relation: "other" });
    setOpen(true);
  }

  function openEdit(recipient: Recipient) {
    setEditingId(recipient.id);
    setError(null);
    form.reset({
      full_name: recipient.full_name,
      relation: RELATION_LABELS[recipient.relation] ? recipient.relation : "other",
    });
    setOpen(true);
  }

  async function onSubmit(values: RecipientForm) {
    setSaving(true);
    setError(null);
    const supabase = createClient();

    if (editingId) {
      const { data, error: dbError } = await supabase
        .from("recipients")
        .update({
          full_name: values.full_name,
          relation: values.relation,
        })
        .eq("id", editingId)
        .select("id, full_name, relation, user_id, created_at")
        .single();

      if (dbError || !data) {
        setError(dbError?.message ?? "Не удалось сохранить");
        setSaving(false);
        return;
      }

      setRecipients((prev) =>
        prev.map((r) => (r.id === editingId ? (data as Recipient) : r))
      );
    } else {
      const { data, error: dbError } = await supabase
        .from("recipients")
        .insert({
          owner_id: ownerId,
          full_name: values.full_name,
          relation: values.relation,
        })
        .select("id, full_name, relation, user_id, created_at")
        .single();

      if (dbError || !data) {
        setError(dbError?.message ?? "Не удалось сохранить");
        setSaving(false);
        return;
      }

      setRecipients((prev) => [data as Recipient, ...prev]);
    }

    setSaving(false);
    setOpen(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить получателя?")) return;

    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("recipients")
      .delete()
      .eq("id", id);

    if (dbError) {
      alert(`Не удалось удалить: ${dbError.message}`);
      return;
    }

    setRecipients((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Список получателей</h2>
        <p className="text-sm text-muted-foreground">
          Близкие, которым откроется доступ после подтверждения события
        </p>
      </div>

      {recipients.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
          Пока нет получателей. Добавьте первого, чтобы настроить передачу
          доступа к материалам.
        </div>
      ) : (
        <ul className="space-y-3">
          {recipients.map((recipient) => (
            <li
              key={recipient.id}
              className="flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-card p-4"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5">
                  <UserRound className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-medium">
                    {recipient.full_name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {RELATION_LABELS[recipient.relation] ?? recipient.relation}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => openEdit(recipient)}
                  aria-label="Редактировать"
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(recipient.id)}
                  aria-label="Удалить"
                  className="text-destructive"
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={openCreate}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 py-4 text-sm font-medium text-background transition hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        Добавить получателя
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Редактировать получателя" : "Новый получатель"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="full_name"
                className="text-sm font-medium text-foreground"
              >
                ФИО
              </label>
              <input
                id="full_name"
                type="text"
                autoComplete="off"
                disabled={saving}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                {...form.register("full_name")}
              />
              {form.formState.errors.full_name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.full_name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="relation"
                className="text-sm font-medium text-foreground"
              >
                Отношение
              </label>
              <select
                id="relation"
                disabled={saving}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                {...form.register("relation")}
              >
                {RELATIONS.map((r) => (
                  <option
                    key={r.value}
                    value={r.value}
                    className="bg-popover text-popover-foreground"
                  >
                    {r.label}
                  </option>
                ))}
              </select>
              {form.formState.errors.relation && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.relation.message}
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
              <Button type="submit" disabled={saving}>
                {saving ? "Сохраняем…" : "Сохранить"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
