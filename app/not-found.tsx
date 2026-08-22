import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        That link doesn&apos;t match anything here — the song may not exist on lrclib.net.
      </p>
      <Link href="/" className="mt-6 inline-block font-semibold text-[#538d4e] hover:underline dark:text-[#7cb56f]">
        ← Search for a song
      </Link>
    </main>
  );
}
