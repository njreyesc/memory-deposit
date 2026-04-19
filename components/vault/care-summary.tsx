import { Leaf } from "lucide-react";

interface CareSummaryProps {
  firstName: string;
  notesCount: number;
  hasVideo: boolean;
  recipientsCount: number;
}

function plural(n: number, one: string, few: string, many: string): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}

export function CareSummary({
  firstName,
  notesCount,
  hasVideo,
  recipientsCount,
}: CareSummaryProps) {
  const total = notesCount + (hasVideo ? 1 : 0);
  const empty = total === 0 && recipientsCount === 0;

  const headline = empty
    ? `${firstName}, начните с одного тёплого слова`
    : `${firstName}, уже сделано`;

  let subline: string;
  if (empty) {
    subline =
      "Первое письмо займёт пару минут. Оно останется с теми, кого вы любите.";
  } else {
    const parts: string[] = [];
    if (hasVideo) parts.push("1 видеообращение");
    if (notesCount > 0) {
      parts.push(
        `${notesCount} ${plural(notesCount, "письмо", "письма", "писем")}`
      );
    }
    if (recipientsCount > 0) {
      parts.push(
        `${recipientsCount} ${plural(
          recipientsCount,
          "близкий",
          "близких",
          "близких"
        )}`
      );
    }
    subline = parts.join(" · ");
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--brand-sber) 10%, transparent)",
            color: "var(--brand-sber)",
          }}
        >
          <Leaf className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{headline}</h2>
          <p className="text-sm text-muted-foreground">{subline}</p>
        </div>
      </div>
    </div>
  );
}
