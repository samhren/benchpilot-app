import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtWeight(n: number | null | undefined, units: "lb" | "kg" = "lb"): string {
  if (n == null) return "—";
  return `${Number.isInteger(n) ? n : n.toFixed(1)} ${units}`;
}

export function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
