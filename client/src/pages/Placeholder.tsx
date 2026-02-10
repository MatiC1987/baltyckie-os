import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight" data-testid={`text-placeholder-title`}>{title}</h2>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          <Construction className="h-12 w-12 text-muted-foreground/50" />
          <div className="text-center">
            <p className="text-lg font-medium text-muted-foreground">Strona w przygotowaniu</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Ta sekcja zostanie wkrótce uzupełniona.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
