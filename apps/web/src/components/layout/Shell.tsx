import { Sidebar } from "./Sidebar.js";

interface ShellProps {
  children: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
  return (
    <div className="min-h-screen bg-cream">
      <Sidebar />
      <main className="ml-56 min-h-screen">
        <div className="max-w-6xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
