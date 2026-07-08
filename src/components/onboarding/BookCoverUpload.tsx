import { useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, X, Loader2, BookOpen, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const SUBJECTS = ["Math", "Science", "English", "Social Science", "Hindi", "Computer Science"];

type CoverInput = { subject: string; dataUrl: string };

export const BOOK_UPLOAD_KEY = "gyanam.books.onboarded";
export const hasSeenBookUpload = () => {
  try { return localStorage.getItem(BOOK_UPLOAD_KEY) === "1"; } catch { return false; }
};
export const markBookUploadSeen = () => {
  try { localStorage.setItem(BOOK_UPLOAD_KEY, "1"); } catch {}
};

const fileToDataUrl = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(f);
  });

const BookCoverUpload = ({
  open,
  studentId,
  onDone,
}: {
  open: boolean;
  studentId: string | null;
  onDone: () => void;
}) => {
  const { toast } = useToast();
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (subject: string) => {
    setActiveSubject(subject);
    inputRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !activeSubject) return;
    if (f.size > 6 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Please pick a photo under 6 MB.", variant: "destructive" });
      return;
    }
    const dataUrl = await fileToDataUrl(f);
    setCovers((c) => ({ ...c, [activeSubject]: dataUrl }));
    e.target.value = "";
  };

  const submit = async () => {
    if (!studentId) { markBookUploadSeen(); onDone(); return; }
    const images: CoverInput[] = Object.entries(covers).map(([subject, dataUrl]) => ({ subject, dataUrl }));
    if (images.length === 0) { markBookUploadSeen(); onDone(); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("detect-books", { body: { student_id: studentId, images } });
      if (error) throw error;
      toast({ title: "Books saved", description: "Your AI Tutor now knows your syllabus." });
      markBookUploadSeen();
      onDone();
    } catch (e: any) {
      toast({ title: "Couldn't save books", description: e?.message ?? "Please try again later.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const skip = () => { markBookUploadSeen(); onDone(); };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) skip(); }}>
      <DialogContent className="p-0 gap-0 max-w-md w-[calc(100vw-1.5rem)] rounded-3xl overflow-hidden border border-border/60 bg-background max-h-[90dvh] flex flex-col">
        <header className="px-6 pt-6 pb-3 flex items-start gap-3 border-b border-border/60">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold font-display text-foreground">Show me your books</h2>
            <p className="text-[12px] text-muted-foreground">
              Snap the front cover of each subject's textbook. Your AI Tutor will lock on to your exact syllabus.
            </p>
          </div>
        </header>

        <div className="px-5 py-4 grid grid-cols-2 gap-2.5 overflow-y-auto">
          {SUBJECTS.map((s) => {
            const cover = covers[s];
            return (
              <button
                key={s}
                onClick={() => pick(s)}
                className="relative aspect-square rounded-2xl border border-border/60 bg-muted/30 hover:border-primary/50 transition-all overflow-hidden text-left touch-manipulation flex flex-col"
                aria-label={`Add cover for ${s}`}
              >
                <div className="px-2.5 py-1.5 border-b border-border/40 bg-background/60 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-foreground truncate">{s}</span>
                  {cover && (
                    <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
                <div className="relative flex-1">
                  {cover ? (
                    <img src={cover} alt={`${s} textbook cover`} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                      <Camera className="w-5 h-5" />
                      <span className="text-[10px] font-medium">Tap to add</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <footer className="flex items-center justify-between gap-3 px-5 py-4 border-t border-border/60 bg-muted/30">
          <Button variant="ghost" size="sm" onClick={skip} disabled={submitting} className="text-muted-foreground">
            Skip for now
          </Button>
          <Button size="sm" onClick={submit} disabled={submitting} className="min-w-[110px]">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : Object.keys(covers).length > 0 ? "Save & continue" : "Continue"}
          </Button>
        </footer>

        <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      </DialogContent>
    </Dialog>
  );
};

export default BookCoverUpload;