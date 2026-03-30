import { useState, useEffect } from "react";
import BottomNavBar from "@/components/BottomNavBar";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  Target,
  Brain,
  BarChart3,
  Award,
  Flame,
  Zap,
  Star,
  CheckCircle,
  Download,
  Loader2,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";
import jsPDF from "jspdf";
import { ProgressSkeleton } from "@/components/DashboardSkeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
  Legend,
} from "recharts";

interface WeeklyTestRecord {
  id: string;
  accuracy_percentage: number;
  correct_count: number;
  wrong_count: number;
  total_questions: number;
  time_taken_seconds: number;
  subjects_tested: string[];
  strong_subjects: string[] | null;
  weak_subjects: string[] | null;
  improvement_suggestion: string | null;
  week_start: string;
  week_end: string;
  created_at: string;
}

interface StudySession {
  id: string;
  topic: string;
  subject: string | null;
  time_spent: number | null;
  understanding_level: string | null;
  weak_areas: string[] | null;
  strong_areas: string[] | null;
  created_at: string;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#8b5cf6", "#f59e0b", "#ef4444"];

const StudentProgress = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const [weeklyTests, setWeeklyTests] = useState<WeeklyTestRecord[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [studentName, setStudentName] = useState("Student");
  const [studentClass, setStudentClass] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    if (!loading && !user) { navigate("/login"); return; }
    if (user) loadProgressData();
  }, [user, loading, navigate]);

  const loadProgressData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data: student } = await supabase
        .from("students")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (student) {
        setStudentName(student.full_name);
        setStudentClass(student.class);

        // Fetch weekly tests (primary progress data)
        const { data: testsData } = await supabase
          .from("weekly_tests")
          .select("*")
          .eq("student_id", student.id)
          .order("created_at", { ascending: true });

        if (testsData) setWeeklyTests(testsData);

        // Fetch study sessions (for study tracking data)
        const { data: sessionData } = await supabase
          .from("study_sessions")
          .select("id, topic, subject, time_spent, understanding_level, weak_areas, strong_areas, created_at")
          .eq("student_id", student.id)
          .not("time_spent", "eq", 0)
          .order("created_at", { ascending: true });

        if (sessionData) setSessions(sessionData);
      }
    } catch (error) {
      console.error("Error loading progress data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // ===== WPS Calculation =====
  const calculateWPS = (testIndex: number): number => {
    if (weeklyTests.length === 0) return 0;
    const test = weeklyTests[testIndex];
    const accuracy = test.accuracy_percentage;

    // Improvement: current - previous week accuracy
    const prevTest = testIndex > 0 ? weeklyTests[testIndex - 1] : null;
    const improvement = prevTest ? Math.max(0, accuracy - prevTest.accuracy_percentage) : 0;

    // Weak topic reduction
    const currentWeak = (test.weak_subjects || []).length;
    const prevWeak = prevTest ? (prevTest.weak_subjects || []).length : currentWeak;
    const weakReduction = prevWeak > 0 ? Math.max(0, ((prevWeak - currentWeak) / prevWeak) * 100) : (currentWeak === 0 ? 100 : 0);

    // Consistency: days studied that week
    const weekStart = new Date(test.week_start);
    const weekEnd = new Date(test.week_end);
    const weekSessions = sessions.filter(s => {
      const d = new Date(s.created_at);
      return d >= weekStart && d <= weekEnd;
    });
    const uniqueDays = new Set(weekSessions.map(s => new Date(s.created_at).toDateString())).size;
    const consistency = (uniqueDays / 7) * 100;

    // WPS Formula
    return Math.round(
      (accuracy * 0.5) +
      (improvement * 0.25) +
      (weakReduction * 0.15) +
      (consistency * 0.10)
    );
  };

  const getLatestWPS = () => {
    if (weeklyTests.length === 0) return 0;
    return calculateWPS(weeklyTests.length - 1);
  };

  // WPS trend over weeks
  const getWPSTrendData = () => {
    return weeklyTests.map((test, i) => ({
      week: `W${i + 1}`,
      wps: calculateWPS(i),
      accuracy: test.accuracy_percentage,
      label: new Date(test.week_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    }));
  };

  // Subject performance from weekly tests
  const getSubjectPerformance = () => {
    const subjectStats: Record<string, { strong: number; weak: number; neutral: number; tests: number }> = {};
    weeklyTests.forEach(test => {
      (test.subjects_tested || []).forEach(sub => {
        if (!subjectStats[sub]) subjectStats[sub] = { strong: 0, weak: 0, neutral: 0, tests: 0 };
        subjectStats[sub].tests++;
        if ((test.strong_subjects || []).includes(sub)) {
          subjectStats[sub].strong++;
        } else if ((test.weak_subjects || []).includes(sub)) {
          subjectStats[sub].weak++;
        } else {
          subjectStats[sub].neutral++;
        }
      });
    });

    return Object.entries(subjectStats)
      .map(([subject, data]) => {
        // Score: strong=100%, neutral=50%, weak=0% weighted average
        const totalClassified = data.strong + data.weak + data.neutral;
        const score = totalClassified > 0 
          ? Math.round(((data.strong * 100) + (data.neutral * 50)) / totalClassified) 
          : 0;
        return {
          subject: subject.length > 12 ? subject.slice(0, 12) + "..." : subject,
          score,
          tests: data.tests,
        };
      })
      .sort((a, b) => b.tests - a.tests)
      .slice(0, 8);
  };

  // All weak subjects across tests
  const getWeakSubjects = () => {
    const weakCount: Record<string, number> = {};
    weeklyTests.forEach(test => {
      (test.weak_subjects || []).forEach(sub => {
        weakCount[sub] = (weakCount[sub] || 0) + 1;
      });
    });
    return Object.entries(weakCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  };

  const getStrongSubjects = () => {
    const strongCount: Record<string, number> = {};
    weeklyTests.forEach(test => {
      (test.strong_subjects || []).forEach(sub => {
        strongCount[sub] = (strongCount[sub] || 0) + 1;
      });
    });
    return Object.entries(strongCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  };

  // Study tracking data
  const getStudyStats = () => {
    const totalSessions = sessions.length;
    const totalMinutes = sessions.reduce((acc, s) => acc + (s.time_spent || 0), 0);
    const last30Days = sessions.filter(s => new Date(s.created_at) >= new Date(Date.now() - 30 * 86400000));
    const daysStudied = new Set(last30Days.map(s => new Date(s.created_at).toDateString())).size;
    const consistency = Math.round((daysStudied / 30) * 100);

    // Streak
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const hasSession = sessions.some(s => new Date(s.created_at).toDateString() === checkDate.toDateString());
      if (hasSession) streak++;
      else if (i > 0) break;
    }

    const totalTests = weeklyTests.length;
    const avgAccuracy = totalTests > 0
      ? Math.round(weeklyTests.reduce((acc, t) => acc + t.accuracy_percentage, 0) / totalTests)
      : 0;

    return { totalSessions, totalMinutes, consistency, streak, totalTests, avgAccuracy };
  };

  // Study patterns by day of week
  const getStudyPatterns = () => {
    const dayData: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    sessions.forEach(s => {
      const day = days[new Date(s.created_at).getDay()];
      dayData[day] += s.time_spent || 0;
    });
    return Object.entries(dayData).map(([day, minutes]) => ({ day, minutes }));
  };

  // Weekly test accuracy trend
  const getAccuracyTrend = () => {
    return weeklyTests.map((test, i) => ({
      week: `W${i + 1}`,
      accuracy: test.accuracy_percentage,
      correct: test.correct_count,
      wrong: test.wrong_count,
      label: new Date(test.week_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    }));
  };

  // Skill radar from weekly test data
  const getSkillRadar = () => {
    const stats = getStudyStats();
    const latestWPS = getLatestWPS();
    return [
      { skill: "WPS Score", value: latestWPS, fullMark: 100 },
      { skill: "Consistency", value: stats.consistency, fullMark: 100 },
      { skill: "Test Accuracy", value: stats.avgAccuracy, fullMark: 100 },
      { skill: "Engagement", value: Math.min(100, (stats.totalMinutes / 60) * 2), fullMark: 100 },
      { skill: "Streak", value: Math.min(100, stats.streak * 14), fullMark: 100 },
    ];
  };

  // Grade based on WPS
  const calculateGrade = () => {
    const wps = getLatestWPS();
    if (wps >= 85) return { grade: "A+", color: "#22c55e", label: "Excellent" };
    if (wps >= 75) return { grade: "A", color: "#22c55e", label: "Very Good" };
    if (wps >= 65) return { grade: "B+", color: "#3b82f6", label: "Good" };
    if (wps >= 55) return { grade: "B", color: "#3b82f6", label: "Above Average" };
    if (wps >= 45) return { grade: "C", color: "#f59e0b", label: "Average" };
    return { grade: "D", color: "#ef4444", label: "Needs Improvement" };
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPos = 15;
      const margin = 15;
      const stats = getStudyStats();
      const gradeInfo = calculateGrade();
      const wps = getLatestWPS();

      // Header
      pdf.setFillColor(59, 130, 246);
      pdf.rect(0, 0, pageWidth, 30, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("Gyanam AI - Progress Report", margin, 15);
      pdf.setFontSize(10);
      pdf.text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, margin, 24);

      yPos = 40;
      pdf.setTextColor(0, 0, 0);

      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text(studentName, margin, yPos);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Class: ${studentClass} | Grade: ${gradeInfo.grade} (${gradeInfo.label}) | WPS: ${wps}%`, margin, yPos + 7);
      yPos += 20;

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("Weekly Performance Score (WPS)", margin, yPos);
      yPos += 8;
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");

      const statsText = [
        `WPS Score: ${wps}%`,
        `Total Weekly Tests: ${stats.totalTests}`,
        `Average Test Accuracy: ${stats.avgAccuracy}%`,
        `Total Study Sessions: ${stats.totalSessions}`,
        `Total Study Time: ${Math.floor(stats.totalMinutes / 60)}h ${stats.totalMinutes % 60}m`,
        `Consistency (30 days): ${stats.consistency}%`,
        `Current Streak: ${stats.streak} days`,
      ];
      statsText.forEach(text => {
        pdf.text(`• ${text}`, margin + 5, yPos);
        yPos += 6;
      });

      // Weak/Strong
      const weakSubs = getWeakSubjects();
      const strongSubs = getStrongSubjects();
      if (strongSubs.length > 0) {
        yPos += 4;
        pdf.setFont("helvetica", "bold");
        pdf.text("Strong Subjects:", margin, yPos);
        yPos += 6;
        pdf.setFont("helvetica", "normal");
        strongSubs.forEach(([sub]) => { pdf.text(`  ✓ ${sub}`, margin + 5, yPos); yPos += 5; });
      }
      if (weakSubs.length > 0) {
        yPos += 4;
        pdf.setFont("helvetica", "bold");
        pdf.text("Weak Subjects (Need Focus):", margin, yPos);
        yPos += 6;
        pdf.setFont("helvetica", "normal");
        weakSubs.forEach(([sub]) => { pdf.text(`  ⚠ ${sub}`, margin + 5, yPos); yPos += 5; });
      }

      // Footer
      pdf.setFillColor(59, 130, 246);
      pdf.rect(0, pageHeight - 12, pageWidth, 12, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      pdf.text("Gyanam AI - Your Personal Gyanam AI", pageWidth / 2, pageHeight - 5, { align: "center" });

      pdf.save(`${studentName.replace(/\s+/g, "_")}_Progress_${new Date().toISOString().split("T")[0]}.pdf`);
      toast({ title: "PDF Downloaded!", description: "Your progress report has been saved." });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: t("progress.downloadFailedTitle"), description: t("progress.downloadFailedDesc"), variant: "destructive" });
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading || isLoading) return <ProgressSkeleton />;

  const wpsTrend = getWPSTrendData();
  const subjectData = getSubjectPerformance();
  const patternData = getStudyPatterns();
  const weakSubs = getWeakSubjects();
  const strongSubs = getStrongSubjects();
  const stats = getStudyStats();
  const skillRadarData = getSkillRadar();
  const accuracyTrend = getAccuracyTrend();
  const gradeInfo = calculateGrade();
  const latestWPS = getLatestWPS();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 pb-16 sm:pb-0">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="hover:bg-primary/10">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-xl">{t("progress.title")}</h1>
                  <p className="text-sm text-muted-foreground">{studentName} • {studentClass}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <LanguageToggle />
              <div className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-xl bg-gradient-to-r from-muted/50 to-muted/30 border border-border/50">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md" style={{ backgroundColor: gradeInfo.color }}>
                  {gradeInfo.grade}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("progress.overallGrade")}</p>
                  <p className="font-semibold text-sm">{gradeInfo.label}</p>
                </div>
              </div>
              <Button variant="default" size="sm" onClick={handleDownloadPdf} disabled={downloadingPdf} className="bg-gradient-to-r from-primary to-primary/80">
                {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4 mr-2" />{t("progress.downloadPdf")}</>}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Mobile Grade Badge */}
        <div className="sm:hidden mb-6 flex justify-center">
          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-card border border-border shadow-sm">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg" style={{ backgroundColor: gradeInfo.color }}>
              {gradeInfo.grade}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("progress.overallGrade")}</p>
              <p className="font-bold text-lg">{gradeInfo.label}</p>
            </div>
          </div>
        </div>

        {/* WPS Hero Card */}
        <div className="edu-card p-6 mb-8 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/5 border-primary/20">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-32 h-32 rounded-full border-4 border-primary flex items-center justify-center flex-shrink-0">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{latestWPS}%</p>
                <p className="text-xs text-muted-foreground">WPS Score</p>
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-xl font-bold mb-2">Weekly Performance Score</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Your overall study performance based on test accuracy, improvement, and consistency.
              </p>
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                  {stats.totalTests} Weekly Tests
                </span>
                <span className="px-3 py-1 bg-accent/10 text-accent rounded-full text-xs font-medium">
                  {stats.avgAccuracy}% Avg Accuracy
                </span>
                <span className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs font-medium">
                  {stats.streak} Day Streak
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <StatCard icon={<Zap className="w-5 h-5" />} label="WPS Score" value={`${latestWPS}%`} color="primary" highlight={latestWPS >= 75} />
          <StatCard icon={<ClipboardList className="w-5 h-5" />} label="Weekly Tests" value={stats.totalTests.toString()} color="accent" />
          <StatCard icon={<Target className="w-5 h-5" />} label="Test Accuracy" value={`${stats.avgAccuracy}%`} color="primary" />
          <StatCard icon={<Calendar className="w-5 h-5" />} label="Study Sessions" value={stats.totalSessions.toString()} color="accent" />
          <StatCard icon={<Clock className="w-5 h-5" />} label="Study Time" value={`${Math.floor(stats.totalMinutes / 60)}h ${stats.totalMinutes % 60}m`} color="primary" />
          <StatCard icon={<Flame className="w-5 h-5" />} label="Streak" value={`${stats.streak} days`} color="accent" highlight={stats.streak >= 3} />
        </div>

        {/* Charts Row 1 */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* WPS Trend */}
          <div className="edu-card p-6 lg:col-span-2">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              WPS Trend (Weekly)
            </h3>
            {wpsTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={wpsTrend}>
                  <defs>
                    <linearGradient id="wpsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[0, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Area type="monotone" dataKey="wps" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#wpsGradient)" name="WPS" />
                  <Line type="monotone" dataKey="accuracy" stroke="hsl(var(--accent))" strokeWidth={2} strokeDasharray="5 5" name="Accuracy" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Take your first weekly test to see progress!</p>
                </div>
              </div>
            )}
          </div>

          {/* Skill Radar */}
          <div className="edu-card p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-primary" />
              {t("progress.skillAssessment")}
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={skillRadarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                <Radar name="Skills" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Subject Performance */}
          <div className="edu-card p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Subject Performance (Tests)
            </h3>
            {subjectData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={subjectData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} domain={[0, 100]} />
                  <YAxis dataKey="subject" type="category" stroke="hsl(var(--muted-foreground))" fontSize={10} width={80} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Bar dataKey="score" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} name="Strong %" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">No test data yet</div>
            )}
          </div>

          {/* Weekly Test Accuracy */}
          <div className="edu-card p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Test Accuracy Trend
            </h3>
            {accuracyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={accuracyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Legend />
                  <Bar dataKey="correct" fill="hsl(var(--accent))" name="Correct" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="wrong" fill="hsl(var(--destructive))" name="Wrong" radius={[4, 4, 0, 0]} stackId="a" />
                  <Line type="monotone" dataKey="accuracy" stroke="hsl(var(--primary))" strokeWidth={2} name="Accuracy %" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">No test data yet</div>
            )}
          </div>

          {/* Study Patterns */}
          <div className="edu-card p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              {t("progress.weeklyStudyPattern")}
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={patternData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} formatter={(value: number) => [`${value} min`, 'Study Time']} />
                <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Strong & Weak Areas */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="edu-card p-6">
            <h3 className="font-bold text-lg mb-4 text-accent flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Strong Subjects
            </h3>
            {strongSubs.length > 0 ? (
              <div className="space-y-3">
                {strongSubs.map(([sub, count], i) => (
                  <div key={sub} className="flex items-center justify-between p-3 bg-accent/10 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm">{i + 1}</div>
                      <span className="font-medium">{sub}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{count} tests</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Take weekly tests to see your strengths!</p>
            )}
          </div>

          <div className="edu-card p-6">
            <h3 className="font-bold text-lg mb-4 text-destructive flex items-center gap-2">
              <Target className="w-5 h-5" />
              Weak Subjects (Focus Here)
            </h3>
            {weakSubs.length > 0 ? (
              <div className="space-y-3">
                {weakSubs.map(([sub, count], i) => (
                  <div key={sub} className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center text-destructive font-bold text-sm">{i + 1}</div>
                      <span className="font-medium">{sub}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{count} tests</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No weak subjects identified yet!</p>
            )}
          </div>
        </div>

        {/* Weekly Test History */}
        {weeklyTests.length > 0 && (
          <div className="edu-card p-6 mb-8">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              Weekly Test History
            </h3>
            <div className="space-y-3">
              {[...weeklyTests].reverse().slice(0, 8).map((test, idx) => {
                const testIdx = weeklyTests.length - 1 - idx;
                const wps = calculateWPS(testIdx);
                const acc = test.accuracy_percentage;
                return (
                  <div key={test.id} className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl">
                    <div>
                      <p className="font-semibold text-sm">
                        {new Date(test.week_start).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} - {new Date(test.week_end).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {test.correct_count}/{test.total_questions} correct • {test.subjects_tested.length} subjects • {Math.floor(test.time_taken_seconds / 60)}m
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Accuracy</p>
                        <p className={`font-bold text-sm ${acc >= 70 ? "text-accent" : acc >= 50 ? "text-yellow-500" : "text-destructive"}`}>{acc}%</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">WPS</p>
                        <p className={`font-bold text-sm ${wps >= 70 ? "text-primary" : wps >= 50 ? "text-yellow-500" : "text-destructive"}`}>{wps}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI Feedback */}
        <div className="edu-card p-6 bg-gradient-to-br from-primary/5 via-accent/5 to-background border border-primary/20">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            AI Gyanam AI Feedback
          </h3>
          <div className="space-y-3">
            {(() => {
              const feedback: string[] = [];
              const grade = calculateGrade();
              
              if (weeklyTests.length === 0) {
                feedback.push("You haven't taken any weekly tests yet! Study throughout the week and take the weekly test - that's when real progress shows!");
              } else {
                if (grade.grade === "A+" || grade.grade === "A") {
                  feedback.push(`WPS Score ${latestWPS}% - Excellent! You're a top performer! Stay consistent!`);
                } else if (grade.grade === "B+" || grade.grade === "B") {
                  feedback.push(`WPS Score ${latestWPS}% - Good progress! Focus on weak subjects to reach A grade!`);
                } else {
                  feedback.push(`WPS Score ${latestWPS}% - Improvement needed. Study daily, revise weak topics, and your next test will be better!`);
                }
              }

              if (stats.streak >= 7) {
                feedback.push("7+ day streak - Champion level consistency! Keep it up!");
              } else if (stats.streak >= 3) {
                feedback.push(`${stats.streak}-day streak - Great going! Push to 7 days for a WPS boost!`);
              } else {
                feedback.push("Start studying daily! Consistency improves your WPS score!");
              }

              if (weakSubs.length > 0) {
                feedback.push(`Focus extra on '${weakSubs[0][0]}' - it was weak in ${weakSubs[0][1]} tests. Study with Gyanam AI and ace the next test!`);
              }

              if (strongSubs.length > 0) {
                feedback.push(`You're excellent in '${strongSubs[0][0]}'! Use this confidence to master related topics too!`);
              }

              if (weeklyTests.length >= 2) {
                const lastWPS = calculateWPS(weeklyTests.length - 1);
                const prevWPS = calculateWPS(weeklyTests.length - 2);
                if (lastWPS > prevWPS) {
                  feedback.push(`📈 WPS ${prevWPS}% → ${lastWPS}% - Improvement showing! Great work!`);
                } else if (lastWPS < prevWPS) {
                  feedback.push(`📉 WPS ${prevWPS}% → ${lastWPS}% - Slight decline. More practice and revision needed!`);
                }
              }

              return feedback.slice(0, 5).map((fb, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-background/70 rounded-xl border border-border/50">
                  <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">{i + 1}</span>
                  </div>
                  <p className="text-sm leading-relaxed">{fb}</p>
                </div>
              ));
            })()}
          </div>
        </div>
      </main>
      <BottomNavBar />
    </div>
  );
};

const StatCard = ({
  icon, label, value, color, highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "primary" | "accent";
  highlight?: boolean;
}) => {
  const colorClasses = {
    primary: "bg-gradient-to-br from-primary/15 to-primary/5 text-primary",
    accent: "bg-gradient-to-br from-accent/15 to-accent/5 text-accent",
  };

  return (
    <div className={`edu-card p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${highlight ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : ""}`}>
      <div className={`w-10 h-10 rounded-xl ${colorClasses[color]} flex items-center justify-center mb-3 shadow-sm`}>
        {icon}
      </div>
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
};

export default StudentProgress;
