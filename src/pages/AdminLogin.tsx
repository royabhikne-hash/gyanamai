import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";

const AdminLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitWait, setRateLimitWait] = useState<number | null>(null);
  const [requiresPasswordReset, setRequiresPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sessionToken, setSessionToken] = useState("");

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({
        title: t('msg.passwordsMismatch'),
        description: t('msg.passwordsMismatch'),
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 8) {
      toast({
        title: t('msg.passwordTooShort'),
        description: t('msg.passwordTooShort'),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("secure-auth", {
        body: {
          action: "reset_password",
          sessionToken,
          newPassword,
        },
      });

      if (error || data.error) {
        throw new Error(data?.error || "Password reset failed");
      }

      // Update session token
      localStorage.setItem("adminSessionToken", data.sessionToken);

      toast({
        title: t('msg.success'),
        description: "Password updated successfully!",
      });
      navigate("/admin-dashboard");
    } catch (error) {
      console.error("Password reset error:", error);
      toast({
        title: t('msg.error'),
        description: error instanceof Error ? error.message : "An error occurred. Please try again.",
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
        const { data, error } = await supabase.functions.invoke("secure-auth", {
          body: {
            action: "login",
            userType: "admin",
            identifier: adminId.trim(),
            password: password,
          },
        });

        if (error) {
          if (attempt < 3) {
            console.warn(`Admin login attempt ${attempt} failed, retrying...`, error);
            await new Promise(r => setTimeout(r, 2000));
            return tryLogin(attempt + 1);
          }
          toast({
            title: t('msg.error'),
            description: "Could not connect to server. Please check your internet and try again.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        if (data?.rateLimited) {
          setRateLimitWait(data.waitSeconds);
          toast({
            title: "Too Many Attempts",
            description: `Please wait ${Math.ceil(data.waitSeconds / 60)} minutes before trying again.`,
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        if (data?.error) {
          toast({
            title: "Invalid Credentials",
            description: data.error,
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        if (data?.success) {
          localStorage.setItem("userType", "admin");
          localStorage.setItem("adminId", data.user.id);
          localStorage.setItem("adminName", data.user.name);
          localStorage.setItem("adminRole", data.user.role);
          localStorage.setItem("adminSessionToken", data.sessionToken);

          if (data.requiresPasswordReset) {
            setSessionToken(data.sessionToken);
            setRequiresPasswordReset(true);
            toast({
              title: t('auth.passwordResetRequired'),
              description: t('auth.mustResetPassword'),
            });
            setIsLoading(false);
            return;
          }
          
          toast({
            title: t('dashboard.welcome') + " Admin!",
            description: "Admin dashboard access granted.",
          });
          navigate("/admin-dashboard");
        } else {
          toast({
            title: t('msg.error'),
            description: "Login failed. Please check credentials.",
            variant: "destructive",
          });
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Login error:", error);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 2000));
          return tryLogin(attempt + 1);
        }
        toast({
          title: t('msg.error'),
          description: "Could not connect to server. Please check your internet.",
          variant: "destructive",
        });
        setIsLoading(false);
      }
    };

    await tryLogin();
  };

  return (
    <div className="min-h-screen hero-gradient flex flex-col">
      {/* Header */}
      <header className="container mx-auto py-4 px-3 sm:px-4 flex justify-between items-center">
        <Link to="/" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden xs:inline">{t('nav.home')}</span>
        </Link>
        <LanguageToggle />
      </header>

      {/* Login Form */}
      <main className="flex-1 container mx-auto px-3 sm:px-4 flex items-center justify-center py-4 sm:py-8">
        <div className="w-full max-w-md">
          <div className="edu-card p-4 sm:p-6 md:p-8">
            <div className="text-center mb-6 sm:mb-8">
              <img 
                src="/logo.png" 
                alt="Gyanam AI" 
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl mx-auto mb-3 sm:mb-4 object-contain"
              />
              <h1 className="text-xl sm:text-2xl font-bold">{t('auth.adminLogin')}</h1>
              <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">Super Admin Access Only</p>
            </div>

            <div className="bg-destructive/10 border border-destructive/20 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
              <div className="flex items-start gap-2 sm:gap-3">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-destructive mt-0.5 flex-shrink-0" />
                <div className="text-xs sm:text-sm">
                  <p className="font-semibold text-foreground">Restricted Access</p>
                  <p className="text-muted-foreground">This login is for authorized administrators only.</p>
                </div>
              </div>
            </div>

            {rateLimitWait && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  Too many login attempts. Please wait before trying again.
                </p>
              </div>
            )}

            {requiresPasswordReset ? (
              <form onSubmit={handlePasswordReset} className="space-y-5">
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-4">
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    {t('auth.mustResetPassword')}
                  </p>
                </div>
                <div>
                  <Label htmlFor="newPassword">{t('auth.newPassword')}</Label>
                  <div className="relative">
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
                </div>
                <div>
                  <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" variant="destructive" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading ? t('auth.updating') : t('auth.updatePassword')}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <Label htmlFor="adminId">{t('auth.adminId')}</Label>
                  <Input
                    id="adminId"
                    placeholder="Enter your Admin ID"
                    value={adminId}
                    onChange={(e) => setAdminId(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="password">{t('auth.password')}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" variant="destructive" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading ? t('auth.loggingIn') : t('auth.enterAdmin')}
                </Button>
              </form>
            )}

            <div className="mt-6 pt-4 border-t border-border text-center">
              <Link to="/school-login" className="text-sm text-muted-foreground hover:text-primary">
                {t('auth.schoolLogin')} →
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminLogin;