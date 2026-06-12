import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Send, Loader2, Mic, MicOff, Volume2, VolumeX, ClipboardCheck, Trophy, ChevronRight, CheckCircle, XCircle, Bot, User, Sparkles } from 'lucide-react';
import { ExamPrepSession, ChatMessage } from '@/hooks/useExamPrep';
import ReactMarkdown from 'react-markdown';

interface Props {
  session: ExamPrepSession;
  studentName: string;
  onSendMessage: (sessionId: string, message: string, history: ChatMessage[]) => Promise<string>;
  onGenerateExam: (sessionId: string) => Promise<any>;
  onEvaluateExam: (sessionId: string, examData: any, answers: any[]) => Promise<any>;
  onBack: () => void;
}

interface ExamQuestion {
  id: number;
  type: 'mcq' | 'short_answer' | 'long_answer';
  question: string;
  options?: string[];
  correctAnswer?: string;
  modelAnswer?: string;
  marks: number;
  topic: string;
  explanation?: string;
  keyPoints?: string[];
}

interface ExamData {
  examTitle: string;
  totalMarks: number;
  totalQuestions: number;
  timeLimit: number;
  questions: ExamQuestion[];
}

interface ExamResult {
  totalMarksObtained: number;
  totalMarksPossible: number;
  percentage: number;
  grade: string;
  estimatedBoardPercentage: number;
  disclaimer: string;
  questionResults: { questionId: number; marksObtained: number; maxMarks: number; isCorrect: boolean; feedback: string; improvement: string }[];
  overallFeedback: string;
  strongTopics: string[];
  weakTopics: string[];
  studyRecommendations: string[];
}

type ExamMode = 'chat' | 'exam_loading' | 'exam_active' | 'exam_submitting' | 'exam_result';

// Web Speech API types
interface SpeechRecognitionEvent extends Event { results: SpeechRecognitionResultList; }
interface SpeechRecognitionErrorEvent extends Event { error: string; }
interface SpeechRecognitionType {
  continuous: boolean; interimResults: boolean; lang: string;
  start: () => void; stop: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onend: () => void; onerror: (event: SpeechRecognitionErrorEvent) => void;
}

const ExamPrepChat: React.FC<Props> = ({ session, studentName, onSendMessage, onGenerateExam, onEvaluateExam, onBack }) => {
  const hasMaterials = (session.exam_prep_materials?.length || 0) > 0 || (session.extracted_topics?.length || 0) > 0;
  const hasExtractedTopics = (session.extracted_topics?.length || 0) > 0;
  
  const getInitialMessages = (): ChatMessage[] => {
    if (!hasMaterials) {
      return [{
        role: 'assistant',
        content: `Welcome ${studentName}!\n\nPlease upload your study materials first to begin your personalized Exam Prep journey. Go back and upload a PDF, DOCX, or TXT file, then return here.\n\nOnce materials are uploaded, I'll analyze them and present key topics for focused study!`,
      }];
    }
    
    if (hasExtractedTopics) {
      const topicNames = session.extracted_topics.map((t: any) => typeof t === 'string' ? t : t.name || t.topic || 'Unknown').slice(0, 10);
      return [{
        role: 'assistant',
        content: `Hello ${studentName}! I've analyzed your uploaded material for ${session.exam_name || 'your exam'}.\n\nHere are the key topics and concepts we'll be focusing on:\n\n${topicNames.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n')}\n\n${session.exam_date ? `Your exam is on ${session.exam_date}. ` : ''}${session.target_score ? `Aiming for ${session.target_score}? Let's make it happen! ` : ''}\n\nPlease review these topics. Which one would you like to start with, or do you have any initial questions?\n\nWhen you feel ready, say "I am ready" to take a Virtual Exam!`,
      }];
    }
    
    return [{
      role: 'assistant',
      content: `Welcome ${studentName}!\n\nI'm your AI exam prep tutor for ${session.exam_name || 'your exam'}. ${
        session.exam_date ? `Your exam is on ${session.exam_date}. ` : ''
      }${session.target_score ? `Aiming for ${session.target_score}? Let's make it happen! ` : ''}\n\nYour material has been uploaded but is still being processed. Let me know what topic you'd like to focus on!\n\nSay "I am ready" when you want to take a Virtual Exam!`,
    }];
  };

  const [messages, setMessages] = useState<ChatMessage[]>(getInitialMessages());
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [examMode, setExamMode] = useState<ExamMode>('chat');
  const [examData, setExamData] = useState<ExamData | null>(null);
  const [examAnswers, setExamAnswers] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [examResult, setExamResult] = useState<ExamResult | null>(null);
  const [examTimer, setExamTimer] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    return () => {
      synthRef.current?.cancel();
      recognitionRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, currentQuestion]);

  useEffect(() => {
    if (!ttsEnabled || examMode !== 'chat') return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'assistant' && !sending) speakText(lastMsg.content);
  }, [messages, sending, ttsEnabled, examMode]);

  const speakText = useCallback((text: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    const cleanText = text.replace(/[*_#`~>\[\]()!]/g, '').replace(/\n{2,}/g, '. ').replace(/\n/g, ' ').trim();
    if (!cleanText) return;
    const chunks = cleanText.match(/.{1,150}[.!?,;:\s]|.{1,150}/g) || [cleanText];
    setIsSpeaking(true);
    let chunkIndex = 0;
    const speakChunk = () => {
      if (chunkIndex >= chunks.length || !ttsEnabled) { setIsSpeaking(false); return; }
      const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
      utterance.lang = 'en-IN'; utterance.rate = 0.95; utterance.pitch = 1;
      utterance.onend = () => { chunkIndex++; speakChunk(); };
      utterance.onerror = () => setIsSpeaking(false);
      synthRef.current?.speak(utterance);
    };
    speakChunk();
  }, [ttsEnabled]);

  const stopSpeaking = useCallback(() => { synthRef.current?.cancel(); setIsSpeaking(false); }, []);
  const toggleTTS = useCallback(() => { if (ttsEnabled) stopSpeaking(); setTtsEnabled(prev => !prev); }, [ttsEnabled, stopSpeaking]);

  const toggleVoiceInput = useCallback(() => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = false; recognition.interimResults = false; recognition.lang = 'en-IN';
    recognition.onresult = (e: SpeechRecognitionEvent) => setInput(prev => prev + e.results[0][0].transcript);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition; recognition.start(); setIsListening(true);
  }, [isListening]);

  // Check if user says "I am ready" or similar
  const checkForExamTrigger = (msg: string): boolean => {
    const lower = msg.toLowerCase().trim();
    const triggers = ['i am ready', "i'm ready", 'im ready', 'start exam', 'virtual exam', 'take exam', 'ready for exam', 'start test', 'main ready hun', 'ready hu', 'exam shuru karo'];
    return triggers.some(t => lower.includes(t));
  };

  const startVirtualExam = async () => {
    setExamMode('exam_loading');
    stopSpeaking();
    try {
      const exam = await onGenerateExam(session.id);
      setExamData(exam);
      setExamAnswers(new Array(exam.questions.length).fill(''));
      setCurrentQuestion(0);
      setExamMode('exam_active');
      setExamTimer(exam.timeLimit * 60);
      timerRef.current = setInterval(() => {
        setExamTimer(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setExamMode('chat');
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I could not generate the exam. Make sure you have uploaded study material first, then try again.' }]);
    }
  };

  const submitExam = async () => {
    if (!examData) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setExamMode('exam_submitting');
    try {
      const result = await onEvaluateExam(session.id, examData, examAnswers);
      setExamResult(result);
      setExamMode('exam_result');
    } catch {
      setExamMode('exam_active');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    
    // Block chat if no materials uploaded
    if (!hasMaterials) {
      setMessages(prev => [...prev, 
        { role: 'user', content: input.trim() },
        { role: 'assistant', content: 'Please upload your study materials first to begin your personalized Exam Prep journey. Go back and upload a PDF, DOCX, or TXT file to get started! 📚' }
      ]);
      setInput('');
      return;
    }
    
    const msg = input.trim();
    setInput('');
    stopSpeaking();
    setMessages(prev => [...prev, { role: 'user', content: msg }]);

    if (checkForExamTrigger(msg)) {
      if (!hasMaterials) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'You need to upload study materials before taking a virtual exam. Please go back and upload your notes or textbook first.' }]);
        return;
      }
      setMessages(prev => [...prev, { role: 'assistant', content: 'Great! You said you are ready! Let me generate a virtual exam based on your study material. This will include MCQs, Short Answer, and Long Answer questions. Get ready...' }]);
      setTimeout(() => startVirtualExam(), 1500);
      return;
    }

    setSending(true);
    try {
      const reply = await onSendMessage(session.id, msg, messages);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I had trouble responding. Please try again.' }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── EXAM LOADING ──
  if (examMode === 'exam_loading') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-semibold text-foreground">Generating your virtual exam...</p>
        <p className="text-sm text-muted-foreground">Based on your study material</p>
      </div>
    );
  }

  // ── EXAM ACTIVE ──
  if (examMode === 'exam_active' && examData) {
    const q = examData.questions[currentQuestion];
    const answered = examAnswers.filter(a => a.trim()).length;

    return (
      <div className="h-screen flex flex-col bg-background">
        {/* Exam Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-card">
          <div>
            <p className="font-semibold text-sm">{examData.examTitle}</p>
            <p className="text-xs text-muted-foreground">Q {currentQuestion + 1}/{examData.totalQuestions} | {answered} answered</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`text-sm font-mono font-bold ${examTimer < 300 ? 'text-destructive' : 'text-foreground'}`}>
              {formatTime(examTimer)}
            </div>
            <Button size="sm" variant="destructive" onClick={submitExam}>
              Submit Exam
            </Button>
          </div>
        </div>

        {/* Question Area */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-2xl mx-auto">
            {/* Question type badge */}
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                q.type === 'mcq' ? 'bg-primary/10 text-primary' :
                q.type === 'short_answer' ? 'bg-accent/10 text-accent' :
                'bg-edu-purple/10 text-edu-purple'
              }`}>
                {q.type === 'mcq' ? 'MCQ' : q.type === 'short_answer' ? 'Short Answer' : 'Long Answer'} | {q.marks} marks
              </span>
              <span className="text-xs text-muted-foreground">{q.topic}</span>
            </div>

            {/* Question */}
            <p className="text-base font-medium text-foreground mb-4 leading-relaxed">{q.question}</p>

            {/* Answer Input */}
            {q.type === 'mcq' && q.options ? (
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const optLetter = opt.charAt(0);
                  const isSelected = examAnswers[currentQuestion] === optLetter;
                  return (
                    <button
                      key={oi}
                      onClick={() => {
                        const newAnswers = [...examAnswers];
                        newAnswers[currentQuestion] = optLetter;
                        setExamAnswers(newAnswers);
                      }}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all text-sm ${
                        isSelected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/30'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            ) : (
              <Textarea
                placeholder={q.type === 'short_answer' ? 'Write your short answer here (2-3 sentences)...' : 'Write your detailed answer here (5-8 sentences)...'}
                value={examAnswers[currentQuestion]}
                onChange={(e) => {
                  const newAnswers = [...examAnswers];
                  newAnswers[currentQuestion] = e.target.value;
                  setExamAnswers(newAnswers);
                }}
                className={`w-full ${q.type === 'long_answer' ? 'min-h-[200px]' : 'min-h-[100px]'}`}
              />
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="border-t border-border p-3 bg-card">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <Button
              variant="outline"
              size="sm"
              disabled={currentQuestion === 0}
              onClick={() => setCurrentQuestion(prev => prev - 1)}
            >
              Previous
            </Button>
            {/* Question dots */}
            <div className="flex gap-1 flex-wrap justify-center max-w-[200px]">
              {examData.questions.map((_, qi) => (
                <button
                  key={qi}
                  onClick={() => setCurrentQuestion(qi)}
                  className={`w-6 h-6 rounded-full text-2xs font-bold transition-colors ${
                    qi === currentQuestion ? 'bg-primary text-primary-foreground' :
                    examAnswers[qi]?.trim() ? 'bg-accent/20 text-accent' :
                    'bg-muted text-muted-foreground'
                  }`}
                >
                  {qi + 1}
                </button>
              ))}
            </div>
            {currentQuestion < examData.totalQuestions - 1 ? (
              <Button size="sm" onClick={() => setCurrentQuestion(prev => prev + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" variant="default" onClick={submitExam}>
                Submit
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── EXAM SUBMITTING ──
  if (examMode === 'exam_submitting') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-semibold">AI is evaluating your answers...</p>
        <p className="text-sm text-muted-foreground">Checking MCQs, short answers, and long answers</p>
      </div>
    );
  }

  // ── EXAM RESULT ──
  if (examMode === 'exam_result' && examResult && examData) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
          <Button variant="ghost" size="icon" onClick={() => { setExamMode('chat'); setExamResult(null); setExamData(null); }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <p className="font-semibold text-sm">Exam Results</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Score Card */}
            <div className="bg-card rounded-xl border border-border p-6 text-center">
              <Trophy className="h-12 w-12 mx-auto mb-3 text-edu-orange" />
              <p className="text-4xl font-extrabold text-foreground mb-1">{examResult.percentage}%</p>
              <p className="text-lg font-semibold text-primary mb-1">Grade: {examResult.grade}</p>
              <p className="text-sm text-muted-foreground">{examResult.totalMarksObtained}/{examResult.totalMarksPossible} marks</p>
              <div className="mt-4 bg-primary/10 rounded-lg p-3">
                <p className="text-sm font-semibold text-primary">Estimated Board Percentage: ~{examResult.estimatedBoardPercentage}%</p>
                <p className="text-xs text-muted-foreground mt-1">{examResult.disclaimer}</p>
              </div>
            </div>

            {/* Overall Feedback */}
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="font-semibold text-sm mb-2">Overall Feedback</p>
              <p className="text-sm text-muted-foreground">{examResult.overallFeedback}</p>
            </div>

            {/* Strong & Weak Topics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-accent/5 rounded-xl border border-accent/20 p-4">
                <p className="text-sm font-semibold text-accent mb-2">Strong Topics</p>
                {examResult.strongTopics?.map((t, i) => (
                  <p key={i} className="text-xs text-muted-foreground">- {t}</p>
                ))}
              </div>
              <div className="bg-destructive/5 rounded-xl border border-destructive/20 p-4">
                <p className="text-sm font-semibold text-destructive mb-2">Weak Topics</p>
                {examResult.weakTopics?.map((t, i) => (
                  <p key={i} className="text-xs text-muted-foreground">- {t}</p>
                ))}
              </div>
            </div>

            {/* Question-by-Question Results */}
            <div className="space-y-3">
              <p className="font-semibold text-sm">Question-wise Analysis</p>
              {examResult.questionResults?.map((qr, i) => {
                const q = examData.questions[i];
                return (
                  <div key={i} className={`rounded-xl border p-4 ${qr.isCorrect ? 'border-accent/30 bg-accent/5' : 'border-destructive/30 bg-destructive/5'}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium flex-1">Q{qr.questionId}. {q?.question}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        {qr.isCorrect ? <CheckCircle className="h-4 w-4 text-accent" /> : <XCircle className="h-4 w-4 text-destructive" />}
                        <span className="text-xs font-bold">{qr.marksObtained}/{qr.maxMarks}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">Your answer: {examAnswers[i] || 'Not attempted'}</p>
                    <p className="text-xs text-foreground/80">{qr.feedback}</p>
                    {!qr.isCorrect && <p className="text-xs text-primary mt-1">Tip: {qr.improvement}</p>}
                  </div>
                );
              })}
            </div>

            {/* Study Recommendations */}
            {examResult.studyRecommendations?.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-4">
                <p className="font-semibold text-sm mb-2">Study Recommendations</p>
                {examResult.studyRecommendations.map((r, i) => (
                  <p key={i} className="text-sm text-muted-foreground mb-1">- {r}</p>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pb-6">
              <Button className="flex-1" onClick={() => { setExamMode('chat'); setExamResult(null); setExamData(null); }}>
                Back to Chat
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { setExamResult(null); setExamData(null); startVirtualExam(); }}>
                Retake Exam
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── CHAT MODE (default) ──
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border/50 bg-card/95 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 h-8 w-8 rounded-full">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-foreground truncate">{session.exam_name || 'Exam Prep AI'}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
            {session.extracted_topics?.length ? `${session.extracted_topics.length} topics loaded` : 'General prep'}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={toggleTTS} className={`h-8 w-8 rounded-full ${ttsEnabled ? 'text-primary' : 'text-muted-foreground'}`}>
          {ttsEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
        <Button variant="outline" size="sm" onClick={startVirtualExam} className="text-xs gap-1 h-8 rounded-full" disabled={!hasMaterials}>
          <ClipboardCheck className="h-3.5 w-3.5" /> Exam
        </Button>
      </div>

      {/* No materials banner */}
      {!hasMaterials && (
        <div className="p-3 bg-destructive/10 border-b border-destructive/20">
          <p className="text-sm text-destructive font-medium text-center">
            📄 Please upload your study materials first to begin your personalized Exam Prep journey.
          </p>
          <div className="flex justify-center mt-2">
            <Button variant="outline" size="sm" onClick={onBack} className="text-xs">
              ← Go back to upload materials
            </Button>
          </div>
        </div>
      )}

      {/* Messages - ChatGPT Style */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 py-8">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-br from-primary to-accent shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">Exam Prep AI</h3>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Upload materials and ask me anything. Say "I am ready" when you want to take a virtual exam!
            </p>
          </div>
        ) : (
          <div className="space-y-0 py-2">
            {messages.map((msg, i) => (
              <div key={i} className={`px-3 sm:px-4 py-3 sm:py-4 ${msg.role === 'assistant' ? 'bg-muted/20' : 'bg-background'} transition-colors`}>
                <div className="max-w-2xl mx-auto flex gap-2.5 sm:gap-3">
                  {/* Avatar */}
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    msg.role === 'assistant'
                      ? 'bg-primary/10 ring-1 ring-primary/20'
                      : 'bg-accent/10 ring-1 ring-accent/20'
                  }`}>
                    {msg.role === 'assistant'
                      ? <Sparkles className="w-3.5 h-3.5 text-primary" />
                      : <User className="w-3.5 h-3.5 text-accent" />
                    }
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-muted-foreground mb-1 block">
                      {msg.role === 'assistant' ? 'Exam Prep AI' : 'You'}
                    </span>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&>pre]:rounded-xl [&>pre]:bg-secondary [&>code]:bg-secondary [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded-md [&>code]:text-xs">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground leading-relaxed">{msg.content}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {sending && (
              <div className="px-3 sm:px-4 py-3 sm:py-4 bg-muted/20">
                <div className="max-w-2xl mx-auto flex gap-2.5 sm:gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-semibold text-muted-foreground mb-1.5 block">Exam Prep AI</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input - ChatGPT Style */}
      <div className="border-t border-border/40 p-2.5 sm:p-3 bg-background">
        <div className="max-w-2xl mx-auto">
          <div className="relative flex items-end gap-2 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm px-3 py-2 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all duration-200">
            <Input
              ref={inputRef}
              placeholder={hasMaterials ? "Ask your tutor or say 'I am ready' for exam..." : "Upload materials first..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-8 text-sm"
            />
            <Button variant="ghost" size="icon" onClick={toggleVoiceInput}
              className={`shrink-0 h-8 w-8 rounded-xl ${isListening ? 'text-destructive bg-destructive/10' : 'text-muted-foreground hover:text-foreground'}`}>
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button size="icon" onClick={handleSend} disabled={!input.trim() || sending}
              className="shrink-0 h-8 w-8 rounded-xl"
              variant={input.trim() ? "default" : "ghost"}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamPrepChat;
