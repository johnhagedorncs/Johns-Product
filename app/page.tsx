import { InboxBoard } from "@/components/inbox-board";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Roles from your watch list show up after Scan now. Apply the same day,
          then draft a note.
        </p>
      </div>
      <InboxBoard />
    </main>
  );
}
