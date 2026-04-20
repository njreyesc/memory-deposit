"use client";

import { Download, FileJson, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export interface TelemetryRowExport {
  id: string;
  created_at: string;
  session_id: string;
  user_id: string | null;
  user_name: string | null;
  event_name: string;
  scene: string | null;
  props: unknown;
  path: string | null;
}

const CSV_HEADER = [
  "timestamp_iso",
  "session_id",
  "user_id",
  "user_name",
  "event_name",
  "scene",
  "path",
  "props_json",
].join(",");

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(rows: TelemetryRowExport[]): string {
  const lines = rows.map((r) =>
    [
      r.created_at,
      r.session_id,
      r.user_id ?? "",
      r.user_name ?? "",
      r.event_name,
      r.scene ?? "",
      r.path ?? "",
      JSON.stringify(r.props ?? {}),
    ]
      .map((v) => escapeCsv(String(v)))
      .join(",")
  );
  return [CSV_HEADER, ...lines].join("\n");
}

function download(filename: string, body: string, mime: string) {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function TelemetryExport({ rows }: { rows: TelemetryRowExport[] }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  function handleCsv() {
    download(
      `telemetry_${today}.csv`,
      toCsv(rows),
      "text/csv;charset=utf-8"
    );
  }

  function handleJson() {
    download(
      `telemetry_${today}.json`,
      JSON.stringify(rows, null, 2),
      "application/json"
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => router.refresh()}
        className="gap-1"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Обновить
      </Button>
      <Button size="sm" onClick={handleCsv} className="gap-1">
        <Download className="h-3.5 w-3.5" />
        CSV
      </Button>
      <Button size="sm" variant="outline" onClick={handleJson} className="gap-1">
        <FileJson className="h-3.5 w-3.5" />
        JSON
      </Button>
    </div>
  );
}
