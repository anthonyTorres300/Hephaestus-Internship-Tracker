import ReactMarkdown from "react-markdown";

const ALLOWED = ["p", "strong", "em", "ul", "ol", "li", "a", "code", "pre", "blockquote", "br"];

// Restricted Markdown: raw HTML is never rendered (react-markdown ignores it by default); unsafe URL schemes are stripped.
export function SafeMarkdown({ children }: { children: string }) {
  return (
    <div className="grid gap-2 text-sm [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_ol]:ml-5 [&_ol]:list-decimal [&_ul]:ml-5 [&_ul]:list-disc">
      <ReactMarkdown
        allowedElements={ALLOWED}
        unwrapDisallowed
        urlTransform={(url) => (/^(https?:|mailto:)/i.test(url) ? url : "")}
        components={{
          a: ({ href, children: c }) =>
            href ? (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                {c}
              </a>
            ) : (
              <span>{c}</span>
            ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
