import { notFound, permanentRedirect } from "next/navigation";
import { getSongData } from "@/lib/songData";

export default async function SongIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const data = await getSongData(Number(id));
  if (!data) notFound();
  permanentRedirect(`/song/${data.id}/${data.slug}`);
}
