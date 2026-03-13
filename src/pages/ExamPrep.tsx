import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useExamPrep, ExamPrepSession } from '@/hooks/useExamPrep';
import { useToast } from '@/hooks/use-toast';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import ExamPrepOnboarding from '@/components/exam-prep/ExamPrepOnboarding';
import ExamPrepDashboard from '@/components/exam-prep/ExamPrepDashboard';
import ExamPrepChat from '@/components/exam-prep/ExamPrepChat';
import InviteModal from '@/components/exam-prep/InviteModal';
import DailyStudyPlan from '@/components/exam-prep/DailyStudyPlan';
import IntroLessons from '@/components/exam-prep/IntroLessons';
import QuizzesFlashcards from '@/components/exam-prep/QuizzesFlashcards';

type View = 'loading' | 'dashboard' | 'onboarding' | 'chat' | 'study_plan' | 'intro_lessons' | 'quizzes';

const ExamPrep = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const {
    access, sessions, loading, error,
    createSession, extractContent, sendChat, generateVirtualExam, evaluateVirtualExam, createInvite, joinInvite, refresh,
  } = useExamPrep();

  const [view, setView] = useState<View>('loading');
  const [activeSession, setActiveSession] = useState<ExamPrepSession | null>(null);
  const [inviteModal, setInviteModal] = useState<{ open: boolean; code: string | null; loading: boolean }>({
    open: false, code: null, loading: false,
  });

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const inviteCode = searchParams.get('invite');
    if (inviteCode && access) {
      joinInvite(inviteCode).then((session) => {
        if (session) {
          toast({ title: 'Joined study session!' });
          refresh();
        }
      }).catch(() => toast({ title: 'Invalid invite link', variant: 'destructive' }));
    }
  }, [searchParams, access]);

  useEffect(() => {
    if (!loading && access) setView('dashboard');
  }, [loading, access]);

  if (authLoading || loading || !access) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-destructive font-semibold">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="text-primary underline mt-2 text-sm">
            Go back
          </button>
        </div>
      </div>
    );
  }

  const handleCreateSession = async (data: {
    examName: string;
    examDate?: string;
    targetScore?: number;
    topicFamiliarity: string;
    mood: string;
  }) => {
    try {
      const session = await createSession(data);
      setActiveSession(session);
      setView('chat');
      toast({ title: 'Session created!' });
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleInvite = async (sessionId: string) => {
    setInviteModal({ open: true, code: null, loading: true });
    try {
      const invite = await createInvite(sessionId);
      setInviteModal({ open: true, code: invite.invite_code, loading: false });
    } catch {
      setInviteModal({ open: true, code: null, loading: false });
    }
  };

  const handleFeature = (feature: string, session?: ExamPrepSession) => {
    if (session) setActiveSession(session);
    if (feature === 'study_plan') setView('study_plan');
    else if (feature === 'intro_lessons') setView('intro_lessons');
    else if (feature === 'quizzes') setView('quizzes');
  };

  if (view === 'onboarding') {
    return (
      <ExamPrepOnboarding
        studentName={access.studentName}
        onComplete={handleCreateSession}
        onBack={() => setView('dashboard')}
      />
    );
  }

  if (view === 'chat' && activeSession) {
    return (
      <ExamPrepChat
        session={activeSession}
        studentName={access.studentName}
        onSendMessage={sendChat}
        onGenerateExam={generateVirtualExam}
        onEvaluateExam={evaluateVirtualExam}
        onBack={() => { setView('dashboard'); setActiveSession(null); }}
      />
    );
  }

  if (view === 'study_plan' && activeSession) {
    return (
      <DailyStudyPlan
        sessionId={activeSession.id}
        onBack={() => setView('dashboard')}
      />
    );
  }

  if (view === 'intro_lessons' && activeSession) {
    return (
      <IntroLessons
        session={activeSession}
        onBack={() => setView('dashboard')}
      />
    );
  }

  if (view === 'quizzes' && activeSession) {
    return (
      <QuizzesFlashcards
        sessionId={activeSession.id}
        topics={activeSession.extracted_topics || []}
        onBack={() => setView('dashboard')}
      />
    );
  }

  return (
    <>
      <ExamPrepDashboard
        access={access}
        sessions={sessions}
        onNewSession={() => {
          if (access.sessionsRemaining <= 0) {
            toast({ title: 'Monthly limit reached', description: `Upgrade for more sessions`, variant: 'destructive' });
            return;
          }
          setView('onboarding');
        }}
        onOpenChat={(session) => { setActiveSession(session); setView('chat'); }}
        onInvite={handleInvite}
        onExtract={extractContent}
        onBack={() => navigate('/dashboard')}
        onFeature={handleFeature}
      />
      {inviteModal.open && (
        <InviteModal
          inviteCode={inviteModal.code}
          loading={inviteModal.loading}
          onClose={() => setInviteModal({ open: false, code: null, loading: false })}
        />
      )}
    </>
  );
};

export default ExamPrep;
