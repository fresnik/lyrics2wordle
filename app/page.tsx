import Search from "@/components/Search";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-center text-4xl font-extrabold tracking-tight">
        Lyrics<span className="text-[#6aaa64]">2</span>Wordle
      </h1>
      <p className="mt-2 text-center text-gray-600 dark:text-gray-400">
        Find every valid Wordle word hiding in a song&apos;s lyrics.
      </p>
      <Search />
    </main>
  );
}
