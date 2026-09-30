import { InboxBoard } from "@/components/inbox-board";

// Scans and AI scoring run as server actions on this page; give them room on Vercel.
export const maxDuration = 60;

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fresh new-grad roles from your watch list, SimplifyJobs, and LinkedIn — scored against
          your resume. Apply the same day, then send a warm note.
        </p>
      </div>
      <InboxBoard />
    </main>
  );
}
