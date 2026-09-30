import { KanbanBoard } from "@/components/kanban-board";

export default function TrackerPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Tracker</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drag a card when the conversation moves.
        </p>
      </div>
      <KanbanBoard />
    </main>
  );
}
