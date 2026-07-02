import { Button } from "@/components/ui/button";

export default function App() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Folder Studio</h1>
      <p className="text-muted-foreground">
        Vite + React + TypeScript + Tailwind + shadcn/ui scaffold is running.
      </p>
      <Button>It works</Button>
    </div>
  );
}
