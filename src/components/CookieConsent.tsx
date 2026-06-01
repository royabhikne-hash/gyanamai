import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Cookie, X } from "lucide-react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "gyanam_cookie_consent_v1";

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) setVisible(true);
    } catch {
      // localStorage blocked — show banner anyway
      setVisible(true);
    }
  }, []);

  const persist = (value: "accepted" | "essential") => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ choice: value, at: new Date().toISOString() })
      );
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[100] p-3 sm:p-4 pointer-events-none">
      <div className="pointer-events-auto max-w-2xl mx-auto glass-card p-4 sm:p-5 shadow-2xl border border-border/60 rounded-2xl">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Cookie className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm sm:text-base">We use cookies</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Gyanam AI uses cookies and local storage to keep you signed in,
              remember your preferences, and improve your learning experience.
              Read our{" "}
              <Link to="/terms" className="underline text-foreground">
                Terms & Privacy
              </Link>
              .
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button size="sm" onClick={() => persist("accepted")}>
                Accept all
              </Button>
              <Button size="sm" variant="outline" onClick={() => persist("essential")}>
                Essential only
              </Button>
            </div>
          </div>
          <button
            onClick={() => persist("essential")}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;