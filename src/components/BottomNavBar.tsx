import { useNavigate, useLocation } from "react-router-dom";
import { Home, BookOpen, Brain, BarChart3, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/dashboard", icon: Home, label: "Home" },
  { path: "/study", icon: BookOpen, label: "Study" },
  { path: "/mcq-practice", icon: Brain, label: "MCQ" },
  { path: "/progress", icon: BarChart3, label: "Progress" },
  { path: "/profile", icon: User, label: "Profile" },
];

const BottomNavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 glass-nav border-t border-white/5 sm:hidden"
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
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all duration-300 touch-manipulation relative group",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground"
              )}
            >
              <div className={cn(
                "relative transition-transform duration-300",
                isActive && "scale-110"
              )}>
                <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5]")} />
                {isActive && (
                  <div className="absolute -inset-2 rounded-full bg-primary/10 blur-md -z-10" />
                )}
              </div>
              <span className={cn("text-[10px] font-medium", isActive && "font-bold text-primary")}>
                {label}
              </span>
              {isActive && (
                <div className="absolute top-0 w-12 h-[2px] rounded-b-full" style={{ background: 'var(--gradient-primary)', boxShadow: '0 2px 12px hsl(228 80% 62% / 0.4)' }} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavBar;
