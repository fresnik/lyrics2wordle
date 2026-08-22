import type { ReactNode } from "react";
import type { AnnotatedLine } from "@/lib/extract";

function renderLine(line: AnnotatedLine): ReactNode {
  if (line.spans.length === 0) return line.text || " ";
  const parts: ReactNode[] = [];
  let pos = 0;
  line.spans.forEach((span, i) => {
    if (span.start > pos) parts.push(line.text.slice(pos, span.start));
    parts.push(
      <mark
        key={i}
        className="rounded-xs bg-[#6aaa64]/25 px-0.5 font-semibold text-inherit dark:bg-[#538d4e]/40"
      >
        {line.text.slice(span.start, span.end)}
      </mark>
    );
    pos = span.end;
  });
  if (pos < line.text.length) parts.push(line.text.slice(pos));
  return parts;
}

export default function LyricsPanel({ lines }: { lines: AnnotatedLine[] }) {
  return (
    <div className="leading-7 text-gray-700 dark:text-gray-300">
      {lines.map((line, i) => (
        <p key={i}>{renderLine(line)}</p>
      ))}
    </div>
  );
}
