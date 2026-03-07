import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3, TrendingUp, Users, DollarSign, Loader2, Brain,
  MessageSquare, ClipboardList, FileText, Mic, Target, Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface UsageSummary {
  totalRequests: number;
  totalCost: number;
  uniqueStudents: number;
  avgCostPerStudent: number;
  avgCostPerRequest: number;
}

interface ActionBreakdown {
  action: string;
  label: string;
  count: number;
  input_tokens: number;
  output_tokens: number;
  cost: number;
}

interface TopStudent {
  id: string;
  name: string;
  totalRequests: number;
  totalCost: number;
  actions: Record<string, number>;
}

interface DailyTrend {
  date: string;
  count: number;
  cost: number;
}

const ACTION_ICONS: Record<string, any> = {
  study_chat: MessageSquare,
  generate_quiz: ClipboardList,
  generate_mcq: Target,
  analyze_answer: Brain,
  exam_prep_chat: Zap,
  exam_prep_extract: FileText,
  exam_prep_exam: BarChart3,
  text_to_speech: Mic,
};

const ACTION_COLORS: Record<string, string> = {
  study_chat: "text-blue-500",
  generate_quiz: "text-green-500",
  generate_mcq: "text-purple-500",
  analyze_answer: "text-orange-500",
  exam_prep_chat: "text-pink-500",
  exam_prep_extract: "text-cyan-500",
  exam_prep_exam: "text-red-500",
  text_to_speech: "text-yellow-500",
};

const AIUsageAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"today" | "week" | "month">("week");
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [actionBreakdown, setActionBreakdown] = useState<ActionBreakdown[]>([]);
  const [topStudents, setTopStudents] = useState<TopStudent[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([]);

  const fetchUsageData = useCallback(async () => {
    setLoading(true);
    try {
      const sessionToken = localStorage.getItem("adminSessionToken");
      if (!sessionToken) return;

      const { data, error } = await supabase.functions.invoke("admin-ai-usage", {
        body: { session_token: sessionToken, period },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSummary(data.summary);
      setActionBreakdown(data.actionBreakdown || []);
      setTopStudents(data.topStudents || []);
      setDailyTrend(data.dailyTrend || []);
    } catch (e: any) {
      console.error("Failed to fetch AI usage:", e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const maxTrendCount = Math.max(...dailyTrend.map(d => d.count), 1);

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Period:</span>
        {(["today", "week", "month"] as const).map((p) => (
          <Button
            key={p}
            variant={period === p ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod(p)}
            className="text-xs"
          >
            {p === "today" ? "Today" : p === "week" ? "7 Days" : "30 Days"}
          </Button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card border-border/50">
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold text-foreground">{summary?.totalRequests || 0}</p>
            <p className="text-xs text-muted-foreground">Total Requests</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold text-foreground">₹{summary?.totalCost?.toFixed(2) || "0.00"}</p>
            <p className="text-xs text-muted-foreground">Total AI Cost</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold text-foreground">{summary?.uniqueStudents || 0}</p>
            <p className="text-xs text-muted-foreground">Active Students</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-orange-500" />
            <p className="text-2xl font-bold text-foreground">₹{summary?.avgCostPerStudent?.toFixed(2) || "0.00"}</p>
            <p className="text-xs text-muted-foreground">Avg/Student</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Trend */}
      {dailyTrend.length > 0 && (
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Daily AI Usage (7 Days)</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex items-end justify-between gap-1 h-24">
              {dailyTrend.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center">
                    <span className="text-[10px] text-muted-foreground mb-1">
                      {day.count}
                    </span>
                    <div
                      className="w-full bg-primary/80 rounded-t-sm transition-all duration-300 min-h-[2px]"
                      style={{ height: `${(day.count / maxTrendCount) * 60}px` }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    {new Date(day.date).toLocaleDateString("en", { weekday: "short" })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Breakdown */}
      {actionBreakdown.length > 0 && (
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Usage by Feature</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {actionBreakdown
              .sort((a, b) => b.cost - a.cost)
              .map((item) => {
                const Icon = ACTION_ICONS[item.action] || BarChart3;
                const color = ACTION_COLORS[item.action] || "text-muted-foreground";
                return (
                  <div key={item.action} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                    <Icon className={`h-4 w-4 ${color} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.count} requests • {((item.input_tokens + item.output_tokens) / 1000).toFixed(1)}K tokens
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-foreground whitespace-nowrap">₹{item.cost.toFixed(2)}</p>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      )}

      {/* Top Students by Usage */}
      {topStudents.length > 0 && (
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top Students by AI Cost</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topStudents.map((student, i) => (
              <div key={student.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                <span className="text-xs font-bold text-muted-foreground w-5 text-center">
                  #{i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{student.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {student.totalRequests} requests •{" "}
                    {Object.entries(student.actions)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 2)
                      .map(([action, count]) => `${action.replace(/_/g, " ")} (${count})`)
                      .join(", ")}
                  </p>
                </div>
                <p className="text-sm font-semibold text-foreground whitespace-nowrap">₹{student.totalCost.toFixed(2)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Cost Estimation */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">💡 Cost Estimation Guide</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>• Study Chat: ~₹0.08/request (Gemini 3 Flash)</p>
          <p>• Quiz Generation: ~₹0.12/request</p>
          <p>• MCQ Practice: ~₹0.10/request</p>
          <p>• Answer Analysis: ~₹0.05/request</p>
          <p>• Exam Prep Chat: ~₹0.10/request</p>
          <p>• PDF Extraction: ~₹0.15/request</p>
          <p>• TTS (Speechify): ~₹1.00/day per Pro user</p>
          <p className="pt-2 font-medium text-foreground">
            Estimated: ₹{summary?.avgCostPerStudent?.toFixed(2) || "0.00"}/student for this period • 
            ₹{summary?.avgCostPerRequest ? (summary.avgCostPerRequest * 1000).toFixed(2) : "0.00"}/1K requests
          </p>
        </CardContent>
      </Card>

      {/* No data state */}
      {(!summary || summary.totalRequests === 0) && (
        <Card className="bg-card border-dashed border-2 border-border">
          <CardContent className="p-8 text-center">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground font-medium">No AI usage data yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Usage tracking is now active. Data will appear as students use the app.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AIUsageAnalytics;
