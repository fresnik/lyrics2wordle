"use client";

import type { ReactNode } from "react";
import type { AnnotatedLine } from "@/lib/extract";

interface LyricsPanelProps {
  lines: AnnotatedLine[];
  /** Words to visually highlight (driven by tile hover/focus). */
  highlighted?: string[];
  /** Fires with the hovered mark's words, null on leave. */
  onHover?: (words: string[] | null) => void;
}

function renderLine(
  line: AnnotatedLine,
  highlighted: string[],
  onHover: LyricsPanelProps["onHover"]
): ReactNode {
  if (line.spans.length === 0) return line.text || " ";
  const parts: ReactNode[] = [];
  let pos = 0;
  line.spans.forEach((span, i) => {
    if (span.start > pos) parts.push(line.text.slice(pos, span.start));
    const active = span.words.some((w) => highlighted.includes(w));
    parts.push(
      <mark
        key={i}
        onMouseEnter={() => onHover?.(span.words)}
        onMouseLeave={() => onHover?.(null)}
        data-highlighted={active || undefined}
        className={
          "rounded-xs px-0.5 font-semibold " +
          (active
            ? "bg-[#6aaa64] text-white dark:bg-[#538d4e]"
            : "bg-[#6aaa64]/25 text-inherit dark:bg-[#538d4e]/40")
        }
      >
        {line.text.slice(span.start, span.end)}
      </mark>
    );
    pos = span.end;
  });
  if (pos < line.text.length) parts.push(line.text.slice(pos));
  return parts;
}

export default function LyricsPanel({ lines, highlighted = [], onHover }: LyricsPanelProps) {
  return (
    <div className="leading-7 text-gray-700 dark:text-gray-300">
      {lines.map((line, i) => (
        <p key={i}>{renderLine(line, highlighted, onHover)}</p>
      ))}
    </div>
  );
}
