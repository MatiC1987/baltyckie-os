import MarkdownViewer from "@/components/MarkdownViewer";
import recepcjaContent from "@docs/instrukcja-rcp-recepcja.md?raw";

export default function RecepcjaInstrukcja() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold" data-testid="text-instrukcja-title">Instrukcja</h1>
        <p className="text-sm text-muted-foreground">Przewodnik po panelu recepcji i module RCP</p>
      </div>
      <MarkdownViewer content={recepcjaContent} />
    </div>
  );
}
