import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { api } from "@/lib/api.js";
import type { User } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Label } from "@/components/ui/label.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog.js";

// ── Compose Message Dialog ───────────────────────────────────────────────────────

interface ComposeDialogProps {
  user: User | null;
  onOpenChange: (v: boolean) => void;
}

export function ComposeMessageDialog({
  user,
  onOpenChange,
}: ComposeDialogProps) {
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (user !== null) {
      setBody("");
      setError("");
      setSent(false);
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: (message: string) =>
      api.post("/messages/threads", {
        recipientId: user?.id ?? "",
        body: message,
      }),
    onSuccess: () => {
      setSent(true);
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Erreur lors de l’envoi");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim().length === 0) return;
    setError("");
    mutation.mutate(body.trim());
  }

  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare size={16} />
            Message à{" "}
            {user !== null ? `${user.firstName} ${user.lastName}` : ""}
          </DialogTitle>
        </DialogHeader>
        {sent ? (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-olive font-medium">
              Message envoyé avec succès !
            </p>
            <p className="text-xs text-meta mt-1">
              Retrouvez la conversation dans la messagerie.
            </p>
            <div className="mt-4">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Fermer
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cm-to">Destinataire</Label>
                <p className="text-sm text-dark" id="cm-to">
                  {user !== null
                    ? `${user.firstName} ${user.lastName} (${user.email})`
                    : ""}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cm-body">Message</Label>
                <textarea
                  id="cm-body"
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value);
                  }}
                  rows={5}
                  className="w-full px-3 py-2 text-sm border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Écrivez votre message…"
                  required
                />
              </div>
              {error.length > 0 && <p className="text-xs text-rose">{error}</p>}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" size="sm">
                  Annuler
                </Button>
              </DialogClose>
              <Button
                type="submit"
                size="sm"
                disabled={mutation.isPending || body.trim().length === 0}
              >
                {mutation.isPending ? "Envoi…" : "Envoyer"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
