"use client";

import { useState } from "react";

export default function ShareButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.origin + path);
    } catch {
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="cursor-pointer rounded-md bg-[#6aaa64] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#5c9a57] dark:bg-[#538d4e]"
    >
      {copied ? "Link copied!" : "Copy share link"}
    </button>
  );
}
