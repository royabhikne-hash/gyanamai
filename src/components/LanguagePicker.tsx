import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Languages, Check } from "lucide-react";
import { useLanguage, LANGUAGE_LABELS, Language } from "@/contexts/LanguageContext";
import { useState } from "react";

interface Props {
  open: boolean;
  onDone: () => void;
  /** When true, shows the "you can change this later" hint. */
  firstRun?: boolean;
}

const ORDER: Language[] = ["en", "hi", "hinglish", "kn"];

const HINTS: Record<Language, string> = {
  en: "The whole app + tutor will reply in English.",
  hi: "पूरा ऐप और ट्यूटर हिंदी में जवाब देगा।",
  hinglish: "Tutor Hinglish mein baat karega — English + Hindi mix.",
  kn: "ಟ್ಯೂಟರ್ ಕನ್ನಡದಲ್ಲಿ ಉತ್ತರಿಸುತ್ತದೆ.",
};

const LanguagePicker = ({ open, onDone, firstRun = true }: Props) => {
  const { language, setLanguage } = useLanguage();
  const [pending, setPending] = useState<Language>(language);

  const confirm = () => {
    setLanguage(pending);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onDone(); }}>
      <DialogContent className="p-0 gap-0 max-w-md w-[calc(100vw-1.5rem)] rounded-3xl overflow-hidden border border-border/60 bg-background">
        <div className="px-6 pt-6 pb-2 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Languages className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-display text-foreground">
              {firstRun ? "Choose your language" : "Change language"}
            </h2>
            <p className="text-[12px] text-muted-foreground">
              Aap kaunsi bhasha mein padhna chahte ho?
            </p>
          </div>
        </div>

        <div className="px-5 py-4 grid grid-cols-2 gap-2.5">
          {ORDER.map((lang) => {
            const meta = LANGUAGE_LABELS[lang];
            const active = pending === lang;
            return (
              <button
                key={lang}
                onClick={() => setPending(lang)}
                className={`relative text-left p-3 rounded-2xl border transition-all touch-manipulation ${
                  active
                    ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                    : "border-border/60 hover:border-primary/40 bg-card"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl leading-none">{meta.flag}</span>
                  {active && (
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <div className="text-sm font-bold text-foreground">{meta.native}</div>
                  <div className="text-[11px] text-muted-foreground">{meta.english}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-6 pb-2">
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            {HINTS[pending]}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 mt-2 border-t border-border/60 bg-muted/30">
          {firstRun ? (
            <span className="text-[11px] text-muted-foreground">
              You can change this anytime from Profile.
            </span>
          ) : <span />}
          <Button size="sm" onClick={confirm} className="min-w-[100px]">
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LanguagePicker;