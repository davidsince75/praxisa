import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, Plus, Send, Trash2, Users, BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button.js";
import { Badge } from "@/components/ui/badge.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.js";
import { api } from "@/lib/api.js";
import type {
  Campaign,
  CampaignsResponse,
  CampaignResponse,
  CampaignSendResponse,
  CourseListResponse,
} from "@/lib/api.js";

// ── Status badge ───────────────────────────────────────────────────────────────

const STATUS_VARIANTS: Record<
  string,
  "default" | "pending" | "in_progress" | "completed" | "destructive"
> = {
  draft: "pending",
  sending: "in_progress",
  sent: "completed",
  failed: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  sending: "Envoi…",
  sent: "Envoyé",
  failed: "Échec",
};

// ── Create form ────────────────────────────────────────────────────────────────

interface CreateFormProps {
  onClose: () => void;
}

function CreateForm({ onClose }: CreateFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState<
    "all_students" | "course_enrolled"
  >("all_students");
  const [targetCourseId, setTargetCourseId] = useState("");

  const { data: coursesData } = useQuery({
    queryKey: ["courses-list"],
    queryFn: () => api.get<CourseListResponse>("/courses"),
  });

  const createMutation = useMutation({
    mutationFn: (body_: Record<string, unknown>) =>
      api.post<CampaignResponse>("/campaigns", body_),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      onClose();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      name: name.trim(),
      subject: subject.trim(),
      body: body.trim(),
      targetType,
      ...(targetType === "course_enrolled" && targetCourseId.length > 0
        ? { targetCourseId }
        : {}),
    });
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold uppercase tracking-wider">
            Nouvelle campagne
          </CardTitle>
          <button
            onClick={onClose}
            className="text-meta hover:text-dark transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-dark mb-1.5">
                Nom interne
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                }}
                placeholder="Ex : Relance juin 2025"
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-dark placeholder:text-meta/50 focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-dark mb-1.5">
                Objet de l'email
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                }}
                placeholder="Ex : Votre prochaine formation vous attend"
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-dark placeholder:text-meta/50 focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-dark mb-1.5">
              Contenu
            </label>
            <textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
              }}
              rows={6}
              placeholder="Rédigez votre message ici…"
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-dark placeholder:text-meta/50 focus:outline-none focus:ring-2 focus:ring-teal/30 resize-y"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-dark mb-1.5">
              Destinataires
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="target"
                  value="all_students"
                  checked={targetType === "all_students"}
                  onChange={() => {
                    setTargetType("all_students");
                  }}
                  className="accent-teal"
                />
                <Users size={13} />
                Tous les apprenants
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="target"
                  value="course_enrolled"
                  checked={targetType === "course_enrolled"}
                  onChange={() => {
                    setTargetType("course_enrolled");
                  }}
                  className="accent-teal"
                />
                <BookOpen size={13} />
                Inscrits à un cours
              </label>
            </div>
            {targetType === "course_enrolled" && (
              <select
                value={targetCourseId}
                onChange={(e) => {
                  setTargetCourseId(e.target.value);
                }}
                className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-dark focus:outline-none focus:ring-2 focus:ring-teal/30"
              >
                <option value="">-- Sélectionner un cours --</option>
                {(coursesData?.courses ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {createMutation.error instanceof Error && (
            <p className="text-xs text-destructive">
              {createMutation.error.message}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={
                createMutation.isPending ||
                name.trim().length === 0 ||
                subject.trim().length === 0 ||
                body.trim().length === 0 ||
                (targetType === "course_enrolled" &&
                  targetCourseId.length === 0)
              }
            >
              {createMutation.isPending ? "Création…" : "Créer le brouillon"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onClose}>
              Annuler
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Campaign row ───────────────────────────────────────────────────────────────

interface CampaignRowProps {
  campaign: Campaign;
}

function CampaignRow({ campaign }: CampaignRowProps) {
  const queryClient = useQueryClient();

  const sendMutation = useMutation({
    mutationFn: () =>
      api.post<CampaignSendResponse>(`/campaigns/${campaign.id}/send`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete<undefined>(`/campaigns/${campaign.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  const targetLabel =
    campaign.targetType === "all_students"
      ? "Tous les apprenants"
      : "Inscrits au cours";

  return (
    <div className="flex items-center gap-4 px-4 py-3.5 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      <div className="w-8 h-8 rounded-full bg-teal/10 flex items-center justify-center flex-shrink-0">
        <Mail size={14} className="text-teal" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-dark truncate">{campaign.name}</p>
        <p className="text-xs text-meta truncate">{campaign.subject}</p>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-meta flex-shrink-0">
        {campaign.targetType === "all_students" ? (
          <Users size={11} />
        ) : (
          <BookOpen size={11} />
        )}
        {targetLabel}
      </div>

      <div className="flex-shrink-0">
        <Badge variant={STATUS_VARIANTS[campaign.status] ?? "default"}>
          {STATUS_LABELS[campaign.status] ?? campaign.status}
        </Badge>
      </div>

      {campaign.recipientCount !== null && (
        <p className="text-xs text-meta flex-shrink-0">
          {campaign.recipientCount} destinataire
          {campaign.recipientCount > 1 ? "s" : ""}
        </p>
      )}

      {campaign.sentAt !== null && (
        <p className="text-xs text-meta flex-shrink-0">
          {new Date(campaign.sentAt).toLocaleDateString("fr-FR")}
        </p>
      )}

      {campaign.status === "draft" && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            size="sm"
            onClick={() => {
              sendMutation.mutate();
            }}
            disabled={sendMutation.isPending}
          >
            <Send size={12} className="mr-1.5" />
            {sendMutation.isPending ? "Envoi…" : "Envoyer"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              deleteMutation.mutate();
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 size={12} />
          </Button>
        </div>
      )}

      {(sendMutation.error instanceof Error ||
        deleteMutation.error instanceof Error) && (
        <p className="text-xs text-destructive flex-shrink-0">
          {(sendMutation.error ?? deleteMutation.error)?.message}
        </p>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function AdminCampaignsPage() {
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => api.get<CampaignsResponse>("/campaigns"),
  });

  const list = data?.campaigns ?? [];
  const drafts = list.filter((c) => c.status === "draft");
  const sent = list.filter((c) => c.status === "sent" || c.status === "failed");

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-dark">Campagnes email</h1>
          <p className="text-xs text-meta mt-0.5">
            Créez et envoyez des communications ciblées via Brevo.
          </p>
        </div>
        {!showCreate && (
          <Button
            size="sm"
            onClick={() => {
              setShowCreate(true);
            }}
          >
            <Plus size={13} className="mr-1.5" />
            Nouvelle campagne
          </Button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateForm
          onClose={() => {
            setShowCreate(false);
          }}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-meta uppercase tracking-wider font-bold">
              Total
            </p>
            <p className="text-2xl font-bold text-dark mt-1">{list.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-meta uppercase tracking-wider font-bold">
              Brouillons
            </p>
            <p className="text-2xl font-bold text-dark mt-1">{drafts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-meta uppercase tracking-wider font-bold">
              Envoyées
            </p>
            <p className="text-2xl font-bold text-dark mt-1">
              {sent.filter((c) => c.status === "sent").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-meta">
            Toutes les campagnes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <p className="text-sm text-meta px-4 py-6 text-center">
              Chargement…
            </p>
          )}
          {!isLoading && list.length === 0 && (
            <div className="px-4 py-10 text-center">
              <Mail size={24} className="text-meta/30 mx-auto mb-2" />
              <p className="text-sm text-meta">
                Aucune campagne pour l'instant.
              </p>
              <p className="text-xs text-meta/60 mt-1">
                Créez votre première campagne ci-dessus.
              </p>
            </div>
          )}
          {list.map((c) => (
            <CampaignRow key={c.id} campaign={c} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
