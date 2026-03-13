import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Loader2, Calendar, Clock, Lightbulb, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StudyBlock {
  time: string;
  topic: string;
  activity: string;
  duration: string;
  tip: string;
}

interface DayPlan {
  day: number;
  date: string;
  theme: string;
  blocks: StudyBlock[];
}

interface StudyPlan {
  planTitle: string;
  totalDays: number;
  dailyStudyHours: number;
  days: DayPlan[];
  tips: string[];
}

interface Props {
  sessionId: string;
  onBack: () => void;
}

const DailyStudyPlan: React.FC<Props> = ({ sessionId, onBack }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [completedBlocks, setCompletedBlocks] = useState<Set<string>>(new Set());
  const [expandedDay, setExpandedDay] = useState<number>(0);

  const generatePlan = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('exam-prep', {
        body: { action: 'generate_study_plan', sessionId },
      });
      if (error) throw error;
      if (data?.plan) {
        setPlan(data.plan);
        setExpandedDay(0);
      } else throw new Error('No plan generated');
    } catch (err: any) {
      toast({ title: 'Failed to generate plan', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggleBlock = (key: string) => {
    setCompletedBlocks(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (!plan && !loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="p-6 pt-8">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
            <h1 className="text-xl font-bold">Daily Study Plan</h1>
          </div>
          <Card className="border-dashed border-2">
            <CardContent className="p-8 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h2 className="text-lg font-semibold mb-2">Generate Your Study Plan</h2>
              <p className="text-muted-foreground text-sm mb-6">
                AI will create a personalized day-by-day study schedule based on your uploaded material and exam date.
              </p>
              <Button onClick={generatePlan} size="lg">
                <Calendar className="h-4 w-4 mr-2" /> Generate Plan
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-semibold">Creating your study plan...</p>
        <p className="text-sm text-muted-foreground">Analyzing your material and exam schedule</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="p-6 pt-8">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{plan?.planTitle}</h1>
            <p className="text-xs text-muted-foreground">{plan?.totalDays} days • ~{plan?.dailyStudyHours}h/day</p>
          </div>
          <Button variant="outline" size="sm" onClick={generatePlan}><Loader2 className="h-3 w-3 mr-1" /> Regenerate</Button>
        </div>

        <div className="space-y-3">
          {plan?.days.map((day, di) => {
            const isExpanded = expandedDay === di;
            const dayCompleted = day.blocks.every((_, bi) => completedBlocks.has(`${di}-${bi}`));
            return (
              <Card key={di} className={`transition-all ${dayCompleted ? 'border-primary/50 bg-primary/5' : ''}`}>
                <CardContent className="p-0">
                  <button
                    onClick={() => setExpandedDay(isExpanded ? -1 : di)}
                    className="w-full p-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${dayCompleted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        {dayCompleted ? <CheckCircle className="h-4 w-4" /> : day.day}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{day.date}</p>
                        <p className="text-xs text-muted-foreground">{day.theme}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{day.blocks.length} blocks</span>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-2">
                      {day.blocks.map((block, bi) => {
                        const key = `${di}-${bi}`;
                        const done = completedBlocks.has(key);
                        return (
                          <button
                            key={bi}
                            onClick={() => toggleBlock(key)}
                            className={`w-full text-left p-3 rounded-xl border transition-all ${done ? 'border-primary/50 bg-primary/5 opacity-70' : 'border-border bg-card hover:bg-muted/50'}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${done ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                                {done && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">{block.time} • {block.duration}</span>
                                </div>
                                <p className={`text-sm font-medium mt-1 ${done ? 'line-through' : ''}`}>{block.topic}</p>
                                <p className="text-xs text-muted-foreground">{block.activity}</p>
                                {block.tip && (
                                  <div className="flex items-start gap-1 mt-1.5">
                                    <Lightbulb className="h-3 w-3 text-yellow-500 mt-0.5 shrink-0" />
                                    <span className="text-xs text-muted-foreground italic">{block.tip}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {plan?.tips && plan.tips.length > 0 && (
          <Card className="mt-4">
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" /> Study Tips
              </h3>
              <ul className="space-y-1">
                {plan.tips.map((tip, i) => (
                  <li key={i} className="text-xs text-muted-foreground">• {tip}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DailyStudyPlan;
