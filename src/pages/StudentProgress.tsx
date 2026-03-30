import { useState, useEffect } from "react";
import BottomNavBar from "@/components/BottomNavBar";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Download,
  Loader2,
  ClipboardList,
  Minus,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";
import jsPDF from "jspdf";
import { ProgressSkeleton } from "@/components/DashboardSkeleton";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  Line,
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

        const { data: testsData } = await supabase
          .from("weekly_tests")
          .select("*")
          .eq("student_id", student.id)
          .order("created_at", { ascending: true });

        if (testsData) setWeeklyTests(testsData);

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

    const prevTest = testIndex > 0 ? weeklyTests[testIndex - 1] : null;
    const improvement = prevTest ? Math.max(0, accuracy - prevTest.accuracy_percentage) : 0;

    const currentWeak = (test.weak_subjects || []).length;
    const prevWeak = prevTest ? (prevTest.weak_subjects || []).length : currentWeak;
    const weakReduction = prevWeak > 0 ? Math.max(0, ((prevWeak - currentWeak) / prevWeak) * 100) : (currentWeak === 0 ? 100 : 0);

    const weekStart = new Date(test.week_start);
    const weekEnd = new Date(test.week_end);
    const weekSessions = sessions.filter(s => {
      const d = new Date(s.created_at);
      return d >= weekStart && d <= weekEnd;
    });
    const uniqueDays = new Set(weekSessions.map(s => new Date(s.created_at).toDateString())).size;
    const consistency = (uniqueDays / 7) * 100;

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

  const getWPSTrendData = () => {
    return weeklyTests.map((test, i) => ({
      week: `W${i + 1}`,
      wps: calculateWPS(i),
      accuracy: test.accuracy_percentage,
      label: new Date(test.week_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    }));
  };

  const getSubjectPerformance = () => {
    const subjectStats: Record<string, { strong: number; weak: number; neutral: number; tests: number }> = {};
    weeklyTests.forEach(test => {
      (test.subjects_tested || []).forEach(sub => {
        if (!subjectStats[sub]) subjectStats[sub] = { strong: 0, weak: 0, neutral: 0, tests: 0 };
        subjectStats[sub].tests++;
        if ((test.strong_subjects || []).includes(sub)) subjectStats[sub].strong++;
        else if ((test.weak_subjects || []).includes(sub)) subjectStats[sub].weak++;
        else subjectStats[sub].neutral++;
      });
    });

    return Object.entries(subjectStats)
      .map(([subject, data]) => {
        const totalClassified = data.strong + data.weak + data.neutral;
        const score = totalClassified > 0
          ? Math.round(((data.strong * 100) + (data.neutral * 50)) / totalClassified)
          : 0;
        return { subject: subject.length > 14 ? subject.slice(0, 14) + "…" : subject, score, tests: data.tests };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  };

  const getWeakSubjects = () => {
    const weakCount: Record<string, number> = {};
    weeklyTests.forEach(test => {
      (test.weak_subjects || []).forEach(sub => { weakCount[sub] = (weakCount[sub] || 0) + 1; });
    });
    return Object.entries(weakCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  };

  const getStrongSubjects = () => {
    const strongCount: Record<string, number> = {};
    weeklyTests.forEach(test => {
      (test.strong_subjects || []).forEach(sub => { strongCount[sub] = (strongCount[sub] || 0) + 1; });
    });
    return Object.entries(strongCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  };

  const getStudyStats = () => {
    const totalSessions = sessions.length;
    const totalMinutes = sessions.reduce((acc, s) => acc + (s.time_spent || 0), 0);

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

    return { totalSessions, totalMinutes, streak, totalTests, avgAccuracy };
  };

  const getStudyPatterns = () => {
    const dayData: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    sessions.forEach(s => {
      const day = days[new Date(s.created_at).getDay()];
      dayData[day] += s.time_spent || 0;
    });
    return Object.entries(dayData).map(([day, minutes]) => ({ day, minutes }));
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
      const wps = getLatestWPS();

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
      pdf.text(`Class: ${studentClass} | WPS: ${wps}%`, margin, yPos + 7);
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
        `Current Streak: ${stats.streak} days`,
      ];
      statsText.forEach(text => { pdf.text(`• ${text}`, margin + 5, yPos); yPos += 6; });

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

      pdf.setFillColor(59, 130, 246);
      pdf.rect(0, pageHeight - 12, pageWidth, 12, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      pdf.text("Gyanam AI - Your Study Companion", pageWidth / 2, pageHeight - 5, { align: "center" });

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
  const latestWPS = getLatestWPS();

  // WPS trend direction
  const wpsDelta = weeklyTests.length >= 2
    ? calculateWPS(weeklyTests.length - 1) - calculateWPS(weeklyTests.length - 2)
    : 0;

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "12px",
  };

  return (
    <div className="min-h-screen bg-background pb-16 sm:pb-0">
      {/* Clean Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="h-9 w-9">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="font-semibold text-lg leading-tight">{t("progress.title")}</h1>
                <p className="text-xs text-muted-foreground">{studentName} · Class {studentClass}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={downloadingPdf} className="h-8 text-xs">
                {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Download className="w-3.5 h-3.5 mr-1.5" />PDF</>}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="WPS Score"
            value={`${latestWPS}%`}
            trend={wpsDelta}
          />
          <MetricCard
            label="Avg Accuracy"
            value={`${stats.avgAccuracy}%`}
          />
          <MetricCard
            label="Study Time"
            value={`${Math.floor(stats.totalMinutes / 60)}h ${stats.totalMinutes % 60}m`}
          />
          <MetricCard
            label="Streak"
            value={`${stats.streak} days`}
          />
        </div>

        {/* WPS + Accuracy Trend — full width area chart */}
        <section className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">WPS & Accuracy Trend</h3>
          {wpsTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={wpsTrend}>
                <defs>
                  <linearGradient id="wpsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="wps" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#wpsGrad)" name="WPS" />
                <Line type="monotone" dataKey="accuracy" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Accuracy" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState text="Take your first weekly test to see trends" />
          )}
        </section>

        {/* Two charts side by side */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Subject Performance — horizontal bar */}
          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Subject Performance</h3>
            {subjectData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={subjectData} layout="vertical" margin={{ left: 0 }}>
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <YAxis dataKey="subject" type="category" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={90} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="score" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Score" barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="No subject data yet" />
            )}
          </section>

          {/* Weekly Study Pattern */}
          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">{t("progress.weeklyStudyPattern")}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={patternData}>
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value} min`, 'Study Time']} />
                <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </div>

        {/* Subject Health */}
        {(strongSubs.length > 0 || weakSubs.length > 0) && (
          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Subject Health</h3>
            <div className="space-y-2">
              {strongSubs.map(([sub, count]) => (
                <div key={sub} className="flex items-center gap-3 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                  <span className="text-sm flex-1">{sub}</span>
                  <span className="text-xs text-muted-foreground">{count} tests</span>
                </div>
              ))}
              {weakSubs.map(([sub, count]) => (
                <div key={sub} className="flex items-center gap-3 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-destructive shrink-0" />
                  <span className="text-sm flex-1">{sub}</span>
                  <span className="text-xs text-muted-foreground">{count} tests</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Test History */}
        {weeklyTests.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Test History</h3>
            <div className="space-y-2">
              {[...weeklyTests].reverse().slice(0, 6).map((test) => (
                <div key={test.id} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium">
                      {new Date(test.week_start).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – {new Date(test.week_end).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {test.correct_count}/{test.total_questions} correct · {Math.floor(test.time_taken_seconds / 60)}m
                    </p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${test.accuracy_percentage >= 70 ? "text-accent" : test.accuracy_percentage >= 50 ? "text-muted-foreground" : "text-destructive"}`}>
                    {test.accuracy_percentage}%
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* AI Feedback — clean, max 3 items */}
        <section className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Gyanam AI Insights</h3>
          <ul className="space-y-2">
            {(() => {
              const feedback: string[] = [];

              if (weeklyTests.length === 0) {
                feedback.push("Take your first weekly test to unlock personalized insights.");
              } else {
                if (latestWPS >= 75) {
                  feedback.push(`WPS ${latestWPS}% — Excellent performance. Stay consistent.`);
                } else if (latestWPS >= 50) {
                  feedback.push(`WPS ${latestWPS}% — Good progress. Focus on weak subjects to reach 75+.`);
                } else {
                  feedback.push(`WPS ${latestWPS}% — Study daily and revise weak topics for improvement.`);
                }
              }

              if (stats.streak >= 7) {
                feedback.push(`${stats.streak}-day streak. Outstanding consistency.`);
              } else if (stats.streak >= 3) {
                feedback.push(`${stats.streak}-day streak. Push to 7 days for a WPS boost.`);
              } else {
                feedback.push("Start a daily study habit to improve your WPS score.");
              }

              if (weakSubs.length > 0) {
                feedback.push(`Focus on "${weakSubs[0][0]}" — weak in ${weakSubs[0][1]} tests.`);
              }

              return feedback.slice(0, 3).map((fb, i) => (
                <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground mt-2 shrink-0" />
                  {fb}
                </li>
              ));
            })()}
          </ul>
        </section>
      </main>
      <BottomNavBar />
    </div>
  );
};

// ===== Minimal Metric Card =====
const MetricCard = ({ label, value, trend }: { label: string; value: string; trend?: number }) => (
  <div className="rounded-lg border border-border bg-card p-4">
    <p className="text-xs text-muted-foreground mb-1">{label}</p>
    <div className="flex items-baseline gap-1.5">
      <span className="text-2xl font-semibold tracking-tight">{value}</span>
      {trend !== undefined && trend !== 0 && (
        <span className={`flex items-center text-xs font-medium ${trend > 0 ? "text-accent" : "text-destructive"}`}>
          {trend > 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
          {Math.abs(trend)}
        </span>
      )}
    </div>
  </div>
);

// ===== Empty State =====
const EmptyState = ({ text }: { text: string }) => (
  <div className="h-[220px] flex items-center justify-center">
    <p className="text-sm text-muted-foreground">{text}</p>
  </div>
);

export default StudentProgress;
