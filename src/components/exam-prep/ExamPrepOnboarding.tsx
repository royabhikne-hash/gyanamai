import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Sprout, Leaf, TreeDeciduous, Trees } from 'lucide-react';

interface OnboardingData {
  examName: string;
  examDate: string;
  targetScore: number | undefined;
  topicFamiliarity: string;
  mood: string;
}

interface Props {
  onComplete: (data: OnboardingData) => void;
  onBack: () => void;
  studentName: string;
}

const familiarityLevels = [
  { id: 'new', label: 'New to me', icon: Sprout, desc: 'Never studied this before' },
  { id: 'heard', label: 'Heard of it', icon: Leaf, desc: 'Know the name, not the details' },
  { id: 'basics', label: 'Know basics', icon: TreeDeciduous, desc: 'Understand fundamental concepts' },
  { id: 'understand', label: 'Understand well', icon: Trees, desc: 'Comfortable with most topics' },
];

const moods = [
  { id: 'ready', emoji: '💪', label: 'Ready to go' },
  { id: 'curious', emoji: '🤔', label: 'Curious' },
  { id: 'calm', emoji: '😌', label: 'Calm' },
  { id: 'neutral', emoji: '😐', label: 'Neutral' },
  { id: 'low_energy', emoji: '😴', label: 'Low energy' },
  { id: 'stressed', emoji: '😟', label: 'Stressed' },
];

const ExamPrepOnboarding: React.FC<Props> = ({ onComplete, onBack, studentName }) => {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    examName: '',
    examDate: '',
    targetScore: undefined,
    topicFamiliarity: '',
    mood: '',
  });

  const totalSteps = 4;
  const progress = ((step + 1) / totalSteps) * 100;

  const canProceed = () => {
    if (step === 0) return data.examName.trim().length > 0;
    if (step === 1) return true;
    if (step === 2) return data.topicFamiliarity !== '';
    if (step === 3) return data.mood !== '';
    return false;
  };

  const handleNext = () => {
    if (step < totalSteps - 1) setStep(step + 1);
    else onComplete(data);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress bar */}
      <div className="p-4 pt-6">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={step > 0 ? () => setStep(step - 1) : onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="text-sm text-muted-foreground">Step {step + 1} of {totalSteps}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="flex-1 flex flex-col p-6">
        {/* Step 0: Exam Info */}
        {step === 0 && (
          <div className="flex-1 flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h1 className="text-2xl font-bold text-foreground">What are you preparing for?</h1>
              <p className="text-muted-foreground mt-1">Tell us about your exam</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Exam / Subject Name</label>
                <Input
                  placeholder="e.g. Math Final, Physics Board Exam"
                  value={data.examName}
                  onChange={(e) => setData({ ...data, examName: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Exam Date (optional)</label>
                <Input
                  type="date"
                  value={data.examDate}
                  onChange={(e) => setData({ ...data, examDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Target Score (optional)</label>
                <Input
                  type="number"
                  placeholder="e.g. 90"
                  value={data.targetScore || ''}
                  onChange={(e) => setData({ ...data, targetScore: e.target.value ? parseInt(e.target.value) : undefined })}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Upload placeholder - handled later */}
        {step === 1 && (
          <div className="flex-1 flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Upload Study Material</h1>
              <p className="text-muted-foreground mt-1">You can upload PDFs after setup too</p>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="border-2 border-dashed border-border rounded-2xl p-10 text-center bg-muted/30">
                <div className="text-4xl mb-3">📄</div>
                <p className="text-muted-foreground">Skip for now — you can upload materials from the dashboard</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Topic Familiarity */}
        {step === 2 && (
          <div className="flex-1 flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h1 className="text-2xl font-bold text-foreground">How familiar are you with this topic?</h1>
              <p className="text-muted-foreground mt-1">This helps your AI tutor adapt</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {familiarityLevels.map((level) => {
                const Icon = level.icon;
                const selected = data.topicFamiliarity === level.id;
                return (
                  <button
                    key={level.id}
                    onClick={() => setData({ ...data, topicFamiliarity: level.id })}
                    className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                      selected
                        ? 'border-primary bg-primary/10 shadow-md'
                        : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    <Icon className={`h-8 w-8 mb-2 ${selected ? 'text-primary' : 'text-accent'}`} />
                    <p className="font-semibold text-sm text-foreground">{level.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{level.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Mood */}
        {step === 3 && (
          <div className="flex-1 flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h1 className="text-2xl font-bold text-foreground">How's your mood today?</h1>
              <p className="text-muted-foreground mt-1">Your AI tutor will adapt to how you feel</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {moods.map((mood) => {
                const selected = data.mood === mood.id;
                return (
                  <button
                    key={mood.id}
                    onClick={() => setData({ ...data, mood: mood.id })}
                    className={`p-4 rounded-2xl border-2 text-center transition-all duration-200 ${
                      selected
                        ? 'border-primary bg-primary/10 shadow-md scale-105'
                        : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    <span className="text-3xl block mb-1">{mood.emoji}</span>
                    <p className="text-xs font-medium text-foreground">{mood.label}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom button */}
        <div className="pt-6">
          <Button
            className="w-full"
            size="lg"
            onClick={handleNext}
            disabled={!canProceed()}
          >
            {step === totalSteps - 1 ? 'Start Studying' : 'Continue'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ExamPrepOnboarding;
