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
      className="fixed bottom-0 left-0 right-0 z-50 glass-nav sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around h-14">
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
                  : "text-muted-foreground active:text-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5 transition-transform duration-200", isActive && "stroke-[2.5] scale-110")} />
              <span className={cn("text-[10px] font-medium", isActive && "font-bold text-primary")}>
                {label}
              </span>
              {isActive && (
                <div className="absolute top-0 w-10 h-0.5 rounded-b-full bg-primary glow-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavBar;
