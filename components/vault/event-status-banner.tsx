import { CheckCircle2 } from "lucide-react";

interface EventStatusBannerProps {
  confirmedAt: string;
}

export function EventStatusBanner({ confirmedAt }: EventStatusBannerProps) {
  const date = new Date(confirmedAt).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#21A038]/30 bg-[#21A038]/10 px-4 py-3">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#21A038]" />
      <div className="text-sm leading-relaxed">
        <p className="font-medium text-[#21A038]">
          Статус: событие подтверждено через СМЭВ
        </p>
        <p className="text-muted-foreground">
          {date}. Материалы переданы получателям.
        </p>
      </div>
    </div>
  );
}
