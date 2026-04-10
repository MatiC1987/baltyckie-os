import MarkdownViewer from "./MarkdownViewer";
import etatContent from "@docs/instrukcja-rcp-pracownik-etat.md?raw";
import godzinyContent from "@docs/instrukcja-rcp-pracownik-godzinowy.md?raw";

export default function InstrukcjaWorker({ cooperationType }: { cooperationType: string }) {
  const content = cooperationType === "PRACA_NA_H" ? godzinyContent : etatContent;
  return <MarkdownViewer content={content} />;
}
