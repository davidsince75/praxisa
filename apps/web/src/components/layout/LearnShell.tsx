import { LearnSidebar } from "./LearnSidebar.js";

interface LearnShellProps {
  children: React.ReactNode;
}

export function LearnShell({ children }: LearnShellProps) {
  return (
    <div className="min-h-screen bg-cream">
      <LearnSidebar />
      <main className="ml-56 min-h-screen">
        <div className="max-w-6xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
