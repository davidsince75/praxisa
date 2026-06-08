import { StickyNote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card.js";

export function LearnNotesPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-dark">
          Notes &amp; Commentaires
        </h1>
        <p className="text-meta text-sm mt-0.5">
          Vos notes personnelles et annotations de cours
        </p>
      </div>

      <Card>
        <CardContent className="py-16 flex flex-col items-center gap-3">
          <div className="p-4 rounded-full bg-teal/10">
            <StickyNote size={28} className="text-teal/60" />
          </div>
          <p className="text-sm font-medium text-dark">
            Aucune note pour le moment
          </p>
          <p className="text-xs text-meta max-w-xs text-center">
            Vos notes et commentaires de cours apparaîtront ici. Cette
            fonctionnalité sera disponible prochainement.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
