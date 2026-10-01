import { SeekerSetup } from "@/components/seeker-setup";

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-8 pb-16">
      <div>
        <h1 className="text-6xl">Settings</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Pick a location and upload the PDF you apply with. Every score, warm path, and draft reads
          this resume. Everything stays in this browser.
        </p>
      </div>
      <SeekerSetup />
    </main>
  );
}
