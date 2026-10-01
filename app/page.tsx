import { InboxBoard } from "@/components/inbox-board";

// Scans and AI scoring run as server actions on this page; give them room on Vercel.
export const maxDuration = 60;

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-16">
      <div>
        <h1 className="text-6xl">Inbox</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Fresh new-grad roles from your watch list, SimplifyJobs, and LinkedIn — scored against
          your resume. Apply the same day, then send a warm note.
        </p>
      </div>
      <InboxBoard />
    </main>
  );
}
