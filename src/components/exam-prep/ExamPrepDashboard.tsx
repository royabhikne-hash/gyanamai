import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Upload, Calendar, Target, BarChart3, BookOpen, Brain,
  GraduationCap, ClipboardList, Plus, ArrowLeft, Share2, Loader2, Sparkles, ListChecks
} from 'lucide-react';
import { ExamPrepAccess, ExamPrepSession } from '@/hooks/useExamPrep';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Feature = 'study_plan' | 'tutor' | 'intro_lessons' | 'quizzes';

interface Props {
  access: ExamPrepAccess;
  sessions: ExamPrepSession[];
  onNewSession: () => void;
  onOpenChat: (session: ExamPrepSession) => void;
  onInvite: (sessionId: string) => void;
  onExtract: (sessionId: string, fileUrl: string, fileName: string) => Promise<any>;
  onBack: () => void;
  onFeature: (feature: Feature, session?: ExamPrepSession) => void;
  onRefresh?: () => void;
}

const ExamPrepDashboard: React.FC<Props> = ({
  access, sessions, onNewSession, onOpenChat, onInvite, onExtract, onBack, onFeature, onRefresh,
}) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<string | null>(null);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [planning, setPlanning] = useState<string | null>(null);
  const [planResult, setPlanResult] = useState<{ sessionId: string; plan: any } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadSessionId, setUploadSessionId] = useState<string | null>(null);

  const getMaterialCount = (session: ExamPrepSession) => {
    const materialCount = session.exam_prep_materials?.length || 0;
    if (materialCount > 0) return materialCount;
    return (session.extracted_topics?.length || 0) > 0 ? 1 : 0;
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, sessionId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 25MB. Please upload a smaller file or split your document.', variant: 'destructive' });
      return;
    }

    try {
      setUploading(sessionId);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${user.id}/${sessionId}/${Date.now()}_${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from('exam-prep-materials')
        .upload(filePath, file);

      if (uploadErr) throw uploadErr;

      toast({ title: 'Uploaded!', description: 'Now extracting content...' });

      setExtracting(sessionId);
      await onExtract(sessionId, filePath, file.name);
      toast({ title: 'Content extracted!', description: 'AI has analyzed your material' });
      onRefresh?.();
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      e.target.value = '';
      setUploading(null);
      setExtracting(null);
    }
  };

  const callExamPrep = async (action: string, sessionId: string) => {
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/exam-prep`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session?.access_token}`,
        },
        body: JSON.stringify({ action, sessionId }),
      }
    );
    return res.json();
  };

  const handleAnalyzeSyllabus = async (sessionId: string) => {
    try {
      setAnalyzing(sessionId);
      const result = await callExamPrep("analyze_full_syllabus", sessionId);
      if (result.error) throw new Error(result.error);
      toast({ title: "Syllabus analyzed ✨", description: `${result.structure?.subjects?.length || 0} subjects mapped by ${"board"} pattern.` });
      onRefresh?.();
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(null);
    }
  };

  const handleGeneratePlan = async (sessionId: string) => {
    try {
      setPlanning(sessionId);
      const result = await callExamPrep("generate_priority_plan", sessionId);
      if (result.error) throw new Error(result.error);
      setPlanResult({ sessionId, plan: result.plan });
      toast({ title: "Plan ready! 🎯", description: `${result.plan?.days?.length || 0}-day prioritized plan generated.` });
    } catch (err: any) {
      toast({ title: "Plan failed", description: err.message, variant: "destructive" });
    } finally {
      setPlanning(null);
    }
  };

  const menuItems: { icon: any; label: string; desc: string; color: string; feature: Feature; needsSession: boolean }[] = [
    { icon: BookOpen, label: 'Daily Study Plan', desc: 'AI-generated schedule', color: 'text-primary', feature: 'study_plan', needsSession: true },
    { icon: Brain, label: 'Personal AI Tutor', desc: 'Chat with your tutor', color: 'text-accent', feature: 'tutor', needsSession: true },
    { icon: GraduationCap, label: 'Intro Lessons', desc: 'Learn new concepts', color: 'text-[hsl(var(--edu-purple))]', feature: 'intro_lessons', needsSession: true },
    { icon: ClipboardList, label: 'Quizzes & Flashcards', desc: 'Test your knowledge', color: 'text-[hsl(var(--edu-orange))]', feature: 'quizzes', needsSession: true },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-accent/5 p-6 pt-8">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Smart AI Exam Prep</h1>
            <p className="text-sm text-muted-foreground">
              {access.sessionsRemaining} of {access.monthlyLimit} sessions left this month
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onNewSession} disabled={access.sessionsRemaining <= 0}>
            <Plus className="h-4 w-4 mr-1" /> New
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Upload, label: 'Materials', value: sessions.reduce((a, s) => a + getMaterialCount(s), 0) },
            { icon: Calendar, label: 'Sessions', value: access.sessionsUsed },
            { icon: Target, label: 'Plan', value: access.plan.toUpperCase() },
          ].map((stat, i) => (
            <Card key={i} className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardContent className="p-3 text-center">
                <stat.icon className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Feature Menu */}
      <div className="p-4 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">Features</h2>
        {menuItems.map((item, i) => (
          <Card
            key={i}
            className="bg-card hover:bg-muted/50 transition-colors cursor-pointer border-border/50"
            onClick={() => {
              if (item.needsSession && sessions.length === 0) {
                toast({ title: 'Create a session first', description: 'Start a new exam prep session to use this feature.', variant: 'destructive' });
                return;
              }
              if (item.feature === 'tutor' && sessions.length > 0) {
                onOpenChat(sessions[0]);
              } else {
                onFeature(item.feature, sessions[0]);
              }
            }}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-muted">
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sessions */}
      <div className="p-4 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">Your Sessions</h2>
        {sessions.length === 0 ? (
          <Card className="bg-card border-dashed border-2 border-border">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No sessions yet. Start your first exam prep!</p>
              <Button className="mt-4" onClick={onNewSession} disabled={access.sessionsRemaining <= 0}>
                <Plus className="h-4 w-4 mr-2" /> Create Session
              </Button>
            </CardContent>
          </Card>
        ) : (
          sessions.map((session) => (
            <Card key={session.id} className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-foreground">{session.exam_name || 'Untitled Exam'}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.exam_date ? `📅 ${session.exam_date}` : 'No date set'}
                      {session.target_score ? ` • 🎯 Target: ${session.target_score}` : ''}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => onInvite(session.id)}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Materials */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-muted-foreground">
                    {getMaterialCount(session)} material(s)
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.txt,.doc,.docx"
                    className="hidden"
                    ref={uploadSessionId === session.id ? fileInputRef : undefined}
                    onChange={(e) => handleUpload(e, session.id)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={uploading === session.id || extracting === session.id}
                    onClick={() => {
                      setUploadSessionId(session.id);
                      setTimeout(() => fileInputRef.current?.click(), 50);
                    }}
                  >
                    {uploading === session.id || extracting === session.id ? (
                      <><Loader2 className="h-3 w-3 animate-spin mr-1" />
                        {extracting === session.id ? 'Extracting...' : 'Uploading...'}</>
                    ) : (
                      <><Upload className="h-3 w-3 mr-1" /> Upload PDF</>
                    )}
                  </Button>
                </div>

                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => onOpenChat(session)}
                >
                  <Brain className="h-4 w-4 mr-2" /> Open AI Tutor
                </Button>

                {/* New priority-plan algorithm */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={analyzing === session.id || getMaterialCount(session) === 0}
                    onClick={() => handleAnalyzeSyllabus(session.id)}
                  >
                    {analyzing === session.id
                      ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Mapping...</>
                      : <><Sparkles className="h-3 w-3 mr-1" /> Analyze Syllabus</>}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={planning === session.id}
                    onClick={() => handleGeneratePlan(session.id)}
                  >
                    {planning === session.id
                      ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Planning...</>
                      : <><ListChecks className="h-3 w-3 mr-1" /> Priority Plan</>}
                  </Button>
                </div>

                {planResult?.sessionId === session.id && planResult.plan && (
                  <div className="mt-3 p-3 rounded-xl bg-muted/40 border border-border/60 space-y-2 max-h-72 overflow-y-auto">
                    <p className="text-xs font-semibold text-foreground">
                      {planResult.plan.totalDays}-day plan • {planResult.plan.phases?.length || 0} phases
                    </p>
                    {(planResult.plan.days || []).slice(0, 14).map((d: any) => (
                      <div key={d.day} className="text-[11px] border-l-2 border-primary/40 pl-2">
                        <p className="font-medium text-foreground">
                          Day {d.day} • {d.date} • <span className={
                            d.priority === "critical" ? "text-destructive"
                            : d.priority === "high" ? "text-primary" : "text-muted-foreground"
                          }>{d.priority}</span>
                        </p>
                        <p className="text-muted-foreground">
                          {d.subject} › {d.chapter} • {d.estimatedMinutes} min • {d.mcqCount} MCQs
                        </p>
                        <p className="text-muted-foreground">{d.task}</p>
                      </div>
                    ))}
                    {(planResult.plan.days?.length || 0) > 14 && (
                      <p className="text-[10px] text-muted-foreground">+ {planResult.plan.days.length - 14} more days…</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ExamPrepDashboard;
