import { useNavigate, useLocation } from "react-router-dom";
import { Home, BookOpen, Brain, BarChart3, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/dashboard", icon: Home, label: "Home" },
  { path: "/study", icon: BookOpen, label: "Study" },
  { path: "/study-blaster", icon: Sparkles, label: "Blaster" },
  { path: "/mcq-practice", icon: Brain, label: "MCQ" },
  { path: "/progress", icon: BarChart3, label: "Progress" },
];

const BottomNavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 glass-nav border-t border-border/30 sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around h-[58px]">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all duration-200 touch-manipulation relative",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground active:scale-95"
              )}
            >
              <Icon className={cn(
                "w-5 h-5 transition-transform duration-200",
                isActive && "stroke-[2.5] scale-110"
              )} />
              <span className={cn(
                "text-[10px] font-medium transition-all duration-200",
                isActive && "font-bold text-primary"
              )}>
                {label}
              </span>
              {isActive && (
                <div
                  className="absolute top-0 w-10 h-[3px] rounded-b-full"
                  style={{ background: 'var(--gradient-primary)' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavBar;
