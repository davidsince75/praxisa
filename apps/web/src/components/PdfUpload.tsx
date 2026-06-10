import { useRef, useState } from "react";
import { api } from "@/lib/api.js";
import type { UploadFileResponse } from "@/lib/api.js";
import { File, Upload, X } from "lucide-react";

interface PdfUploadProps {
  onUpload: (fileId: string) => void;
  currentFileId?: string | null;
  label?: string;
}

export function PdfUpload({
  onUpload,
  currentFileId,
  label = "PDF",
}: PdfUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [filename, setFilename] = useState("");

  async function handleFile(file: File): Promise<void> {
    if (file.type !== "application/pdf") {
      setError("Seuls les fichiers PDF sont acceptés.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("Fichier trop volumineux (max 50 Mo).");
      return;
    }

    setUploading(true);
    setError("");
    try {
      // Send raw binary — no base64 conversion, no JSON overhead
      const res = await api.upload<UploadFileResponse>("/files", file);
      setFilename(file.name);
      onUpload(res.file.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur d’upload");
    } finally {
      setUploading(false);
    }
  }

  const hasFile = currentFileId !== null && currentFileId !== undefined;

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f !== undefined) {
            void handleFile(f);
          }
        }}
      />

      {hasFile || filename.length > 0 ? (
        <div className="flex items-center gap-2 p-2 bg-teal/5 border border-teal/30 rounded">
          <File size={14} className="text-teal flex-shrink-0" />
          <span className="flex-1 text-xs text-dark truncate">
            {filename.length > 0 ? filename : label + " téléchargé"}
          </span>
          <button
            type="button"
            onClick={() => {
              inputRef.current?.click();
            }}
            disabled={uploading}
            className="text-[10px] font-bold uppercase tracking-wider text-teal hover:text-teal/70 transition-colors disabled:opacity-40"
          >
            {uploading ? "Upload..." : "Remplacer"}
          </button>
          <a
            href={hasFile ? `/v1/files/${currentFileId}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold uppercase tracking-wider text-meta hover:text-dark transition-colors"
          >
            Ouvrir ↗
          </a>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            inputRef.current?.click();
          }}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-slate-300 rounded hover:border-teal/60 hover:bg-teal/5 transition-colors disabled:opacity-40"
        >
          <Upload size={14} className="text-meta" />
          <span className="text-xs text-meta">
            {uploading ? "Upload en cours..." : `Télécharger un ${label}`}
          </span>
        </button>
      )}

      {error.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-rose">
          <X size={11} />
          {error}
        </div>
      )}
    </div>
  );
}
