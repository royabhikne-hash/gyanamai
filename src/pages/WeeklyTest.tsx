import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Clock, Trophy, Loader2, AlertCircle, BookOpen } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";

interface WeeklyQuestion {
  subject: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  explanation: string;
}

type Phase = "checking" | "unavailable" | "ready" | "loading" | "test" | "result";

const WeeklyTest = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [studentId, setStudentId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("checking");
  const [unavailableReason, setUnavailableReason] = useState("");
  const [studiedSubjects, setStudiedSubjects] = useState<string[]>([]);

  // Test state
  const [questions, setQuestions] = useState<WeeklyQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [startTime, setStartTime] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!loading && !user) { navigate("/login"); return; }
    if (user) loadStudentAndCheck();
  }, [user, loading]);

  useEffect(() => {
    if (phase === "test" && startTime > 0) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, startTime]);

  const loadStudentAndCheck = async () => {
    if (!user) return;
    try {
      const { data: student } = await supabase
        .from("students")
        .select("id, is_approved")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!student || !student.is_approved) { navigate("/dashboard"); return; }
      setStudentId(student.id);

      // Check availability
      const { data, error } = await supabase.functions.invoke("generate-mcq", {
        body: { action: "check_weekly_test_available", studentId: student.id },
      });

      if (error || data?.error) {
        setUnavailableReason("Could not check test availability.");
        setPhase("unavailable");
        return;
      }

      if (data.alreadyTakenThisWeek) {
        setUnavailableReason("You already took this week's test. Come back next week!");
        setPhase("unavailable");
      } else if (!data.hasStudied) {
        setUnavailableReason("You haven't studied any subjects this week. Study first, then take the test!");
        setPhase("unavailable");
      } else if (!data.available) {
        setUnavailableReason("Weekly test is not available yet. Keep studying!");
        setPhase("unavailable");
      } else {
        setStudiedSubjects(data.studiedSubjects || []);
        setPhase("ready");
      }
    } catch (err) {
      console.error("Error:", err);
      setPhase("unavailable");
      setUnavailableReason("Something went wrong.");
    }
  };

  const handleStartTest = async () => {
    if (!studentId) return;
    setPhase("loading");

    try {
      const { data, error } = await supabase.functions.invoke("generate-mcq", {
        body: { action: "generate_weekly_test", studentId, subjects: studiedSubjects },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setQuestions(data.questions);
      setWeekStart(data.weekStart);
      setWeekEnd(data.weekEnd);
      setSelectedAnswers({});
      setCurrentQuestion(0);
      setStartTime(Date.now());
      setElapsedSeconds(0);
      setPhase("test");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to generate test.", variant: "destructive" });
      setPhase("ready");
    }
  };

  const handleSelectAnswer = (qIndex: number, answer: string) => {
    setSelectedAnswers(prev => ({ ...prev, [qIndex]: answer }));
  };

  const handleSubmitTest = async () => {
    if (!studentId) return;
    if (timerRef.current) clearInterval(timerRef.current);

    // Calculate results
    let correct = 0;
    const subjectCorrect: Record<string, number> = {};
    const subjectTotal: Record<string, number> = {};

    questions.forEach((q, i) => {
      const sub = q.subject;
      subjectTotal[sub] = (subjectTotal[sub] || 0) + 1;
      if (selectedAnswers[i] === q.correctAnswer) {
        correct++;
        subjectCorrect[sub] = (subjectCorrect[sub] || 0) + 1;
      }
    });

    const total = questions.length;
    const wrong = total - correct;
    const accuracy = Math.round((correct / total) * 100);

    // Determine strong/weak subjects
    const strongSubjects: string[] = [];
    const weakSubjects: string[] = [];
    Object.keys(subjectTotal).forEach(sub => {
      const subAcc = ((subjectCorrect[sub] || 0) / subjectTotal[sub]) * 100;
      if (subAcc >= 70) strongSubjects.push(sub);
      else if (subAcc < 50) weakSubjects.push(sub);
    });

    let suggestion = "";
    if (accuracy >= 90) suggestion = "Excellent performance! Keep up the great work.";
    else if (accuracy >= 70) suggestion = "Good job! Focus on weak subjects to improve further.";
    else if (accuracy >= 50) suggestion = "You need more practice. Revise weak areas and attempt more MCQs.";
    else suggestion = "Significant improvement needed. Go back to basics in weak subjects.";

    if (weakSubjects.length > 0) {
      suggestion += ` Focus on: ${weakSubjects.join(", ")}.`;
    }

    // Save to database
    try {
      await supabase.from("weekly_tests").insert({
        student_id: studentId,
        subjects_tested: Object.keys(subjectTotal),
        total_questions: total,
        correct_count: correct,
        wrong_count: wrong,
        accuracy_percentage: accuracy,
        time_taken_seconds: elapsedSeconds,
        strong_subjects: strongSubjects,
        weak_subjects: weakSubjects,
        improvement_suggestion: suggestion,
        questions: questions as any,
        answers: Object.entries(selectedAnswers).map(([i, a]) => ({ questionIndex: parseInt(i), selected: a })) as any,
        week_start: weekStart,
        week_end: weekEnd,
      });
      // Trigger topic mastery update
      try {
        await supabase.functions.invoke("update-topic-mastery", {
          body: {
            studentId,
            source: "weekly_test",
            testData: {
              subjectResults: Object.fromEntries(
                Object.keys(subjectTotal).map(sub => [sub, { correct: subjectCorrect[sub] || 0, total: subjectTotal[sub] }])
              ),
              weakSubjects,
              strongSubjects,
            },
          },
        });
      } catch (masteryErr) {
        console.error("Error updating topic mastery:", masteryErr);
      }
    } catch (err) {
      console.error("Error saving weekly test:", err);
    }

    setPhase("result");
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  if (loading || phase === "checking") return <DashboardSkeleton />;

  // UNAVAILABLE
  if (phase === "unavailable") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 max-w-md text-center space-y-4">
          <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-bold">Weekly Test Not Available</h2>
          <p className="text-sm text-muted-foreground">{unavailableReason}</p>
          <Button onClick={() => navigate("/dashboard")} className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  // READY
  if (phase === "ready") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card sticky top-0 z-10">
          <div className="container mx-auto px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-bold text-lg">Weekly Smart Test</h1>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 max-w-lg">
          <Card className="p-6 text-center space-y-6">
            <Trophy className="w-16 h-16 text-primary mx-auto" />
            <h2 className="text-xl font-bold">Your Weekly Test is Ready!</h2>
            <p className="text-sm text-muted-foreground">
              Based on your study activity, a test has been prepared covering:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {studiedSubjects.map(s => (
                <span key={s} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">{s}</span>
              ))}
            </div>
            <div className="bg-muted/50 rounded-xl p-4 text-sm text-left space-y-2">
              <p>📝 25-40 mixed MCQs from studied subjects</p>
              <p>⏱️ Timed test - no instant answers</p>
              <p>📊 Detailed performance analysis after completion</p>
              <p>⚠️ You can only take this test once per week</p>
            </div>
            <Button size="lg" className="w-full" onClick={handleStartTest}>
              <BookOpen className="w-5 h-5 mr-2" /> Start Weekly Test
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  // LOADING
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <h2 className="text-lg font-bold">Generating Your Weekly Test...</h2>
          <p className="text-sm text-muted-foreground">Creating questions from {studiedSubjects.length} subjects</p>
        </div>
      </div>
    );
  }

  // TEST PHASE (no instant answer reveal)
  if (phase === "test" && questions.length > 0) {
    const q = questions[currentQuestion];
    const answeredCount = Object.keys(selectedAnswers).length;
    const options = [
      { key: "A", text: q.optionA },
      { key: "B", text: q.optionB },
      { key: "C", text: q.optionC },
      { key: "D", text: q.optionD },
    ];

    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card sticky top-0 z-10">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Q {currentQuestion + 1}/{questions.length}</span>
                <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">{q.subject}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4" />
                <span className="font-mono">{formatTime(elapsedSeconds)}</span>
              </div>
            </div>
            <Progress value={((currentQuestion + 1) / questions.length) * 100} className="mt-2 h-1.5" />
            <p className="text-xs text-muted-foreground mt-1">{answeredCount}/{questions.length} answered</p>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 max-w-2xl">
          <Card className="p-6 mb-6">
            <p className="text-base sm:text-lg font-medium leading-relaxed">{q.question}</p>
          </Card>

          <div className="space-y-3 mb-6">
            {options.map(opt => (
              <Card
                key={opt.key}
                className={`p-4 cursor-pointer transition-all ${
                  selectedAnswers[currentQuestion] === opt.key
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => handleSelectAnswer(currentQuestion, opt.key)}
              >
                <div className="flex items-start gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    selectedAnswers[currentQuestion] === opt.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>{opt.key}</span>
                  <span className="text-sm sm:text-base pt-1">{opt.text}</span>
                </div>
              </Card>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            <Button variant="outline" disabled={currentQuestion === 0} onClick={() => setCurrentQuestion(prev => prev - 1)}>
              ← Previous
            </Button>
            <div className="flex-1" />
            {currentQuestion + 1 < questions.length ? (
              <Button onClick={() => setCurrentQuestion(prev => prev + 1)}>
                Next →
              </Button>
            ) : (
              <Button
                onClick={handleSubmitTest}
                disabled={answeredCount < questions.length}
                className="bg-primary hover:bg-primary/90"
              >
                Submit Test ({answeredCount}/{questions.length})
              </Button>
            )}
          </div>

          {/* Question navigator */}
          <div className="mt-8">
            <p className="text-sm font-medium mb-2">Question Navigator</p>
            <div className="flex flex-wrap gap-2">
              {questions.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentQuestion(i)}
                  className={`w-8 h-8 rounded text-xs font-medium transition-all ${
                    i === currentQuestion
                      ? "bg-primary text-primary-foreground"
                      : selectedAnswers[i]
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // RESULT PHASE
  if (phase === "result") {
    const total = questions.length;
    const correct = questions.filter((q, i) => selectedAnswers[i] === q.correctAnswer).length;
    const wrong = total - correct;
    const accuracy = Math.round((correct / total) * 100);

    // Per-subject breakdown
    const subjectStats: Record<string, { correct: number; total: number }> = {};
    questions.forEach((q, i) => {
      if (!subjectStats[q.subject]) subjectStats[q.subject] = { correct: 0, total: 0 };
      subjectStats[q.subject].total++;
      if (selectedAnswers[i] === q.correctAnswer) subjectStats[q.subject].correct++;
    });

    const strongSubjects = Object.entries(subjectStats).filter(([, s]) => (s.correct / s.total) >= 0.7).map(([name]) => name);
    const weakSubjects = Object.entries(subjectStats).filter(([, s]) => (s.correct / s.total) < 0.5).map(([name]) => name);

    let remarkText = "Weak Area ⚠️";
    let remarkColor = "text-red-600";
    if (accuracy >= 90) { remarkText = "Excellent! 🏆"; remarkColor = "text-green-600"; }
    else if (accuracy >= 70) { remarkText = "Good! 👍"; remarkColor = "text-blue-600"; }
    else if (accuracy >= 50) { remarkText = "Needs Improvement 📖"; remarkColor = "text-yellow-600"; }

    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card sticky top-0 z-10">
          <div className="container mx-auto px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-bold text-lg">Weekly Test Results</h1>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-lg space-y-6">
          <Card className="p-6 text-center space-y-4">
            <Trophy className="w-16 h-16 text-primary mx-auto" />
            <h2 className="text-2xl font-bold">Weekly Test Complete!</h2>
            <div className="w-32 h-32 rounded-full border-4 border-primary flex items-center justify-center mx-auto">
              <div>
                <p className="text-3xl font-bold">{accuracy}%</p>
                <p className="text-xs text-muted-foreground">Accuracy</p>
              </div>
            </div>
            <p className={`text-lg font-bold ${remarkColor}`}>{remarkText}</p>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/50 rounded-xl p-3">
                <p className="text-xl font-bold text-green-600">{correct}</p>
                <p className="text-xs text-muted-foreground">Correct</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-3">
                <p className="text-xl font-bold text-red-600">{wrong}</p>
                <p className="text-xs text-muted-foreground">Wrong</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-3">
                <p className="text-xl font-bold">{formatTime(elapsedSeconds)}</p>
                <p className="text-xs text-muted-foreground">Time</p>
              </div>
            </div>
          </Card>

          {/* Subject breakdown */}
          <Card className="p-6">
            <h3 className="font-bold mb-4">Subject Breakdown</h3>
            <div className="space-y-3">
              {Object.entries(subjectStats).map(([subject, stats]) => {
                const subAcc = Math.round((stats.correct / stats.total) * 100);
                return (
                  <div key={subject} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{subject}</p>
                      <p className="text-xs text-muted-foreground">{stats.correct}/{stats.total} correct</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={subAcc} className="w-20 h-2" />
                      <span className={`text-sm font-bold ${subAcc >= 70 ? "text-green-600" : subAcc >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                        {subAcc}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Strong/Weak areas */}
          {strongSubjects.length > 0 && (
            <Card className="p-4 border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
              <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">💪 Strong Subjects</p>
              <div className="flex flex-wrap gap-2">
                {strongSubjects.map(s => (
                  <span key={s} className="px-3 py-1 bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100 rounded-full text-xs">{s}</span>
                ))}
              </div>
            </Card>
          )}

          {weakSubjects.length > 0 && (
            <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
              <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">⚠️ Weak Subjects - Need More Practice</p>
              <div className="flex flex-wrap gap-2">
                {weakSubjects.map(s => (
                  <span key={s} className="px-3 py-1 bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100 rounded-full text-xs">{s}</span>
                ))}
              </div>
            </Card>
          )}

          <Button className="w-full" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </main>
      </div>
    );
  }

  return null;
};

export default WeeklyTest;
