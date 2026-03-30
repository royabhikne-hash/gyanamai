import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Clock, BookOpen, Brain, TrendingUp, TrendingDown, Minus, 
  Trophy, AlertCircle, Loader2, BarChart3, Target
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ParentChatbot from "@/components/ParentChatbot";

interface TopicMasteryItem {
  subject: string;
  topic: string;
  score: number;
  attempts: number;
  trend: string;
  lastPracticed: string;
}

interface ParentData {
  student: {
    name: string;
    class: string;
    board: string;
    school: string;
    district: string;
  };
  stats: {
    weeklyStudyMinutes: number;
    monthlyStudyMinutes: number;
    subjectsStudied: string[];
    totalMcqsAttempted: number;
    avgMcqAccuracy: number;
    weeklyTestScores: { accuracy: number; date: string; subjects: string[] }[];
    strongSubjects: string[];
    weakSubjects: string[];
    daysActiveThisWeek: number;
    progressTrend: "up" | "down" | "stable";
    topicMastery?: TopicMasteryItem[];
  };
}

const ParentDashboard = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [data, setData] = useState<ParentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Invalid link. Please ask your child to share the correct link.");
      setLoading(false);
      return;
    }
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const { data: result, error: err } = await supabase.functions.invoke("parent-dashboard", {
        body: { token },
      });

      if (err || result?.error) {
        setError(result?.error || "Failed to load data. The link may be invalid or expired.");
        return;
      }

      setData(result);
    } catch {
      setError("Something went wrong. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const formatMinutes = (m: number) => {
    const h = Math.floor(m / 60);
    const mins = m % 60;
    return h > 0 ? `${h}h ${mins}m` : `${mins}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 max-w-md text-center space-y-4">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto" />
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { student, stats } = data;
  const topicMastery = stats.topicMastery || [];
  const weakTopics = topicMastery.filter(t => t.score < 50).slice(0, 5);
  const strongTopics = topicMastery.filter(t => t.score >= 70).slice(0, 5);

  const TrendIcon = stats.progressTrend === "up" ? TrendingUp : stats.progressTrend === "down" ? TrendingDown : Minus;
  const trendColor = stats.progressTrend === "up" ? "text-green-600 dark:text-green-400" : stats.progressTrend === "down" ? "text-red-600 dark:text-red-400" : "text-muted-foreground";

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div>
            <h1 className="font-semibold text-lg">Parent Dashboard</h1>
            <p className="text-xs text-muted-foreground">{student.name} · Class {student.class} · {student.board}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard icon={<Clock className="w-4 h-4" />} label="Weekly Study" value={formatMinutes(stats.weeklyStudyMinutes)} />
          <MetricCard icon={<Clock className="w-4 h-4" />} label="Monthly Study" value={formatMinutes(stats.monthlyStudyMinutes)} />
          <MetricCard icon={<Brain className="w-4 h-4" />} label="MCQs Attempted" value={`${stats.totalMcqsAttempted}`} />
          <MetricCard icon={<BarChart3 className="w-4 h-4" />} label="Avg Accuracy" value={`${stats.avgMcqAccuracy}%`} />
        </div>

        {/* Consistency & Trend */}
        <section className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Consistency & Progress</h3>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-muted-foreground">Days Active This Week</p>
              <p className="text-2xl font-semibold">{stats.daysActiveThisWeek}/7</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Trend</p>
              <div className={`flex items-center gap-1 justify-end ${trendColor}`}>
                <TrendIcon className="w-4 h-4" />
                <span className="font-semibold text-sm capitalize">{stats.progressTrend}</span>
              </div>
            </div>
          </div>
          <Progress value={(stats.daysActiveThisWeek / 7) * 100} className="h-2" />
        </section>

        {/* Topic Mastery Map */}
        {topicMastery.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">Topic Mastery</h3>
              <span className="text-xs text-muted-foreground">{topicMastery.length} topics</span>
            </div>
            <div className="space-y-3">
              {topicMastery.slice(0, 10).map((tm, i) => (
                <div key={i} className="flex items-center gap-3">
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
                          className={`h-full rounded-full transition-all ${getMasteryColor(tm.score)}`}
                          style={{ width: `${tm.score}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold tabular-nums w-8 text-right ${getMasteryTextColor(tm.score)}`}>
                        {tm.score}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{tm.subject} · {tm.attempts} attempts</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Weak Topics Alert */}
        {weakTopics.length > 0 && (
          <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-destructive" />
              <h3 className="text-sm font-medium">Topics Needing Attention</h3>
            </div>
            <div className="space-y-2">
              {weakTopics.map((tm, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{tm.topic}</p>
                    <p className="text-xs text-muted-foreground">{tm.subject} · {tm.attempts} attempts</p>
                  </div>
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400">{tm.score}%</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Strong Topics */}
        {strongTopics.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Strong Topics ✓</h3>
            <div className="flex flex-wrap gap-2">
              {strongTopics.map((tm, i) => (
                <span key={i} className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                  {tm.topic} ({tm.score}%)
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Weekly Test Scores */}
        {stats.weeklyTestScores.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Weekly Test History</h3>
            <div className="space-y-2">
              {stats.weeklyTestScores.map((test, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{new Date(test.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                    <p className="text-xs text-muted-foreground">{test.subjects?.join(", ")}</p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${
                    test.accuracy >= 70 ? "text-green-600 dark:text-green-400" : test.accuracy >= 50 ? "text-yellow-600" : "text-red-600 dark:text-red-400"
                  }`}>
                    {test.accuracy}%
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Subjects Studied */}
        {stats.subjectsStudied.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Subjects Studied</h3>
            <div className="flex flex-wrap gap-2">
              {stats.subjectsStudied.map(s => (
                <span key={s} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">{s}</span>
              ))}
            </div>
          </section>
        )}

        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">Gyanam AI · Parent View · Read Only</p>
        </div>
      </main>

      {token && <ParentChatbot token={token} studentName={student.name} />}
    </div>
  );
};

// ===== Metric Card =====
const MetricCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-lg border border-border bg-card p-4">
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-primary">{icon}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
    <p className="text-xl font-semibold">{value}</p>
  </div>
);

export default ParentDashboard;
