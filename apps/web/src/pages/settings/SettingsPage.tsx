import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Lock,
  Palette,
  Bell,
  Shield,
  Check,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api.js";
import type { ProfileResponse, PreferencesResponse } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";
import { Card, CardContent } from "@/components/ui/card.js";

type Tab = "profile" | "password" | "appearance" | "notifications" | "privacy";

function ProfileTab() {
  const qc = useQueryClient();
  const { data } = useQuery<ProfileResponse>({
    queryKey: ["settings-profile"],
    queryFn: () => api.get<ProfileResponse>("/settings/profile"),
  });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  if (data !== undefined && !initialized) {
    setFirstName(data.profile.firstName);
    setLastName(data.profile.lastName);
    setEmail(data.profile.email);
    setInitialized(true);
  }

  const mutation = useMutation({
    mutationFn: () =>
      api.patch("/settings/profile", { firstName, lastName, email }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["settings-profile"] });
      setSuccess(true);
      setError("");
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Erreur");
      setSuccess(false);
    },
  });

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-dark">Profil</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-first">Pr&eacute;nom</Label>
            <Input
              id="p-first"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-last">Nom</Label>
            <Input
              id="p-last"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
              }}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-email">Email</Label>
          <Input
            id="p-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
          />
        </div>
        {error.length > 0 && <p className="text-xs text-rose">{error}</p>}
        {success && (
          <p className="text-xs text-teal flex items-center gap-1">
            <Check size={12} /> Profil mis &agrave; jour
          </p>
        )}
        <Button
          size="sm"
          disabled={mutation.isPending}
          onClick={() => {
            mutation.mutate();
          }}
        >
          {mutation.isPending ? "Sauvegarde…" : "Enregistrer"}
        </Button>
      </CardContent>
    </Card>
  );
}

function PasswordTab() {
  const [current, setCurrent] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/settings/password", {
        currentPassword: current,
        newPassword: newPwd,
      }),
    onSuccess: () => {
      setSuccess(true);
      setError("");
      setCurrent("");
      setNewPwd("");
      setConfirm("");
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Erreur");
      setSuccess(false);
    },
  });

  function handleSubmit() {
    if (newPwd !== confirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    if (newPwd.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }
    mutation.mutate();
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-dark">Mot de passe</h2>
        <div className="space-y-1.5">
          <Label htmlFor="pw-current">Mot de passe actuel</Label>
          <Input
            id="pw-current"
            type="password"
            value={current}
            onChange={(e) => {
              setCurrent(e.target.value);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-new">Nouveau mot de passe</Label>
          <Input
            id="pw-new"
            type="password"
            value={newPwd}
            onChange={(e) => {
              setNewPwd(e.target.value);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-confirm">Confirmer</Label>
          <Input
            id="pw-confirm"
            type="password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
            }}
          />
        </div>
        {error.length > 0 && <p className="text-xs text-rose">{error}</p>}
        {success && (
          <p className="text-xs text-teal flex items-center gap-1">
            <Check size={12} /> Mot de passe modifi&eacute;
          </p>
        )}
        <Button size="sm" disabled={mutation.isPending} onClick={handleSubmit}>
          {mutation.isPending ? "Sauvegarde…" : "Changer le mot de passe"}
        </Button>
      </CardContent>
    </Card>
  );
}

function AppearanceTab() {
  const qc = useQueryClient();
  const { data } = useQuery<PreferencesResponse>({
    queryKey: ["settings-prefs"],
    queryFn: () => api.get<PreferencesResponse>("/settings/preferences"),
  });

  const theme = data?.preferences?.theme ?? "system";

  const mutation = useMutation({
    mutationFn: (t: string) => api.patch("/settings/preferences", { theme: t }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["settings-prefs"] });
    },
  });

  const themes = [
    { value: "light", label: "Clair" },
    { value: "dark", label: "Sombre" },
    { value: "system", label: "Système" },
  ];

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-dark">Apparence</h2>
        <div className="flex gap-3">
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                mutation.mutate(t.value);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                theme === t.value
                  ? "border-teal bg-teal/10 text-teal"
                  : "border-rule text-meta hover:border-dark"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-meta">
          Le th&egrave;me s&apos;appliquera lors de la prochaine connexion.
        </p>
      </CardContent>
    </Card>
  );
}

