"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/telemetry/client";

type EditedField = "name" | "provider" | "value" | "recipient_note";
const EDIT_THROTTLE_MS = 10_000;

export interface FinanceRecipient {
  id: string;
  full_name: string;
  relation: string;
}

type SectionKey =
  | "accounts"
  | "mortgage"
  | "broker"
  | "insurance"
  | "offbank";

type BadgeKind = "auto" | "manual";

interface Row {
  id: string;
  name: string;
  provider: string;
  value: string;
  recipientId: string | null;
  recipientNote: string;
}

interface Section {
  key: SectionKey;
  title: string;
  badge: BadgeKind;
  rows: Row[];
}

const SEED: Section[] = [
  { key: "accounts", title: "Счета и вклады", badge: "auto", rows: [] },
  { key: "mortgage", title: "Ипотека и кредиты", badge: "auto", rows: [] },
  { key: "broker", title: "Брокерский счёт", badge: "auto", rows: [] },
  { key: "insurance", title: "Страховки", badge: "auto", rows: [] },
  { key: "offbank", title: "Вне банка", badge: "manual", rows: [] },
];

const STORAGE_KEY = "finance-map-v3";

interface FinanceMapProps {
  userId: string;
  recipients: FinanceRecipient[];
}

export function FinanceMap({ userId, recipients }: FinanceMapProps) {
  const [sections, setSections] = useState<Section[]>(SEED);
  const [hydrated, setHydrated] = useState(false);

  const storageKey = `${STORAGE_KEY}:${userId}`;
  // Throttle finance_row_edited events per (rowId, field) — otherwise every
  // keystroke would flood telemetry. Matches the 10s cadence used for
  // letter_text_input in the vault.
  const editLastAtRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Section[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSections(parsed);
        }
      }
    } catch {
      // ignore and fall back to seed
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(sections));
    } catch {
      // storage full / unavailable — silently ignore for demo
    }
  }, [sections, hydrated, storageKey]);

  function updateRow(sectionKey: SectionKey, rowId: string, patch: Partial<Row>) {
    if ("recipientId" in patch) {
      track(
        "finance_recipient_changed",
        { section: sectionKey, has_recipient: patch.recipientId !== null },
        "finance"
      );
    }

    const editedField = resolveEditedField(patch);
    if (editedField) {
      const key = `${rowId}:${editedField}`;
      const now = Date.now();
      const last = editLastAtRef.current.get(key) ?? 0;
      if (now - last >= EDIT_THROTTLE_MS) {
        editLastAtRef.current.set(key, now);
        track(
          "finance_row_edited",
          { section: sectionKey, field: editedField },
          "finance"
        );
      }
    }

    setSections((prev) =>
      prev.map((section) =>
        section.key === sectionKey
          ? {
              ...section,
              rows: section.rows.map((row) =>
                row.id === rowId ? { ...row, ...patch } : row
              ),
            }
          : section
      )
    );
  }

  function addRow(sectionKey: SectionKey) {
    const newRow: Row = {
      id: `${sectionKey}-${Date.now()}`,
      name: "",
      provider: "",
      value: "",
      recipientId: recipients[0]?.id ?? null,
      recipientNote: "",
    };
    track("finance_row_added", { section: sectionKey }, "finance");
    setSections((prev) =>
      prev.map((section) =>
        section.key === sectionKey
          ? { ...section, rows: [...section.rows, newRow] }
          : section
      )
    );
  }

  function removeRow(sectionKey: SectionKey, rowId: string) {
    track("finance_row_removed", { section: sectionKey }, "finance");
    editLastAtRef.current.delete(`${rowId}:name`);
    editLastAtRef.current.delete(`${rowId}:provider`);
    editLastAtRef.current.delete(`${rowId}:value`);
    editLastAtRef.current.delete(`${rowId}:recipient_note`);
    setSections((prev) =>
      prev.map((section) =>
        section.key === sectionKey
          ? {
              ...section,
              rows: section.rows.filter((row) => row.id !== rowId),
            }
          : section
      )
    );
  }

  function resolveEditedField(patch: Partial<Row>): EditedField | null {
    if ("name" in patch) return "name";
    if ("provider" in patch) return "provider";
    if ("value" in patch) return "value";
    if ("recipientNote" in patch) return "recipient_note";
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Финансовая карта семьи
        </p>
        <h1 className="font-heading text-4xl font-medium tracking-tight text-foreground">
          Что есть и где это лежит.
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Большую часть мы уже видим через банк — вам остаётся только
          подтвердить. Остальное добавляется за 2–3 минуты.
        </p>
      </header>

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-5 py-4">
        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Данные берутся напрямую из банка, обновляются ежедневно. Вы видите
          свою настоящую финансовую картину — в режиме реального времени.
        </p>
      </div>

      {recipients.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-4 text-sm text-muted-foreground">
          Чтобы указать, кому достанется каждая позиция, добавьте близких в
          разделе «Близкие» — они появятся в списке получателей.
        </div>
      )}

      <div className="space-y-4">
        {sections.map((section) => (
          <SectionCard
            key={section.key}
            section={section}
            recipients={recipients}
            onChange={updateRow}
            onAdd={addRow}
            onRemove={removeRow}
          />
        ))}
      </div>
    </div>
  );
}

