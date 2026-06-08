import { BookOpen, NotebookPen, Archive, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card.js";

interface LibrarySection {
  icon: typeof BookOpen;
  title: string;
  description: string;
}

const SECTIONS: LibrarySection[] = [
  {
    icon: BookOpen,
    title: "Lectures complémentaires",
    description:
      "Ressources et lectures supplémentaires recommandées par vos formateurs.",
  },
  {
    icon: NotebookPen,
    title: "Notes personnelles",
    description:
      "Vos documents personnels et notes téléversés dans la plateforme.",
  },
  {
    icon: Archive,
    title: "Archive",
    description:
      "Documents archivés et ressources de vos formations terminées.",
  },
];

export function LearnLibraryPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-dark">Bibliothèque</h1>
        <p className="text-meta text-sm mt-0.5">
          Ressources, notes personnelles et documents archivés
        </p>
      </div>

      <div className="space-y-4">
        {SECTIONS.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-teal/10 shrink-0">
                  <Icon size={18} className="text-teal" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold text-dark">{title}</h2>
                  <p className="text-xs text-meta mt-0.5">{description}</p>
                  <div className="mt-4 py-8 flex flex-col items-center gap-2 border border-dashed border-rule rounded-lg">
                    <Download size={20} className="text-meta/30" />
                    <p className="text-xs text-meta/60">
                      Aucun document disponible pour le moment
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
