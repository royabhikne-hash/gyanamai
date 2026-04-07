import { useNavigate, useLocation } from "react-router-dom";
import { Home, BookOpen, Brain, BarChart3, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback, memo } from "react";

const navItems = [
  { path: "/dashboard", icon: Home, label: "Home" },
  { path: "/study", icon: BookOpen, label: "Study" },
  { path: "/study-blaster", icon: Sparkles, label: "Blaster" },
  { path: "/mcq-practice", icon: Brain, label: "MCQ" },
  { path: "/progress", icon: BarChart3, label: "Progress" },
];

const BottomNavBar = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavClick = useCallback((path: string) => {
    // Haptic feedback for Android
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    navigate(path);
  }, [navigate]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 glass-nav border-t border-border/30 sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around h-[62px]">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => handleNavClick(path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all duration-200 touch-manipulation touch-target relative",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground active:scale-90"
              )}
            >
              <div className={cn(
                "relative p-1.5 rounded-xl transition-all duration-300",
                isActive && "bg-primary/10"
              )}>
                <Icon className={cn(
                  "w-5 h-5 transition-all duration-300",
                  isActive && "stroke-[2.5] scale-110 drop-shadow-sm"
                )} />
                {isActive && (
                  <div className="absolute inset-0 rounded-xl bg-primary/5 animate-scale-pop" />
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium transition-all duration-200",
                isActive && "font-bold text-primary"
              )}>
                {label}
              </span>
              {isActive && (
                <div
                  className="absolute top-0 w-10 h-[3px] rounded-b-full animate-scale-pop"
                  style={{ background: 'var(--gradient-primary)' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
});

BottomNavBar.displayName = "BottomNavBar";

export default BottomNavBar;
