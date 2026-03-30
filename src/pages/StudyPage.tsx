import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import StudyChat from "@/components/StudyChat";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  imageUrl?: string;
}

interface RealTimeAnalysis {
  weakAreas: string[];
  strongAreas: string[];
  currentUnderstanding: "weak" | "average" | "good" | "excellent";
  topicsCovered: string[];
}

const StudyPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
      return;
    }

    if (user) {
      loadStudentData();
    }
  }, [user, loading, navigate]);

  const loadStudentData = async () => {
    if (!user) return;

    try {
      const { data: student } = await supabase
        .from("students")
        .select("id, is_approved")
        .eq("user_id", user.id)
        .maybeSingle();

      if (student) {
        setStudentId(student.id);
        setIsApproved(student.is_approved);
        
        // If not approved, redirect back to dashboard
        if (!student.is_approved) {
          toast({
            title: "Approval Pending",
            description: "Aapka account abhi approve nahi hua. Please wait!",
            variant: "destructive",
          });
          navigate("/dashboard");
          return;
        }
      } else {
        // No student profile found
        navigate("/dashboard");
        return;
      }
    } catch (error) {
      console.error("Error loading student data:", error);
      navigate("/dashboard");
      return;
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleEndStudy = useCallback(async (summary: { 
    topic: string; 
    timeSpent: number; 
    messages: ChatMessage[];
    analysis: RealTimeAnalysis;
    sessionId?: string;
    quizResult?: {
      correctCount: number;
      totalQuestions: number;
      accuracy: number;
      understanding: "strong" | "partial" | "weak";
      questions: any[];
      answers: string[];
    };
  }) => {
    // Save session to database if we have a student ID
    if (studentId) {
      try {
        // Map understanding level based on quiz result or analysis
        let understandingLevel: "weak" | "average" | "good" | "excellent";
        let improvementScore: number;

        if (summary.quizResult) {
          improvementScore = summary.quizResult.accuracy;
          
          if (summary.quizResult.understanding === "strong") {
            understandingLevel = "excellent";
          } else if (summary.quizResult.understanding === "partial") {
            understandingLevel = "average";
          } else {
            understandingLevel = "weak";
          }
        } else {
          const scoreMap = { weak: 40, average: 60, good: 75, excellent: 90 };
          improvementScore = scoreMap[summary.analysis.currentUnderstanding] || 50;
          understandingLevel = summary.analysis.currentUnderstanding;
        }

        const topicToSave = summary.topic || summary.analysis.topicsCovered[0] || "General Study";
        const aiSummary = summary.quizResult 
          ? `Studied ${summary.topic} for ${summary.timeSpent} minutes. Quiz: ${summary.quizResult.correctCount}/${summary.quizResult.totalQuestions} correct (${summary.quizResult.accuracy}%). Result: ${summary.quizResult.understanding}.`
          : `Studied ${summary.topic} for ${summary.timeSpent} minutes. Understanding: ${summary.analysis.currentUnderstanding}. Topics covered: ${summary.analysis.topicsCovered.join(", ") || "General concepts"}.`;

        let finalSessionId = summary.sessionId;

        if (summary.sessionId) {
          await supabase
            .from("study_sessions")
            .update({
              topic: topicToSave,
              subject: topicToSave !== "General Study" ? topicToSave : null,
              time_spent: summary.timeSpent,
              understanding_level: understandingLevel,
              improvement_score: improvementScore,
              weak_areas: summary.analysis.weakAreas,
              strong_areas: summary.analysis.strongAreas,
              ai_summary: aiSummary,
              end_time: new Date().toISOString(),
            })
            .eq("id", summary.sessionId);
        } else {
          const { data: sessionData } = await supabase.from("study_sessions").insert({
            student_id: studentId,
            topic: topicToSave,
            subject: topicToSave !== "General Study" ? topicToSave : null,
            time_spent: summary.timeSpent,
            understanding_level: understandingLevel,
            improvement_score: improvementScore,
            weak_areas: summary.analysis.weakAreas,
            strong_areas: summary.analysis.strongAreas,
            ai_summary: aiSummary,
          }).select().single();

          finalSessionId = sessionData?.id;
        }

        // Save quiz attempt if quiz was taken
        if (summary.quizResult && finalSessionId) {
          await supabase.from("quiz_attempts").insert({
            student_id: studentId,
            session_id: finalSessionId,
            questions: summary.quizResult.questions,
            answers: summary.quizResult.answers,
            correct_count: summary.quizResult.correctCount,
            total_questions: summary.quizResult.totalQuestions,
            accuracy_percentage: summary.quizResult.accuracy,
            understanding_result: summary.quizResult.understanding,
          });
        }
        // Trigger topic mastery update
        try {
          await supabase.functions.invoke("update-topic-mastery", {
            body: {
              studentId,
              source: summary.quizResult ? "quiz" : "study_session",
              sessionData: {
                topic: summary.topic,
                subject: summary.topic,
                weakAreas: summary.analysis.weakAreas,
                strongAreas: summary.analysis.strongAreas,
                understandingLevel: summary.analysis.currentUnderstanding,
                accuracy: summary.quizResult?.accuracy,
              },
            },
          });
        } catch (masteryErr) {
          console.error("Error updating topic mastery:", masteryErr);
        }
      } catch (err) {
        console.error("Error saving session:", err);
      }
    }

    toast({
      title: "Study Session Complete! 🎉",
      description: summary.quizResult 
        ? `Quiz: ${summary.quizResult.correctCount}/${summary.quizResult.totalQuestions} correct (${summary.quizResult.accuracy}%)`
        : `You studied ${summary.topic} for ${summary.timeSpent} minutes.`,
    });

    // Navigate back to dashboard using router (WebView compatible)
    navigate("/dashboard");
  }, [studentId, toast, navigate]);

  if (loading || isDataLoading) {
    return <DashboardSkeleton />;
  }

  if (!isApproved) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="h-[100dvh] bg-background flex flex-col">
      <StudyChat onEndStudy={handleEndStudy} studentId={studentId || undefined} />
    </div>
  );
};

export default StudyPage;
