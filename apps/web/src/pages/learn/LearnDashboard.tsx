import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api.js";
import type { UserMeResponse, MyEnrolmentsResponse } from "@/lib/api.js";
import { useAuth } from "@/hooks/useAuth.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { Button } from "@/components/ui/button.js";
import {
  User,
  Mail,
  Phone,
  MapPin,
  FileText,
  Download,
  Award,
  Edit,
  AlertCircle,
} from "lucide-react";

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-rule last:border-0">
      <Icon size={14} className="text-meta mt-0.5 shrink-0" />
      <span className="text-xs text-meta w-28 shrink-0">{label}</span>
      <span className="text-xs text-dark font-medium">
        {value !== null && value !== undefined && value.length > 0
          ? value
          : "—"}
      </span>
    </div>
  );
}

export function LearnDashboardPage() {
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<{
    phone: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
  } | null>(null);
  const [saveError, setSaveError] = useState("");

  const { data: meData, isLoading } = useQuery<UserMeResponse>({
    queryKey: ["users-me"],
    queryFn: () => api.get<UserMeResponse>("/users/me"),
  });

  const { data: enrolData } = useQuery<MyEnrolmentsResponse>({
    queryKey: ["my-enrolments"],
    queryFn: () => api.get<MyEnrolmentsResponse>("/enrolments/my"),
  });

  const saveMutation = useMutation({
    mutationFn: (body: typeof form) =>
      api.patch<UserMeResponse>("/users/me", body),
    onSuccess: (data) => {
      queryClient.setQueryData<UserMeResponse>(["users-me"], data);
      setEditMode(false);
      setSaveError("");
    },
    onError: (err: unknown) => {
      setSaveError(err instanceof Error ? err.message : "Erreur");
    },
  });

  const profile = meData?.user;

  function startEdit(): void {
    setForm({
      phone: profile?.phone ?? "",
      address: profile?.address ?? "",
      city: profile?.city ?? "",
      postalCode: profile?.postalCode ?? "",
      country: profile?.country ?? "France",
    });
    setEditMode(true);
  }

  const completedCount = (enrolData?.enrolments ?? []).filter(
    (e) => e.status === "completed",
  ).length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark">Tableau de bord</h1>
          <p className="text-meta text-sm mt-0.5">
            Bienvenue, {authUser?.firstName}
          </p>
        </div>
        {!editMode && (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Edit size={13} className="mr-1.5" />
            Modifier
          </Button>
        )}
      </div>

      {/* Civil status */}
      <Card>
        <CardContent className="p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-meta mb-4">
            Mes informations
          </h2>
          {isLoading ? (
            <p className="text-xs text-meta">Chargement&hellip;</p>
          ) : editMode && form !== null ? (
            <div className="space-y-3">
              {(
                [
                  { key: "phone" as const, label: "Téléphone", type: "tel" },
                  { key: "address" as const, label: "Adresse", type: "text" },
                  { key: "city" as const, label: "Ville", type: "text" },
                  {
                    key: "postalCode" as const,
                    label: "Code postal",
                    type: "text",
                  },
                  { key: "country" as const, label: "Pays", type: "text" },
                ] as const
              ).map(({ key, label, type }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="text-xs text-meta w-28 shrink-0">
                    {label}
                  </label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => {
                      setForm({ ...form, [key]: e.target.value });
                    }}
                    className="flex-1 text-xs border border-rule rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal"
                  />
                </div>
              ))}
              {saveError.length > 0 && (
                <p className="text-xs text-rose">{saveError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  disabled={saveMutation.isPending}
                  onClick={() => {
                    saveMutation.mutate(form);
                  }}
                >
                  {saveMutation.isPending ? "Sauvegarde…" : "Enregistrer"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditMode(false);
                  }}
                >
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <InfoRow
                icon={User}
                label="Nom complet"
                value={
                  (profile?.firstName ?? "") + " " + (profile?.lastName ?? "")
                }
              />
              <InfoRow icon={Mail} label="Email" value={profile?.email} />
              <InfoRow icon={Phone} label="Téléphone" value={profile?.phone} />
              <InfoRow icon={MapPin} label="Adresse" value={profile?.address} />
              <InfoRow icon={MapPin} label="Ville" value={profile?.city} />
              <InfoRow
                icon={MapPin}
                label="Code postal"
                value={profile?.postalCode}
              />
              <InfoRow icon={MapPin} label="Pays" value={profile?.country} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contrat Praxisa */}
      <Card>
        <CardContent className="p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-meta mb-4">
            Contrat Praxisa
          </h2>
          <div className="flex flex-col items-center py-6 gap-2">
            <AlertCircle size={24} className="text-meta/40" />
            <p className="text-xs text-meta">
              Aucun contrat signé pour le moment.
            </p>
            <p className="text-[11px] text-meta/60">
              Votre contrat apparaîtra ici une fois signé.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Factures */}
      <Card>
        <CardContent className="p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-meta mb-4">
            Factures
          </h2>
          <div className="flex flex-col items-center py-6 gap-2">
            <FileText size={24} className="text-meta/40" />
            <p className="text-xs text-meta">Aucune facture disponible.</p>
          </div>
        </CardContent>
      </Card>

      {/* Certificats shortcut */}
      <Link to="/learn/certificates">
        <Card className="cursor-pointer hover:border-teal/40 transition-colors">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-teal/10">
              <Award size={20} className="text-teal" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-dark">
                Mes certificats
              </h2>
              <p className="text-xs text-meta mt-0.5">
                {completedCount > 0
                  ? String(completedCount) +
                    " formation" +
                    (completedCount > 1 ? "s" : "") +
                    " terminée" +
                    (completedCount > 1 ? "s" : "")
                  : "Terminez une formation pour obtenir votre certificat."}
              </p>
            </div>
            <Download size={16} className="text-meta" />
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
