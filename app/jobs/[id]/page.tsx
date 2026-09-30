import { ScannedJob } from "@/components/scanned-job";

type PageProps = { params: Promise<{ id: string }> };

export default async function JobPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <ScannedJob id={id} />
    </main>
  );
}
