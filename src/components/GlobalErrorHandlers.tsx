import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

/**
 * Catches unexpected runtime errors (especially unhandled promise rejections)
 * so WebView/PWA users don't end up with a blank white screen.
 */
export const GlobalErrorHandlers = () => {
  const { toast } = useToast();
  const lastToastAtRef = useRef(0);

  useEffect(() => {
    const maybeToast = (reason: unknown) => {
      const now = Date.now();
      if (now - lastToastAtRef.current < 3000) return;
      lastToastAtRef.current = now;

      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unexpected error";

      toast({
        title: "Something went wrong",
        description: message,
        variant: "destructive",
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled rejection:", event.reason);
      maybeToast(event.reason);
      // In some WebViews, preventing default avoids a hard crash/blank screen.
      event.preventDefault();
    };

    const onError = (event: ErrorEvent) => {
      const msg = event.error?.message || event.message || "";
      // Suppress React DOM reconciliation errors caused by external scripts (Tailwind CDN, etc.)
      if (msg.includes("removeChild") || msg.includes("insertBefore") || msg.includes("not a child")) {
        event.preventDefault();
        console.warn("Suppressed DOM reconciliation error:", msg);
        return;
      }
      console.error("Global error:", event.error || event.message);
      maybeToast(event.error || event.message);
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onError);

    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onError);
    };
  }, [toast]);

  return null;
};

export default GlobalErrorHandlers;
