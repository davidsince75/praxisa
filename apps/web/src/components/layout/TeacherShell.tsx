import { TeacherSidebar } from "./TeacherSidebar.js";

interface TeacherShellProps {
  children: React.ReactNode;
}

export function TeacherShell({ children }: TeacherShellProps) {
  return (
    <div className="min-h-screen bg-cream">
      <TeacherSidebar />
      <main className="ml-56 min-h-screen">
        <div className="max-w-6xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
