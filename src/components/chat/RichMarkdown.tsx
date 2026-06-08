import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  children: string;
}

/**
 * Shared rich markdown renderer for AI chat messages across the app.
 * Supports GFM (tables, task lists), headings, blockquotes, code, lists.
 */
const RichMarkdown = ({ children }: Props) => (
  <div
    className="prose prose-sm dark:prose-invert max-w-none
      [&>p]:mb-2.5 [&>p:last-child]:mb-0 [&>p]:leading-relaxed
      [&>ul]:mb-2.5 [&>ul]:pl-5 [&>ul>li]:mb-1 [&>ul]:list-disc
      [&>ol]:mb-2.5 [&>ol]:pl-5 [&>ol>li]:mb-1 [&>ol]:list-decimal
      [&_li>p]:mb-0 [&_li]:marker:text-primary/70
      [&>h1]:text-base [&>h1]:font-bold [&>h1]:mt-3 [&>h1]:mb-2
      [&>h2]:text-[15px] [&>h2]:font-bold [&>h2]:mt-3 [&>h2]:mb-1.5
      [&>h3]:text-[14px] [&>h3]:font-semibold [&>h3]:mt-2.5 [&>h3]:mb-1.5 [&>h3]:text-primary
      [&>blockquote]:border-l-2 [&>blockquote]:border-primary/50 [&>blockquote]:pl-3 [&>blockquote]:italic [&>blockquote]:text-foreground/85 [&>blockquote]:my-2
      [&_strong]:text-foreground [&_strong]:font-semibold
      [&_pre]:rounded-xl [&_pre]:bg-secondary [&_pre]:p-3 [&_pre]:my-2 [&_pre]:overflow-x-auto
      [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-[12px] [&_code]:font-mono
      [&_pre_code]:bg-transparent [&_pre_code]:p-0
      [&_table]:w-full [&_table]:my-2 [&_table]:text-[13px] [&_table]:border-collapse
      [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-secondary [&_th]:font-semibold [&_th]:text-left
      [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1
      [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2
      [&_hr]:my-3 [&_hr]:border-border"
  >
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
  </div>
);

export default RichMarkdown;