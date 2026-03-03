import { Button } from "@/components/ui/button";
import { useReportLanguage } from "./ReportLanguageContext";
import { Languages } from "lucide-react";

export const ReportLanguageToggle = () => {
  const { language, setLanguage } = useReportLanguage();

  return (
    <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
      <Button
        variant={language === "en" ? "default" : "ghost"}
        size="sm"
        onClick={() => setLanguage("en")}
        className="rounded-lg text-xs px-3 h-7"
      >
        EN
      </Button>
      <Button
        variant={language === "hi" ? "default" : "ghost"}
        size="sm"
        onClick={() => setLanguage("hi")}
        className="rounded-lg text-xs px-3 h-7"
      >
        <Languages className="w-3 h-3 mr-1" />
        हिंदी
      </Button>
    </div>
  );
};
