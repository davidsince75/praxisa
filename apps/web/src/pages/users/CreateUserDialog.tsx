import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api.js";
import type { UserRole } from "@/lib/api.js";
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

interface CreateUserForm {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  password: string;
}
interface CreateDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export function CreateUserDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateDialogProps) {
  const [form, setForm] = useState<CreateUserForm>({
    email: "",
    firstName: "",
    lastName: "",
    role: "student",
    password: "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: CreateUserForm) => api.post("/users", data),
    onSuccess: () => {
      onSuccess();
      onOpenChange(false);
      setForm({
        email: "",
        firstName: "",
        lastName: "",
        role: "student",
        password: "",
      });
      setError("");
    },
    onError: (err: unknown) => {
      setError(
        err instanceof Error ? err.message : "Erreur lors de la création",
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    mutation.mutate(form);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvel utilisateur</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cu-firstName">Prénom</Label>
                <Input
                  id="cu-firstName"
                  value={form.firstName}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, firstName: e.target.value }));
                  }}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cu-lastName">Nom</Label>
                <Input
                  id="cu-lastName"
                  value={form.lastName}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, lastName: e.target.value }));
                  }}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-email">Email</Label>
              <Input
                id="cu-email"
                type="email"
                value={form.email}
                onChange={(e) => {
                  setForm((f) => ({ ...f, email: e.target.value }));
                }}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-role">Rôle</Label>
              <select
                id="cu-role"
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
            <div className="space-y-1.5">
              <Label htmlFor="cu-password">Mot de passe temporaire</Label>
              <Input
                id="cu-password"
                type="password"
                value={form.password}
                onChange={(e) => {
                  setForm((f) => ({ ...f, password: e.target.value }));
                }}
                placeholder="Min. 8 car., 1 maj., 1 chiffre"
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
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
