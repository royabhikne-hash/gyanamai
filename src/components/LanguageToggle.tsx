import { forwardRef } from "react";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const LanguageToggle = forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof Button>>(
  (props, ref) => {
    const { language, toggleLanguage, t } = useLanguage();

    return (
      <Button
        ref={ref}
        variant="outline"
        size="sm"
        onClick={toggleLanguage}
        className="gap-1.5 font-semibold text-xs sm:text-sm px-2 sm:px-3"
        title={t('language.toggle')}
        {...props}
      >
        <Languages className="h-4 w-4" />
        <span className="hidden sm:inline">{language === 'en' ? 'हिंदी' : 'EN'}</span>
      </Button>
    );
  }
);

LanguageToggle.displayName = "LanguageToggle";

export default LanguageToggle;
