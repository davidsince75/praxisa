import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api.js";
import type { User, UserRole } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog.js";
import { ROLES, ROLE_LABELS } from "./shared.js";

interface EditUserForm {
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  isRestricted: boolean;
}
interface EditDialogProps {
  user: User | null;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export function EditUserDialog({
  user,
  onOpenChange,
  onSuccess,
}: EditDialogProps) {
  const [form, setForm] = useState<EditUserForm>({
    firstName: "",
    lastName: "",
    role: "student",
    isActive: true,
    isRestricted: false,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (user !== null) {
      setForm({
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        isRestricted: user.isRestricted,
      });
      setError("");
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: (data: EditUserForm) =>
      api.patch(`/users/${user?.id ?? ""}`, data),
    onSuccess: () => {
      onSuccess();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      setError(
        err instanceof Error ? err.message : "Erreur lors de la mise à jour",
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    mutation.mutate(form);
  }

  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier l’utilisateur</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="eu-firstName">Prénom</Label>
                <Input
                  id="eu-firstName"
                  value={form.firstName}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, firstName: e.target.value }));
                  }}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eu-lastName">Nom</Label>
                <Input
                  id="eu-lastName"
                  value={form.lastName}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, lastName: e.target.value }));
                  }}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eu-role">Rôle</Label>
              <select
                id="eu-role"
                value={form.role}
                onChange={(e) => {
                  setForm((f) => ({ ...f, role: e.target.value as UserRole }));
                }}
                className="w-full h-10 px-3 text-sm border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="eu-active"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => {
                  setForm((f) => ({ ...f, isActive: e.target.checked }));
                }}
                className="h-4 w-4 accent-teal"
              />
              <Label htmlFor="eu-active" className="cursor-pointer">
                Compte actif
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="eu-restricted"
                type="checkbox"
                checked={form.isRestricted}
                onChange={(e) => {
                  setForm((f) => ({ ...f, isRestricted: e.target.checked }));
                }}
                className="h-4 w-4 accent-amber-500"
              />
              <Label htmlFor="eu-restricted" className="cursor-pointer">
                Accès restreint
                <span className="block text-[11px] text-meta font-normal">
                  Limite l'apprenant à 1 formation et 3 premiers modules
                </span>
              </Label>
            </div>
            {error.length > 0 && <p className="text-xs text-rose">{error}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                Annuler
              </Button>
            </DialogClose>
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending ? "Sauvegarde…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
