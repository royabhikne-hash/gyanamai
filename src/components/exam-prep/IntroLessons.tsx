import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Loader2, GraduationCap, BookOpen, ChevronRight, Lightbulb, HelpCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ExamPrepSession } from '@/hooks/useExamPrep';

interface LessonSection {
  heading: string;
  content: string;
  example: string | null;
}

interface Lesson {
  lessonTitle: string;
  introduction: string;
  sections: LessonSection[];
  keyTakeaways: string[];
  quickQuestion: { question: string; answer: string };
}

interface Props {
  session: ExamPrepSession;
  onBack: () => void;
}

const IntroLessons: React.FC<Props> = ({ session, onBack }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  const topics = (session.extracted_topics || []).map((t: any) =>
    typeof t === 'string' ? t : t.name || t.topic || 'Unknown'
  );

  const loadLesson = async (topicName: string) => {
    setSelectedTopic(topicName);
    setLesson(null);
    setShowAnswer(false);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('exam-prep', {
        body: { action: 'generate_intro_lesson', sessionId: session.id, topicName },
      });
      if (error) throw error;
      if (data?.lesson) setLesson(data.lesson);
      else throw new Error('No lesson generated');
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
      setSelectedTopic(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-semibold">Creating lesson on "{selectedTopic}"...</p>
      </div>
    );
  }

  if (lesson && selectedTopic) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="p-6 pt-8">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => { setLesson(null); setSelectedTopic(null); }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">{lesson.lessonTitle}</h1>
              <p className="text-xs text-muted-foreground">{selectedTopic}</p>
            </div>
          </div>

          <Card className="mb-4 bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <p className="text-sm text-foreground leading-relaxed">{lesson.introduction}</p>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {lesson.sections.map((sec, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" /> {sec.heading}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{sec.content}</p>
                  {sec.example && (
                    <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Example:</p>
                      <p className="text-sm">{sec.example}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {lesson.keyTakeaways.length > 0 && (
            <Card className="mt-4 border-accent/30">
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" /> Key Takeaways
                </h3>
                <ul className="space-y-1">
                  {lesson.keyTakeaways.map((t, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-1">•</span> {t}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {lesson.quickQuestion && (
            <Card className="mt-4">
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-accent" /> Quick Check
                </h3>
                <p className="text-sm font-medium mb-3">{lesson.quickQuestion.question}</p>
                {showAnswer ? (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm">{lesson.quickQuestion.answer}</p>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setShowAnswer(true)}>
                    Show Answer
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Topic list
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="p-6 pt-8">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-xl font-bold">Intro Lessons</h1>
            <p className="text-sm text-muted-foreground">Learn concepts from your material</p>
          </div>
        </div>

        {topics.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="p-8 text-center">
              <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Upload study material first to generate intro lessons.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {topics.map((topic: string, i: number) => (
              <Card key={i} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => loadLesson(topic)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {i + 1}
                    </div>
                    <p className="text-sm font-medium">{topic}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default IntroLessons;
