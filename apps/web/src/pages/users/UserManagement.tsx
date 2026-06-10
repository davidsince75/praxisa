import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  Search,
  Pencil,
  Trash2,
  UserX,
  UserCheck,
  Mail,
  MessageSquare,
  User as UserIcon,
} from "lucide-react";
import { api } from "@/lib/api.js";
import type { User, UserListResponse } from "@/lib/api.js";
import { useAuth } from "@/hooks/useAuth.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
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
import { ROLES, ROLE_LABELS, roleBadgeVariant, useDebounce } from "./shared.js";
import type { RoleFilter } from "./shared.js";
import { ComposeMessageDialog } from "./ComposeMessageDialog.js";
import { CreateUserDialog } from "./CreateUserDialog.js";
import { EditUserDialog } from "./EditUserDialog.js";
import { UserProfileDialog } from "./UserProfileDialog.js";

// ── Main page ─────────────────────────────────────────────────────────────────────

export function UserManagementPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [messageUser, setMessageUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      invalidate();
      setDeleteUser(null);
      setDeleteError("");
    },
    onError: (err: unknown) => {
      setDeleteError(err instanceof Error ? err.message : "Erreur");
    },
  });

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
                    <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wider text-meta">
                      Nom
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wider text-meta">
                      Email
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wider text-meta">
                      Rôle
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wider text-meta">
                      Statut
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wider text-meta">
                      Restriction
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wider text-meta">
                      Dernière connexion
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wider text-meta">
                      Créé le
                    </th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-cream/50 transition-colors"
                    >
                      <td className="px-3 py-2 font-medium text-dark">
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
                      <td className="px-3 py-2">
                        <a
                          href={`mailto:${u.email}`}
                          className="flex items-center gap-1.5 text-meta hover:text-dark hover:underline transition-colors"
                          title="Envoyer un email"
                        >
                          <Mail size={12} className="shrink-0" />
                          {u.email}
                        </a>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={roleBadgeVariant(u.role)}>
                          {ROLE_LABELS[u.role]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
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
                      <td className="px-3 py-2">
                        {u.isRestricted ? (
                          <Badge variant="pending">Restreint</Badge>
                        ) : (
                          <span className="text-meta">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-meta">
                        {u.lastLoginAt !== null
                          ? formatDate(u.lastLoginAt)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-meta">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setProfileUserId(u.id);
                            }}
                            className="text-meta hover:text-dark transition-colors"
                            aria-label="Fiche contact"
                            title="Fiche contact"
                          >
                            <UserIcon size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setEditUser(u);
                            }}
                            className="text-meta hover:text-dark transition-colors"
                            aria-label="Modifier"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteUser(u);
                            }}
                            className="text-meta hover:text-rose transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Supprimer"
                            disabled={u.id === currentUser?.id}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
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
      <UserProfileDialog
        userId={profileUserId}
        onOpenChange={(v) => {
          if (!v) {
            setProfileUserId(null);
          }
        }}
      />

      {deleteUser !== null && (
        <Dialog
          open
          onOpenChange={(v) => {
            if (!v) {
              setDeleteUser(null);
              setDeleteError("");
            }
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Supprimer l&apos;utilisateur</DialogTitle>
            </DialogHeader>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-dark">
                Supprimer{" "}
                <span className="font-semibold">
                  {deleteUser.firstName} {deleteUser.lastName}
                </span>{" "}
                ({deleteUser.email}) ? Cette action est irréversible.
              </p>
              {deleteError.length > 0 && (
                <p className="text-xs text-rose">{deleteError}</p>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" size="sm">
                  Annuler
                </Button>
              </DialogClose>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  deleteMutation.mutate(deleteUser.id);
                }}
              >
                {deleteMutation.isPending ? "Suppression…" : "Supprimer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
