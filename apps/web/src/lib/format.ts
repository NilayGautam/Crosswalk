import type { ColumnProfile, ColumnType, DatasetFormat } from "@crosswalk/contract";

const NUMBER = new Intl.NumberFormat("en-US");

export function formatCount(value: number): string {
  return NUMBER.format(value);
}

export function plural(count: number, noun: string): string {
  return `${formatCount(count)} ${count === 1 ? noun : `${noun}s`}`;
}

/** A share from 0 to 1 as a percentage that never rounds a small share down to nothing. */
export function formatShare(share: number): string {
  if (share <= 0) {
    return "0%";
  }
  if (share >= 1) {
    return "100%";
  }
  const percent = share * 100;
  if (percent < 1) {
    return "under 1%";
  }
  if (percent > 99) {
    return "over 99%";
  }
  return `${Math.round(percent)}%`;
}

const TYPE_LABELS: Record<ColumnType, string> = {
  text: "Text",
  integer: "Whole number",
  number: "Number",
  boolean: "True or false",
  date: "Date",
  datetime: "Date and time",
  empty: "Empty",
};

export function typeLabel(type: ColumnType): string {
  return TYPE_LABELS[type];
}

const FORMAT_LABELS: Record<DatasetFormat, string> = {
  csv: "CSV",
  tsv: "TSV",
  xlsx: "Excel",
  xls: "Excel",
  parquet: "Parquet",
  dta: "Stata",
};

export function formatLabel(format: DatasetFormat): string {
  return FORMAT_LABELS[format];
}

function sentence(text: string): string {
  return text === "" ? "" : `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

/** The lines shown when a column is focused: what its values look like and how complete it is. */
export function profileLines(column: ColumnProfile): string[] {
  if (column.type === "empty") {
    return ["Every cell in this column is empty."];
  }
  const uniqueness =
    column.uniqueRate >= 1
      ? "Every value is different."
      : `${plural(column.distinctCount, "different value")}.`;
  return [sentence(column.shape), `${formatShare(column.nullRate)} empty.`, uniqueness];
}

/** "3 minutes ago" for a moment in the past, relative to now. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (seconds < 45) {
    return "just now";
  }
  const steps: [number, string][] = [
    [60, "minute"],
    [60, "hour"],
    [24, "day"],
    [30, "month"],
    [12, "year"],
  ];
  let value = seconds;
  let unit = "second";
  for (const [size, name] of steps) {
    if (value < size && unit !== "second") {
      break;
    }
    value = Math.round(value / size);
    unit = name;
    if (value < (name === "minute" ? 60 : name === "hour" ? 24 : name === "day" ? 30 : 12)) {
      break;
    }
  }
  return `${value} ${value === 1 ? unit : `${unit}s`} ago`;
}

/** Device codes are shown and typed as two groups: ABCD-1234. */
export function formatUserCode(code: string): string {
  const clean = code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (clean.length < 6) {
    return clean;
  }
  const middle = Math.floor(clean.length / 2);
  return `${clean.slice(0, middle)}-${clean.slice(middle)}`;
}

/** Only a path inside this app is safe to send someone to after they sign in. */
export function safeNextPath(next: string | null): string {
  if (next === null || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return "/";
  }
  return next;
}
