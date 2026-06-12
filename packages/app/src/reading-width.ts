import { useCallback, useEffect, useState } from "react";
import { log } from "./log";

// A single design variable controls the reading column width. The slider in the
// document toolbar drives it; `style.css` consumes it as
// `max-width: min(var(--rd-measure), 100%)` so the top of the range clamps to
// the track and reproduces a full-bleed, table-friendly column.
export const READING_WIDTH_CSS_VAR = "--rd-measure";
export const READING_WIDTH_STORAGE_KEY = "roughdraft:reading-width";

// rem. Min keeps prose above the lower readable bound; max clamps to 100% of the
// track on normal monitors (effectively "fill the viewport").
export const READING_WIDTH_MIN = 40;
export const READING_WIDTH_MAX = 120;
export const READING_WIDTH_DEFAULT = 60;

export type ReadingWidthPreset = {
  label: string;
  rem: number;
};

export const READING_WIDTH_PRESETS: readonly ReadingWidthPreset[] = [
  { label: "Narrow", rem: 46 },
  { label: "Comfortable", rem: READING_WIDTH_DEFAULT },
  { label: "Wide", rem: 80 },
  { label: "Full", rem: READING_WIDTH_MAX },
];

export function clampReadingWidth(rem: number): number {
  if (!Number.isFinite(rem)) return READING_WIDTH_DEFAULT;
  return Math.min(
    READING_WIDTH_MAX,
    Math.max(READING_WIDTH_MIN, Math.round(rem)),
  );
}

export function readStoredReadingWidth(): number {
  try {
    const raw = window.localStorage.getItem(READING_WIDTH_STORAGE_KEY);
    if (raw == null) return READING_WIDTH_DEFAULT;
    return clampReadingWidth(Number.parseFloat(raw));
  } catch (error) {
    log.warn("could not read stored reading width; using default:", error);
    return READING_WIDTH_DEFAULT;
  }
}

export function applyReadingWidth(rem: number): void {
  const clamped = clampReadingWidth(rem);
  document.documentElement.style.setProperty(
    READING_WIDTH_CSS_VAR,
    `${clamped}rem`,
  );
}

export function storeReadingWidth(rem: number): void {
  try {
    window.localStorage.setItem(
      READING_WIDTH_STORAGE_KEY,
      String(clampReadingWidth(rem)),
    );
  } catch (error) {
    // Storage failures (private mode, disabled storage) are non-fatal — the
    // in-memory value still drives the current session — but surface them once
    // so a silently-not-persisting setting is diagnosable rather than confusing.
    log.warn("could not persist reading width:", error);
  }
}

// Approximate characters-per-line for a given rem measure, for a human-readable
// label in the settings popover. The content card has ~7rem of horizontal
// padding, so prose wraps inside `rem - 7`; at this font ~1.8 glyphs land per
// rem of text. This is a rough guide for the typographic line-length band
// (~45-85 ideal), not a guarantee.
export function approxCharsPerLine(rem: number): number {
  return Math.max(20, Math.round((rem - 7) * 1.8));
}

// Returns `[width, preview, commit]`. `preview` updates the live column (cheap,
// no I/O) and is meant for continuous input like dragging the slider; `commit`
// also persists to localStorage and is meant for discrete actions (drag release,
// preset click). Splitting them keeps a full slider drag from issuing one
// synchronous localStorage write per pixel.
export function useReadingWidth(): [
  number,
  (rem: number) => void,
  (rem: number) => void,
] {
  const [width, setWidth] = useState<number>(() => readStoredReadingWidth());

  useEffect(() => {
    applyReadingWidth(width);
  }, [width]);

  const preview = useCallback((rem: number) => {
    setWidth(clampReadingWidth(rem));
  }, []);

  const commit = useCallback((rem: number) => {
    const clamped = clampReadingWidth(rem);
    setWidth(clamped);
    storeReadingWidth(clamped);
  }, []);

  return [width, preview, commit];
}
