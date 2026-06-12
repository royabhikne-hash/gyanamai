import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Image, X, Loader2, Brain, TrendingUp, AlertTriangle, Volume2, VolumeX, CheckCircle, XCircle, ThumbsUp, HelpCircle, Lightbulb, Bot, User, Mic, MicOff, Settings2, BookOpen, Sparkles } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import SoundWave from "@/components/SoundWave";
import VoiceInputIndicator from "@/components/VoiceInputIndicator";
import Confetti from "@/components/Confetti";
import TypingText from "@/components/TypingText";
import { useSmartTTS, SPEECHIFY_VOICES } from "@/hooks/useSmartTTS";
import SpeechifyVoiceSelector from "@/components/SpeechifyVoiceSelector";
import SubjectChapterSelector from "@/components/SubjectChapterSelector";
import { BoardType } from "@/data/syllabusData";

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionType {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onend: () => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionType;
    webkitSpeechRecognition: new () => SpeechRecognitionType;
  }
}

type ReactionType = "like" | "helpful" | "confusing";

interface MessageReaction {
  type: ReactionType;
  count: number;
  userReacted: boolean;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  imageUrl?: string;
  reactions?: Record<ReactionType, MessageReaction>;
  isTyping?: boolean;
}

interface RealTimeAnalysis {
  weakAreas: string[];
  strongAreas: string[];
  currentUnderstanding: "weak" | "average" | "good" | "excellent";
  topicsCovered: string[];
}

interface QuizQuestion {
  id: number;
  type: "mcq" | "true_false" | "fill_blank" | "short_answer";
  question: string;
  options?: string[];
  correct_answer: string;
  acceptable_answers?: string[];
  explanation: string;
  difficulty: string;
  topic: string;
  key_concept?: string;
}

interface AnswerAnalysis {
  isCorrect: boolean;
  confidence: number;
  reasoning: string;
  feedback: string;
}

interface StudyChatProps {
  onEndStudy: (summary: { 
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
      questions: QuizQuestion[];
      answers: string[];
    };
  }) => void;
  studentId?: string;
  studentClass?: string;
  studentBoard?: string;
}

