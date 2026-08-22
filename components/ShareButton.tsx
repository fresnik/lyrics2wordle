"use client";

import { useCopyFeedback } from "@/components/useCopyFeedback";

export default function ShareButton({ path }: { path: string }) {
  const { status, copy } = useCopyFeedback();

  const label =
    status === "copied" ? "Link copied!" : status === "error" ? "Couldn't copy" : "Copy share link";

  return (
    <button
      type="button"
      onClick={() => void copy(window.location.origin + path)}
      className="cursor-pointer rounded-md bg-[#6aaa64] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#5c9a57] dark:bg-[#538d4e]"
    >
      {label}
    </button>
  );
}
