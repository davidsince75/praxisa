import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  Search,
  Pencil,
  UserX,
  UserCheck,
  Mail,
  MessageSquare,
} from "lucide-react";
import { api } from "@/lib/api.js";
import type { User, UserListResponse, UserRole } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";
import { Badge } from "@/components/ui/badge.js";
import { Card, CardContent } from "@/components/ui/card.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog.js";
import { formatDate } from "@/lib/utils.js";

// ── Types ───────────────────────────────────────────────────────────────────────────

type RoleFilter = UserRole | "all";

interface CreateUserForm {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  password: string;
}

interface EditUserForm {
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
}

const ROLES: UserRole[] = ["admin", "instructor", "student", "migration_lead"];

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  instructor: "Formateur",
  student: "Apprenant",
  migration_lead: "Migration",
};

function roleBadgeVariant(role: UserRole) {
  if (role === "admin") return "default" as const;
  if (role === "instructor") return "in_progress" as const;
  if (role === "student") return "completed" as const;
  return "pending" as const;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(value);
    }, ms);
    return () => {
      clearTimeout(t);
    };
  }, [value, ms]);
  return debounced;
}

// ── Sub-components ────────────────────────────────────────────────────────────────

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

function CreateUserDialog({
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

interface EditDialogProps {
  user: User | null;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

function EditUserDialog({ user, onOpenChange, onSuccess }: EditDialogProps) {
  const [form, setForm] = useState<EditUserForm>({
    firstName: "",
    lastName: "",
    role: "student",
    isActive: true,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (user !== null) {
      setForm({
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
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

// ── Compose Message Dialog ───────────────────────────────────────────────────────

interface ComposeDialogProps {
  user: User | null;
  onOpenChange: (v: boolean) => void;
}

function ComposeMessageDialog({ user, onOpenChange }: ComposeDialogProps) {
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

// ── Main page ─────────────────────────────────────────────────────────────────────

export function UserManagementPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [messageUser, setMessageUser] = useState<User | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const params = new URLSearchParams({ page: String(page), limit: "25" });
  if (debouncedSearch.length > 0) params.set("search", debouncedSearch);
  if (roleFilter !== "all") params.set("role", roleFilter);

  const { data, isLoading } = useQuery({
    queryKey: ["users", debouncedSearch, roleFilter, page],
    queryFn: () => api.get<UserListResponse>(`/users?${params.toString()}`),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["users"] });
  }

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter]);

  const users = data?.users ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark">Utilisateurs</h1>
          <p className="text-meta text-sm mt-1">
            {meta !== undefined
              ? `${String(meta.total)} utilisateurs au total`
              : "Chargement…"}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setCreateOpen(true);
          }}
        >
          <UserPlus size={14} className="mr-2" />
          Nouvel utilisateur
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-meta pointer-events-none"
          />
          <Input
            placeholder="Rechercher par nom ou email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            className="pl-9"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value as RoleFilter);
          }}
          className="h-10 px-3 text-sm border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Tous les rôles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-meta text-sm p-6">Chargement…</p>
          ) : users.length === 0 ? (
            <p className="text-meta text-sm p-6">Aucun utilisateur trouvé.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule">
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-meta">
                      Nom
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-meta">
                      Email
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-meta">
                      Rôle
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-meta">
                      Statut
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-meta">
                      Dernière connexion
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-meta">
                      Créé le
                    </th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-cream/50 transition-colors"
                    >
                      <td className="px-6 py-3 font-medium text-dark">
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-teal hover:text-teal/80 hover:underline transition-colors text-left"
                          title="Envoyer un message"
                          onClick={() => {
                            setMessageUser(u);
                          }}
                        >
                          <MessageSquare size={12} className="shrink-0" />
                          {u.firstName} {u.lastName}
                        </button>
                      </td>
                      <td className="px-6 py-3">
                        <a
                          href={`mailto:${u.email}`}
                          className="flex items-center gap-1.5 text-meta hover:text-dark hover:underline transition-colors"
                          title="Envoyer un email"
                        >
                          <Mail size={12} className="shrink-0" />
                          {u.email}
                        </a>
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant={roleBadgeVariant(u.role)}>
                          {ROLE_LABELS[u.role]}
                        </Badge>
                      </td>
                      <td className="px-6 py-3">
                        {u.isActive ? (
                          <span className="flex items-center gap-1.5 text-xs text-olive font-bold uppercase tracking-wider">
                            <UserCheck size={12} />
                            Actif
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-rose font-bold uppercase tracking-wider">
                            <UserX size={12} />
                            Inactif
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-meta">
                        {u.lastLoginAt !== null
                          ? formatDate(u.lastLoginAt)
                          : "—"}
                      </td>
                      <td className="px-6 py-3 text-meta">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => {
                            setEditUser(u);
                          }}
                          className="text-meta hover:text-dark transition-colors"
                          aria-label="Modifier"
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {meta !== undefined && meta.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-meta">
            Page {String(meta.page)} sur {String(meta.pages)} ·{" "}
            {String(meta.total)} résultats
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => {
                setPage((p) => p - 1);
              }}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.pages}
              onClick={() => {
                setPage((p) => p + 1);
              }}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={invalidate}
      />
      <EditUserDialog
        user={editUser}
        onOpenChange={(v) => {
          if (!v) setEditUser(null);
        }}
        onSuccess={invalidate}
      />
      <ComposeMessageDialog
        user={messageUser}
        onOpenChange={(v) => {
          if (!v) setMessageUser(null);
        }}
      />
    </div>
  );
}
