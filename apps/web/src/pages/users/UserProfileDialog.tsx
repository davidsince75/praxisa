import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Pencil,
  Mail,
  Phone,
  Copy,
  Check,
  User as UserIcon,
} from "lucide-react";
import { api } from "@/lib/api.js";
import type { UserDetail, UserDetailResponse } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Badge } from "@/components/ui/badge.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.js";
import { ROLE_LABELS, roleBadgeVariant } from "./shared.js";

// ── User Profile Dialog ──────────────────────────────────────────────────────

interface ProfileForm {
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

interface UserProfileDialogProps {
  userId: string | null;
  onOpenChange: (v: boolean) => void;
}

export function UserProfileDialog({
  userId,
  onOpenChange,
}: UserProfileDialogProps) {
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<ProfileForm>({
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    country: "",
  });
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery<UserDetailResponse>({
    queryKey: ["user-detail", userId],
    queryFn: () => api.get<UserDetailResponse>(`/users/${userId ?? ""}`),
    enabled: userId !== null,
  });

  const u = data?.user;

  useEffect(() => {
    if (u !== undefined) {
      setForm({
        phone: u.phone ?? "",
        address: u.address ?? "",
        city: u.city ?? "",
        postalCode: u.postalCode ?? "",
        country: u.country ?? "France",
      });
      setEditMode(false);
      setError("");
    }
  }, [u]);

  const saveMutation = useMutation({
    mutationFn: (body: ProfileForm) =>
      api.patch<UserDetailResponse>(`/users/${userId ?? ""}`, body),
    onSuccess: (updated) => {
      queryClient.setQueryData<UserDetailResponse>(
        ["user-detail", userId],
        updated,
      );
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditMode(false);
      setError("");
      const uu = updated.user;
      setForm({
        phone: uu.phone ?? "",
        address: uu.address ?? "",
        city: uu.city ?? "",
        postalCode: uu.postalCode ?? "",
        country: uu.country ?? "France",
      });
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Erreur");
    },
  });

  function handleCopy(): void {
    if (u === undefined) return;
    const lines: string[] = [`${u.firstName} ${u.lastName}`, u.email];
    if ((u.phone ?? "").length > 0) {
      lines.push(`Tel : ${u.phone ?? ""}`);
    }
    const addrParts = [
      u.address,
      [u.postalCode, u.city].filter(Boolean).join(" "),
      u.country,
    ].filter((p): p is string => typeof p === "string" && p.length > 0);
    if (addrParts.length > 0) {
      lines.push(addrParts.join(", "));
    }
    void navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  const PROFILE_FIELDS: {
    key: keyof ProfileForm;
    label: string;
    type: string;
  }[] = [
    { key: "phone", label: "Telephone", type: "tel" },
    { key: "address", label: "Adresse", type: "text" },
    { key: "city", label: "Ville", type: "text" },
    { key: "postalCode", label: "Code postal", type: "text" },
    { key: "country", label: "Pays", type: "text" },
  ];

  return (
    <Dialog open={userId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon size={16} />
            Fiche contact
          </DialogTitle>
        </DialogHeader>

        {isLoading || u === undefined ? (
          <div className="px-6 py-8 text-center text-xs text-meta">
            Chargement&hellip;
          </div>
        ) : (
          <div className="px-6 pb-6 space-y-5">
            {/* Identity (read-only) */}
            <div className="rounded-lg border border-rule bg-cream/40 p-4 space-y-2">
              <p className="text-sm font-semibold text-dark">
                {u.firstName} {u.lastName}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-meta">
                <Mail size={11} />
                {u.email}
              </p>
              <div className="flex items-center gap-2">
                <Badge variant={roleBadgeVariant(u.role)}>
                  {ROLE_LABELS[u.role]}
                </Badge>
                {u.isActive ? (
                  <span className="text-[11px] text-olive font-semibold uppercase tracking-wide">
                    Actif
                  </span>
                ) : (
                  <span className="text-[11px] text-rose font-semibold uppercase tracking-wide">
                    Inactif
                  </span>
                )}
              </div>
            </div>

            {/* Profile fields */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold uppercase tracking-wider text-meta flex items-center gap-1.5">
                  <Phone size={11} />
                  Coordonnees
                </p>
                {!editMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditMode(true);
                    }}
                    className="text-xs text-teal hover:text-teal/80 flex items-center gap-1"
                  >
                    <Pencil size={11} />
                    Modifier
                  </button>
                )}
              </div>

              {editMode ? (
                <div className="space-y-2.5">
                  {PROFILE_FIELDS.map(({ key, label, type }) => (
                    <div key={key} className="flex items-center gap-3">
                      <label className="text-xs text-meta w-24 shrink-0">
                        {label}
                      </label>
                      <input
                        type={type}
                        value={form[key]}
                        onChange={(e) => {
                          setForm((f) => ({ ...f, [key]: e.target.value }));
                        }}
                        className="flex-1 text-xs border border-rule rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal"
                      />
                    </div>
                  ))}
                  {error.length > 0 && (
                    <p className="text-xs text-rose">{error}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      disabled={saveMutation.isPending}
                      onClick={() => {
                        saveMutation.mutate(form);
                      }}
                    >
                      {saveMutation.isPending ? "Sauvegarde..." : "Enregistrer"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditMode(false);
                        setError("");
                      }}
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {PROFILE_FIELDS.map(({ key, label }) => {
                    const val = u[key as keyof UserDetail] as string | null;
                    return (
                      <div key={key} className="flex items-start gap-2 text-xs">
                        <span className="text-meta w-24 shrink-0">{label}</span>
                        <span className="text-dark font-medium">
                          {val !== null && val.length > 0 ? (
                            val
                          ) : (
                            <span className="text-meta">&#8212;</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Copy to clipboard */}
            {!editMode && (
              <button
                type="button"
                onClick={handleCopy}
                className="w-full flex items-center justify-center gap-2 text-xs text-meta border border-rule rounded-md py-2 hover:bg-cream/60 hover:text-dark transition-colors"
              >
                {copied ? (
                  <>
                    <Check size={12} className="text-olive" />
                    Copie !
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    Copier les coordonnees
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
