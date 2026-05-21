import { useAuth } from "@/hooks/useAuth.js";
import { MessagingView } from "@/components/messaging/MessagingView.js";

export function LearnMessagesPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-slate-800 mb-4">Messages</h1>
      <MessagingView currentUserId={user.id} />
    </div>
  );
}
