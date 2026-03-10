import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, BookOpen, CheckCircle, XCircle, Clock, Trophy, Loader2, Brain } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getSubjects, BoardType } from "@/data/syllabusData";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";

interface MCQQuestion {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  explanation: string;
}

type TestPhase = "setup" | "loading" | "test" | "result";

const McqPractice = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentBoard, setStudentBoard] = useState<string>("CBSE");
  const [studentClass, setStudentClass] = useState<string>("10");
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Setup state
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);

  // Test state
  const [phase, setPhase] = useState<TestPhase>("setup");
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [answers, setAnswers] = useState<{ selected: string; correct: string; isCorrect: boolean }[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Results
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
      return;
    }
    if (user) loadStudentData();
  }, [user, loading]);

  useEffect(() => {
    if (phase === "test" && startTime > 0) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, startTime]);

  const loadStudentData = async () => {
    if (!user) return;
    try {
      const { data: student } = await supabase
        .from("students")
        .select("id, board, class, is_approved")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!student || !student.is_approved) {
        navigate("/dashboard");
        return;
      }

      setStudentId(student.id);
      setStudentBoard(student.board);
      setStudentClass(student.class);

      // Strip "Class " prefix since syllabusData uses plain numbers like "10"
      const classNum = student.class.replace(/^Class\s+/i, "");
      const subjects = getSubjects(student.board as BoardType, classNum);
      setAvailableSubjects(subjects);
      if (subjects.length > 0) setSelectedSubject(subjects[0]);
    } catch (error) {
      console.error("Error loading student:", error);
      navigate("/dashboard");
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleStartTest = async () => {
    if (!selectedSubject || !studentId) return;
    setPhase("loading");

    try {
      const { data, error } = await supabase.functions.invoke("generate-mcq", {
        body: {
          action: "generate_mcq",
          studentId,
          subject: selectedSubject,
          numQuestions,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (!data?.questions || data.questions.length === 0) {
        throw new Error("No questions generated");
      }

      setQuestions(data.questions);
      setCurrentQuestion(0);
      setAnswers([]);
      setCorrectCount(0);
      setWrongCount(0);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setStartTime(Date.now());
      setElapsedSeconds(0);
      setPhase("test");
    } catch (err: any) {
      console.error("MCQ generation error:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to generate questions. Please try again.",
        variant: "destructive",
      });
      setPhase("setup");
    }
  };

  const handleSelectAnswer = (answer: string) => {
    if (isAnswered) return;
    setSelectedAnswer(answer);
  };

  const handleSubmitAnswer = () => {
    if (!selectedAnswer || isAnswered) return;
    const q = questions[currentQuestion];
    const isCorrect = selectedAnswer === q.correctAnswer;

    setIsAnswered(true);
    setAnswers(prev => [...prev, { selected: selectedAnswer, correct: q.correctAnswer, isCorrect }]);

    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
    } else {
      setWrongCount(prev => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestion + 1 >= questions.length) {
      // Test complete
      if (timerRef.current) clearInterval(timerRef.current);
      saveResults();
      setPhase("result");
    } else {
      setCurrentQuestion(prev => prev + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
    }
  };

  const saveResults = async () => {
    if (!studentId) return;

    const total = questions.length;
    const correct = correctCount + (selectedAnswer === questions[currentQuestion]?.correctAnswer && isAnswered ? 0 : 0);
    const finalCorrect = answers.filter(a => a.isCorrect).length;
    const accuracy = Math.round((finalCorrect / total) * 100);
    let remark = "Weak Area";
    if (accuracy >= 90) remark = "Excellent";
    else if (accuracy >= 70) remark = "Good";
    else if (accuracy >= 50) remark = "Needs Improvement";

    try {
      await supabase.from("mcq_attempts").insert({
        student_id: studentId,
        subject: selectedSubject,
        board: studentBoard,
        class: studentClass,
        total_questions: total,
        correct_count: finalCorrect,
        wrong_count: total - finalCorrect,
        accuracy_percentage: accuracy,
        time_taken_seconds: elapsedSeconds,
        performance_remark: remark,
        questions: questions as any,
        answers: answers as any,
      });
    } catch (err) {
      console.error("Error saving MCQ results:", err);
    }
  };

  const getPerformanceRemark = () => {
    const total = questions.length;
    const correct = answers.filter(a => a.isCorrect).length;
    const accuracy = Math.round((correct / total) * 100);
    if (accuracy >= 90) return { text: "Excellent! 🏆", color: "text-green-600" };
    if (accuracy >= 70) return { text: "Good! 👍", color: "text-blue-600" };
    if (accuracy >= 50) return { text: "Needs Improvement 📖", color: "text-yellow-600" };
    return { text: "Weak Area ⚠️", color: "text-red-600" };
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (loading || isDataLoading) return <DashboardSkeleton />;

  // SETUP PHASE
  if (phase === "setup") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card sticky top-0 z-10">
          <div className="container mx-auto px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-bold text-lg">Practice MCQ</h1>
              <p className="text-xs text-muted-foreground">{studentBoard} · {studentClass}</p>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-lg">
          <Card className="p-6 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Brain className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold">MCQ Practice</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Select a subject and start practicing board-style questions
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Subject</label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubjects.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Number of Questions</label>
                <Select value={numQuestions.toString()} onValueChange={v => setNumQuestions(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 Questions</SelectItem>
                    <SelectItem value="15">15 Questions</SelectItem>
                    <SelectItem value="20">20 Questions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button className="w-full" size="lg" onClick={handleStartTest} disabled={!selectedSubject}>
              <BookOpen className="w-5 h-5 mr-2" />
              Start Practice
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  // LOADING PHASE
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <h2 className="text-lg font-bold">Generating Questions...</h2>
          <p className="text-sm text-muted-foreground">
            Creating {numQuestions} {selectedSubject} MCQs for {studentBoard} {studentClass}
          </p>
        </div>
      </div>
    );
  }

  // TEST PHASE
  if (phase === "test" && questions.length > 0) {
    const q = questions[currentQuestion];
    const progress = ((currentQuestion + 1) / questions.length) * 100;
    const options = [
      { key: "A", text: q.optionA },
      { key: "B", text: q.optionB },
      { key: "C", text: q.optionC },
      { key: "D", text: q.optionD },
    ];

    return (
      <div className="min-h-screen bg-background">
        {/* Header with timer */}
        <header className="border-b border-border bg-card sticky top-0 z-10">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Q {currentQuestion + 1}/{questions.length}</span>
                <span className="text-xs text-muted-foreground">· {selectedSubject}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4" />
                <span className="font-mono">{formatTime(elapsedSeconds)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-green-600">✓ {correctCount}</span>
                <span className="text-red-600">✗ {wrongCount}</span>
              </div>
            </div>
            <Progress value={progress} className="mt-2 h-1.5" />
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 max-w-2xl">
          {/* Question */}
          <Card className="p-6 mb-6">
            <p className="text-base sm:text-lg font-medium leading-relaxed">{q.question}</p>
          </Card>

          {/* Options */}
          <div className="space-y-3 mb-6">
            {options.map(opt => {
              let optClass = "border-border hover:border-primary/50 cursor-pointer";
              if (isAnswered) {
                if (opt.key === q.correctAnswer) {
                  optClass = "border-green-500 bg-green-50 dark:bg-green-900/20";
                } else if (opt.key === selectedAnswer && opt.key !== q.correctAnswer) {
                  optClass = "border-red-500 bg-red-50 dark:bg-red-900/20";
                } else {
                  optClass = "border-border opacity-50";
                }
              } else if (opt.key === selectedAnswer) {
                optClass = "border-primary bg-primary/5";
              }

              return (
                <Card
                  key={opt.key}
                  className={`p-4 cursor-pointer transition-all ${optClass}`}
                  onClick={() => handleSelectAnswer(opt.key)}
                >
                  <div className="flex items-start gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      isAnswered && opt.key === q.correctAnswer
                        ? "bg-green-500 text-white"
                        : isAnswered && opt.key === selectedAnswer && opt.key !== q.correctAnswer
                        ? "bg-red-500 text-white"
                        : opt.key === selectedAnswer
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {opt.key}
                    </span>
                    <span className="text-sm sm:text-base pt-1">{opt.text}</span>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Explanation (after answer) */}
          {isAnswered && (
            <Card className="p-4 mb-6 border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Explanation</p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">{q.explanation}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {!isAnswered ? (
              <Button className="flex-1" size="lg" onClick={handleSubmitAnswer} disabled={!selectedAnswer}>
                Submit Answer
              </Button>
            ) : (
              <Button className="flex-1" size="lg" onClick={handleNextQuestion}>
                {currentQuestion + 1 >= questions.length ? "View Results" : "Next Question →"}
              </Button>
            )}
          </div>
        </main>
      </div>
    );
  }

  // RESULT PHASE
  if (phase === "result") {
    const total = questions.length;
    const correct = answers.filter(a => a.isCorrect).length;
    const wrong = total - correct;
    const accuracy = Math.round((correct / total) * 100);
    const remark = getPerformanceRemark();

    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card sticky top-0 z-10">
          <div className="container mx-auto px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-bold text-lg">MCQ Results</h1>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-lg">
          <Card className="p-6 text-center space-y-6">
            <div>
              <Trophy className="w-16 h-16 mx-auto text-primary mb-4" />
              <h2 className="text-2xl font-bold">Practice Complete!</h2>
              <p className="text-sm text-muted-foreground mt-1">{selectedSubject} · {studentBoard} {studentClass}</p>
            </div>

            {/* Score circle */}
            <div className="w-32 h-32 rounded-full border-4 border-primary flex items-center justify-center mx-auto">
              <div>
                <p className="text-3xl font-bold">{accuracy}%</p>
                <p className="text-xs text-muted-foreground">Accuracy</p>
              </div>
            </div>

            <p className={`text-lg font-bold ${remark.color}`}>{remark.text}</p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-2xl font-bold text-green-600">{correct}</p>
                <p className="text-xs text-muted-foreground">Correct</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-2xl font-bold text-red-600">{wrong}</p>
                <p className="text-xs text-muted-foreground">Wrong</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-2xl font-bold">{total}</p>
                <p className="text-xs text-muted-foreground">Total Questions</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-2xl font-bold">{formatTime(elapsedSeconds)}</p>
                <p className="text-xs text-muted-foreground">Time Taken</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setPhase("setup"); setAnswers([]); }}>
                Practice Again
              </Button>
              <Button className="flex-1" onClick={() => navigate("/dashboard")}>
                Back to Dashboard
              </Button>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  return null;
};

export default McqPractice;