function NotificationsTab() {
  const qc = useQueryClient();
  const { data } = useQuery<PreferencesResponse>({
    queryKey: ["settings-prefs"],
    queryFn: () => api.get<PreferencesResponse>("/settings/preferences"),
  });

  const prefs = data?.preferences?.emailNotifications ?? {
    messages: true,
    grading: true,
    campaigns: true,
    forums: true,
  };

  const mutation = useMutation({
    mutationFn: (emailNotifications: typeof prefs) =>
      api.patch("/settings/preferences", { emailNotifications }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["settings-prefs"] });
    },
  });

  const toggles = [
    { key: "messages" as const, label: "Messages" },
    { key: "grading" as const, label: "Notation de travaux" },
    { key: "campaigns" as const, label: "Campagnes email" },
    { key: "forums" as const, label: "Réponses au forum" },
  ];

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-dark">
          Notifications par email
        </h2>
        {toggles.map((t) => (
          <label key={t.key} className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs[t.key]}
              onChange={(e) => {
                mutation.mutate({ ...prefs, [t.key]: e.target.checked });
              }}
              className="h-4 w-4 accent-teal"
            />
            <span className="text-sm text-dark">{t.label}</span>
          </label>
        ))}
      </CardContent>
    </Card>
  );
}

function PrivacyTab() {
  const [exportSuccess, setExportSuccess] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [error, setError] = useState("");

  const exportMutation = useMutation({
    mutationFn: () => api.post("/settings/data-export", {}),
    onSuccess: () => {
      setExportSuccess(true);
      setError("");
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Erreur");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.post("/settings/data-deletion", {}),
    onSuccess: () => {
      setDeleteSuccess(true);
      setError("");
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Erreur");
    },
  });

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <h2 className="text-lg font-semibold text-dark">
          Confidentialit&eacute; &amp; donn&eacute;es
        </h2>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-dark">
            Exporter mes donn&eacute;es (RGPD Art. 15)
          </h3>
          <p className="text-xs text-meta">
            Demandez une copie de toutes vos donn&eacute;es personnelles. Un
            administrateur traitera votre demande sous 30 jours.
          </p>
          {exportSuccess ? (
            <p className="text-xs text-teal flex items-center gap-1">
              <Check size={12} /> Demande soumise
            </p>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={exportMutation.isPending}
              onClick={() => {
                exportMutation.mutate();
              }}
            >
              Demander l&apos;export
            </Button>
          )}
        </div>

        <div className="border-t border-rule" />

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-dark">
            Supprimer mes donn&eacute;es (RGPD Art. 17)
          </h3>
          <p className="text-xs text-meta">
            Demandez la suppression de vos donn&eacute;es personnelles. Cette
            action est irr&eacute;versible apr&egrave;s traitement.
          </p>
          {deleteSuccess ? (
            <p className="text-xs text-teal flex items-center gap-1">
              <Check size={12} /> Demande soumise
            </p>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={deleteMutation.isPending}
              onClick={() => {
                deleteMutation.mutate();
              }}
              className="border-rose text-rose hover:bg-rose/10"
            >
              <AlertTriangle size={13} className="mr-1.5" />
              Demander la suppression
            </Button>
          )}
        </div>

        <div className="border-t border-rule" />

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-dark">
            Supprimer mon compte
          </h3>
          <p className="text-xs text-meta">
            Demandez la fermeture d&eacute;finitive de votre compte.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              deleteMutation.mutate();
            }}
            className="border-rose text-rose hover:bg-rose/10"
          >
            <AlertTriangle size={13} className="mr-1.5" />
            Demander la suppression du compte
          </Button>
        </div>

        {error.length > 0 && <p className="text-xs text-rose">{error}</p>}
      </CardContent>
    </Card>
  );
}

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");

  const tabs: { key: Tab; label: string; icon: typeof User }[] = [
    { key: "profile", label: "Profil", icon: User },
    { key: "password", label: "Mot de passe", icon: Lock },
    { key: "appearance", label: "Apparence", icon: Palette },
    { key: "notifications", label: "Notifications", icon: Bell },
    { key: "privacy", label: "Confidentialité", icon: Shield },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-dark">Param&egrave;tres</h1>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-teal text-white"
                  : "bg-cream text-meta hover:text-dark"
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "profile" && <ProfileTab />}
      {tab === "password" && <PasswordTab />}
      {tab === "appearance" && <AppearanceTab />}
      {tab === "notifications" && <NotificationsTab />}
      {tab === "privacy" && <PrivacyTab />}
    </div>
  );
}
