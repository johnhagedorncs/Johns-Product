import { SeekerSetup } from "@/components/seeker-setup";

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a location and upload a PDF so the next scan scores that person.
          Leave the name blank to keep the saved profile.
        </p>
      </div>
      <SeekerSetup />
    </main>
  );
}
