import React, { useEffect } from "react";
import { BookOpen, Users, GraduationCap, MessageCircle, TrendingUp, FileText, Shield, Zap, Star, Brain, BarChart3, Sparkles, ArrowRight } from "lucide-react";
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
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen liquid-bg flex items-center justify-center">
        <div className="w-14 h-14 rounded-2xl glass flex items-center justify-center animate-glow-pulse">
          <BookOpen className="w-7 h-7 text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen liquid-bg overflow-hidden text-foreground">
      {/* Animated Liquid Orbs */}
      <div className="liquid-orb liquid-orb-blue w-[500px] h-[500px] -top-40 -left-40" />
      <div className="liquid-orb liquid-orb-purple w-[400px] h-[400px] top-20 right-[-10%]" style={{ animationDelay: '2s' }} />
      <div className="liquid-orb liquid-orb-teal w-[350px] h-[350px] bottom-20 left-[20%]" style={{ animationDelay: '4s' }} />
      <div className="liquid-orb liquid-orb-blue w-[300px] h-[300px] bottom-[-5%] right-[15%]" style={{ animationDelay: '6s' }} />

      {/* Header */}
      <header className="container mx-auto py-4 px-4 relative z-20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img 
              src="/logo.png" 
              alt="Study Buddy AI" 
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex-shrink-0 object-contain"
            />
            <span className="text-base sm:text-xl font-extrabold font-display text-foreground truncate tracking-tight">{t('app.name')}</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            <LanguageToggle />
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")} className="text-xs sm:text-sm px-2 sm:px-4 font-semibold text-foreground/80 hover:text-foreground">
              {t('nav.login')}
            </Button>
            <Button variant="hero" size="sm" onClick={() => navigate("/signup")} className="text-xs sm:text-sm px-3 sm:px-4 font-bold">
              {t('landing.getStarted')}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10">
        <div className="container mx-auto px-4 py-16 md:py-28">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-accent animate-pulse" />
              <span className="text-sm font-bold text-accent">
                {language === 'en' ? '🚀 India\'s #1 AI Study Companion' : '🚀 India ka #1 AI Study Companion'}
              </span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold font-display mb-6 leading-[1.1] tracking-tight">
              {language === 'en' ? (
                <>Your Personal<br /><span className="gradient-text text-glow">AI Study Buddy</span><br />is Here</>
              ) : (
                <>Tera Personal<br /><span className="gradient-text text-glow">AI Study Buddy</span><br />Aa Gaya</>
              )}
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              {language === 'en' 
                ? "AI-powered study companion for Class 6-12. Smart chat, weekly tests, progress tracking & parent reports — all in one app."
                : "Class 6-12 ke liye AI study companion. Smart chat, weekly test, progress tracking & parent reports — sab ek app mein."}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button variant="hero" size="xl" onClick={() => navigate("/signup")} className="font-bold text-base group">
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

            {/* Trust indicators */}
            <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5 glass px-3.5 py-2 rounded-full">
                <Shield className="w-4 h-4 text-accent" />
                <span>{language === 'en' ? 'Safe & Secure' : 'Safe & Secure'}</span>
              </div>
              <div className="flex items-center gap-1.5 glass px-3.5 py-2 rounded-full">
                <Zap className="w-4 h-4 text-primary" />
                <span>{language === 'en' ? 'Instant AI Help' : 'Turant AI Help'}</span>
              </div>
              <div className="flex items-center gap-1.5 glass px-3.5 py-2 rounded-full">
                <Star className="w-4 h-4 text-edu-orange" />
                <span>{language === 'en' ? 'CBSE, ICSE & More' : 'CBSE, ICSE & More'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="relative z-10 border-y border-border/30">
        <div className="glass-nav">
          <div className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center">
              <StatItem value="5,000+" label={language === 'en' ? 'Students Ready' : 'Students Ready'} icon={<Users className="w-5 h-5 text-primary" />} />
              <StatItem value="6-12" label={language === 'en' ? 'All Classes' : 'All Classes'} icon={<BookOpen className="w-5 h-5 text-accent" />} />
              <StatItem value="4" label={language === 'en' ? 'Boards Supported' : 'Boards Supported'} icon={<GraduationCap className="w-5 h-5 text-primary" />} />
              <StatItem value="24/7" label={language === 'en' ? 'AI Available' : 'AI Available'} icon={<Zap className="w-5 h-5 text-accent" />} />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20 relative z-10">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 glass px-3 py-1 rounded-full mb-4">
            <span className="text-xs font-bold text-accent uppercase tracking-wider">
              {language === 'en' ? 'Features' : 'Features'}
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold font-display mb-4">
            {language === 'en' ? 'Everything You Need to ' : 'Everything You Need to '}<span className="gradient-text">{language === 'en' ? 'Excel' : 'Excel'}</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-lg">
            {language === 'en' ? 'Powerful features designed for Indian students' : 'Powerful features designed for Indian students'}
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <FeatureCard icon={<MessageCircle className="w-6 h-6" />} title="AI Study Chat" description="Chat with AI while studying. Upload notes, ask doubts, get step-by-step explanations instantly." color="primary" />
          <FeatureCard icon={<Brain className="w-6 h-6" />} title="Weekly Smart Test" description="AI generates personalized weekly tests based on what you studied. 70% current + 30% weak topics." color="accent" />
          <FeatureCard icon={<BarChart3 className="w-6 h-6" />} title="WPS Progress Score" description="Weekly Performance Score tracks accuracy, improvement, weak topics & consistency automatically." color="purple" />
          <FeatureCard icon={<TrendingUp className="w-6 h-6" />} title="Rankings & Leaderboard" description="Compete with school & district peers. Climb the leaderboard and earn achievement badges." color="primary" />
          <FeatureCard icon={<FileText className="w-6 h-6" />} title="Parent Reports" description="Weekly PDF reports with WPS score sent to parents via WhatsApp. Full transparency." color="accent" />
          <FeatureCard icon={<Shield className="w-6 h-6" />} title="School Dashboard" description="Schools and coaching centers manage students, track performance & approve subscriptions." color="purple" />
        </div>
      </section>

      {/* How It Works */}
      <section className="relative z-10 border-y border-border/30">
        <div className="glass-nav">
          <div className="container mx-auto px-4 py-20">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 glass px-3 py-1 rounded-full mb-4">
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  {language === 'en' ? 'How It Works' : 'Process'}
                </span>
              </div>
              <h2 className="text-3xl md:text-5xl font-extrabold font-display">
                {language === 'en' ? 'Start in ' : 'Start in '}<span className="gradient-text">{language === 'en' ? '4 Simple Steps' : '4 Simple Steps'}</span>
              </h2>
            </div>
            
            <div className="max-w-4xl mx-auto">
              <div className="grid md:grid-cols-4 gap-8 relative">
                <div className="hidden md:block absolute top-7 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />
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
          <div className="glass-card p-10 md:p-14 relative overflow-hidden">
            {/* Animated liquid accents */}
            <div className="liquid-orb liquid-orb-blue w-48 h-48 -top-20 -right-20" style={{ animationDelay: '1s' }} />
            <div className="liquid-orb liquid-orb-teal w-40 h-40 -bottom-16 -left-16" style={{ animationDelay: '3s' }} />
            
            <div className="relative z-10">
              <Sparkles className="w-10 h-10 text-primary mx-auto mb-4" />
              <h2 className="text-3xl md:text-4xl font-extrabold font-display mb-4">
                {language === 'en' ? 'Ready to Start Your ' : 'Ready to Start Your '}<span className="gradient-text">{language === 'en' ? 'Journey?' : 'Journey?'}</span>
              </h2>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto text-lg">
                {language === 'en' 
                  ? 'Join thousands of students already improving their grades with AI-powered learning.'
                  : 'Join thousands of students already improving their grades with AI-powered learning.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button variant="hero" size="xl" onClick={() => navigate("/signup")} className="font-bold text-base group">
                  <GraduationCap className="w-5 h-5" />
                  {language === 'en' ? 'Get Started Free' : 'Get Started Free'}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button variant="hero-outline" size="xl" onClick={() => navigate("/schools")} className="font-semibold">
                  <Users className="w-5 h-5" />
                  {language === 'en' ? 'Browse Schools' : 'Browse Schools'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 relative z-10">
        <div className="glass-nav">
          <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2.5">
                <img src="/logo.png" alt="Study Buddy AI" className="w-8 h-8 rounded-lg object-contain" />
                <span className="font-bold font-display">Study Buddy AI</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <button onClick={() => navigate("/terms")} className="hover:text-foreground transition-colors">
                  {language === 'en' ? 'Terms & Conditions' : 'Terms & Conditions'}
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                © 2025 Study Buddy AI. Making education better for every student.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const StatItem = React.forwardRef<HTMLDivElement, { value: string; label: string; icon: React.ReactNode }>(
  ({ value, label, icon }, ref) => (
    <div ref={ref} className="flex flex-col items-center gap-2">
      <div className="w-10 h-10 rounded-xl glass flex items-center justify-center mb-1">
        {icon}
      </div>
      <p className="text-2xl md:text-3xl font-extrabold font-display text-primary">{value}</p>
      <p className="text-sm text-muted-foreground font-medium">{label}</p>
    </div>
  )
);
StatItem.displayName = "StatItem";

const FeatureCard = React.forwardRef<HTMLDivElement, { icon: React.ReactNode; title: string; description: string; color?: string }>(
  ({ icon, title, description, color = "primary" }, ref) => {
    const colorClasses: Record<string, string> = {
      primary: "bg-primary/10 text-primary border-primary/20",
      accent: "bg-accent/10 text-accent border-accent/20",
      purple: "bg-edu-purple/10 text-edu-purple border-edu-purple/20",
    };
    
    return (
      <div ref={ref} className="glass-card p-6 group">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 border ${colorClasses[color]} group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
        <h3 className="text-lg font-bold font-display mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </div>
    );
  }
);
FeatureCard.displayName = "FeatureCard";

const StepCard = React.forwardRef<HTMLDivElement, { step: number; title: string; description: string }>(
  ({ step, title, description }, ref) => (
    <div ref={ref} className="text-center group relative z-10">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 font-extrabold font-display text-xl text-primary-foreground group-hover:scale-110 transition-all duration-300 glow-primary"
        style={{ background: 'var(--gradient-primary)' }}
      >
        {step}
      </div>
      <h3 className="font-bold font-display mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
);
StepCard.displayName = "StepCard";

export default Landing;
