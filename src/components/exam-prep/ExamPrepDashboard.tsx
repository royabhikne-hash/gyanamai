import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Upload, Calendar, Target, BarChart3, BookOpen, Brain,
  GraduationCap, ClipboardList, Plus, ArrowLeft, Share2, Loader2
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
      const filePath = `${access.studentId}/${sessionId}/${Date.now()}_${file.name}`;
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
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ExamPrepDashboard;
