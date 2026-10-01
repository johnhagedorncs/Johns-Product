import { ScannedJob } from "@/components/scanned-job";

export const maxDuration = 60;

type PageProps = { params: Promise<{ id: string }> };

export default async function JobPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
      <ScannedJob id={id} />
    </main>
  );
}
