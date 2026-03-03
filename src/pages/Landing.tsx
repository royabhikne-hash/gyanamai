import React, { useEffect } from "react";
import { BookOpen, Users, GraduationCap, MessageCircle, TrendingUp, FileText, Shield, Zap, Star, ChevronRight, Brain, BarChart3, Sparkles, ArrowRight } from "lucide-react";
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
      <div className="min-h-screen hero-gradient flex items-center justify-center">
        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center animate-pulse">
          <BookOpen className="w-6 h-6 text-primary-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Header */}
      <header className="container mx-auto py-4 px-4 relative z-20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img 
              src="/logo.png" 
              alt="Study Buddy AI" 
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex-shrink-0 object-contain shadow-md"
            />
            <span className="text-base sm:text-xl font-extrabold text-foreground truncate">{t('app.name')}</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            <LanguageToggle />
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")} className="text-xs sm:text-sm px-2 sm:px-4 font-semibold">
              {t('nav.login')}
            </Button>
            <Button variant="hero" size="sm" onClick={() => navigate("/signup")} className="text-xs sm:text-sm px-3 sm:px-4 font-bold shadow-lg shadow-primary/25">
              {t('landing.getStarted')}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative">
        <div className="absolute inset-0 hero-gradient opacity-60" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 py-16 md:py-28 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 px-4 py-2 rounded-full mb-6 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-sm font-bold text-primary">
                {language === 'en' ? '🚀 India\'s #1 AI Study Companion' : '🚀 India ka #1 AI Study Companion'}
              </span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-foreground mb-6 leading-[1.1] tracking-tight">
              {language === 'en' ? (
                <>Your Personal<br /><span className="gradient-text">AI Study Buddy</span><br />is Here</>
              ) : (
                <>Tera Personal<br /><span className="gradient-text">AI Study Buddy</span><br />Aa Gaya</>
              )}
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              {language === 'en' 
                ? "AI-powered study companion for Class 6-12. Smart chat, weekly tests, progress tracking & parent reports — all in one app."
                : "Class 6-12 ke liye AI study companion. Smart chat, weekly test, progress tracking & parent reports — sab ek app mein."}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button variant="hero" size="xl" onClick={() => navigate("/signup")} className="shadow-xl shadow-primary/30 font-bold text-base group">
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
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5 bg-card/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border/50">
                <Shield className="w-4 h-4 text-accent" />
                <span>{language === 'en' ? 'Safe & Secure' : 'Safe & Secure'}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-card/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border/50">
                <Zap className="w-4 h-4 text-primary" />
                <span>{language === 'en' ? 'Instant AI Help' : 'Turant AI Help'}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-card/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border/50">
                <Star className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>{language === 'en' ? 'CBSE, ICSE & More' : 'CBSE, ICSE & More'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center">
            <StatItem value="5,000+" label={language === 'en' ? 'Students Ready' : 'Students Ready'} icon={<Users className="w-5 h-5 text-primary" />} />
            <StatItem value="6-12" label={language === 'en' ? 'All Classes' : 'All Classes'} icon={<BookOpen className="w-5 h-5 text-accent" />} />
            <StatItem value="4" label={language === 'en' ? 'Boards Supported' : 'Boards Supported'} icon={<GraduationCap className="w-5 h-5 text-primary" />} />
            <StatItem value="24/7" label={language === 'en' ? 'AI Available' : 'AI Available'} icon={<Zap className="w-5 h-5 text-accent" />} />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 px-3 py-1 rounded-full mb-4">
            <span className="text-xs font-bold text-accent uppercase tracking-wider">
              {language === 'en' ? 'Features' : 'Features'}
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold mb-4">
            {language === 'en' ? 'Everything You Need to ' : 'Everything You Need to '}<span className="gradient-text">{language === 'en' ? 'Excel' : 'Excel'}</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-lg">
            {language === 'en' ? 'Powerful features designed for Indian students' : 'Powerful features designed for Indian students'}
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <FeatureCard
            icon={<MessageCircle className="w-6 h-6" />}
            title={language === 'en' ? "AI Study Chat" : "AI Study Chat"}
            description={language === 'en' 
              ? "Chat with AI while studying. Upload notes, ask doubts, get step-by-step explanations instantly."
              : "Chat with AI while studying. Upload notes, ask doubts, get step-by-step explanations instantly."}
            color="primary"
          />
          <FeatureCard
            icon={<Brain className="w-6 h-6" />}
            title={language === 'en' ? "Weekly Smart Test" : "Weekly Smart Test"}
            description={language === 'en'
              ? "AI generates personalized weekly tests based on what you studied. 70% current + 30% weak topics."
              : "AI generates personalized weekly tests based on what you studied. 70% current + 30% weak topics."}
            color="accent"
          />
          <FeatureCard
            icon={<BarChart3 className="w-6 h-6" />}
            title={language === 'en' ? "WPS Progress Score" : "WPS Progress Score"}
            description={language === 'en'
              ? "Weekly Performance Score tracks accuracy, improvement, weak topics & consistency automatically."
              : "Weekly Performance Score tracks accuracy, improvement, weak topics & consistency automatically."}
            color="purple"
          />
          <FeatureCard
            icon={<TrendingUp className="w-6 h-6" />}
            title={language === 'en' ? "Rankings & Leaderboard" : "Rankings & Leaderboard"}
            description={language === 'en'
              ? "Compete with school & district peers. Climb the leaderboard and earn achievement badges."
              : "Compete with school & district peers. Climb the leaderboard and earn achievement badges."}
            color="primary"
          />
          <FeatureCard
            icon={<FileText className="w-6 h-6" />}
            title={language === 'en' ? "Parent Reports" : "Parent Reports"}
            description={language === 'en'
              ? "Weekly PDF reports with WPS score sent to parents via WhatsApp. Full transparency."
              : "Weekly PDF reports with WPS score sent to parents via WhatsApp. Full transparency."}
            color="accent"
          />
          <FeatureCard
            icon={<Shield className="w-6 h-6" />}
            title={language === 'en' ? "School Dashboard" : "School Dashboard"}
            description={language === 'en'
              ? "Schools and coaching centers manage students, track performance & approve subscriptions."
              : "Schools and coaching centers manage students, track performance & approve subscriptions."}
            color="purple"
          />
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4 py-20">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1 rounded-full mb-4">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                {language === 'en' ? 'How It Works' : 'Process'}
              </span>
            </div>
             <h2 className="text-3xl md:text-5xl font-extrabold">
              {language === 'en' ? 'Start in ' : 'Start in '}<span className="gradient-text">{language === 'en' ? '4 Simple Steps' : '4 Simple Steps'}</span>
            </h2>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8 relative">
              {/* Connection line */}
              <div className="hidden md:block absolute top-7 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-primary/30 via-primary/50 to-primary/30" />
              <StepCard step={1} title="Sign Up" description="Create account & get approved by school" />
              <StepCard step={2} title="Study Daily" description="Chat with AI, ask doubts freely" />
              <StepCard step={3} title="Weekly Test" description="Take AI-generated adaptive test" />
              <StepCard step={4} title="Track Growth" description="See WPS score & improve" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="edu-card p-10 md:p-14 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-accent/10 rounded-full blur-3xl" />
            <div className="relative z-10">
              <Sparkles className="w-10 h-10 text-primary mx-auto mb-4" />
              <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
                {language === 'en' ? 'Ready to Start Your ' : 'Ready to Start Your '}<span className="gradient-text">{language === 'en' ? 'Journey?' : 'Journey?'}</span>
              </h2>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto text-lg">
                {language === 'en' 
                  ? 'Join thousands of students already improving their grades with AI-powered learning.'
                  : 'Join thousands of students already improving their grades with AI-powered learning.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button variant="hero" size="xl" onClick={() => navigate("/signup")} className="shadow-xl shadow-primary/30 font-bold text-base group">
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
      <footer className="border-t border-border bg-card/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="Study Buddy AI" className="w-8 h-8 rounded-lg object-contain" />
              <span className="font-bold">Study Buddy AI</span>
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
      </footer>
    </div>
  );
};

const StatItem = React.forwardRef<HTMLDivElement, { value: string; label: string; icon: React.ReactNode }>(
  ({ value, label, icon }, ref) => (
    <div ref={ref} className="flex flex-col items-center gap-2">
      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-1">
        {icon}
      </div>
      <p className="text-2xl md:text-3xl font-extrabold text-primary">{value}</p>
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
      purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    };
    
    return (
      <div ref={ref} className="edu-card p-6 hover:-translate-y-1.5 hover:shadow-lg transition-all duration-300 group">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 border ${colorClasses[color]} group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </div>
    );
  }
);
FeatureCard.displayName = "FeatureCard";

const StepCard = React.forwardRef<HTMLDivElement, { step: number; title: string; description: string }>(
  ({ step, title, description }, ref) => (
    <div ref={ref} className="text-center group relative z-10">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center mx-auto mb-4 font-extrabold text-xl shadow-lg shadow-primary/25 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-primary/30 transition-all duration-300">
        {step}
      </div>
      <h3 className="font-bold mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
);
StepCard.displayName = "StepCard";

export default Landing;