const StudyChat = ({ onEndStudy, studentId, studentClass = "10", studentBoard = "CBSE" }: StudyChatProps) => {
  const { toast } = useToast();
  
  // Subject and Chapter selection state (optional - for reference only)
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [showSubjectSelector, setShowSubjectSelector] = useState(false);
  
  // Subject session tracking - allows multi-subject study
  const [currentSubject, setCurrentSubjectState] = useState<string>("");
  const [completedSubjects, setCompletedSubjects] = useState<string[]>([]);
  const [subjectSessions, setSubjectSessions] = useState<Record<string, { messages: ChatMessage[], startedAt: Date }>>({});
  
  const getRandomGreeting = () => {
    const greetings = [
      "Hey there! 🚀 Let's crush some studying today!\n\nJust say \"Start Maths\" or \"Start Science\" and we'll get rolling. When you're done with a subject, say \"[Subject] done\" and I'll set up the next one!",
      "Welcome back, superstar! 🌟 Your personal tutor is all set!\n\nPick any subject - say \"Start Physics\" or \"Start English\" to begin. I'll explain everything step by step with examples!",
      "Yo! Ready for a power study session? 💪\n\nSay \"Start [Subject]\" to kick things off. I'll teach, you learn, and at the end we'll test what you've mastered with a quiz!",
      "Hey champion! 🎯 Another day, another chance to level up!\n\nTell me your subject - \"Start History\", \"Start Biology\", anything! Say \"Finish study\" when you're done and I'll quiz you!",
      "Hi! Let's make today's study session legendary! ⚡\n\nDrop a \"Start [Subject]\" to begin. I'll break down tough concepts into easy bites and give you real-world examples to remember them!",
      "Hello, future topper! 📚 Your AI Gyanam AI is fired up!\n\nSay \"Start Chemistry\" or any subject to dive in. Multiple subjects? No problem - just say \"[Subject] done\" to switch!"
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  };

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      content: getRandomGreeting(),
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [startTime] = useState(new Date());
  const [currentTopic, setCurrentTopic] = useState("");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [voiceSpeed, setVoiceSpeed] = useState(0.9);
  const [autoSpeak, setAutoSpeak] = useState(true); // Auto-speak enabled by default

  // Smart TTS hook with subscription-aware logic
  // Basic plan: Web TTS only | Pro plan: Premium TTS with 150k chars/month
  const { 
    speak: speechifySpeak, 
    stop: stopTTS, 
    isSupported: ttsSupported, 
    isSpeaking,
    isLoading: ttsLoading,
    currentVoiceId,
    setVoice,
    previewVoice,
    voices: availableVoices,
    usageInfo: ttsUsageInfo,
    getStatusMessage: getTTSStatusMessage,
    getEngineBadge,
    isPremiumActive,
    isAndroidNative,
    activeEngine,
    error: ttsError,
  } = useSmartTTS(studentId || null);
  
  // Quiz mode state
  const [isQuizMode, setIsQuizMode] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [hasPlayedWelcome, setHasPlayedWelcome] = useState(false);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [answerResults, setAnswerResults] = useState<AnswerAnalysis[]>([]);
  const [analyzingAnswer, setAnalyzingAnswer] = useState(false);
  const [shortAnswerInput, setShortAnswerInput] = useState("");
  
  // Real-time analysis state
  const [analysis, setAnalysis] = useState<RealTimeAnalysis>({
    weakAreas: [],
    strongAreas: [],
    currentUnderstanding: "average",
    topicsCovered: [],
  });
  
  // Message reactions state
  const [messageReactions, setMessageReactions] = useState<Record<string, Record<ReactionType, MessageReaction>>>({});
  
  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  // Auto-speak welcome greeting when chatbot first opens
  useEffect(() => {
    if (!ttsSupported) return;
    if (!hasPlayedWelcome && autoSpeak && messages.length === 1) {
      const timer = setTimeout(() => {
        speakText(messages[0].content, messages[0].id);
        setHasPlayedWelcome(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [hasPlayedWelcome, autoSpeak, messages, ttsSupported]);

  // Check for speech recognition support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN'; // English-India for voice input
      
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        console.log('Speech recognized:', transcript);
        setInputValue(transcript);
      };
      
      recognition.onend = () => {
        console.log('Speech recognition ended');
        setIsListening(false);
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          toast({
            title: "Microphone Access Denied",
            description: "Please allow microphone access to use voice input.",
            variant: "destructive"
          });
        } else if (event.error === 'no-speech') {
          toast({
            title: "No Speech Detected",
            description: "Please try speaking again.",
          });
        }
      };
      
      recognitionRef.current = recognition;
    } else {
      console.log('Speech recognition not supported');
    }
  }, [toast]);

  const toggleListening = useCallback(async () => {
    if (!recognitionRef.current) {
      toast({
        title: "Not Supported",
        description: "Your browser doesn't support voice input. Please use Chrome.",
        variant: "destructive"
      });
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      // Stop any ongoing speech first
      if (ttsSupported) {
        stopTTS();
      }
      setSpeakingMessageId(null);
      
      setInputValue('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast({
          title: "🎤 Listening...",
          description: "Go ahead, I'm listening!",
          duration: 2000
        });
      } catch (error) {
        console.error('Error starting recognition:', error);
        toast({
          title: "Error",
          description: "Could not start voice input. Please refresh and try again.",
          variant: "destructive"
        });
      }
    }
  }, [isListening, toast, ttsSupported, stopTTS]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentQuestionIndex]);

  // Handle message reactions
  const handleReaction = (messageId: string, reactionType: ReactionType) => {
    setMessageReactions(prev => {
      const messageReacts = prev[messageId] || {
        like: { type: "like", count: 0, userReacted: false },
        helpful: { type: "helpful", count: 0, userReacted: false },
        confusing: { type: "confusing", count: 0, userReacted: false }
      };
      
      const currentReaction = messageReacts[reactionType];
      const newUserReacted = !currentReaction.userReacted;
      
      return {
        ...prev,
        [messageId]: {
          ...messageReacts,
          [reactionType]: {
            ...currentReaction,
            count: newUserReacted ? currentReaction.count + 1 : Math.max(0, currentReaction.count - 1),
            userReacted: newUserReacted
          }
        }
      };
    });

    const reactionLabels: Record<ReactionType, string> = {
      like: "👍 Liked!",
      helpful: "💡 Marked as helpful!",
      confusing: "🤔 Marked as confusing - we'll explain better!"
    };
    
    toast({
      title: reactionLabels[reactionType],
      duration: 1500
    });
  };

  // Robust TTS function with error handling & no silent failure
  const speakText = useCallback(async (text: string, messageId: string, isQuizQuestion: boolean = false) => {
    if (!ttsSupported) {
      toast({ title: "Voice Not Available", description: "Voice is not supported on this device.", variant: "destructive", duration: 2000 });
      return;
    }

    if (speakingMessageId === messageId) {
      stopTTS();
      setSpeakingMessageId(null);
      return;
    }

    stopTTS();
    setSpeakingMessageId(messageId);

    try {
      await speechifySpeak({
        text,
        speed: isQuizQuestion ? Math.max(voiceSpeed - 0.1, 0.7) : voiceSpeed,
        language: 'hi-IN',
      });

      // Check if there was an error after speak completed (no silent failure)
      if (ttsError) {
        toast({
          title: "Voice Error",
          description: ttsError,
          variant: "destructive",
          duration: 3000
        });
      }
    } catch (error) {
      console.error("TTS error:", error);
      toast({
        title: "Voice Error",
        description: "Voice playback had an issue. Try again!",
        variant: "destructive",
        duration: 2000
      });
    } finally {
      setSpeakingMessageId(null);
    }
  }, [ttsSupported, speakingMessageId, voiceSpeed, speechifySpeak, stopTTS, toast, ttsError]);

  // Quiz TTS removed - no voice in quiz mode

  const getAIResponse = async (conversationHistory: ChatMessage[]) => {
    try {
      const formattedMessages = conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
        imageUrl: msg.imageUrl
      }));

      const { data, error } = await supabase.functions.invoke('study-chat', {
        body: { 
          messages: formattedMessages, 
          studentId, 
          analyzeSession: true,
          currentSubject: currentSubject || undefined,
          completedSubjects: completedSubjects,
          subject: selectedSubject || undefined,
          chapter: selectedChapter || undefined,
          studentClass: studentClass,
          studentBoard: studentBoard
        }
      });

      if (error) {
        console.error("Edge function error:", error);
        throw error;
      }

      if (data?.error) {
        toast({
          title: "AI Error",
          description: data.error,
          variant: "destructive"
        });
      }

      if (data?.sessionAnalysis) {
        setAnalysis(prev => ({
          weakAreas: [...new Set([...prev.weakAreas, ...(data.sessionAnalysis.weakAreas || [])])],
          strongAreas: [...new Set([...prev.strongAreas, ...(data.sessionAnalysis.strongAreas || [])])],
          currentUnderstanding: data.sessionAnalysis.understanding || prev.currentUnderstanding,
          topicsCovered: [...new Set([...prev.topicsCovered, ...(data.sessionAnalysis.topics || [])])],
        }));
      }

      return data?.response || "Sorry, something went wrong. Please try again!";
    } catch (err) {
      console.error("AI response error:", err);
      return "Oops! Connection issue. Please try again in a moment! 🙏";
    }
  };

  const [sessionId, setSessionId] = useState<string | null>(null);

  const saveMessageToDb = async (message: ChatMessage, sessId: string) => {
    try {
      await supabase.from("chat_messages").insert({
        session_id: sessId,
        role: message.role,
        content: message.content,
        image_url: message.imageUrl || null,
      });
    } catch (err) {
      console.error("Error saving message:", err);
    }
  };

  const ensureSession = async (detectedTopic?: string): Promise<string | null> => {
    if (sessionId) {
      // Update topic if we detected a new one and session already exists
      if (detectedTopic && detectedTopic !== "General Study") {
        await supabase
          .from("study_sessions")
          .update({ 
            topic: detectedTopic,
            subject: detectedTopic 
          })
          .eq("id", sessionId);
      }
      return sessionId;
    }
    
    if (!studentId) return null;

    const topicToSave = detectedTopic || currentTopic || "General Study";

    try {
      const { data, error } = await supabase
        .from("study_sessions")
        .insert({
          student_id: studentId,
          topic: topicToSave,
          subject: topicToSave !== "General Study" ? topicToSave : null,
          start_time: startTime.toISOString(),
        })
        .select("id")
        .single();

      if (error) throw error;
      
      setSessionId(data.id);
      return data.id;
    } catch (err) {
      console.error("Error creating session:", err);
      return null;
    }
  };

  // Subject command detection
  const detectSubjectCommand = (text: string): { type: 'start' | 'done' | 'finish' | null; subject: string } => {
    const lower = text.toLowerCase().trim();
    
    // "Finish study" command
    if (lower === 'finish study' || lower === 'finish studying' || lower === 'end study' || lower === 'study khatam' || lower === 'padhai khatam') {
      return { type: 'finish', subject: '' };
    }
    
    // "Start [Subject]" command
    const startMatch = lower.match(/^start\s+(.+)$/i) || lower.match(/^(.+)\s+start\s*$/i) || lower.match(/^(.+)\s+shuru\s*$/i);
    if (startMatch) {
      const subj = startMatch[1].trim().replace(/^(the|a|an)\s+/i, '');
      return { type: 'start', subject: subj.charAt(0).toUpperCase() + subj.slice(1) };
    }
    
    // "[Subject] done" command
    const doneMatch = lower.match(/^(.+)\s+(done|complete|finished|khatam|ho gaya|hogaya)$/i);
    if (doneMatch) {
      const subj = doneMatch[1].trim();
      return { type: 'done', subject: subj.charAt(0).toUpperCase() + subj.slice(1) };
    }
    
    return { type: null, subject: '' };
  };

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && !selectedImage) || isLoading) return;

    // Check daily usage limits BEFORE sending
    if (studentId) {
      try {
        const usageType = selectedImage ? "image" : "chat";
        const { data: usageData, error: usageError } = await supabase.functions.invoke('manage-subscription', {
          body: { action: 'check_daily_usage', studentId, usageType },
        });

        if (usageError) {
          console.error("Usage check error:", usageError);
        } else if (usageData && usageData.allowed === false) {
          toast({
            title: usageType === "image" ? "📸 Image Limit Reached!" : "💬 Chat Limit Reached!",
            description: `Today's ${usageType} limit reached (${usageData.currentCount}/${usageData.limit}). Upgrade your plan for more!`,
            variant: "destructive",
            duration: 5000,
          });
          return;
        }
      } catch (err) {
        console.error("Usage limit check failed:", err);
      }
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
      imageUrl: selectedImage || undefined,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    const userInput = inputValue;
    setInputValue("");
    setSelectedImage(null);

    // Detect subject commands
    const command = detectSubjectCommand(userInput);
    
    if (command.type === 'start') {
      // Start a new subject
      if (currentSubject) {
        // Must finish current subject first
        const warnMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `You're currently studying ${currentSubject}. Please say "${currentSubject} done" first before starting ${command.subject}! 📝`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, warnMsg]);
        if (autoSpeak) setTimeout(() => speakText(warnMsg.content, warnMsg.id), 200);
        return;
      }
      
      setCurrentSubjectState(command.subject);
      setCurrentTopic(command.subject);
      setSubjectSessions(prev => ({
        ...prev,
        [command.subject]: { messages: [], startedAt: new Date() }
      }));
      
      const startMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Chalo ${command.subject} shuru karte hain! 📖\n\nBatao konsa topic ya doubt hai ${command.subject} mein? Main ready hoon help karne ke liye!\n\nJab ${command.subject} ho jaye toh bolo "${command.subject} done" 👍`,
        timestamp: new Date(),
        isTyping: true,
      };
      setMessages(prev => [...prev, startMsg]);
      setTypingMessageId(startMsg.id);
      
      const sessId = await ensureSession(command.subject);
      if (sessId) await saveMessageToDb(userMessage, sessId);
      if (sessId) await saveMessageToDb(startMsg, sessId);
      return;
    }
    
    if (command.type === 'done') {
      // Complete current subject
      const subjectToComplete = command.subject || currentSubject;
      if (!currentSubject || currentSubject.toLowerCase() !== subjectToComplete.toLowerCase()) {
        const errorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: currentSubject 
            ? `You're studying ${currentSubject}, not ${subjectToComplete}. Say "${currentSubject} done" to finish it.`
            : `No subject is active right now. Say "Start [Subject]" to begin studying.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMsg]);
        return;
      }
      
      // Save subject session messages
      const subjectMessages = messages.filter(m => {
        // Get messages since this subject was started
        const sessionStart = subjectSessions[currentSubject]?.startedAt;
        return sessionStart && m.timestamp >= sessionStart;
      });
      
      setSubjectSessions(prev => ({
        ...prev,
        [currentSubject]: { ...prev[currentSubject], messages: subjectMessages }
      }));
      
      setCompletedSubjects(prev => [...prev, currentSubject]);
      const completedSubj = currentSubject;
      setCurrentSubjectState("");
      setCurrentTopic("");
      
      const doneMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `${completedSubj} complete! Bahut accha padha tumne! ✅\n\nAb kya karna hai?\n- Naya subject padhne ke liye bolo "Start [Subject]"\n- Quiz lene ke liye bolo "Finish study" 🎯`,
        timestamp: new Date(),
        isTyping: true,
      };
      setMessages(prev => [...prev, doneMsg]);
      setTypingMessageId(doneMsg.id);
      
      const sessId = await ensureSession(completedSubj);
      if (sessId) await saveMessageToDb(userMessage, sessId);
      if (sessId) await saveMessageToDb(doneMsg, sessId);
      return;
    }
    
    if (command.type === 'finish') {
      // If there's an active subject, complete it first
      const allSubjects = [...completedSubjects];
      if (currentSubject && !allSubjects.includes(currentSubject)) {
        allSubjects.push(currentSubject);
        setCompletedSubjects(allSubjects);
        setCurrentSubjectState("");
      }
      
      // Generate per-subject quizzes if multiple subjects were studied
      if (allSubjects.length > 0) {
        handlePerSubjectQuiz(allSubjects);
      } else {
        handleEndStudyClick();
      }
      return;
    }

    // Normal message flow - detect topic from keywords only if no active subject
    let detectedTopic = currentSubject || currentTopic;
    if (!currentSubject) {
      const topicKeywords = ["physics", "chemistry", "maths", "math", "biology", "history", "geography", "english", "hindi", "science", "social", "economics", "political", "civics", "computer", "bio"];
      const foundTopic = topicKeywords.find((t) => userInput.toLowerCase().includes(t));
      if (foundTopic) {
        const topicMap: Record<string, string> = {
          "maths": "Math", "bio": "Biology", "political": "Political Science",
          "civics": "Civics", "social": "Social Science"
        };
        detectedTopic = topicMap[foundTopic] || foundTopic.charAt(0).toUpperCase() + foundTopic.slice(1);
        if (!currentTopic) setCurrentTopic(detectedTopic);
      }
    }

    setIsLoading(true);
    const sessId = await ensureSession(detectedTopic);
    if (sessId) await saveMessageToDb(userMessage, sessId);

    const aiResponseText = await getAIResponse(newMessages);
    
    const aiResponseId = (Date.now() + 1).toString();
    const aiResponse: ChatMessage = {
      id: aiResponseId,
      role: "assistant",
      content: aiResponseText,
      timestamp: new Date(),
      isTyping: true,
    };
    
    setMessages((prev) => [...prev, aiResponse]);
    setTypingMessageId(aiResponseId);
    
    if (sessId) await saveMessageToDb(aiResponse, sessId);
    setIsLoading(false);
  };
  
  const handleTypingComplete = (messageId: string, content: string) => {
    setTypingMessageId(null);
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, isTyping: false } : msg
    ));
    
    // Auto-speak after typing is complete
    if (autoSpeak && content) {
      setTimeout(() => {
        speakText(content, messageId, false);
      }, 200);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Image too large",
          description: "Please upload an image smaller than 5MB",
          variant: "destructive"
        });
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Per-subject quiz generation: generates 10 MCQs + 3 short + 1 long per subject
  const handlePerSubjectQuiz = async (subjects: string[]) => {
    setQuizLoading(true);
    
    try {
      // Show intro message
      const introMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Great study session! You covered ${subjects.length} subject(s): ${subjects.join(", ")}. 📝\n\nNow generating a comprehensive quiz for each subject (10 MCQs + 3 Short + 1 Long per subject). Get ready!`,
        timestamp: new Date(),
        isTyping: true,
      };
      setMessages(prev => [...prev, introMsg]);
      setTypingMessageId(introMsg.id);

      // Generate quiz for first subject (sequential to avoid rate limits)
      const allQuestions: QuizQuestion[] = [];
      
      for (const subj of subjects) {
        // Get messages relevant to this subject from subjectSessions
        const subjSession = subjectSessions[subj];
        const subjMessages = subjSession?.messages?.length > 0 
          ? subjSession.messages.map(m => ({ role: m.role, content: m.content }))
          : messages.filter(m => m.content.toLowerCase().includes(subj.toLowerCase())).map(m => ({ role: m.role, content: m.content }));

        const { data, error } = await supabase.functions.invoke('generate-quiz', {
          body: { 
            messages: subjMessages.length > 0 ? subjMessages : messages.map(m => ({ role: m.role, content: m.content })),
            topic: subj,
            studentLevel: analysis.currentUnderstanding,
            weakAreas: analysis.weakAreas,
            strongAreas: analysis.strongAreas,
            studentId,
            quizMode: 'per_subject'
          }
        });

        if (!error && data?.success && data?.quiz?.questions?.length > 0) {
          // Add subject label to each question
          const labeledQuestions = data.quiz.questions.map((q: QuizQuestion, idx: number) => ({
            ...q,
            id: allQuestions.length + idx + 1,
            topic: subj,
          }));
          allQuestions.push(...labeledQuestions);
          
          const subjectDoneMsg: ChatMessage = {
            id: (Date.now() + Math.random()).toString(),
            role: "assistant",
            content: `${subj} quiz ready! (${labeledQuestions.length} questions) ✅`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, subjectDoneMsg]);
        } else {
          console.error(`Quiz generation failed for ${subj}:`, error);
        }
      }

      if (allQuestions.length > 0) {
        setQuizQuestions(allQuestions);
        setIsQuizMode(true);
        setCurrentQuestionIndex(0);
        setUserAnswers([]);
        setAnswerResults([]);
        setShortAnswerInput("");
        
        const startMsg: ChatMessage = {
          id: (Date.now() + 2).toString(),
          role: "assistant",
          content: `All quizzes generated! ${allQuestions.length} total questions across ${subjects.length} subject(s). Let's begin! 🚀`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, startMsg]);
      } else {
        finishStudySession();
      }
    } catch (err) {
      console.error("Per-subject quiz error:", err);
      toast({
        title: "Quiz Error",
        description: "Could not generate subject quizzes. Ending session.",
        variant: "destructive"
      });
      finishStudySession();
    } finally {
      setQuizLoading(false);
    }
  };

  const handleEndStudyClick = async () => {
    setQuizLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-quiz', {
        body: { 
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          topic: currentTopic || "General Study",
          studentLevel: analysis.currentUnderstanding,
          weakAreas: analysis.weakAreas,
          strongAreas: analysis.strongAreas
        }
      });

      if (error) throw error;

      if (data?.success && data?.quiz?.questions?.length > 0) {
        setQuizQuestions(data.quiz.questions);
        setIsQuizMode(true);
        setCurrentQuestionIndex(0);
        setUserAnswers([]);
        setAnswerResults([]);
        setShortAnswerInput("");
        
        // Adaptive intro message based on student's performance
        const hasWeakAreas = analysis.weakAreas.length > 0;
        const introMessage = hasWeakAreas 
          ? `I noticed you struggled a bit with ${analysis.weakAreas.slice(0, 2).join(" and ")}. No worries - these ${data.quiz.questions.length} questions will help you understand the topic better! Ready?`
          : `Great study session! Let's see how much you learned. Here are ${data.quiz.questions.length} quick questions - let's go!`;
        
        const quizIntro: ChatMessage = {
          id: Date.now().toString(),
          role: "assistant",
          content: introMessage,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, quizIntro]);
        
          // TTS removed from quiz mode
      } else {
        finishStudySession();
      }
    } catch (err) {
      console.error("Quiz generation error:", err);
      toast({
        title: "Quiz Error",
        description: "Could not generate quiz. Ending session without quiz.",
        variant: "destructive"
      });
      finishStudySession();
    } finally {
      setQuizLoading(false);
    }
  };

  const analyzeAnswerWithAI = async (question: QuizQuestion, answer: string): Promise<AnswerAnalysis> => {
    // For MCQ and True/False, do simple matching first
    if (question.type === "mcq" || question.type === "true_false") {
      const isCorrect = answer.toLowerCase().trim() === question.correct_answer.toLowerCase().trim();
      return {
        isCorrect,
        confidence: 100,
        reasoning: isCorrect ? "Correct option selected" : "Wrong option selected",
        feedback: isCorrect ? "🎉 Correct answer!" : "❌ Wrong answer"
      };
    }

    // For short answer, use AI analysis
    try {
      const { data, error } = await supabase.functions.invoke('analyze-answer', {
        body: {
          question: question.question,
          correctAnswer: question.correct_answer,
          studentAnswer: answer,
          topic: question.topic,
          questionType: question.type
        }
      });

      if (error) throw error;

      return {
        isCorrect: data.isCorrect ?? false,
        confidence: data.confidence ?? 80,
        reasoning: data.reasoning ?? "Analysis completed",
        feedback: data.feedback ?? (data.isCorrect ? "Sahi!" : "Galat")
      };
    } catch (err) {
      console.error("Answer analysis error:", err);
      // Fallback to checking acceptable_answers
      const userAnswer = answer.toLowerCase().trim();
      const correctAnswer = question.correct_answer.toLowerCase().trim();
      const acceptableAnswers = question.acceptable_answers?.map(a => a.toLowerCase().trim()) || [];
      
      const isCorrect = userAnswer === correctAnswer || acceptableAnswers.includes(userAnswer);
      return {
        isCorrect,
        confidence: 70,
        reasoning: "Simple matching used",
        feedback: isCorrect ? "🎉 Correct answer!" : "❌ Answer didn't match"
      };
    }
  };

  const handleQuizAnswer = async (answer: string) => {
    setSelectedOption(answer);
    setAnalyzingAnswer(true);
    
    const currentQuestion = quizQuestions[currentQuestionIndex];
    
    // Analyze the answer with AI for short answers
    const analysisResult = await analyzeAnswerWithAI(currentQuestion, answer);
    
    setAnswerResults(prev => [...prev, analysisResult]);
    setUserAnswers(prev => [...prev, answer]);
    setShowExplanation(true);
    setAnalyzingAnswer(false);
  };

  const handleShortAnswerSubmit = () => {
    if (shortAnswerInput.trim()) {
      handleQuizAnswer(shortAnswerInput.trim());
      setShortAnswerInput("");
    }
  };

  const handleNextQuestion = () => {
    setSelectedOption(null);
    setShowExplanation(false);
    
    if (currentQuestionIndex < quizQuestions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      
      // TTS removed from quiz mode
    } else {
      calculateQuizResults();
    }
  };

  const calculateQuizResults = () => {
    // Use AI analysis results
    const correctCount = answerResults.filter(r => r.isCorrect).length;
    const accuracy = Math.round((correctCount / quizQuestions.length) * 100);
    let understanding: "strong" | "partial" | "weak";
    
    if (accuracy >= 70) understanding = "strong";
    else if (accuracy >= 40) understanding = "partial";
    else understanding = "weak";

    // Trigger confetti for strong and partial understanding
    if (accuracy >= 40) {
      setShowConfetti(true);
    }

    setShowResult(true);

    const resultMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "assistant",
      content: getResultMessage(correctCount, quizQuestions.length, understanding),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, resultMessage]);

    setTimeout(() => {
      onEndStudy({
        topic: currentTopic || "General Study",
        timeSpent: Math.max(Math.round((new Date().getTime() - startTime.getTime()) / 60000), 1),
        messages,
        analysis,
        sessionId: sessionId || undefined,
        quizResult: {
          correctCount,
          totalQuestions: quizQuestions.length,
          accuracy,
          understanding,
          questions: quizQuestions,
          answers: userAnswers
        }
      });
    }, 3000);
  };

  const getResultMessage = (correct: number, total: number, understanding: string) => {
    const accuracy = Math.round((correct / total) * 100);
    
    if (understanding === "strong") {
      return `🎉 Amazing! You got ${correct}/${total} (${accuracy}%) correct! This topic is your strength. Keep it up! ✔`;
    } else if (understanding === "partial") {
      return `👍 Not bad! ${correct}/${total} (${accuracy}%) correct. Some concepts are clear but you need a bit more practice. You're improving!`;
    } else {
      return `⚠️ You got ${correct}/${total} (${accuracy}%) correct. You should revisit this topic. Don't worry, you'll do better next time! 💪`;
    }
  };

  const finishStudySession = () => {
    const timeSpent = Math.round((new Date().getTime() - startTime.getTime()) / 60000);
    onEndStudy({
      topic: currentTopic || "General Study",
      timeSpent: Math.max(timeSpent, 1),
      messages,
      analysis,
      sessionId: sessionId || undefined,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle subject/chapter selection
  const handleSubjectChange = (subject: string) => {
    setSelectedSubject(subject);
    setSelectedChapter(""); // Reset chapter when subject changes
  };

  const handleChapterChange = (chapter: string) => {
    setSelectedChapter(chapter);
    setCurrentTopic(`${selectedSubject} - ${chapter}`);
    setShowSubjectSelector(false);
    
    // Add confirmation message
    const confirmMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "assistant",
      content: `Perfect! 📖 You've selected **${selectedSubject}** chapter **"${chapter}"**. Ask me anything about this chapter - I'll focus my help on it! Let's begin? 🚀`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, confirmMessage]);
    
    if (autoSpeak) {
      setTimeout(() => {
        speakText(confirmMessage.content.replace(/\*\*/g, ""), confirmMessage.id);
      }, 300);
    }
  };

  const currentQuestion = quizQuestions[currentQuestionIndex];

  return (
    <div className="flex flex-col h-full w-full bg-gradient-to-b from-background to-muted/20">
      {/* Confetti Celebration */}
      <Confetti trigger={showConfetti} onComplete={() => setShowConfetti(false)} />
      {/* Enhanced ChatGPT-style Header - Mobile Optimized */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border/50 bg-card/95 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm sm:text-base">Gyanam AI</h3>
            <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
              {isQuizMode ? (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
                  Q {currentQuestionIndex + 1}/{quizQuestions.length}
                </span>
              ) : currentSubject ? (
                <span className="flex items-center gap-1 truncate max-w-[150px]">
                  <BookOpen className="w-3 h-3 text-primary" />
                  {currentSubject}
                  {completedSubjects.length > 0 && ` (${completedSubjects.length} done)`}
                </span>
              ) : selectedChapter ? (
                <span className="flex items-center gap-1 truncate max-w-[150px]">
                  <BookOpen className="w-3 h-3 text-primary" />
                  {selectedChapter.length > 20 ? selectedChapter.substring(0, 20) + "..." : selectedChapter}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                  {completedSubjects.length > 0 ? `${completedSubjects.length} subject(s) studied` : "Ready!"}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Subject/Chapter Toggle */}
          {selectedChapter && !isQuizMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSubjectSelector(true)}
              className="h-7 sm:h-8 px-2 text-[10px] sm:text-xs"
            >
              <BookOpen className="w-3 h-3 mr-1" />
              Change
            </Button>
          )}
          {/* Voice Speed Control - Mobile Optimized */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-foreground h-7 sm:h-8 px-1.5 sm:px-2 gap-0.5 sm:gap-1"
              >
                <Settings2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="text-[10px] sm:text-xs">{voiceSpeed}x</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 sm:w-72 p-3 sm:p-4" align="end">
              <div className="space-y-3 sm:space-y-4">
                {/* Voice Selection */}
                <div className="space-y-2">
                  <span className="text-xs sm:text-sm font-medium">Voice Select करें</span>
                  <SpeechifyVoiceSelector
                    selectedVoiceId={currentVoiceId}
                    onVoiceChange={setVoice}
                    onPreview={previewVoice}
                    isPreviewing={ttsLoading}
                    isPlaying={isSpeaking}
                    onStop={stopTTS}
                    disabled={isSpeaking && !ttsLoading}
                  />
                </div>
                
                <div className="border-t border-border pt-2 sm:pt-3 space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-medium">Voice Speed</span>
                    <span className="text-xs sm:text-sm text-muted-foreground">{voiceSpeed}x</span>
                  </div>
                  <Slider
                    value={[voiceSpeed]}
                    onValueChange={(val) => setVoiceSpeed(val[0])}
                    min={0.5}
                    max={1.5}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
                    <span>Slow</span>
                    <span>Fast</span>
                  </div>
                </div>
                <div className="border-t border-border pt-2 sm:pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-medium">Auto-speak</span>
                    <button
                      onClick={() => setAutoSpeak(!autoSpeak)}
                      className={`w-9 sm:w-10 h-5 rounded-full transition-colors relative ${autoSpeak ? 'bg-primary' : 'bg-muted'}`}
                    >
                      <span className={`absolute w-4 h-4 rounded-full bg-white top-0.5 transition-all ${autoSpeak ? 'left-4 sm:left-5' : 'left-0.5'}`} />
                    </button>
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Auto read AI responses</p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowAnalysis(!showAnalysis)}
            className="text-muted-foreground hover:text-foreground h-7 w-7 sm:h-8 sm:w-8 p-0"
          >
            <Brain className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
          {!isQuizMode && (
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleEndStudyClick}
              disabled={quizLoading}
              className="h-7 sm:h-8 px-2 sm:px-3 text-[10px] sm:text-xs"
            >
              {quizLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "End"}
            </Button>
          )}
        </div>
      </div>

      {/* Subject/Chapter Selector Panel */}
      {showSubjectSelector && !isQuizMode && (
        <div className="px-3 sm:px-4 py-3 bg-primary/5 border-b border-border">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Subject & Chapter चुनें</span>
              </div>
              {selectedChapter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSubjectSelector(false)}
                  className="h-6 px-2 text-xs"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
            <SubjectChapterSelector
              studentClass={studentClass}
              studentBoard={studentBoard as BoardType}
              selectedSubject={selectedSubject}
              selectedChapter={selectedChapter}
              onSubjectChange={handleSubjectChange}
              onChapterChange={handleChapterChange}
            />
            {selectedSubject && !selectedChapter && (
              <p className="text-xs text-muted-foreground">
                📖 Now select a chapter
              </p>
            )}
          </div>
        </div>
      )}

      {/* Analysis Panel - Mobile Optimized */}
      {showAnalysis && (
        <div className="px-3 sm:px-4 py-2 sm:py-3 bg-muted/50 border-b border-border">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
            <span className="text-muted-foreground">Level:</span>
            <span className={`font-medium px-2 py-0.5 rounded-full text-[10px] sm:text-xs ${
              analysis.currentUnderstanding === "excellent" ? "bg-accent/20 text-accent" :
              analysis.currentUnderstanding === "good" ? "bg-primary/20 text-primary" :
              analysis.currentUnderstanding === "average" ? "bg-warning/20 text-warning" :
              "bg-destructive/20 text-destructive"
            }`}>
              {analysis.currentUnderstanding}
            </span>
            {analysis.strongAreas.length > 0 && (
              <span className="text-accent flex items-center gap-1 text-[10px] sm:text-xs">
                <TrendingUp className="w-3 h-3" /> {analysis.strongAreas.slice(0, 1).join(", ")}
              </span>
            )}
            {analysis.weakAreas.length > 0 && (
              <span className="text-warning flex items-center gap-1 text-[10px] sm:text-xs">
                <AlertTriangle className="w-3 h-3" /> {analysis.weakAreas.slice(0, 1).join(", ")}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ChatGPT-style Messages - Mobile Optimized */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {messages.map((message) => {
          const reactions = messageReactions[message.id];
          const isUser = message.role === "user";
          
          return (
            <div
              key={message.id}
              className={`py-3 sm:py-5 px-3 sm:px-4 ${isUser ? "bg-background" : "bg-muted/20"} transition-colors`}
            >
              <div className="max-w-3xl mx-auto flex gap-2 sm:gap-4">
                {/* Avatar - Smaller on mobile */}
                <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg flex-shrink-0 flex items-center justify-center shadow-sm ${
                  isUser 
                    ? "bg-accent/10 ring-1 ring-accent/20" 
                    : "bg-primary/10 ring-1 ring-primary/20"
                }`}>
                  {isUser ? <User className="w-3 h-3 sm:w-4 sm:h-4 text-accent" /> : <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                    <span className="font-semibold text-xs sm:text-sm">
                      {isUser ? "You" : "Gyanam AI"}
                    </span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground">
                      {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  
                  {message.imageUrl && (
                    <img
                      src={message.imageUrl}
                      alt="Uploaded"
                      className="max-w-[150px] sm:max-w-[200px] rounded-xl mb-2 sm:mb-3 shadow-sm border border-border/50"
                    />
                  )}
                  
                  <div className="text-foreground leading-relaxed text-[13px] sm:text-[15px]">
                    {!isUser && message.isTyping && typingMessageId === message.id ? (
                      <TypingText 
                        text={message.content} 
                        speed={12}
                        onComplete={() => handleTypingComplete(message.id, message.content)}
                      />
                    ) : isUser ? (
                      <span className="whitespace-pre-wrap">{message.content}</span>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&>pre]:rounded-xl [&>pre]:bg-secondary [&>code]:bg-secondary [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded-md [&>code]:text-xs">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                  
                  {/* AI message actions - Compact on mobile */}
                  {!isUser && (
                    <div className="flex items-center gap-0.5 sm:gap-1 mt-2 sm:mt-3">
                      <button
                        onClick={() => speakText(message.content, message.id)}
                        className="p-1 sm:p-1.5 rounded hover:bg-muted transition-colors flex items-center gap-0.5 sm:gap-1"
                        title={speakingMessageId === message.id ? "Stop speaking" : "Read aloud"}
                      >
                        {speakingMessageId === message.id ? (
                          <>
                            <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                            <SoundWave isActive={true} className="ml-0.5 sm:ml-1" />
                            {/* TTS Engine Badge - Premium / Web Voice / Device Voice */}
                            {(() => {
                              const badge = getEngineBadge();
                              if (badge.style === 'none') return null;
                              return (
                                <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold ${
                                  badge.style === 'premium'
                                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                                    : 'bg-muted text-muted-foreground'
                                }`}>
                                  {badge.label}
                                </span>
                              );
                            })()}
                          </>
                        ) : (
                          <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground hover:text-foreground" />
                        )}
                      </button>
                      <div className="w-px h-3 sm:h-4 bg-border mx-0.5 sm:mx-1" />
                      <button
                        onClick={() => handleReaction(message.id, "like")}
                        className={`p-1 sm:p-1.5 rounded transition-colors ${
                          reactions?.like?.userReacted ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                        title="Like"
                      >
                        <ThumbsUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                      <button
                        onClick={() => handleReaction(message.id, "helpful")}
                        className={`p-1 sm:p-1.5 rounded transition-colors ${
                          reactions?.helpful?.userReacted ? "bg-accent/10 text-accent" : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                        title="Helpful"
                      >
                        <Lightbulb className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                      <button
                        onClick={() => handleReaction(message.id, "confusing")}
                        className={`p-1 sm:p-1.5 rounded transition-colors ${
                          reactions?.confusing?.userReacted ? "bg-warning/10 text-warning" : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                        title="Confusing"
                      >
                        <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Enhanced Quiz Question UI */}
        {isQuizMode && currentQuestion && !showResult && (
          <div className="py-6 bg-gradient-to-b from-primary/5 to-accent/5">
            <div className="max-w-2xl mx-auto px-4 flex gap-4">
              <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-primary to-accent text-white shadow-md">
                <Brain className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm bg-primary/10 text-primary px-3 py-1 rounded-full font-semibold">
                    Question {currentQuestionIndex + 1} of {quizQuestions.length}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    currentQuestion.difficulty === 'easy' ? 'bg-accent/20 text-accent' :
                    currentQuestion.difficulty === 'medium' ? 'bg-warning/20 text-warning' :
                    'bg-destructive/20 text-destructive'
                  }`}>
                    {currentQuestion.difficulty}
                  </span>
                </div>
                <p className="font-semibold text-lg mb-5 leading-relaxed">{currentQuestion.question}</p>
                
                {currentQuestion.type === "mcq" && currentQuestion.options && (
                  <div className="space-y-3">
                    {currentQuestion.options.map((option, idx) => {
                      const isSelected = selectedOption === option;
                      const isCorrect = option.toLowerCase() === currentQuestion.correct_answer.toLowerCase();
                      const showFeedback = showExplanation;
                      
                      return (
                        <button
                          key={idx}
                          onClick={() => !showExplanation && handleQuizAnswer(option)}
                          disabled={showExplanation}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                            showFeedback
                              ? isCorrect
                                ? "bg-accent/10 border-accent shadow-sm"
                                : isSelected
                                  ? "bg-destructive/10 border-destructive"
                                  : "bg-muted/30 border-border/50"
                              : isSelected
                                ? "bg-primary/10 border-primary shadow-sm"
                                : "bg-card border-border hover:border-primary/50 hover:bg-primary/5"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-muted text-sm font-bold mr-3">
                                {String.fromCharCode(65 + idx)}
                              </span>
                              {option}
                            </span>
                            {showFeedback && isCorrect && <CheckCircle className="w-5 h-5 text-accent" />}
                            {showFeedback && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-destructive" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {currentQuestion.type === "true_false" && (
                  <div className="flex gap-3">
                    {["True", "False"].map((option) => {
                      const isSelected = selectedOption === option;
                      const isCorrect = option.toLowerCase() === currentQuestion.correct_answer.toLowerCase();
                      const showFeedback = showExplanation;
                      
                      return (
                        <button
                          key={option}
                          onClick={() => !showExplanation && handleQuizAnswer(option)}
                          disabled={showExplanation}
                          className={`flex-1 p-4 rounded-xl border-2 transition-all font-semibold ${
                            showFeedback
                              ? isCorrect
                                ? "bg-accent/10 border-accent"
                                : isSelected
                                  ? "bg-destructive/10 border-destructive"
                                  : "bg-muted/30 border-border/50"
                              : isSelected
                                ? "bg-primary/10 border-primary"
                                : "bg-card border-border hover:border-primary/50 hover:bg-primary/5"
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                )}

                {(currentQuestion.type === "fill_blank" || currentQuestion.type === "short_answer") && !showExplanation && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type your answer here..."
                        value={shortAnswerInput}
                        onChange={(e) => setShortAnswerInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter" && shortAnswerInput.trim()) {
                            handleShortAnswerSubmit();
                          }
                        }}
                        className="rounded-xl"
                        disabled={analyzingAnswer}
                      />
                      <Button 
                        onClick={handleShortAnswerSubmit} 
                        disabled={!shortAnswerInput.trim() || analyzingAnswer} 
                        className="rounded-xl"
                      >
                        {analyzingAnswer ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      💡 Apne words mein likho - AI samajhkar check karega
                    </p>
                  </div>
                )}

                {/* Analyzing indicator */}
                {analyzingAnswer && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span>AI tumhara answer analyze kar raha hai...</span>
                  </div>
                )}

                {showExplanation && answerResults[currentQuestionIndex] && (
                  <div className="mt-4 space-y-3">
                    {/* AI Analysis Result */}
                    <div className={`p-3 rounded-xl ${
                      answerResults[currentQuestionIndex].isCorrect 
                        ? "bg-accent/10 border border-accent/30" 
                        : "bg-destructive/10 border border-destructive/30"
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        {answerResults[currentQuestionIndex].isCorrect ? (
                          <CheckCircle className="w-5 h-5 text-accent" />
                        ) : (
                          <XCircle className="w-5 h-5 text-destructive" />
                        )}
                        <span className="font-medium">
                          {answerResults[currentQuestionIndex].isCorrect ? "Correct! 🎉" : "Wrong Answer"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {answerResults[currentQuestionIndex].feedback}
                      </p>
                      {answerResults[currentQuestionIndex].reasoning && (
                        <p className="text-xs text-muted-foreground italic">
                          {answerResults[currentQuestionIndex].reasoning}
                        </p>
                      )}
                    </div>

                    {/* Correct Answer & Explanation */}
                    <div className="p-3 bg-muted/50 rounded-xl">
                      <p className="text-sm font-medium mb-1">
                        Correct Answer: {currentQuestion.correct_answer}
                      </p>
                      <p className="text-sm text-muted-foreground">{currentQuestion.explanation}</p>
                    </div>

                    <Button 
                      className="w-full rounded-xl" 
                      onClick={handleNextQuestion}
                    >
                      {currentQuestionIndex < quizQuestions.length - 1 ? `Next Question (${currentQuestionIndex + 2}/${quizQuestions.length})` : "See Results 🎯"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Loading indicator - ChatGPT style */}
        {isLoading && (
          <div className="py-5 bg-muted/20">
            <div className="max-w-2xl mx-auto px-4 flex gap-3">
              <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center bg-primary/10 ring-1 ring-primary/20">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <div className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{animationDelay: "0ms"}}></div>
                <div className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{animationDelay: "150ms"}}></div>
                <div className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{animationDelay: "300ms"}}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Image Preview */}
      {selectedImage && (
        <div className="px-4 py-2 bg-muted/30 border-t border-border/50">
          <div className="max-w-2xl mx-auto">
            <div className="relative inline-block">
              <img src={selectedImage} alt="Preview" className="h-16 rounded-lg shadow-sm" />
              <button
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-sm"
                onClick={() => setSelectedImage(null)}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ChatGPT-style Input - Mobile Optimized */}
      {!isQuizMode && (
        <div className="border-t border-border/40 bg-background p-2 sm:p-3 pb-safe">
          <div className="max-w-2xl mx-auto">
            <div className="relative flex items-center gap-1.5 sm:gap-2 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm px-2 sm:px-3 py-1.5 sm:py-2 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all duration-200">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 h-7 w-7 sm:h-8 sm:w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Image className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Button>
              
              {/* Voice Input Button */}
              {speechSupported && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleListening}
                  className={`shrink-0 h-7 w-7 sm:h-8 sm:w-8 rounded-xl transition-colors ${
                    isListening 
                      ? "bg-destructive/10 text-destructive hover:bg-destructive/20" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {isListening ? <MicOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                </Button>
              )}
              
              <Input
                placeholder={isListening ? "Listening..." : "Message Gyanam AI..."}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-7 sm:h-8 text-xs sm:text-sm"
                disabled={isLoading || isListening}
              />
              <Button
                size="icon"
                onClick={handleSendMessage}
                disabled={!inputValue.trim() && !selectedImage}
                className="shrink-0 h-7 w-7 sm:h-8 sm:w-8 rounded-xl"
                variant={inputValue.trim() ? "default" : "ghost"}
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              </Button>
            </div>
            {isListening && (
              <div className="flex flex-col items-center gap-1.5 sm:gap-2 mt-2 sm:mt-3">
                <VoiceInputIndicator isActive={isListening} />
                <p className="text-[10px] sm:text-xs text-muted-foreground animate-pulse">
                  Bol dijiye... main sun raha hoon
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyChat;
