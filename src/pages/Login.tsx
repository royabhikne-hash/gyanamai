import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import AuthRepairButton from "@/components/AuthRepairButton";
import { useLanguage } from "@/contexts/LanguageContext";
import { loginSchema, validateForm } from "@/lib/validation";

type Role = "student" | "school" | "coaching" | "admin";

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const [detectedRole, setDetectedRole] = useState<Role>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAuthRepair, setShowAuthRepair] = useState(false);
  const [requiresPasswordReset, setRequiresPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Check localStorage availability - some phones block it in WebView
  useEffect(() => {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
    } catch (e) {
      console.warn("localStorage not available, login may have issues on this device");
      toast({
        title: language === 'en' ? "Browser Warning" : "ब्राउज़र चेतावनी",
        description: language === 'en' 
          ? "Your browser may have storage issues. Try using Chrome or your default browser." 
          : "आपके ब्राउज़र में storage issue है। Chrome या default browser use करें।",
        variant: "destructive",
      });
    }
  }, []);

  // Check if user is already logged in and approved - only after auth is ready
  useEffect(() => {
    if (authLoading || !user) return;
    
    const checkUserApproval = async () => {
      try {
        const { data: student, error } = await supabase
          .from("students")
          .select("id, is_approved")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (error || !student) return;
        
        if (student.is_approved) {
          navigate("/dashboard", { replace: true });
        }
      } catch {
        // ignore
      }
    };
    
    checkUserApproval();
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Non-student roles use the secure-auth edge function (admin/school/coaching)
    if (role !== "student") {
      return handleSecureAuthLogin();
    }

    const validation = validateForm(loginSchema, { email, password });
    if (!validation.success && 'errors' in validation) {
      const firstError = Object.values(validation.errors)[0];
      toast({
        title: language === 'en' ? "Validation Error" : "वैलिडेशन एरर",
        description: firstError,
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);

    // Global timeout - 30s to handle cold-start backends + slow mobile networks
    const globalTimeout = setTimeout(() => {
      if (mountedRef.current) {
        setIsLoading(false);
        setShowAuthRepair(true);
        toast({
          title: language === 'en' ? "Login Timeout" : "लॉगिन टाइमआउट",
          description: language === 'en' ? "Server took too long. Please try again." : "सर्वर ने बहुत समय लिया। कृपया फिर से कोशिश करें।",
          variant: "destructive",
        });
      }
    }, 30000);

    const trySignIn = async (attempt = 1): Promise<void> => {
      try {
        const controller = new AbortController();
        const attemptTimeout = setTimeout(() => controller.abort(), 12000);
        
        const { error } = await signIn(email, password);
        clearTimeout(attemptTimeout);
        
        if (!mountedRef.current) return;
        
        if (error) {
          const msg = error.message || "";
          
          // Transient WebView/network errors - retry automatically
          const isTransient = msg.includes('signal is aborted') || 
                             msg.includes('AbortError') ||
                             msg.includes('LockManager') ||
                             msg.includes('timed out') ||
                             msg.includes('Failed to fetch') ||
                             msg.includes('NetworkError') ||
                             msg.includes('network') ||
                             msg.includes('CORS') ||
                             msg.includes('Load failed');
          
          if (isTransient) {
            // Wait longer on each retry
            const delay = attempt === 1 ? 2000 : 3000;
            await new Promise(r => setTimeout(r, delay));
            if (!mountedRef.current) return;
            
            // Check if session was actually created despite network error
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              clearTimeout(globalTimeout);
              await checkApprovalAndNavigate(data.session.user.id);
              return;
            }
            if (attempt < 3) {
              console.warn(`Student login attempt ${attempt} failed (transient), retrying...`);
              return trySignIn(attempt + 1);
            }
            clearTimeout(globalTimeout);
            setIsLoading(false);
            setShowAuthRepair(true);
            toast({
              title: language === 'en' ? "Connection Error" : "कनेक्शन एरर",
              description: language === 'en' ? "Could not connect to server. Check your internet and try again." : "सर्वर से कनेक्ट नहीं हो पाया। इंटरनेट चेक करें।",
              variant: "destructive",
            });
            return;
          }
          
          clearTimeout(globalTimeout);
          if (msg.includes("Invalid login credentials")) {
            toast({
              title: language === 'en' ? "Login Failed" : "लॉगिन फेल",
              description: language === 'en' ? "Invalid email or password." : "गलत ईमेल या पासवर्ड।",
              variant: "destructive",
            });
          } else if (msg.includes("Email not confirmed")) {
            toast({
              title: language === 'en' ? "Email Not Verified" : "ईमेल वेरिफाई नहीं हुआ",
              description: language === 'en' ? "Please check your email and click the verification link." : "कृपया अपना ईमेल चेक करें।",
              variant: "destructive",
            });
          } else {
            if (attempt < 3) {
              console.warn(`Student login attempt ${attempt} failed, retrying...`, msg);
              await new Promise(r => setTimeout(r, 2000));
              return trySignIn(attempt + 1);
            }
            setShowAuthRepair(true);
            toast({
              title: language === 'en' ? "Login Failed" : "लॉगिन फेल",
              description: msg || "Please try again.",
              variant: "destructive",
            });
          }
          setIsLoading(false);
          return;
        }

        // Login succeeded - check approval
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!mountedRef.current) return;
        
        clearTimeout(globalTimeout);
        if (currentUser) {
          await checkApprovalAndNavigate(currentUser.id);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        if (!mountedRef.current) return;
        console.error("Login error:", error);
        if (attempt < 3) {
          console.warn(`Student login catch attempt ${attempt}, retrying...`);
          await new Promise(r => setTimeout(r, 2000));
          return trySignIn(attempt + 1);
        }
        clearTimeout(globalTimeout);
        setShowAuthRepair(true);
        toast({
          title: language === 'en' ? "Login Failed" : "लॉगिन फेल",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
        setIsLoading(false);
      }
    };

    await trySignIn();
  };

  const handleSecureAuthLogin = async () => {
    setIsLoading(true);
    const userType = role; // 'admin' | 'school' | 'coaching'

    const tryLogin = async (attempt = 1): Promise<void> => {
      try {
        const { data, error } = await supabase.functions.invoke("secure-auth", {
          body: {
            action: "login",
            userType,
            identifier: email.trim(),
            password,
          },
        });

        if (error) {
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, 2000));
            return tryLogin(attempt + 1);
          }
          toast({ title: "Connection Error", description: "Could not reach the server. Please retry.", variant: "destructive" });
          setIsLoading(false);
          return;
        }

        if (data?.rateLimited) {
          toast({ title: "Too Many Attempts", description: `Wait ${Math.ceil(data.waitSeconds / 60)} minutes.`, variant: "destructive" });
          setIsLoading(false);
          return;
        }

        if (data?.error) {
          toast({ title: "Login Failed", description: data.error, variant: "destructive" });
          setIsLoading(false);
          return;
        }

        if (data?.success) {
          if (userType === "admin") {
            localStorage.setItem("userType", "admin");
            localStorage.setItem("adminId", data.user.id);
            localStorage.setItem("adminName", data.user.name);
            localStorage.setItem("adminRole", data.user.role);
            localStorage.setItem("adminSessionToken", data.sessionToken);
          } else if (userType === "school") {
            localStorage.setItem("userType", "school");
            localStorage.setItem("schoolId", data.user.schoolId);
            localStorage.setItem("schoolUUID", data.user.id);
            localStorage.setItem("schoolName", data.user.name);
            localStorage.setItem("schoolSessionToken", data.sessionToken);
          } else if (userType === "coaching") {
            localStorage.setItem("userType", "coaching");
            localStorage.setItem("coachingId", data.user.coachingId || data.user.id);
            localStorage.setItem("coachingUUID", data.user.id);
            localStorage.setItem("coachingName", data.user.name);
            localStorage.setItem("coachingSessionToken", data.sessionToken);
          }

          if (data.requiresPasswordReset) {
            setSessionToken(data.sessionToken);
            setRequiresPasswordReset(true);
            toast({ title: "Password Reset Required", description: "Please set a new password to continue." });
            setIsLoading(false);
            return;
          }

          toast({ title: "Welcome!", description: `Signed in as ${userType}.` });
          navigate(userType === "admin" ? "/admin-dashboard" : userType === "school" ? "/school-dashboard" : "/school-dashboard");
        } else {
          toast({ title: "Login Failed", description: "Please check your credentials.", variant: "destructive" });
          setIsLoading(false);
        }
      } catch (err) {
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 2000));
          return tryLogin(attempt + 1);
        }
        toast({ title: "Login Failed", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
        setIsLoading(false);
      }
    };
    await tryLogin();
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords Mismatch", description: "Both passwords must match.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Password Too Short", description: "Minimum 8 characters.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("secure-auth", {
        body: { action: "reset_password", sessionToken, newPassword },
      });
      if (error || data?.error) throw new Error(data?.error || "Reset failed");
      const tokenKey = role === "admin" ? "adminSessionToken" : role === "school" ? "schoolSessionToken" : "coachingSessionToken";
      localStorage.setItem(tokenKey, data.sessionToken);
      toast({ title: "Success", description: "Password updated." });
      navigate(role === "admin" ? "/admin-dashboard" : "/school-dashboard");
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const roleConfig: Record<Role, { label: string; icon: typeof GraduationCap; idLabel: string; idPlaceholder: string; idType: string }> = {
    student: { label: "Student", icon: GraduationCap, idLabel: language === "en" ? "Email" : "ईमेल", idPlaceholder: "your.email@example.com", idType: "email" },
    school: { label: "School", icon: Building2, idLabel: "School ID", idPlaceholder: "Enter School ID", idType: "text" },
    coaching: { label: "Coaching", icon: BookOpen, idLabel: "Coaching ID", idPlaceholder: "Enter Coaching ID", idType: "text" },
    admin: { label: "Admin", icon: Shield, idLabel: "Admin ID / Email", idPlaceholder: "superadmin5670@gmail.com", idType: "text" },
  };
  const cfg = roleConfig[role];

  const checkApprovalAndNavigate = async (userId: string) => {
    try {
      const { data: student } = await supabase
        .from("students")
        .select("id, is_approved")
        .eq("user_id", userId)
        .maybeSingle();
      
      if (!mountedRef.current) return;
      
      // Always navigate to dashboard - let the dashboard handle pending/rejected UI
      // This prevents the UX deadlock where unapproved students get logged out
      if (student && !student.is_approved) {
        toast({
          title: language === 'en' ? "Approval Pending ⏳" : "अप्रूवल पेंडिंग ⏳",
          description: language === 'en' 
            ? "Your account is waiting for approval. You can check your status." 
            : "आपका अकाउंट अप्रूवल का इंतज़ार कर रहा है।",
        });
      } else {
        toast({
          title: language === 'en' ? "Welcome back!" : "वापस स्वागत है!",
          description: language === 'en' ? "Let's start studying." : "चलो पढ़ाई करते हैं।",
        });
      }
      
      navigate("/dashboard", { replace: true });
    } catch {
      if (mountedRef.current) {
        // Even on error, navigate to dashboard - let it handle
        navigate("/dashboard", { replace: true });
      }
    }
  };

  return (
    <div className="min-h-screen liquid-bg flex flex-col relative overflow-hidden">
      <div className="liquid-orb liquid-orb-blue w-[400px] h-[400px] -top-32 -right-32" />
      <div className="liquid-orb liquid-orb-purple w-[300px] h-[300px] bottom-0 -left-20" style={{ animationDelay: '3s' }} />
      <header className="container mx-auto py-4 px-3 sm:px-4 relative z-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden xs:inline">{language === 'en' ? 'Back to Home' : 'वापस होम'}</span>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-3 sm:px-4 flex items-center justify-center py-4 sm:py-8 relative z-10">
        <div className="w-full max-w-md">
          <div className="glass-card p-4 sm:p-6 md:p-8">
            <div className="text-center mb-6 sm:mb-8">
              <img src="/logo.png" alt="Gyanam AI" className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl mx-auto mb-3 sm:mb-4 object-contain drop-shadow-lg" />
              <h1 className="text-xl sm:text-2xl font-bold font-display">
                {language === 'en' ? 'Welcome Back!' : 'वापस स्वागत है!'}
              </h1>
              <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
                {language === 'en' ? 'Sign in to your account' : 'अपने अकाउंट में साइन इन करें'}
              </p>
            </div>

            {/* Role selector */}
            <div className="grid grid-cols-4 gap-1.5 mb-5 p-1 rounded-2xl bg-muted/40 border border-border/40">
              {(Object.keys(roleConfig) as Role[]).map(r => {
                const Icon = roleConfig[r].icon;
                const active = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => { setRole(r); setRequiresPasswordReset(false); }}
                    className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-[10px] sm:text-xs font-semibold transition-all ${
                      active ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" strokeWidth={2.2} />
                    {roleConfig[r].label}
                  </button>
                );
              })}
            </div>

            {requiresPasswordReset ? (
              <form onSubmit={handlePasswordReset} className="space-y-5">
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-xs text-yellow-600 dark:text-yellow-400">
                  Please set a new password (min 8 chars) to continue.
                </div>
                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input id="newPassword" type={showPassword ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} className="h-12" />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input id="confirmPassword" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="h-12" />
                </div>
                <Button type="submit" variant="hero" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading ? "Updating..." : "Update Password"}
                </Button>
              </form>
            ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <Label htmlFor="identifier">{cfg.idLabel}</Label>
                <Input
                  id="identifier"
                  type={cfg.idType}
                  placeholder={cfg.idPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12"
                />
              </div>
              <div>
                <Label htmlFor="password">{language === 'en' ? 'Password' : 'पासवर्ड'}</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder={language === 'en' ? "Enter your password" : "अपना पासवर्ड डालें"} value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12" />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {role === "student" && (
                  <div className="flex justify-end mt-2">
                    <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                      {language === 'en' ? 'Forgot password?' : 'पासवर्ड भूल गए?'}
                    </Link>
                  </div>
                )}
              </div>
              <Button type="submit" variant="hero" className="w-full shadow-lg shadow-primary/20" size="lg" disabled={isLoading}>
                {isLoading ? (language === 'en' ? "Logging in..." : "लॉगिन हो रहा है...") : (language === 'en' ? "Login" : "लॉगिन")}
              </Button>
            </form>
            )}

            {showAuthRepair && (
              <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/20">
                <p className="text-sm text-muted-foreground mb-2">
                  {language === 'en' ? 'Having trouble logging in?' : 'लॉगिन में परेशानी?'}
                </p>
                <AuthRepairButton onRepaired={() => setShowAuthRepair(false)} className="w-full" />
              </div>
            )}

            {role === "student" && !requiresPasswordReset && (
              <div className="mt-6 text-center">
                <p className="text-muted-foreground">
                  {language === 'en' ? "Don't have an account?" : "अकाउंट नहीं है?"}{" "}
                  <Link to="/signup" className="text-primary font-semibold hover:underline">
                    {language === 'en' ? 'Sign Up' : 'साइन अप'}
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
