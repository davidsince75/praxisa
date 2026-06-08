import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api.js";
import type { UserMeResponse } from "@/lib/api.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { Button } from "@/components/ui/button.js";
import { User, Mail, Lock, Phone, MapPin } from "lucide-react";

interface FieldConfig {
  key: "phone" | "address" | "city" | "postalCode" | "country";
  label: string;
  type: string;
}

const PROFILE_FIELDS: FieldConfig[] = [
  { key: "phone", label: "Téléphone", type: "tel" },
  { key: "address", label: "Adresse", type: "text" },
  { key: "city", label: "Ville", type: "text" },
  { key: "postalCode", label: "Code postal", type: "text" },
  { key: "country", label: "Pays", type: "text" },
];

export function LearnSettingsPage() {
  const queryClient = useQueryClient();
  const [profileForm, setProfileForm] = useState<{
    phone: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
  } | null>(null);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);

  const { data: meData, isLoading } = useQuery<UserMeResponse>({
    queryKey: ["users-me"],
    queryFn: () => api.get<UserMeResponse>("/users/me"),
  });

  const profile = meData?.user;

  const saveMutation = useMutation({
    mutationFn: (body: typeof profileForm) => api.patch("/users/me", body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users-me"] });
      setProfileError("");
      setProfileSuccess(true);
      setTimeout(() => {
        setProfileSuccess(false);
      }, 3000);
      setProfileForm(null);
    },
    onError: (err: unknown) => {
      setProfileError(err instanceof Error ? err.message : "Erreur");
    },
  });

  function startEdit(): void {
    setProfileForm({
      phone: profile?.phone ?? "",
      address: profile?.address ?? "",
      city: profile?.city ?? "",
      postalCode: profile?.postalCode ?? "",
      country: profile?.country ?? "France",
    });
    setProfileSuccess(false);
  }

  function cancelEdit(): void {
    setProfileForm(null);
    setProfileError("");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-dark">Paramètres</h1>
        <p className="text-meta text-sm mt-0.5">
          Gérez vos informations personnelles
        </p>
      </div>

      {/* Identity (read-only) */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <User size={14} className="text-meta" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-meta">
              Identité
            </h2>
          </div>
          {isLoading ? (
            <p className="text-xs text-meta">Chargement&hellip;</p>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] text-meta block mb-1">
                    Prénom
                  </label>
                  <p className="text-sm font-medium text-dark">
                    {profile?.firstName ?? "—"}
                  </p>
                </div>
                <div className="flex-1">
                  <label className="text-[11px] text-meta block mb-1">
                    Nom
                  </label>
                  <p className="text-sm font-medium text-dark">
                    {profile?.lastName ?? "—"}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-[11px] text-meta block mb-1 flex items-center gap-1.5">
                  <Mail size={11} />
                  Email
                </label>
                <p className="text-sm font-medium text-dark">
                  {profile?.email ?? "—"}
                </p>
              </div>
              <p className="text-[11px] text-meta/60 mt-2">
                Pour modifier votre nom ou email, contactez un administrateur.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact info (editable) */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-meta" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-meta">
                Coordonnées
              </h2>
            </div>
            {profileForm === null && (
              <Button variant="outline" size="sm" onClick={startEdit}>
                Modifier
              </Button>
            )}
          </div>

          {profileSuccess && (
            <p className="text-xs text-teal mb-3">
              Modifications enregistrées.
            </p>
          )}

          {profileForm !== null ? (
            <div className="space-y-3">
              {PROFILE_FIELDS.map(({ key, label, type }) => (
                <div key={key}>
                  <label className="text-[11px] text-meta block mb-1">
                    {label}
                  </label>
                  <input
                    type={type}
                    value={profileForm[key]}
                    onChange={(e) => {
                      setProfileForm({ ...profileForm, [key]: e.target.value });
                    }}
                    className="w-full text-sm border border-rule rounded px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-teal"
                  />
                </div>
              ))}
              {profileError.length > 0 && (
                <p className="text-xs text-rose">{profileError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  disabled={saveMutation.isPending}
                  onClick={() => {
                    saveMutation.mutate(profileForm);
                  }}
                >
                  {saveMutation.isPending ? "Sauvegarde…" : "Enregistrer"}
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {PROFILE_FIELDS.map(({ key, label }) => {
                const val = profile?.[key] ?? "";
                return (
                  <div
                    key={key}
                    className="flex gap-3 text-xs py-1 border-b border-rule last:border-0"
                  >
                    <span className="text-meta w-24 shrink-0">{label}</span>
                    <span className="text-dark font-medium">
                      {val.length > 0 ? val : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change password (placeholder) */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lock size={14} className="text-meta" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-meta">
              Mot de passe
            </h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-meta block mb-1">
                Mot de passe actuel
              </label>
              <input
                type="password"
                disabled
                placeholder="••••••••"
                className="w-full text-sm border border-rule rounded px-3 py-2 bg-surface text-meta cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-[11px] text-meta block mb-1">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                disabled
                placeholder="••••••••"
                className="w-full text-sm border border-rule rounded px-3 py-2 bg-surface text-meta cursor-not-allowed"
              />
            </div>
            <p className="text-[11px] text-meta/60">
              La modification du mot de passe sera disponible prochainement.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={14} className="text-meta" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-meta">
              Adresse complète
            </h2>
          </div>
          <p className="text-sm text-dark">
            {[
              profile?.address,
              profile?.city,
              profile?.postalCode,
              profile?.country,
            ]
              .filter(
                (v) => v !== null && v !== undefined && String(v).length > 0,
              )
              .join(", ") || "—"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
