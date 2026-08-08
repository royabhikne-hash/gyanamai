import { classifyMatrix, Confidence } from "@/lib/mastery";

export interface MatrixItem {
  key: string;
  name: string;
  understanding: number;
  effort: number;
  confidence: Confidence;
  meta?: string;
}

const toneClass: Record<string, string> = {
  success: "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted/40 text-muted-foreground",
};

interface Props {
  items: MatrixItem[];
  title?: string;
  description?: string;
}

const EffortUnderstandingMatrix = ({
  items,
  title = "Effort × Understanding",
  description = "Effort is work done. Understanding is what actually stuck. Never mixed into one number.",
}: Props) => {
  if (items.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1 mb-4">{description}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item) => {
          const result = classifyMatrix(item.understanding, item.effort, item.confidence);
          return (
            <div key={item.key} className={`rounded-lg border p-3 ${toneClass[result.tone]}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold truncate text-foreground">{item.name}</p>
                <span className="text-[11px] font-medium shrink-0">{result.label}</span>
              </div>
              <p className="text-xs mt-1">{result.detail}</p>
              <p className="text-[11px] text-muted-foreground mt-2">
                {result.cell === "unknown" ? "Understanding: limited data" : `Understanding ${item.understanding}%`} · Effort {item.effort}%
                {item.meta ? ` · ${item.meta}` : ""}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default EffortUnderstandingMatrix;
