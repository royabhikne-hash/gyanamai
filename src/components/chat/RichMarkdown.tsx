import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Children, isValidElement, ReactNode } from "react";

interface Props {
  children: string;
}

const getText = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getText).join("");
  if (isValidElement(node)) return getText((node.props as { children?: ReactNode }).children);
  return "";
};

const isRecap = (text: string) => /quick\s*recap/i.test(text);
const isCheck = (text: string) => /check\s*your\s*understanding/i.test(text);
const stripEmoji = (text: string) =>
  text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();

/**
 * Shared rich markdown renderer for AI chat messages across the app.
 * Supports GFM + brutalist-notebook cards for Quick Recap & Check Your Understanding.
 */
/**
 * Pre-process the markdown so a `### 📌 Quick Recap` / `### 🎯 Check Your Understanding`
 * heading and the block that follows it gets wrapped in a sentinel div we can style as a card.
 */
const wrapSpecialSections = (md: string) => {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const h = line.match(/^#{2,4}\s+(.+)$/);
    const heading = h?.[1] ?? "";
    const kind = isRecap(heading) ? "recap" : isCheck(heading) ? "check" : null;
    if (kind) {
      // collect lines until next heading or blank-then-heading or EOF
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^#{2,4}\s+/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      const label = stripEmoji(heading);
      out.push(`<div data-card="${kind}" data-label="${label}">\n\n${body.join("\n")}\n\n</div>`);
      continue;
    }
    out.push(line);
    i++;
  }
  return out.join("\n");
};

const RichMarkdown = ({ children }: Props) => {
  const processed = wrapSpecialSections(children || "");
  return (
    <div
      className="text-[14px] leading-relaxed text-foreground
        [&>p]:mb-3 [&>p:last-child]:mb-0
        [&>ul]:mb-3 [&>ul]:pl-5 [&>ul>li]:mb-1.5 [&>ul]:list-disc
        [&>ol]:mb-3 [&>ol]:pl-5 [&>ol>li]:mb-1.5 [&>ol]:list-decimal
        [&_li>p]:mb-0 [&_li]:marker:text-primary
        [&>h1]:text-base [&>h1]:font-bold [&>h1]:mt-3 [&>h1]:mb-2 [&>h1]:uppercase [&>h1]:tracking-tight [&>h1]:font-display
        [&>h2]:text-[15px] [&>h2]:font-bold [&>h2]:mt-3 [&>h2]:mb-1.5 [&>h2]:uppercase [&>h2]:tracking-tight [&>h2]:font-display
        [&>h3]:text-[13px] [&>h3]:font-bold [&>h3]:mt-3 [&>h3]:mb-1.5 [&>h3]:uppercase [&>h3]:tracking-wider [&>h3]:text-primary [&>h3]:font-display
        [&>blockquote]:border-l-4 [&>blockquote]:border-primary [&>blockquote]:pl-3 [&>blockquote]:bg-muted/40 [&>blockquote]:py-2 [&>blockquote]:my-3 [&>blockquote]:font-medium
        [&_strong]:text-foreground [&_strong]:font-semibold
        [&_pre]:rounded-none [&_pre]:border-2 [&_pre]:border-foreground [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:my-3 [&_pre]:overflow-x-auto
        [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-sm [&_code]:text-[12px] [&_code]:font-mono
        [&_pre_code]:bg-transparent [&_pre_code]:p-0
        [&_table]:w-full [&_table]:my-3 [&_table]:text-[13px] [&_table]:border-collapse
        [&_th]:border-2 [&_th]:border-foreground [&_th]:px-2 [&_th]:py-1 [&_th]:bg-muted [&_th]:font-bold [&_th]:text-left [&_th]:uppercase [&_th]:text-[11px] [&_th]:tracking-wider
        [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1
        [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:font-medium
        [&_hr]:my-4 [&_hr]:border-foreground/30"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          div: ({ node, children: kids, ...props }: any) => {
            const card = props["data-card"] as string | undefined;
            const label = (props["data-label"] as string | undefined) || "";
            if (card === "recap") {
              return (
                <div className="mt-4 mb-2 border-l-4 border-primary bg-muted/60 p-4 rounded-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-foreground text-background text-[10px] font-bold font-display">01</span>
                    <h4 className="text-[12px] font-bold uppercase tracking-widest font-display text-foreground m-0">
                      {label || "Quick Recap"}
                    </h4>
                  </div>
                  <div className="text-[13.5px] leading-relaxed
                    [&>ul]:list-none [&>ul]:pl-0 [&>ul>li]:relative [&>ul>li]:pl-4 [&>ul>li]:mb-1.5
                    [&>ul>li]:before:content-['→'] [&>ul>li]:before:absolute [&>ul>li]:before:left-0 [&>ul>li]:before:text-primary [&>ul>li]:before:font-bold
                    [&>p]:mb-2 [&>p:last-child]:mb-0">
                    {kids}
                  </div>
                </div>
              );
            }
            if (card === "check") {
              return (
                <div className="mt-3 mb-2 border-2 border-foreground bg-background p-4 shadow-[3px_3px_0px_0px_hsl(var(--foreground))] rounded-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold font-display">?</span>
                    <h4 className="text-[12px] font-bold uppercase tracking-widest font-display text-primary m-0">
                      {label || "Check Your Understanding"}
                    </h4>
                  </div>
                  <div className="text-[13.5px] leading-relaxed font-medium
                    [&>ol]:list-none [&>ol]:pl-0 [&>ol]:counter-reset-[q]
                    [&>ol>li]:relative [&>ol>li]:pl-7 [&>ol>li]:mb-2.5 [&>ol>li]:[counter-increment:q]
                    [&>ol>li]:before:content-[counter(q,decimal-leading-zero)'.'] [&>ol>li]:before:absolute [&>ol>li]:before:left-0 [&>ol>li]:before:top-0 [&>ol>li]:before:font-bold [&>ol>li]:before:font-display [&>ol>li]:before:text-foreground
                    [&>p]:mb-2 [&>p:last-child]:mb-0">
                    {kids}
                  </div>
                </div>
              );
            }
            return <div {...props}>{kids}</div>;
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
};

export default RichMarkdown;