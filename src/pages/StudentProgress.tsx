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
  Minus,
  BookOpen,
  Target,
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

interface TopicMastery {
  id: string;
  subject: string;
  topic: string;
  mastery_score: number;
  attempt_count: number;
  last_practiced: string;
  trend: string;
}

interface ActivityItem {
  id: string;
  type: "session" | "test" | "quiz";
  title: string;
  detail: string;
  score?: number;
  date: string;
}

const StudentProgress = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const [weeklyTests, setWeeklyTests] = useState<WeeklyTestRecord[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [topicMastery, setTopicMastery] = useState<TopicMastery[]>([]);
  const [studentName, setStudentName] = useState("Student");
  const [studentClass, setStudentClass] = useState("");
  const [studentId, setStudentId] = useState<string | null>(null);
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
        setStudentId(student.id);

        // Fetch all data in parallel
        const [testsRes, sessionsRes, masteryRes] = await Promise.all([
          supabase
            .from("weekly_tests")
            .select("*")
            .eq("student_id", student.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("study_sessions")
            .select("id, topic, subject, time_spent, understanding_level, weak_areas, strong_areas, created_at")
            .eq("student_id", student.id)
            .not("time_spent", "eq", 0)
            .order("created_at", { ascending: true }),
          supabase
            .from("topic_mastery")
            .select("id, subject, topic, mastery_score, attempt_count, last_practiced, trend")
            .eq("student_id", student.id)
            .order("mastery_score", { ascending: true }),
        ]);

        if (testsRes.data) setWeeklyTests(testsRes.data);
        if (sessionsRes.data) setSessions(sessionsRes.data);
        if (masteryRes.data) setTopicMastery(masteryRes.data as TopicMastery[]);
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
    const weekSessions = sessions.filter(s => { const d = new Date(s.created_at); return d >= weekStart && d <= weekEnd; });
    const uniqueDays = new Set(weekSessions.map(s => new Date(s.created_at).toDateString())).size;
    const consistency = (uniqueDays / 7) * 100;
    return Math.round((accuracy * 0.5) + (improvement * 0.25) + (weakReduction * 0.15) + (consistency * 0.10));
  };

  const getLatestWPS = () => weeklyTests.length === 0 ? 0 : calculateWPS(weeklyTests.length - 1);

  const getWPSTrendData = () => weeklyTests.map((test, i) => ({
    week: `W${i + 1}`,
    wps: calculateWPS(i),
    accuracy: test.accuracy_percentage,
    label: new Date(test.week_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
  }));

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
    const avgAccuracy = totalTests > 0 ? Math.round(weeklyTests.reduce((acc, t) => acc + t.accuracy_percentage, 0) / totalTests) : 0;
    return { totalSessions, totalMinutes, streak, totalTests, avgAccuracy };
  };

  const getStudyPatterns = () => {
    const dayData: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    sessions.forEach(s => { const day = days[new Date(s.created_at).getDay()]; dayData[day] += s.time_spent || 0; });
    return Object.entries(dayData).map(([day, minutes]) => ({ day, minutes }));
  };

  // ===== Topic Mastery Helpers =====
  const weakTopics = topicMastery.filter(t => t.mastery_score < 50).slice(0, 5);
  const strongTopics = topicMastery.filter(t => t.mastery_score >= 70);

  // ===== Activity Timeline =====
  const getActivityTimeline = (): ActivityItem[] => {
    const items: ActivityItem[] = [];
    
    sessions.slice(-10).forEach(s => {
      items.push({
        id: s.id,
        type: "session",
        title: s.topic || "Study Session",
        detail: `${s.time_spent || 0}min · ${s.understanding_level || "N/A"}`,
        date: s.created_at,
      });
    });

    weeklyTests.slice(-5).forEach(t => {
      items.push({
        id: t.id,
        type: "test",
        title: `Weekly Test`,
        detail: `${t.correct_count}/${t.total_questions} correct`,
        score: t.accuracy_percentage,
        date: t.created_at,
      });
    });

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
  };

  const getMasteryColor = (score: number) => {
    if (score >= 70) return "bg-green-500";
    if (score >= 40) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getMasteryTextColor = (score: number) => {
    if (score >= 70) return "text-green-600 dark:text-green-400";
    if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
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

      // Stats
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("Key Metrics", margin, yPos);
      yPos += 8;
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      const statsText = [
        `WPS Score: ${wps}%`,
        `Average Accuracy: ${stats.avgAccuracy}%`,
        `Total Study Time: ${Math.floor(stats.totalMinutes / 60)}h ${stats.totalMinutes % 60}m`,
        `Current Streak: ${stats.streak} days`,
        `Total Sessions: ${stats.totalSessions}`,
      ];
      statsText.forEach(text => { pdf.text(`• ${text}`, margin + 5, yPos); yPos += 6; });

      // Topic mastery
      if (topicMastery.length > 0) {
        yPos += 4;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.text("Topic Mastery", margin, yPos);
        yPos += 8;
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        
        const weakTopicsPdf = topicMastery.filter(t => t.mastery_score < 50).slice(0, 5);
        const strongTopicsPdf = topicMastery.filter(t => t.mastery_score >= 70).slice(0, 5);
        
        if (weakTopicsPdf.length > 0) {
          pdf.setFont("helvetica", "bold");
          pdf.text("Weak Topics (Need Practice):", margin + 5, yPos);
          yPos += 6;
          pdf.setFont("helvetica", "normal");
          weakTopicsPdf.forEach(t => {
            pdf.text(`  ⚠ ${t.topic} (${t.subject}) — ${t.mastery_score}%`, margin + 5, yPos);
            yPos += 5;
          });
        }
        if (strongTopicsPdf.length > 0) {
          yPos += 2;
          pdf.setFont("helvetica", "bold");
          pdf.text("Strong Topics:", margin + 5, yPos);
          yPos += 6;
          pdf.setFont("helvetica", "normal");
          strongTopicsPdf.forEach(t => {
            pdf.text(`  ✓ ${t.topic} (${t.subject}) — ${t.mastery_score}%`, margin + 5, yPos);
            yPos += 5;
          });
        }
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
      toast({ title: "Download Failed", description: "Could not generate PDF.", variant: "destructive" });
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading || isLoading) return <ProgressSkeleton />;

  const wpsTrend = getWPSTrendData();
  const patternData = getStudyPatterns();
  const stats = getStudyStats();
  const latestWPS = getLatestWPS();
  const activityTimeline = getActivityTimeline();

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
      {/* Header */}
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
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="WPS Score" value={`${latestWPS}%`} trend={wpsDelta} />
          <MetricCard label="Avg Accuracy" value={`${stats.avgAccuracy}%`} />
          <MetricCard label="Study Time" value={`${Math.floor(stats.totalMinutes / 60)}h ${stats.totalMinutes % 60}m`} />
          <MetricCard label="Streak" value={`${stats.streak} days`} />
        </div>

        {/* Topic Mastery Map */}
        {topicMastery.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">Topic Mastery</h3>
              <span className="text-xs text-muted-foreground">{topicMastery.length} topics tracked</span>
            </div>
            <div className="space-y-3">
              {topicMastery.slice(0, 12).map((tm) => (
                <div key={tm.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium truncate">{tm.topic}</span>
                      {tm.trend === "improving" && <TrendingUp className="w-3 h-3 text-green-500 shrink-0" />}
                      {tm.trend === "declining" && <TrendingDown className="w-3 h-3 text-red-500 shrink-0" />}
                      {tm.trend === "stable" && <Minus className="w-3 h-3 text-muted-foreground shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${getMasteryColor(tm.mastery_score)}`}
                          style={{ width: `${tm.mastery_score}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold tabular-nums w-8 text-right ${getMasteryTextColor(tm.mastery_score)}`}>
                        {tm.mastery_score}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tm.subject} · {tm.attempt_count} attempts
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Weak Topics Action Card */}
        {weakTopics.length > 0 && (
          <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-destructive" />
              <h3 className="text-sm font-medium">Focus Areas — Practice These</h3>
            </div>
            <div className="space-y-2.5">
              {weakTopics.map((tm) => (
                <div key={tm.id} className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tm.topic}</p>
                    <p className="text-xs text-muted-foreground">
                      {tm.subject} · {tm.mastery_score}% mastery · {tm.attempt_count} attempts
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs shrink-0"
                    onClick={() => navigate(`/study?topic=${encodeURIComponent(tm.topic)}`)}
                  >
                    <BookOpen className="w-3 h-3 mr-1" /> Study
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* WPS + Accuracy Trend */}
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

        {/* Study Pattern */}
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

        {/* Recent Activity Timeline */}
        {activityTimeline.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Recent Activity</h3>
            <div className="space-y-3">
              {activityTimeline.map((item) => (
                <div key={item.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    item.type === "test" ? "bg-primary" : item.type === "quiz" ? "bg-yellow-500" : "bg-muted-foreground"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      {item.score !== undefined && (
                        <span className={`text-xs font-semibold tabular-nums ${
                          item.score >= 70 ? "text-green-600 dark:text-green-400" : item.score >= 50 ? "text-yellow-600" : "text-red-600 dark:text-red-400"
                        }`}>
                          {item.score}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.detail} · {new Date(item.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* AI Insights */}
        <section className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Gyanam AI Insights</h3>
          <ul className="space-y-2">
            {(() => {
              const feedback: string[] = [];

              if (topicMastery.length > 0) {
                const weakest = topicMastery[0];
                if (weakest && weakest.mastery_score < 50) {
                  feedback.push(`"${weakest.topic}" needs attention — ${weakest.mastery_score}% mastery after ${weakest.attempt_count} attempts.`);
                }
                const improving = topicMastery.filter(t => t.trend === "improving");
                if (improving.length > 0) {
                  feedback.push(`${improving.length} topic${improving.length > 1 ? "s" : ""} improving — keep it up!`);
                }
              }

              if (weeklyTests.length === 0 && sessions.length === 0) {
                feedback.push("Start studying to unlock personalized insights.");
              } else {
                if (stats.streak >= 7) {
                  feedback.push(`${stats.streak}-day streak. Outstanding consistency!`);
                } else if (stats.streak >= 3) {
                  feedback.push(`${stats.streak}-day streak. Push to 7 days for better results.`);
                } else if (stats.streak === 0) {
                  feedback.push("Start a daily study habit for consistent improvement.");
                }

                if (latestWPS > 0) {
                  if (latestWPS >= 75) feedback.push(`WPS ${latestWPS}% — Excellent performance.`);
                  else if (latestWPS >= 50) feedback.push(`WPS ${latestWPS}% — Good. Focus on weak topics to reach 75+.`);
                  else feedback.push(`WPS ${latestWPS}% — Study weak areas daily to improve.`);
                }
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

// ===== Metric Card =====
const MetricCard = ({ label, value, trend }: { label: string; value: string; trend?: number }) => (
  <div className="rounded-lg border border-border bg-card p-4">
    <p className="text-xs text-muted-foreground mb-1">{label}</p>
    <div className="flex items-baseline gap-1.5">
      <span className="text-2xl font-semibold tracking-tight">{value}</span>
      {trend !== undefined && trend !== 0 && (
        <span className={`flex items-center text-xs font-medium ${trend > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
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
