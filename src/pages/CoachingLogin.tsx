import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, ArrowLeft, Eye, EyeOff, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";

const CoachingLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [coachingId, setCoachingId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [requiresPasswordReset, setRequiresPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sessionToken, setSessionToken] = useState("");

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please re-enter.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Too short", description: "Password must be 8+ characters.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-coaching", {
        body: { action: "coaching_reset_password", sessionToken, newPassword },
      });

      if (error || data?.error) throw new Error(data?.error || "Password reset failed");

      localStorage.setItem("coachingSessionToken", data.sessionToken);
      toast({ title: "Success!", description: "Password updated successfully." });
      navigate("/school-dashboard");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const tryLogin = async (attempt = 1): Promise<void> => {
      try {
        const { data, error } = await supabase.functions.invoke("manage-coaching", {
          body: { action: "coaching_login", identifier: coachingId.trim(), password },
        });

        if (error) {
          if (attempt === 1) {
            console.warn("Coaching login attempt 1 failed, retrying...", error);
            await new Promise(r => setTimeout(r, 1500));
            return tryLogin(2);
          }
          toast({ title: "Error", description: "Could not connect to server. Please check your internet.", variant: "destructive" });
          setIsLoading(false);
          return;
        }

        if (data?.error) {
          toast({ title: "Error", description: data.error, variant: "destructive" });
          setIsLoading(false);
          return;
        }

        if (data?.success) {
          localStorage.setItem("userType", "coaching");
          localStorage.setItem("schoolId", data.user.coachingId);
          localStorage.setItem("schoolUUID", data.user.id);
          localStorage.setItem("schoolName", data.user.name);
          localStorage.setItem("schoolSessionToken", data.sessionToken);
          localStorage.setItem("coachingSessionToken", data.sessionToken);

          if (data.requiresPasswordReset) {
            setSessionToken(data.sessionToken);
            setRequiresPasswordReset(true);
            toast({ title: "Password Reset Required", description: "Please set a new password." });
            setIsLoading(false);
            return;
          }

          toast({ title: "Welcome!", description: "Coaching dashboard access granted." });
          navigate("/school-dashboard");
        }
      } catch (error) {
        if (attempt === 1) {
          await new Promise(r => setTimeout(r, 1500));
          return tryLogin(2);
        }
        toast({ title: "Error", description: "Could not connect to server. Please check your internet.", variant: "destructive" });
        setIsLoading(false);
      }
    };

    await tryLogin();
  };

  return (
    <div className="min-h-screen hero-gradient flex flex-col">
      <header className="container mx-auto py-4 px-3 sm:px-4 flex justify-between items-center">
        <Link to="/" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden xs:inline">{t('nav.home')}</span>
        </Link>
        <LanguageToggle />
      </header>

      <main className="flex-1 container mx-auto px-3 sm:px-4 flex items-center justify-center py-4 sm:py-8">
        <div className="w-full max-w-md">
          <div className="edu-card p-4 sm:p-6 md:p-8">
            <div className="text-center mb-6 sm:mb-8">
              <img src="/logo.png" alt="Gyanam AI" className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl mx-auto mb-3 sm:mb-4 object-contain" />
              <h1 className="text-xl sm:text-2xl font-bold">Coaching Center Login</h1>
              <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">Access your coaching dashboard</p>
            </div>

            <div className="bg-secondary/50 border border-secondary rounded-lg sm:rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-foreground">Admin Access Only</p>
                  <p className="text-muted-foreground">This login is for registered coaching centers only.</p>
                </div>
              </div>
            </div>

            {requiresPasswordReset ? (
              <form onSubmit={handlePasswordReset} className="space-y-5">
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-4">
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    You must set a new password before continuing.
                  </p>
                </div>
                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password (min 8 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" size="lg" disabled={isLoading}>
                  {isLoading ? "Updating..." : "Update Password"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <Label htmlFor="coachingId">Coaching Center ID</Label>
                  <Input
                    id="coachingId"
                    placeholder="Enter your Coaching ID (e.g. CC_...)"
                    value={coachingId}
                    onChange={(e) => setCoachingId(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" size="lg" disabled={isLoading}>
                  {isLoading ? "Logging in..." : "Login to Dashboard"}
                </Button>
              </form>
            )}

            <div className="mt-6 pt-4 border-t border-border text-center space-y-3">
              <Link to="/login" className="text-sm text-muted-foreground hover:text-primary block">
                Login as Student →
              </Link>
              <Link to="/school-login" className="text-sm text-muted-foreground hover:text-primary block">
                Login as School →
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CoachingLogin;
