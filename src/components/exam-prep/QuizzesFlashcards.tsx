import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Loader2, ClipboardCheck, RotateCcw, CheckCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

interface Flashcard {
  id: number;
  front: string;
  back: string;
}

interface QuizData {
  quizTitle: string;
  questions: QuizQuestion[];
  flashcards: Flashcard[];
}

interface Props {
  sessionId: string;
  topics: any[];
  onBack: () => void;
}

type Mode = 'menu' | 'quiz' | 'quiz_result' | 'flashcards';

const QuizzesFlashcards: React.FC<Props> = ({ sessionId, topics, onBack }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('menu');
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [currentCard, setCurrentCard] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const topicNames = topics.map((t: any) => typeof t === 'string' ? t : t.name || t.topic || 'Unknown');

  const generate = async (topicName?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('exam-prep', {
        body: { action: 'generate_quiz_flashcards', sessionId, topicName: topicName || 'all topics' },
      });
      if (error) throw error;
      if (data?.quizData) {
        setQuizData(data.quizData);
        setAnswers(new Array(data.quizData.questions?.length || 0).fill(''));
        setCurrentQ(0);
        setSubmitted(false);
        setCurrentCard(0);
        setFlipped(false);
      } else throw new Error('Failed');
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-semibold">Generating quizzes & flashcards...</p>
      </div>
    );
  }

  // Menu
  if (mode === 'menu' && !quizData) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="p-6 pt-8">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
            <h1 className="text-xl font-bold">Quizzes & Flashcards</h1>
          </div>

          {topicNames.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="p-8 text-center">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Upload study material first.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Button className="w-full mb-4" onClick={() => generate()}>
                <ClipboardCheck className="h-4 w-4 mr-2" /> Generate from All Topics
              </Button>
              <p className="text-xs text-muted-foreground mb-2">Or pick a topic:</p>
              <div className="space-y-2">
                {topicNames.map((t: string, i: number) => (
                  <Card key={i} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => generate(t)}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <p className="text-sm font-medium">{t}</p>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Quiz mode
  if ((mode === 'menu' || mode === 'quiz') && quizData && !submitted) {
    const q = quizData.questions[currentQ];
    if (!q) {
      setMode('menu');
      return null;
    }
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="p-6 pt-8">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="icon" onClick={() => { setQuizData(null); setMode('menu'); }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-lg font-bold">{quizData.quizTitle}</h1>
              <p className="text-xs text-muted-foreground">Q {currentQ + 1}/{quizData.questions.length}</p>
            </div>
          </div>

          <Card>
            <CardContent className="p-5">
              <p className="text-sm font-medium mb-4 leading-relaxed">{q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const letter = opt.charAt(0);
                  const sel = answers[currentQ] === letter;
                  return (
                    <button
                      key={oi}
                      onClick={() => {
                        const n = [...answers];
                        n[currentQ] = letter;
                        setAnswers(n);
                      }}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all text-sm ${sel ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/30'}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between mt-4">
            <Button variant="outline" size="sm" disabled={currentQ === 0} onClick={() => setCurrentQ(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            {currentQ < quizData.questions.length - 1 ? (
              <Button size="sm" onClick={() => setCurrentQ(p => p + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => setSubmitted(true)}>
                Check Answers
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Quiz result
  if (submitted && quizData) {
    const correct = quizData.questions.filter((q, i) => answers[i] === q.correctAnswer).length;
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="p-6 pt-8">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => { setQuizData(null); setSubmitted(false); setMode('menu'); }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold">Quiz Results</h1>
          </div>

          <Card className="mb-4">
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-primary">{correct}/{quizData.questions.length}</p>
              <p className="text-sm text-muted-foreground">
                {correct === quizData.questions.length ? '🎉 Perfect!' : correct >= quizData.questions.length / 2 ? '👍 Good job!' : '📚 Keep practicing!'}
              </p>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {quizData.questions.map((q, i) => {
              const isCorrect = answers[i] === q.correctAnswer;
              return (
                <Card key={i} className={isCorrect ? 'border-green-500/30' : 'border-red-500/30'}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                      {isCorrect ? <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />}
                      <div>
                        <p className="text-sm font-medium">{q.question}</p>
                        <p className="text-xs mt-1">Your answer: <span className={isCorrect ? 'text-green-600' : 'text-red-600'}>{answers[i] || 'Not attempted'}</span>
                          {!isCorrect && <> | Correct: <span className="text-green-600">{q.correctAnswer}</span></>}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{q.explanation}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => { setSubmitted(false); setAnswers(new Array(quizData.questions.length).fill('')); setCurrentQ(0); }}>
              <RotateCcw className="h-4 w-4 mr-1" /> Retry
            </Button>
            <Button className="flex-1" onClick={() => { setMode('flashcards'); setCurrentCard(0); setFlipped(false); }}>
              📇 Flashcards
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Flashcards
  if (mode === 'flashcards' && quizData?.flashcards) {
    const card = quizData.flashcards[currentCard];
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="p-6 pt-8">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => { setMode('menu'); setQuizData(null); }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-lg font-bold">Flashcards</h1>
              <p className="text-xs text-muted-foreground">{currentCard + 1} of {quizData.flashcards.length}</p>
            </div>
          </div>

          <div
            onClick={() => setFlipped(!flipped)}
            className="cursor-pointer min-h-[250px] flex items-center justify-center"
          >
            <Card className={`w-full transition-all duration-300 ${flipped ? 'bg-primary/5 border-primary/30' : ''}`}>
              <CardContent className="p-8 text-center">
                <p className="text-xs text-muted-foreground mb-3">{flipped ? 'ANSWER' : 'QUESTION'}</p>
                <p className="text-lg font-medium leading-relaxed">
                  {flipped ? card.back : card.front}
                </p>
                <p className="text-xs text-muted-foreground mt-4">Tap to {flipped ? 'see question' : 'reveal answer'}</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-between mt-6">
            <Button variant="outline" disabled={currentCard === 0} onClick={() => { setCurrentCard(p => p - 1); setFlipped(false); }}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <div className="flex gap-1">
              {quizData.flashcards.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${i === currentCard ? 'bg-primary' : 'bg-muted'}`} />
              ))}
            </div>
            <Button variant="outline" disabled={currentCard >= quizData.flashcards.length - 1} onClick={() => { setCurrentCard(p => p + 1); setFlipped(false); }}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default QuizzesFlashcards;
