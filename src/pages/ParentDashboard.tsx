import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Clock, BookOpen, Brain, TrendingUp, TrendingDown, Minus, 
  Trophy, AlertCircle, CalendarDays, Loader2, BarChart3 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ParentChatbot from "@/components/ParentChatbot";

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
  const TrendIcon = stats.progressTrend === "up" ? TrendingUp : stats.progressTrend === "down" ? TrendingDown : Minus;
  const trendColor = stats.progressTrend === "up" ? "text-green-600" : stats.progressTrend === "down" ? "text-red-600" : "text-muted-foreground";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Gyanam AI" className="w-8 h-8 rounded-xl object-contain" />
            <div>
              <h1 className="font-bold text-lg">Parent Dashboard</h1>
              <p className="text-xs text-muted-foreground">{student.name} · {student.class} · {student.board}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Weekly Study</span>
            </div>
            <p className="text-xl font-bold">{formatMinutes(stats.weeklyStudyMinutes)}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Monthly Study</span>
            </div>
            <p className="text-xl font-bold">{formatMinutes(stats.monthlyStudyMinutes)}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">MCQs Attempted</span>
            </div>
            <p className="text-xl font-bold">{stats.totalMcqsAttempted}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Avg MCQ Accuracy</span>
            </div>
            <p className="text-xl font-bold">{stats.avgMcqAccuracy}%</p>
          </Card>
        </div>

        {/* Consistency & Trend */}
        <Card className="p-5">
          <h3 className="font-bold mb-3">Consistency & Progress</h3>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-muted-foreground">Days Active This Week</p>
              <p className="text-2xl font-bold">{stats.daysActiveThisWeek}/7</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Progress Trend</p>
              <div className={`flex items-center gap-1 justify-end ${trendColor}`}>
                <TrendIcon className="w-5 h-5" />
                <span className="font-bold capitalize">{stats.progressTrend}</span>
              </div>
            </div>
          </div>
          <Progress value={(stats.daysActiveThisWeek / 7) * 100} className="h-2" />
        </Card>

        {/* Subjects Studied */}
        <Card className="p-5">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> Subjects Studied
          </h3>
          {stats.subjectsStudied.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {stats.subjectsStudied.map(s => (
                <span key={s} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">{s}</span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No subjects studied yet.</p>
          )}
        </Card>

        {/* Weekly Test Scores */}
        <Card className="p-5">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4" /> Weekly Test Scores
          </h3>
          {stats.weeklyTestScores.length > 0 ? (
            <div className="space-y-3">
              {stats.weeklyTestScores.map((test, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{new Date(test.date).toLocaleDateString()}</p>
                    <p className="text-xs text-muted-foreground">{test.subjects?.join(", ")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={test.accuracy} className="w-16 h-2" />
                    <span className={`text-sm font-bold ${test.accuracy >= 70 ? "text-green-600" : test.accuracy >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                      {test.accuracy}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No weekly tests taken yet.</p>
          )}
        </Card>

        {/* Strong & Weak Subjects */}
        {stats.strongSubjects.length > 0 && (
          <Card className="p-4 border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
            <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">💪 Strong Subjects</p>
            <div className="flex flex-wrap gap-2">
              {stats.strongSubjects.map(s => (
                <span key={s} className="px-3 py-1 bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100 rounded-full text-xs">{s}</span>
              ))}
            </div>
          </Card>
        )}

        {stats.weakSubjects.length > 0 && (
          <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
            <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">⚠️ Needs Improvement</p>
            <div className="flex flex-wrap gap-2">
              {stats.weakSubjects.map(s => (
                <span key={s} className="px-3 py-1 bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100 rounded-full text-xs">{s}</span>
              ))}
            </div>
          </Card>
        )}

        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">
            Gyanam AI · Parent View · Read Only
          </p>
        </div>
      </main>

      {/* Parent Chatbot */}
      {token && <ParentChatbot token={token} studentName={student.name} />}
    </div>
  );
};

export default ParentDashboard;