interface SectionCardProps {
  section: Section;
  recipients: FinanceRecipient[];
  onChange: (key: SectionKey, rowId: string, patch: Partial<Row>) => void;
  onAdd: (key: SectionKey) => void;
  onRemove: (key: SectionKey, rowId: string) => void;
}

function SectionCard({
  section,
  recipients,
  onChange,
  onAdd,
  onRemove,
}: SectionCardProps) {
  const isManual = section.badge === "manual";
  const isEmpty = section.rows.length === 0;

  return (
    <section className="rounded-2xl border border-border bg-card px-6 py-5">
      <header className="mb-4 flex items-center gap-3">
        <h2 className="font-heading text-lg font-medium text-foreground">
          {section.title}
        </h2>
        <Badge kind={section.badge} />
      </header>

      {!isEmpty && (
        <ul className="divide-y divide-border/70">
          {section.rows.map((row) => (
            <li
              key={row.id}
              className="group grid grid-cols-[1.2fr_1.1fr_0.9fr_1.6fr_auto] items-center gap-4 py-3"
            >
              <CellInput
                value={row.name}
                placeholder="Название"
                onChange={(v) => onChange(section.key, row.id, { name: v })}
              />
              <CellInput
                value={row.provider}
                placeholder="Банк / детали"
                muted
                onChange={(v) =>
                  onChange(section.key, row.id, { provider: v })
                }
              />
              <CellInput
                value={row.value}
                placeholder="Сумма"
                mono
                onChange={(v) => onChange(section.key, row.id, { value: v })}
              />
              <RecipientCell
                recipientId={row.recipientId}
                recipientNote={row.recipientNote}
                recipients={recipients}
                onChange={(patch) => onChange(section.key, row.id, patch)}
              />
              <button
                type="button"
                onClick={() => onRemove(section.key, row.id)}
                aria-label="Удалить строку"
                className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {isEmpty && isManual && (
        <div className="grid grid-cols-[1.2fr_2fr] items-start gap-4 py-2 text-sm">
          <p className="text-foreground/80">Добавьте то, о чём мы не знаем</p>
          <p className="text-muted-foreground">
            квартира родителей, криптокошелёк, бизнес-доля…
          </p>
        </div>
      )}

      {isEmpty && !isManual && (
        <p className="py-2 text-sm text-muted-foreground/70">
          Пока пусто. Как только банк передаст данные, они появятся здесь — или
          добавьте строку вручную.
        </p>
      )}

      {isManual ? (
        <button
          type="button"
          onClick={() => onAdd(section.key)}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" />
          Добавить актив
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onAdd(section.key)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Добавить строку
        </button>
      )}
    </section>
  );
}

interface BadgeProps {
  kind: BadgeKind;
}

function Badge({ kind }: BadgeProps) {
  if (kind === "auto") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[color:oklch(0.88_0.055_145)] px-2.5 py-0.5 text-xs font-medium text-[color:oklch(0.32_0.055_145)]">
        <Check className="h-3 w-3" strokeWidth={2.5} />
        подтянуто автоматически
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-[color:oklch(0.82_0.095_65)] px-2.5 py-0.5 text-xs font-medium text-[color:oklch(0.30_0.055_55)]">
      добавьте вручную
    </span>
  );
}

interface CellInputProps {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  mono?: boolean;
  muted?: boolean;
}

function CellInput({
  value,
  placeholder,
  onChange,
  mono,
  muted,
}: CellInputProps) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "w-full min-w-0 truncate rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 hover:border-border/60 focus:border-border focus:bg-background",
        mono && "font-mono tabular-nums",
        muted && "text-muted-foreground"
      )}
    />
  );
}

interface RecipientCellProps {
  recipientId: string | null;
  recipientNote: string;
  recipients: FinanceRecipient[];
  onChange: (patch: Partial<Row>) => void;
}

function RecipientCell({
  recipientId,
  recipientNote,
  recipients,
  onChange,
}: RecipientCellProps) {
  const known = recipientId
    ? recipients.find((r) => r.id === recipientId)
    : null;
  const value = known ? recipientId ?? "" : "";

  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className="shrink-0 text-xs text-muted-foreground">·</span>
      <select
        value={value}
        onChange={(event) =>
          onChange({ recipientId: event.target.value || null })
        }
        className={cn(
          "shrink-0 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm outline-none transition-colors hover:border-border/60 focus:border-border focus:bg-background",
          !known && "text-muted-foreground/70"
        )}
      >
        <option value="">— кому</option>
        {recipients.map((r) => (
          <option key={r.id} value={r.id}>
            {r.full_name}
          </option>
        ))}
      </select>
      {known && (
        <>
          <span className="shrink-0 text-sm text-muted-foreground">—</span>
          <input
            type="text"
            value={recipientNote}
            placeholder="когда"
            onChange={(event) =>
              onChange({ recipientNote: event.target.value })
            }
            className="w-full min-w-0 truncate rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-muted-foreground outline-none transition-colors placeholder:text-muted-foreground/60 hover:border-border/60 focus:border-border focus:bg-background"
          />
        </>
      )}
    </div>
  );
}
