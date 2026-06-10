import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Upload,
  FileSpreadsheet,
  Users,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Download,
} from "lucide-react";
import { api } from "@/lib/api.js";
import type {
  ImportUsersResponse,
  ImportEnrolmentsResponse,
} from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardContent } from "@/components/ui/card.js";

type ImportMode = "users" | "enrolments";

type ParsedRow = Record<string, string>;

function parseCsv(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: ParsedRow = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return { headers, rows };
}

const USER_TEMPLATE = `firstName,lastName,email,role
Marie,Dupont,marie.dupont@example.com,student
Jean,Martin,jean.martin@example.com,student
Claire,Bernard,claire.bernard@example.com,instructor`;

const ENROLMENT_TEMPLATE = `studentEmail,courseSlug,status,enrolledAt,completedAt
marie.dupont@example.com,psychologie,active,2024-09-15,
jean.martin@example.com,psychologie,completed,2023-09-01,2024-06-15`;

function downloadTemplate(mode: ImportMode) {
  const content = mode === "users" ? USER_TEMPLATE : ENROLMENT_TEMPLATE;
  const filename =
    mode === "users"
      ? "template_utilisateurs.csv"
      : "template_inscriptions.csv";
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function DataImportPage() {
  const [mode, setMode] = useState<ImportMode>("users");
  const [parsed, setParsed] = useState<{
    headers: string[];
    rows: ParsedRow[];
  } | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<
    | { type: "users"; data: ImportUsersResponse }
    | { type: "enrolments"; data: ImportEnrolmentsResponse }
    | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const usersMutation = useMutation({
    mutationFn: (rows: ParsedRow[]) =>
      api.post<ImportUsersResponse>("/import/users", {
        rows: rows.map((r) => ({
          firstName: r.firstName,
          lastName: r.lastName,
          email: r.email,
          role: r.role || "student",
        })),
      }),
    onSuccess: (data) => {
      setResult({ type: "users", data });
    },
  });

  const enrolmentsMutation = useMutation({
    mutationFn: (rows: ParsedRow[]) =>
      api.post<ImportEnrolmentsResponse>("/import/enrolments", {
        rows: rows.map((r) => ({
          studentEmail: r.studentEmail,
          courseSlug: r.courseSlug,
          status: r.status || "active",
          enrolledAt: r.enrolledAt || undefined,
          completedAt: r.completedAt || undefined,
        })),
      }),
    onSuccess: (data) => {
      setResult({ type: "enrolments", data });
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file === undefined) return;

    setFileName(file.name);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        setParsed(parseCsv(text));
      }
    };
    reader.readAsText(file);
  }

  function handleImport() {
    if (parsed === null || parsed.rows.length === 0) return;

    if (mode === "users") {
      usersMutation.mutate(parsed.rows);
    } else {
      enrolmentsMutation.mutate(parsed.rows);
    }
  }

  function handleReset() {
    setParsed(null);
    setFileName(null);
    setResult(null);
    if (fileInputRef.current !== null) {
      fileInputRef.current.value = "";
    }
  }

  const isPending = usersMutation.isPending || enrolmentsMutation.isPending;
  const mutationError = usersMutation.error ?? enrolmentsMutation.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-dark">
          Import de donn&eacute;es
        </h1>
        <p className="text-meta text-sm mt-1">
          Importez des utilisateurs ou des inscriptions depuis un fichier CSV.
        </p>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setMode("users");
            handleReset();
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border transition-colors ${
            mode === "users"
              ? "border-teal bg-teal/5 text-teal"
              : "border-rule text-meta hover:border-teal/40"
          }`}
        >
          <Users size={14} />
          Utilisateurs
        </button>
        <button
          onClick={() => {
            setMode("enrolments");
            handleReset();
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border transition-colors ${
            mode === "enrolments"
              ? "border-teal bg-teal/5 text-teal"
              : "border-rule text-meta hover:border-teal/40"
          }`}
        >
          <BookOpen size={14} />
          Inscriptions
        </button>
      </div>

      {/* Template download */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-dark text-sm">
                {mode === "users"
                  ? "Import d'utilisateurs"
                  : "Import d'inscriptions"}
              </h2>
              <p className="text-xs text-meta mt-1">
                {mode === "users"
                  ? "Colonnes attendues : firstName, lastName, email, role (student/instructor)"
                  : "Colonnes attendues : studentEmail, courseSlug, status, enrolledAt, completedAt"}
              </p>
            </div>
            <button
              onClick={() => {
                downloadTemplate(mode);
              }}
              className="flex items-center gap-1.5 text-xs text-teal hover:underline"
            >
              <Download size={13} />
              T&eacute;l&eacute;charger le mod&egrave;le
            </button>
          </div>
        </CardContent>
      </Card>

      {/* File upload */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-14 h-14 rounded-full bg-teal/10 flex items-center justify-center">
              {fileName !== null ? (
                <FileSpreadsheet size={24} className="text-teal" />
              ) : (
                <Upload size={24} className="text-meta" />
              )}
            </div>
            {fileName !== null ? (
              <div className="text-center">
                <p className="text-sm font-medium text-dark">{fileName}</p>
                <p className="text-xs text-meta mt-1">
                  {String(parsed?.rows.length ?? 0)} lignes
                  d&eacute;tect&eacute;es
                </p>
              </div>
            ) : (
              <p className="text-sm text-meta">
                S&eacute;lectionnez un fichier CSV
              </p>
            )}
            <div className="flex gap-2">
              <label className="cursor-pointer">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal border border-teal/40 px-4 py-2 hover:bg-teal/5 transition-colors">
                  <Upload size={13} />
                  {fileName !== null ? "Changer" : "Choisir un fichier"}
                </span>
              </label>
              {fileName !== null && (
                <button
                  onClick={handleReset}
                  className="text-xs text-meta hover:text-dark transition-colors px-3 py-2"
                >
                  Effacer
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview table */}
      {parsed !== null && parsed.rows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-3 border-b border-rule flex items-center justify-between">
              <h3 className="text-sm font-semibold text-dark">
                Aper&ccedil;u ({String(parsed.rows.length)} lignes)
              </h3>
              <Button size="sm" disabled={isPending} onClick={handleImport}>
                {isPending ? "Import en cours..." : "Lancer l'import"}
              </Button>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-cream">
                  <tr className="border-b border-rule">
                    <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-meta">
                      #
                    </th>
                    {parsed.headers.map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-meta"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {parsed.rows.slice(0, 50).map((row, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-cream/50 transition-colors"
                    >
                      <td className="px-4 py-2 text-meta text-xs">
                        {String(idx + 1)}
                      </td>
                      {parsed.headers.map((h) => (
                        <td key={h} className="px-4 py-2 text-dark">
                          {row[h] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.rows.length > 50 && (
                <p className="px-4 py-2 text-xs text-meta border-t border-rule">
                  &hellip; et {String(parsed.rows.length - 50)} lignes
                  suppl&eacute;mentaires
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {mutationError !== null && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-rose">
              <AlertTriangle size={16} />
              <p className="text-sm">
                Erreur :{" "}
                {mutationError instanceof Error
                  ? mutationError.message
                  : "Erreur inconnue"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result !== null && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-teal">
              <CheckCircle2 size={16} />
              <h3 className="font-semibold text-sm">Import termin&eacute;</h3>
            </div>
            {result.type === "users" ? (
              <div className="text-sm space-y-1">
                <p className="text-dark">
                  <strong>{String(result.data.created)}</strong> utilisateur
                  {result.data.created !== 1 ? "s" : ""} cr&eacute;&eacute;
                  {result.data.created !== 1 ? "s" : ""}
                </p>
                {result.data.skipped > 0 && (
                  <div>
                    <p className="text-amber-600">
                      <strong>{String(result.data.skipped)}</strong>{" "}
                      ignor&eacute;{result.data.skipped !== 1 ? "s" : ""} (email
                      d&eacute;j&agrave; existant)
                    </p>
                    <ul className="mt-1 text-xs text-meta list-disc list-inside">
                      {result.data.skippedEmails.map((email) => (
                        <li key={email}>{email}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm space-y-1">
                <p className="text-dark">
                  <strong>{String(result.data.created)}</strong> inscription
                  {result.data.created !== 1 ? "s" : ""} cr&eacute;&eacute;e
                  {result.data.created !== 1 ? "s" : ""}
                </p>
                {result.data.errors.length > 0 && (
                  <div>
                    <p className="text-amber-600">
                      <strong>{String(result.data.errors.length)}</strong>{" "}
                      erreur{result.data.errors.length !== 1 ? "s" : ""}
                    </p>
                    <ul className="mt-1 text-xs text-meta list-disc list-inside">
                      {result.data.errors.map((err) => (
                        <li key={err.row}>
                          Ligne {String(err.row)}: {err.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
