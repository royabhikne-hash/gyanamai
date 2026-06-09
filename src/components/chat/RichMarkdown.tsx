import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  children: string;
}

const isRecap = (text: string) => /quick\s*recap/i.test(text);
const isCheck = (text: string) => /check\s*your\s*understanding/i.test(text);
const stripEmoji = (text: string) =>
  text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();

type Segment = { kind: "plain" | "recap" | "check"; label?: string; body: string };

/**
 * Split markdown into top-level segments. A `### Quick Recap` /
 * `### Check Your Understanding` heading starts a card segment that
 * extends until the next heading or EOF.
 */
const splitSegments = (md: string): Segment[] => {
  const lines = (md || "").split("\n");
  const segments: Segment[] = [];
  let buf: string[] = [];
  let current: { kind: "recap" | "check"; label: string } | null = null;

  const flushPlain = () => {
    if (buf.length) {
      segments.push({ kind: "plain", body: buf.join("\n") });
      buf = [];
    }
  };
  const flushCard = () => {
    if (current) {
      segments.push({ kind: current.kind, label: current.label, body: buf.join("\n") });
      buf = [];
      current = null;
    }
  };

  for (const line of lines) {
    const h = line.match(/^#{1,4}\s+(.+)$/);
    if (h) {
      const heading = h[1];
      const kind = isRecap(heading) ? "recap" : isCheck(heading) ? "check" : null;
      if (kind) {
        if (current) flushCard();
        else flushPlain();
        current = { kind, label: stripEmoji(heading) };
        continue;
      }
      if (current) flushCard();
    }
    buf.push(line);
  }
  if (current) flushCard();
  else flushPlain();
  return segments;
};

const proseClasses =
  "text-[14px] leading-relaxed text-foreground " +
  "[&>p]:mb-3 [&>p:last-child]:mb-0 " +
  "[&>ul]:mb-3 [&>ul]:pl-5 [&>ul>li]:mb-1.5 [&>ul]:list-disc " +
  "[&>ol]:mb-3 [&>ol]:pl-5 [&>ol>li]:mb-1.5 [&>ol]:list-decimal " +
  "[&_li>p]:mb-0 [&_li]:marker:text-primary " +
  "[&>h1]:text-base [&>h1]:font-bold [&>h1]:mt-3 [&>h1]:mb-2 [&>h1]:uppercase [&>h1]:tracking-tight " +
  "[&>h2]:text-[15px] [&>h2]:font-bold [&>h2]:mt-3 [&>h2]:mb-1.5 [&>h2]:uppercase [&>h2]:tracking-tight " +
  "[&>h3]:text-[13px] [&>h3]:font-bold [&>h3]:mt-3 [&>h3]:mb-1.5 [&>h3]:uppercase [&>h3]:tracking-wider [&>h3]:text-primary " +
  "[&>blockquote]:border-l-4 [&>blockquote]:border-primary [&>blockquote]:pl-3 [&>blockquote]:bg-muted/40 [&>blockquote]:py-2 [&>blockquote]:my-3 [&>blockquote]:font-medium " +
  "[&_strong]:text-foreground [&_strong]:font-semibold " +
  "[&_pre]:rounded-none [&_pre]:border-2 [&_pre]:border-foreground [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:my-3 [&_pre]:overflow-x-auto " +
  "[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-sm [&_code]:text-[12px] [&_code]:font-mono " +
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 " +
  "[&_table]:w-full [&_table]:my-3 [&_table]:text-[13px] [&_table]:border-collapse " +
  "[&_th]:border-2 [&_th]:border-foreground [&_th]:px-2 [&_th]:py-1 [&_th]:bg-muted [&_th]:font-bold [&_th]:text-left [&_th]:uppercase [&_th]:text-[11px] [&_th]:tracking-wider " +
  "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 " +
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:font-medium " +
  "[&_hr]:my-4 [&_hr]:border-foreground/30";

const RichMarkdown = ({ children }: Props) => {
  const segments = splitSegments(children || "");
  return (
    <div className="space-y-1">
      {segments.map((seg, idx) => {
        if (seg.kind === "plain") {
          if (!seg.body.trim()) return null;
          return (
            <div key={idx} className={proseClasses}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{seg.body}</ReactMarkdown>
            </div>
          );
        }
        if (seg.kind === "recap") {
          return (
            <div
              key={idx}
              className="mt-3 mb-1 border-l-4 border-primary bg-muted/60 p-4 rounded-sm animate-fade-in"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center justify-center w-5 h-5 bg-foreground text-background text-[10px] font-bold">
                  01
                </span>
                <h4 className="text-[12px] font-bold uppercase tracking-widest text-foreground m-0">
                  {seg.label || "Quick Recap"}
                </h4>
              </div>
              <div
                className="text-[13.5px] leading-relaxed text-foreground/90
                  [&_ul]:list-none [&_ul]:pl-0
                  [&_ul>li]:relative [&_ul>li]:pl-5 [&_ul>li]:mb-1.5
                  [&_ul>li]:before:content-['\\2192'] [&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:text-primary [&_ul>li]:before:font-bold
                  [&_ol]:pl-5 [&_ol>li]:mb-1.5
                  [&_p]:mb-2 [&_p:last-child]:mb-0
                  [&_strong]:font-semibold"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{seg.body}</ReactMarkdown>
              </div>
            </div>
          );
        }
        return (
          <div
            key={idx}
            className="mt-3 mb-1 border-2 border-foreground bg-background p-4 rounded-sm shadow-[3px_3px_0px_0px_hsl(var(--foreground))] animate-fade-in"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-5 h-5 bg-primary text-primary-foreground text-[11px] font-bold">
                ?
              </span>
              <h4 className="text-[12px] font-bold uppercase tracking-widest text-primary m-0">
                {seg.label || "Check Your Understanding"}
              </h4>
            </div>
            <div
              className="text-[13.5px] leading-relaxed font-medium text-foreground
                [&_ol]:list-decimal [&_ol]:pl-6 [&_ol>li]:mb-2.5 [&_ol>li]:marker:font-bold [&_ol>li]:marker:text-foreground
                [&_ul]:list-disc [&_ul]:pl-6 [&_ul>li]:mb-2 [&_ul>li]:marker:text-primary
                [&_p]:mb-2 [&_p:last-child]:mb-0"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{seg.body}</ReactMarkdown>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RichMarkdown;
