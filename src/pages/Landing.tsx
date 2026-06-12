import React, { useEffect, memo, useCallback, useMemo } from "react";
import { BookOpen, Users, GraduationCap, MessageCircle, TrendingUp, FileText, Shield, Zap, Star, Brain, BarChart3, Sparkles, ArrowRight, Volume2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";

const Landing = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate("/dashboard");
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen liquid-bg text-foreground relative overflow-hidden">
      {/* Liquid background orbs */}
      <div className="liquid-orb liquid-orb-blue w-[500px] h-[500px] -top-40 -right-40 opacity-30" />
      <div className="liquid-orb liquid-orb-purple w-[400px] h-[400px] top-[60%] -left-32 opacity-25" style={{ animationDelay: '3s' }} />
      <div className="liquid-orb liquid-orb-green w-[300px] h-[300px] top-[30%] right-[10%] opacity-20" style={{ animationDelay: '5s' }} />
      <div className="liquid-orb liquid-orb-gold w-[250px] h-[250px] bottom-[20%] left-[20%] opacity-15" style={{ animationDelay: '7s' }} />

      {/* Header */}
      <header className="container mx-auto py-4 px-4 relative z-10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/logo.png" alt="Gyanam AI" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex-shrink-0 object-contain drop-shadow-md" />
            <span className="text-base sm:text-xl font-extrabold text-foreground truncate font-display">{t('app.name')}</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            <LanguageToggle />
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")} className="text-xs sm:text-sm px-2 sm:px-4">
              {t('nav.login')}
            </Button>
            <Button size="sm" onClick={() => navigate("/signup")} className="text-xs sm:text-sm px-3 sm:px-4">
              {t('landing.getStarted')}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10">
        <div className="container mx-auto px-4 py-16 md:py-28">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-primary/10 backdrop-blur-sm px-4 py-2 rounded-full mb-8 animate-slide-up border border-primary/20">
              <Sparkles className="w-4 h-4 text-primary animate-pulse-slow" />
              <span className="text-sm font-bold text-primary">
                {language === 'en' ? '🚀 India\'s #1 AI Study Companion' : '🚀 India ka #1 AI Study Companion'}
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-[1.08] tracking-tight animate-slide-up font-display">
              {language === 'en' ? (
                <>Your Personal<br /><span className="text-gradient-shimmer">Gyanam AI</span><br />is Here</>
              ) : (
                <>Tera Personal<br /><span className="text-gradient-shimmer">Gyanam AI</span><br />Aa Gaya</>
              )}
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed animate-slide-up stagger-2">
              {language === 'en'
                ? "AI-powered study companion for Class 6-12. Smart chat, weekly tests, progress tracking & parent reports — all in one app."
                : "Class 6-12 ke liye AI study companion. Smart chat, weekly test, progress tracking & parent reports — sab ek app mein."}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 animate-slide-up stagger-3">
              <Button variant="hero" size="xl" onClick={() => navigate("/signup")} className="font-bold text-base group shadow-lg shadow-primary/25">
                <GraduationCap className="w-5 h-5" />
                {language === 'en' ? 'Start Studying Free' : 'Start Studying Free'}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="hero-outline" size="xl" onClick={() => navigate("/school-login")} className="font-semibold">
                <Users className="w-5 h-5" />
                {t('auth.schoolLogin')}
              </Button>
              <Button variant="hero-outline" size="xl" onClick={() => navigate("/coaching-login")} className="font-semibold">
                <GraduationCap className="w-5 h-5" />
                {language === 'en' ? 'Coaching Login' : 'Coaching Login'}
              </Button>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground animate-slide-up stagger-4">
              {[
                { icon: <Shield className="w-4 h-4 text-accent" />, text: language === 'en' ? 'Safe & Secure' : 'Safe & Secure' },
                { icon: <Zap className="w-4 h-4 text-primary" />, text: language === 'en' ? 'Instant AI Help' : 'Turant AI Help' },
                { icon: <Star className="w-4 h-4 text-edu-orange" />, text: language === 'en' ? 'CBSE, ICSE & More' : 'CBSE, ICSE & More' },
                { icon: <Volume2 className="w-4 h-4 text-edu-purple" />, text: language === 'en' ? 'Voice Support' : 'Voice Support' },
              ].map((badge, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-card/60 backdrop-blur-sm border border-border/50 px-3.5 py-2 rounded-full hover:border-primary/30 transition-colors">
                  {badge.icon}
                  <span>{badge.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="relative z-10">
        <div className="stats-glass border-y border-border/50">
          <div className="container mx-auto px-4 py-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center">
              <StatItem value="5,000+" label={language === 'en' ? 'Students Ready' : 'Students Ready'} icon={<Users className="w-5 h-5 text-primary" />} />
              <StatItem value="6-12" label={language === 'en' ? 'All Classes' : 'All Classes'} icon={<BookOpen className="w-5 h-5 text-accent" />} />
              <StatItem value="4" label={language === 'en' ? 'Boards Supported' : 'Boards Supported'} icon={<GraduationCap className="w-5 h-5 text-edu-purple" />} />
              <StatItem value="24/7" label={language === 'en' ? 'AI Available' : 'AI Available'} icon={<Zap className="w-5 h-5 text-accent" />} />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20 relative z-10">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-accent/10 px-3 py-1.5 rounded-full mb-4 border border-accent/20">
            <span className="text-xs font-bold text-accent uppercase tracking-widest">Features</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold mb-4 font-display">
            Everything You Need to <span className="text-gradient-shimmer">Excel</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-lg">Powerful features designed for Indian students</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <FeatureCard icon={<MessageCircle className="w-6 h-6" />} title="AI Study Chat" description="Chat with AI while studying. Upload notes, ask doubts, get step-by-step explanations instantly." color="primary" index={0} />
          <FeatureCard icon={<Brain className="w-6 h-6" />} title="Weekly Smart Test" description="AI generates personalized weekly tests based on what you studied. 70% current + 30% weak topics." color="accent" index={1} />
          <FeatureCard icon={<BarChart3 className="w-6 h-6" />} title="WPS Progress Score" description="Weekly Performance Score tracks accuracy, improvement, weak topics & consistency automatically." color="purple" index={2} />
          <FeatureCard icon={<TrendingUp className="w-6 h-6" />} title="Rankings & Leaderboard" description="Compete with school & district peers. Climb the leaderboard and earn achievement badges." color="primary" index={3} />
          <FeatureCard icon={<FileText className="w-6 h-6" />} title="Parent Reports" description="Weekly PDF reports with WPS score sent to parents via WhatsApp. Full transparency." color="accent" index={4} />
          <FeatureCard icon={<Shield className="w-6 h-6" />} title="School Dashboard" description="Schools and coaching centers manage students, track performance & approve subscriptions." color="purple" index={5} />
        </div>
      </section>

      {/* How It Works */}
      <section className="relative z-10">
        <div className="stats-glass border-y border-border/50">
          <div className="container mx-auto px-4 py-20">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full mb-4 border border-primary/20">
                <span className="text-xs font-bold text-primary uppercase tracking-widest">How It Works</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-extrabold font-display">
                Start in <span className="text-gradient-shimmer">4 Simple Steps</span>
              </h2>
            </div>
            <div className="max-w-4xl mx-auto">
              <div className="grid md:grid-cols-4 gap-8 relative">
                <div className="hidden md:block absolute top-7 left-[12.5%] right-[12.5%] step-connector" />
                <StepCard step={1} title="Sign Up" description="Create account & get approved by school" />
                <StepCard step={2} title="Study Daily" description="Chat with AI, ask doubts freely" />
                <StepCard step={3} title="Weekly Test" description="Take AI-generated adaptive test" />
                <StepCard step={4} title="Track Growth" description="See WPS score & improve" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="glass-card relative overflow-hidden p-10 md:p-14 mesh-bg">
            {/* Background decoration */}
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/8 blur-3xl" />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-accent/8 blur-3xl" />
            
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: 'var(--gradient-primary)' }}>
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold mb-4 font-display">
                Ready to Start Your <span className="text-gradient-shimmer">Journey?</span>
              </h2>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto text-lg">
                Join thousands of students already improving their grades with AI-powered learning.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button variant="hero" size="xl" onClick={() => navigate("/signup")} className="font-bold text-base group shadow-lg shadow-primary/25">
                  <GraduationCap className="w-5 h-5" />
                  Get Started Free
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button variant="hero-outline" size="xl" onClick={() => navigate("/schools")} className="font-semibold">
                  <Users className="w-5 h-5" />
                  Browse Schools
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 relative z-10">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="Gyanam AI" className="w-8 h-8 rounded-lg object-contain" />
              <span className="font-bold font-display">Gyanam AI</span>
            </div>
            <button onClick={() => navigate("/terms")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Terms & Conditions
            </button>
            <p className="text-sm text-muted-foreground">
              © 2025 Gyanam AI. Making education better for every student.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

/* ── Sub-components ────────────────────────────── */

const StatItem = memo(({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) => (
  <div className="flex flex-col items-center gap-2 animate-counter">
    <div className="w-11 h-11 rounded-xl bg-card/60 backdrop-blur-sm border border-border/30 flex items-center justify-center mb-1 hover:scale-110 transition-transform">
      {icon}
    </div>
    <p className="text-2xl md:text-3xl font-extrabold gradient-text font-display">{value}</p>
    <p className="text-sm text-muted-foreground font-medium">{label}</p>
  </div>
));
StatItem.displayName = "StatItem";

const FeatureCard = memo(({ icon, title, description, color = "primary", index = 0 }: { icon: React.ReactNode; title: string; description: string; color?: string; index?: number }) => {
  const colorClasses: Record<string, string> = {
    primary: "text-primary",
    accent: "text-accent",
    purple: "text-edu-purple",
  };
  const bgClasses: Record<string, string> = {
    primary: "bg-primary/10",
    accent: "bg-accent/10",
    purple: "bg-edu-purple/10",
  };
  const borderGlow: Record<string, string> = {
    primary: "hover:border-primary/30 hover:shadow-[0_0_25px_hsl(var(--primary)/0.12)]",
    accent: "hover:border-accent/30 hover:shadow-[0_0_25px_hsl(var(--accent)/0.12)]",
    purple: "hover:border-edu-purple/30 hover:shadow-[0_0_25px_hsl(var(--edu-purple)/0.12)]",
  };
  return (
    <div 
      className={`feature-card group ${borderGlow[color]} animate-slide-up`}
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${bgClasses[color]} ${colorClasses[color]} transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`}>
        {icon}
      </div>
      <h3 className="text-lg font-bold mb-2 font-display">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  );
});
FeatureCard.displayName = "FeatureCard";

const StepCard = memo(({ step, title, description }: { step: number; title: string; description: string }) => (
  <div className="text-center relative z-10 animate-slide-up" style={{ animationDelay: `${step * 0.1}s` }}>
    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 font-extrabold text-xl text-primary-foreground shadow-lg shadow-primary/25 font-display hover:scale-110 transition-transform"
      style={{ background: 'var(--gradient-primary)' }}
    >
      {step}
    </div>
    <h3 className="font-bold mb-1.5 font-display">{title}</h3>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
));
StepCard.displayName = "StepCard";

export default Landing;
