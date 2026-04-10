import ReactMarkdown from "react-markdown";

export default function MarkdownViewer({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none
      prose-headings:scroll-mt-4
      prose-h1:text-xl prose-h1:font-bold prose-h1:border-b prose-h1:pb-2 prose-h1:mb-4
      prose-h2:text-lg prose-h2:font-bold prose-h2:mt-6 prose-h2:mb-3
      prose-h3:text-base prose-h3:font-semibold prose-h3:mt-4 prose-h3:mb-2
      prose-p:text-sm prose-p:leading-relaxed prose-p:my-2
      prose-li:text-sm prose-li:my-0.5
      prose-strong:text-foreground
      prose-hr:my-4 prose-hr:border-border
      prose-table:text-sm prose-th:text-left prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2
      prose-table:border prose-th:border prose-td:border prose-th:bg-muted/50
      prose-a:text-primary prose-a:no-underline hover:prose-a:underline
    ">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
