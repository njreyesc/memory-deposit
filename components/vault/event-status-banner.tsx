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
    <div className="rounded-lg border border-border bg-background/40 px-4 py-3 text-sm leading-relaxed">
      <p className="font-medium">Статус: событие подтверждено через СМЭВ</p>
      <p className="text-muted-foreground">
        {date}. Материалы переданы получателям.
      </p>
    </div>
  );
}
