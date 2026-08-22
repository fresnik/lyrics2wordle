import { useEffect, useRef, useState } from "react";

export type CopyStatus = "idle" | "copied" | "error";

/**
 * Copies text to the clipboard and tracks transient feedback ("copied" /
 * "error") that automatically reverts to "idle" after `duration` ms.
 *
 * Centralizes what would otherwise be duplicated in every copy-to-clipboard
 * button: reporting failures instead of swallowing them, clearing any
 * pending revert timeout before scheduling a new one (so rapid clicks don't
 * stack timers), and clearing it on unmount.
 */
export function useCopyFeedback(duration = 1500) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  // Typed as `number` (not `ReturnType<typeof window.setTimeout>`): with both
  // DOM and @types/node in scope, `window`'s type is an intersection with
  // `typeof globalThis`, and that ReturnType resolves to Node's `Timeout`
  // instead of the browser's `number` that `window.setTimeout` actually
  // returns at runtime.
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  async function copy(text: string) {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch (err) {
      console.error("Failed to copy to clipboard", err);
      setStatus("error");
    }

    timeoutRef.current = window.setTimeout(() => {
      setStatus("idle");
      timeoutRef.current = null;
    }, duration);
  }

  return { status, copy };
}
