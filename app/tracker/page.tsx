import { KanbanBoard } from "@/components/kanban-board";

export default function TrackerPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-16">
      <div>
        <h1 className="text-6xl">Tracker</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Drag a card when the conversation moves.
        </p>
      </div>
      <KanbanBoard />
    </main>
  );
}
