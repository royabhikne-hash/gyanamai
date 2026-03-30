import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BookOpen,
  Clock,
  TrendingUp,
  LogOut,
  Play,
  CheckCircle,
  XCircle,
  User,
  BarChart3,
  CalendarDays,
  Sun,
  Trophy,
  Sparkles,
  Brain,
  ClipboardList,
  Zap,
  Target,
} from "lucide-react";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import StudentRankingCard from "@/components/StudentRankingCard";


import { ThemeToggle } from "@/components/ThemeToggle";
import BottomNavBar from "@/components/BottomNavBar";

import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface RecentSession {
  id: string;
  topic: string;
  date: string;
  duration: number;
  score: number;
}

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut, loading } = useAuth();
  const { t, language } = useLanguage();
  const [userName, setUserName] = useState("Student");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string>("");
  const [studentDistrict, setStudentDistrict] = useState<string>("");
  
  const [analyticsView, setAnalyticsView] = useState<"today" | "week">("today");
  const [mainTab, setMainTab] = useState<"study" | "rankings">("study");
  const [isDataLoading, setIsDataLoading] = useState(true);
  
  // Ranking data
  const [mySchoolRank, setMySchoolRank] = useState<any>(null);
  const [myDistrictRank, setMyDistrictRank] = useState<any>(null);
  const [totalSchoolStudents, setTotalSchoolStudents] = useState(0);
  const [totalDistrictStudents, setTotalDistrictStudents] = useState(0);
  const [rankingHistory, setRankingHistory] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  const [todayStats, setTodayStats] = useState({
    sessions: 0,
    minutes: 0,
    avgScore: 0,
    studied: false,
  });
  
  const [weekStats, setWeekStats] = useState({
    sessions: 0,
    minutes: 0,
    avgScore: 0,
    daysStudied: 0,
  });

  // Weekly Performance Score from weekly tests
  const [weeklyWPS, setWeeklyWPS] = useState<number | null>(null);
  const [latestTestAccuracy, setLatestTestAccuracy] = useState<number | null>(null);

  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
      return;
    }

    if (user) {
      loadStudentData();
    }
  }, [user, loading, navigate]);

  // Real-time subscription for approval status changes
  useEffect(() => {
    if (!studentId) return;

    const channel = supabase
      .channel('student-approval')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'students',
          filter: `id=eq.${studentId}`,
        },
        (payload) => {
          console.log('Student data updated:', payload);
          if (payload.new && 'is_approved' in payload.new) {
            setIsApproved(payload.new.is_approved as boolean);
            if (payload.new.is_approved) {
              loadStudentData(); // Reload full data when approved
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId]);

  const loadStudentData = async () => {
    if (!user) return;

    try {
      // Get student profile with school info
      const { data: student } = await supabase
        .from("students")
        .select("*, schools(name)")
        .eq("user_id", user.id)
        .maybeSingle();

      setIsDataLoading(true);
      
      if (student) {
        setUserName(student.full_name);
        setStudentId(student.id);
        setIsApproved(student.is_approved);
        setRejectionReason(student.rejection_reason || null);
        setSchoolName((student.schools as any)?.name || "Your School");
        setStudentDistrict(student.district || "Your District");
        
        // Only load data if approved - run in parallel for speed
        if (student.is_approved) {
          const [sessionsResult, weeklyTestsResult] = await Promise.all([
            supabase
              .from("study_sessions")
              .select("*, quiz_attempts(accuracy_percentage)")
              .eq("student_id", student.id)
              .not("time_spent", "eq", 0)
              .order("created_at", { ascending: false })
              .limit(200),
            supabase
              .from("weekly_tests")
              .select("accuracy_percentage, weak_subjects, week_start, week_end, created_at")
              .eq("student_id", student.id)
              .order("created_at", { ascending: true })
              .limit(52),
          ]);

          // Process sessions
          const sessions = sessionsResult.data;
          if (sessions) {
            const today = new Date();
            const todayStr = today.toDateString();
            
            const currentDay = today.getDay();
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - currentDay);
            weekStart.setHours(0, 0, 0, 0);
            
            const todaySessions = sessions.filter(s => new Date(s.created_at).toDateString() === todayStr);
            const weekSessions = sessions.filter(s => new Date(s.created_at) >= weekStart);
            
            const getAvgScore = (sessionList: typeof sessions) => {
              const scores = sessionList.map(s => {
                const quizAttempts = s.quiz_attempts as { accuracy_percentage: number | null }[] | null;
                if (quizAttempts && quizAttempts.length > 0 && quizAttempts[0].accuracy_percentage !== null) {
                  return quizAttempts[0].accuracy_percentage;
                }
                return s.improvement_score || 50;
              });
              return scores.length > 0 
                ? Math.round(scores.reduce((acc, s) => acc + s, 0) / scores.length)
                : 0;
            };
            
            setTodayStats({
              sessions: todaySessions.length,
              minutes: todaySessions.reduce((acc, s) => acc + (s.time_spent || 0), 0),
              avgScore: getAvgScore(todaySessions),
              studied: todaySessions.length > 0,
            });
            
            const uniqueDays = new Set(weekSessions.map(s => new Date(s.created_at).toDateString())).size;
            setWeekStats({
              sessions: weekSessions.length,
              minutes: weekSessions.reduce((acc, s) => acc + (s.time_spent || 0), 0),
              avgScore: getAvgScore(weekSessions),
              daysStudied: uniqueDays,
            });

            const recent = sessions.slice(0, 5).map((s) => {
              const quizAttempts = s.quiz_attempts as { accuracy_percentage: number | null }[] | null;
              const score = (quizAttempts && quizAttempts.length > 0 && quizAttempts[0].accuracy_percentage !== null)
                ? quizAttempts[0].accuracy_percentage
                : s.improvement_score || 0;
              const displayTopic = s.subject || s.topic || "General Study";
              
              return {
                id: s.id,
                topic: displayTopic,
                date: formatDate(new Date(s.created_at)),
                duration: s.time_spent || 0,
                score: Math.round(score),
              };
            });
            setRecentSessions(recent);

            // Process weekly tests
            const weeklyTestsData = weeklyTestsResult.data;
            if (weeklyTestsData && weeklyTestsData.length > 0) {
              const latestTest = weeklyTestsData[weeklyTestsData.length - 1];
              setLatestTestAccuracy(latestTest.accuracy_percentage);

              const accuracy = latestTest.accuracy_percentage;
              const prevTest = weeklyTestsData.length > 1 ? weeklyTestsData[weeklyTestsData.length - 2] : null;
              const improvement = prevTest ? Math.max(0, accuracy - prevTest.accuracy_percentage) : 0;
              const currentWeak = (latestTest.weak_subjects || []).length;
              const prevWeak = prevTest ? (prevTest.weak_subjects || []).length : currentWeak;
              const weakReduction = prevWeak > 0 ? Math.max(0, ((prevWeak - currentWeak) / prevWeak) * 100) : (currentWeak === 0 ? 100 : 0);
              
              const testWeekStart = new Date(latestTest.week_start);
              const testWeekEnd = new Date(latestTest.week_end);
              const testWeekSessions = sessions?.filter(s => {
                const d = new Date(s.created_at);
                return d >= testWeekStart && d <= testWeekEnd;
              }) || [];
              const testWeekDays = new Set(testWeekSessions.map(s => new Date(s.created_at).toDateString())).size;
              const consistencyScore = (testWeekDays / 7) * 100;

              const wps = Math.round(
                (accuracy * 0.5) + (improvement * 0.25) + (weakReduction * 0.15) + (consistencyScore * 0.10)
              );
              setWeeklyWPS(wps);
            }
          }

          // Load rankings in parallel (non-blocking)
          loadRankingData(student.id);
        }
        setIsDataLoading(false);
      } else {
        setUserName(user.user_metadata?.full_name || user.email?.split("@")[0] || "Student");
        setIsApproved(null);
        setIsDataLoading(false);
      }
    } catch (error) {
      console.error("Error loading student data:", error);
      setIsDataLoading(false);
    }
  };

  const loadRankingData = async (studentIdToLoad: string) => {
    try {
      // Fetch rankings
      const { data, error } = await supabase.functions.invoke("get-students", {
        body: {
          action: "get_student_rankings",
          student_id: studentIdToLoad,
        },
      });

      if (error) {
        console.error("Error fetching rankings:", error);
        return;
      }

      if (data) {
        setMySchoolRank(data.mySchoolRank);
        setMyDistrictRank(data.myDistrictRank);
        setTotalSchoolStudents(data.totalSchoolStudents || 0);
        setTotalDistrictStudents(data.totalDistrictStudents || 0);
        setRankingHistory(data.rankingHistory || []);
      }

      // Fetch achievements
      const { data: achievementsData } = await supabase
        .from("achievements")
        .select("*")
        .eq("student_id", studentIdToLoad)
        .order("achieved_at", { ascending: false })
        .limit(20);
      
      if (achievementsData) {
        setAchievements(achievementsData);
      }

      // Fetch notifications
      const { data: notificationsData } = await supabase
        .from("rank_notifications")
        .select("*")
        .eq("student_id", studentIdToLoad)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (notificationsData) {
        setNotifications(notificationsData);
      }
    } catch (err) {
      console.error("Error loading ranking data:", err);
    }
  };

  const handleMarkNotificationRead = async (notificationId: string) => {
    try {
      await supabase
        .from("rank_notifications")
        .update({ is_read: true })
        .eq("id", notificationId);
      
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const formatDate = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString();
  };

  const handleStartStudy = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    // Prevent default and stop propagation for touch events to avoid double-firing
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (isApproved === false) {
      toast({
        title: "Approval Pending",
        description: "Aapka account abhi approve nahi hua. Please wait!",
        variant: "destructive",
      });
      return;
    }
    
    console.log("Navigating to study page via internal router...");
    
    // Use router navigation for WebView/PWA compatibility
    // This avoids window.open, popups, or external redirects
    // Works in: Desktop, Mobile Browser, PWA, WebView, APK
    try {
      navigate("/study");
    } catch (err) {
      console.error("Router navigation error, using SPA history fallback:", err);
      // Fallback: keep it INTERNAL (no full reload) for WebView/PWA/APK
      try {
        window.history.pushState({}, "", "/study");
        window.dispatchEvent(new PopStateEvent("popstate"));
      } catch (fallbackErr) {
        console.error("History fallback failed:", fallbackErr);
      }
    }
  }, [isApproved, toast, navigate]);

  // handleEndStudy is now in StudyPage.tsx - study sessions are handled via route navigation


  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  if (loading || isDataLoading) {
    return <DashboardSkeleton />;
  }

  // Show pending approval or rejection screen
  if (isApproved === false) {
    const isRejected = rejectionReason !== null;
    
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="edu-card p-8 max-w-md text-center">
          <div className={`w-20 h-20 rounded-full ${isRejected ? 'bg-destructive/20' : 'bg-warning/20'} flex items-center justify-center mx-auto mb-6`}>
            {isRejected ? (
              <XCircle className="w-10 h-10 text-destructive" />
            ) : (
              <Clock className="w-10 h-10 text-warning" />
            )}
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {isRejected ? "Registration Rejected" : "Approval Pending"}
          </h1>
          <p className="text-muted-foreground mb-4">
            Namaste {userName}! 👋
          </p>
          
          {isRejected ? (
            <>
              <p className="text-muted-foreground mb-4">
                Your registration has been rejected by <strong>{schoolName}</strong>.
              </p>
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 mb-6">
                <p className="text-sm font-medium text-destructive mb-1">Rejection Reason:</p>
                <p className="text-sm text-foreground">{rejectionReason}</p>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                If you think this was a mistake, please contact your school.
              </p>
            </>
          ) : (
            <>
              <p className="text-muted-foreground mb-6">
                Your account is pending approval from <strong>{schoolName}</strong>. 
                Once approved, you can start studying.
              </p>
              <div className="bg-secondary/50 rounded-xl p-4 mb-6">
                <p className="text-sm text-muted-foreground">
                  🔔 Your school has been notified. Please wait!
                </p>
              </div>
            </>
          )}
          
          <Button variant="outline" onClick={handleLogout} className="w-full">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    );
  }


  // Study sessions now use route navigation (/study) for WebView/PWA compatibility

  return (
    <div className="min-h-screen liquid-bg pb-20 sm:pb-0 relative overflow-hidden">
      {/* Liquid background orbs - smaller on mobile */}
      <div className="liquid-orb liquid-orb-blue w-[250px] sm:w-[350px] h-[250px] sm:h-[350px] -top-20 sm:-top-32 -left-16 sm:-left-20 opacity-30" />
      <div className="liquid-orb liquid-orb-purple w-[180px] sm:w-[250px] h-[180px] sm:h-[250px] top-40 -right-16 sm:-right-20 opacity-25" style={{ animationDelay: '3s' }} />
      
      {/* Header */}
      <header className="glass-nav border-b border-border/20 sticky top-0 z-10">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <img 
                src="/logo.png" 
                alt="Gyanam AI" 
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex-shrink-0 object-contain"
              />
              <div className="min-w-0">
                <span className="font-bold font-display text-sm sm:text-lg truncate block">{t('app.name')}</span>
                <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">{t('nav.dashboard')}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-3">
              <ThemeToggle />
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate("/profile")}
                className="sm:hidden"
              >
                <User className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate("/profile")}
                className="hidden sm:flex items-center gap-2"
              >
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <span className="font-medium">{userName}</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl relative z-10">
        {/* Welcome & Start Study */}
        <div className="mb-6 sm:mb-8 animate-fade-in">
          <div className="glass-card relative overflow-hidden p-5 sm:p-8 md:p-10 text-center"
            style={{
              background: 'var(--gradient-liquid)',
            }}
          >
            {/* Animated background orbs */}
            <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-primary/10 blur-3xl animate-pulse-slow" />
            <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-accent/10 blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
            
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-primary animate-pulse-slow" />
               <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Daily Motivation
                </span>
                <Sparkles className="w-5 h-5 text-accent animate-pulse-slow" style={{ animationDelay: '1s' }} />
              </div>
              
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold mb-2 font-display">
                Hello, {userName}! 👋
              </h1>
              
              <MotivationalQuote studied={todayStats.studied} />
              
              <div className="flex flex-wrap justify-center gap-3 mt-5">
                <Button 
                  variant="hero" 
                  size="lg" 
                  className="text-sm sm:text-base touch-manipulation px-8 hover-scale"
                  onClick={handleStartStudy}
                  onTouchStart={handleStartStudy}
                >
                  <Play className="w-5 h-5" />
                  Start Studying
                </Button>
                <Button variant="outline" size="lg" className="text-sm sm:text-base hover-scale border-primary/50 bg-primary/5" onClick={() => navigate("/exam-prep")}>
                  <Target className="w-5 h-5 text-primary" />
                  AI Exam Prep
                </Button>
              </div>
            </div>
          </div>
        </div>


        {/* Main Tabs: Study / Rankings */}
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "study" | "rankings")} className="mb-6">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="study" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Study
            </TabsTrigger>
            <TabsTrigger value="rankings" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Rankings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="study" className="mt-6">
            {/* Analytics Toggle */}
            <div className="flex justify-center mb-6">
              <Tabs value={analyticsView} onValueChange={(v) => setAnalyticsView(v as "today" | "week")} className="w-auto">
                <TabsList className="grid grid-cols-2 w-64">
                  <TabsTrigger value="today" className="flex items-center gap-2">
                    <Sun className="w-4 h-4" />
                    Today
                  </TabsTrigger>
                  <TabsTrigger value="week" className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" />
                    This Week
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Stats Grid - Today View */}
            {analyticsView === "today" && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard
                  icon={<CheckCircle className="w-5 h-5" />}
                  label="Today Status"
                  value={todayStats.studied ? "Studied ✓" : "Not Yet"}
                  color={todayStats.studied ? "accent" : "muted"}
                />
                <StatCard
                  icon={<BookOpen className="w-5 h-5" />}
                  label="Today Sessions"
                  value={todayStats.sessions.toString()}
                  color="primary"
                />
                <StatCard
                  icon={<Clock className="w-5 h-5" />}
                  label="Today's Time"
                  value={`${Math.floor(todayStats.minutes / 60)}h ${todayStats.minutes % 60}m`}
                  color="primary"
                />
                <StatCard
                  icon={<TrendingUp className="w-5 h-5" />}
                  label="Today Score"
                  value={todayStats.avgScore > 0 ? `${todayStats.avgScore}%` : "-"}
                  color="accent"
                />
              </div>
            )}

            {/* Stats Grid - Week View */}
            {analyticsView === "week" && (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <StatCard
                  icon={<Zap className="w-5 h-5" />}
                  label="WPS Score"
                  value={weeklyWPS !== null ? `${weeklyWPS}%` : "-"}
                  color={weeklyWPS !== null && weeklyWPS >= 70 ? "accent" : "primary"}
                />
                <StatCard
                  icon={<CalendarDays className="w-5 h-5" />}
                  label="Days Studied"
                  value={`${weekStats.daysStudied}/7`}
                  color={weekStats.daysStudied >= 5 ? "accent" : "primary"}
                />
                <StatCard
                  icon={<BookOpen className="w-5 h-5" />}
                  label="Week Sessions"
                  value={weekStats.sessions.toString()}
                  color="primary"
                />
                <StatCard
                  icon={<Clock className="w-5 h-5" />}
                  label="Week Time"
                  value={`${Math.floor(weekStats.minutes / 60)}h ${weekStats.minutes % 60}m`}
                  color="primary"
                />
                <StatCard
                  icon={<Target className="w-5 h-5" />}
                  label="Test Accuracy"
                  value={latestTestAccuracy !== null ? `${latestTestAccuracy}%` : "-"}
                  color="accent"
                />
              </div>
            )}

            {/* Recent Sessions */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-bold mb-4 font-display">Recent Study Sessions</h2>
              {recentSessions.length > 0 ? (
                <div className="space-y-3">
                  {recentSessions.map((session) => (
                    <div
                      key={session.id}
                      className="session-row"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{session.topic}</p>
                          <p className="text-sm text-muted-foreground">{session.date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{session.duration} min</p>
                        <p className="text-sm text-accent font-medium">Score: {session.score}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No study sessions yet. Start your first session!</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="rankings" className="mt-6">
            <StudentRankingCard
              mySchoolRank={mySchoolRank}
              myDistrictRank={myDistrictRank}
              totalSchoolStudents={totalSchoolStudents}
              totalDistrictStudents={totalDistrictStudents}
              schoolName={schoolName}
              district={studentDistrict}
              rankingHistory={rankingHistory}
              achievements={achievements}
              notifications={notifications}
              onMarkNotificationRead={handleMarkNotificationRead}
            />
          </TabsContent>
        </Tabs>
      </main>
      <BottomNavBar />
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "primary" | "accent" | "muted";
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ icon, label, value, color }, ref) => {
    const colorClasses = {
      primary: "bg-primary/10 text-primary",
      accent: "bg-accent/10 text-accent",
      muted: "bg-muted text-muted-foreground",
    };

    return (
      <div ref={ref} className="glass-card p-4 card-hover-lift">
        <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3`}>
          {icon}
        </div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xl font-bold font-display">{value}</p>
      </div>
    );
  }
);

StatCard.displayName = "StatCard";

const QUOTES = [
  "Every expert was once a beginner. Keep going! 🚀",
  "Small daily progress leads to big results! 📈",
  "Your future self will thank you for studying today! 💪",
  "Champions study when no one is watching! 🏆",
  "Knowledge is the one thing no one can take from you! 🧠",
  "Today's effort is tomorrow's success! ⭐",
  "Be curious. Stay hungry for knowledge! 🔥",
  "The more you learn, the more you earn! 💡",
];

const MotivationalQuote = ({ studied }: { studied: boolean }) => {
  const quote = React.useMemo(() => {
    const dayIndex = new Date().getDate() % QUOTES.length;
    return QUOTES[dayIndex];
  }, []);

  return (
    <p className="text-sm sm:text-base text-muted-foreground italic max-w-lg mx-auto leading-relaxed">
      "{quote}"
    </p>
  );
};

export default StudentDashboard;
