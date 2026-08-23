/**
 * Deployment-specific support link. Renders nothing unless
 * NEXT_PUBLIC_KOFI_URL is set, so forks and local dev get no footer.
 */
export default function Footer() {
  const kofiUrl = process.env.NEXT_PUBLIC_KOFI_URL;
  if (!kofiUrl) return null;
  return (
    <footer className="mt-auto py-6 text-center text-sm text-gray-500 dark:text-gray-400">
      Enjoying this?{" "}
      <a
        href={kofiUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-[#538d4e] hover:underline dark:text-[#7cb56f]"
      >
        ☕ Support the hosting costs
      </a>
    </footer>
  );
}
