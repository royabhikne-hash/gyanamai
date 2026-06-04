import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, ArrowLeft, Eye, EyeOff, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  // 10-minute reset link window
  const RESET_WINDOW_MS = 10 * 60 * 1000;
  const [isExpired, setIsExpired] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    // Check if user has a valid recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsValidSession(!!session);
    };
    checkSession();
  }, []);

  // Enforce the 10-minute link window. Reads the timestamp ForgotPassword
  // stored when the user requested the reset email.
  useEffect(() => {
    if (isValidSession !== true) return;
    const requestedAtStr = localStorage.getItem("gyanam_pwd_reset_requested_at");
    const requestedAt = requestedAtStr ? parseInt(requestedAtStr, 10) : null;
    if (!requestedAt || Number.isNaN(requestedAt)) {
      // No tracked request time — assume link is fresh enough.
      return;
    }
    const expiresAt = requestedAt + RESET_WINDOW_MS;
    const tick = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        setIsExpired(true);
        setSecondsLeft(0);
        // Drop the recovery session so a stale tab can't be used either.
        supabase.auth.signOut().catch(() => {});
      } else {
        setSecondsLeft(Math.ceil(remaining / 1000));
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [isValidSession]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isExpired) {
      toast({
        title: "Reset Link Expired",
        description: "This reset link is older than 10 minutes. Please request a new one.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }

      setIsSuccess(true);
      toast({
        title: "Password Updated!",
        description: "Your password has been successfully changed.",
      });

      // Clear the 10-minute window tracker on success.
      try {
        localStorage.removeItem("gyanam_pwd_reset_requested_at");
        localStorage.removeItem("gyanam_pwd_reset_email");
      } catch { /* ignore */ }

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (error) {
      console.error("Reset password error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reset password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidSession === null) {
    return (
      <div className="min-h-screen hero-gradient flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isValidSession || isExpired) {
    return (
      <div className="min-h-screen hero-gradient flex flex-col">
        <header className="container mx-auto py-6 px-4">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </header>

        <main className="flex-1 container mx-auto px-4 flex items-center justify-center py-8">
          <div className="w-full max-w-md">
            <div className="edu-card p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-destructive flex items-center justify-center mx-auto mb-4">
                <KeyRound className="w-8 h-8 text-destructive-foreground" />
              </div>
              <h1 className="text-2xl font-bold">
                {isExpired ? "Link Expired" : "Invalid or Expired Link"}
              </h1>
              <p className="text-muted-foreground mt-2 mb-6">
                {isExpired
                  ? "For your security, password reset links are only valid for 10 minutes. Please request a new one."
                  : "This password reset link is invalid or has expired. Please request a new one."}
              </p>
              <Link to="/forgot-password">
                <Button variant="hero" className="w-full">
                  Request New Reset Link
                </Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen hero-gradient flex flex-col">
      {/* Header */}
      <header className="container mx-auto py-6 px-4">
        <Link to="/login" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </Link>
      </header>

      {/* Form */}
      <main className="flex-1 container mx-auto px-4 flex items-center justify-center py-8">
        <div className="w-full max-w-md">
          <div className="edu-card p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
                {isSuccess ? (
                  <CheckCircle className="w-8 h-8 text-primary-foreground" />
                ) : (
                  <KeyRound className="w-8 h-8 text-primary-foreground" />
                )}
              </div>
              <h1 className="text-2xl font-bold">
                {isSuccess ? "Password Updated!" : "Reset Password"}
              </h1>
              <p className="text-muted-foreground mt-2">
                {isSuccess 
                  ? "Redirecting you to login..." 
                  : "Enter your new password below."}
              </p>
            </div>

            {isSuccess ? (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                <p className="text-sm text-green-600 dark:text-green-400 text-center">
                  ✅ Your password has been successfully reset. You'll be redirected to login shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {secondsLeft !== null && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      ⏱️ This link expires in{" "}
                      <strong>
                        {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
                      </strong>
                    </p>
                  </div>
                )}
                <div>
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum 6 characters
                  </p>
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" variant="hero" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading ? "Updating..." : "Update Password"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ResetPassword;