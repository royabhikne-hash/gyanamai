import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Loader2, Plus, Camera, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { ExamPrepSession, ChatMessage } from '@/hooks/useExamPrep';
import ReactMarkdown from 'react-markdown';

interface Props {
  session: ExamPrepSession;
  studentName: string;
  onSendMessage: (sessionId: string, message: string, history: ChatMessage[]) => Promise<string>;
  onBack: () => void;
}

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

const ExamPrepChat: React.FC<Props> = ({ session, studentName, onSendMessage, onBack }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Welcome ${studentName}!\n\nI'm your AI exam prep tutor for ${session.exam_name || 'your exam'}. ${
        session.exam_date ? `Your exam is on ${session.exam_date}. ` : ''
      }${session.target_score ? `Aiming for ${session.target_score}? Let's make it happen! ` : ''}\n\nI've adapted my teaching style based on your preferences. What would you like to start with?\n\n1. Review a specific topic\n2. Practice questions\n3. Explain a concept\n4. Quick revision`,
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    return () => {
      synthRef.current?.cancel();
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Auto-speak last assistant message
  useEffect(() => {
    if (!ttsEnabled) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'assistant' && !sending) {
      speakText(lastMsg.content);
    }
  }, [messages, sending, ttsEnabled]);

  const speakText = useCallback((text: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();

    // Clean markdown symbols for speech
    const cleanText = text
      .replace(/[*_#`~>\[\]()!]/g, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .trim();

    if (!cleanText) return;

    // Split into chunks of ~150 chars for reliability
    const chunks = cleanText.match(/.{1,150}[.!?,;:\s]|.{1,150}/g) || [cleanText];
    
    setIsSpeaking(true);
    let chunkIndex = 0;

    const speakChunk = () => {
      if (chunkIndex >= chunks.length || !ttsEnabled) {
        setIsSpeaking(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
      utterance.lang = 'en-IN';
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.onend = () => {
        chunkIndex++;
        speakChunk();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
      };
      synthRef.current?.speak(utterance);
    };

    speakChunk();
  }, [ttsEnabled]);

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
  }, []);

  const toggleTTS = useCallback(() => {
    if (ttsEnabled) {
      stopSpeaking();
    }
    setTtsEnabled(prev => !prev);
  }, [ttsEnabled, stopSpeaking]);

  const toggleVoiceInput = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput('');
    stopSpeaking();
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setSending(true);

    try {
      const reply = await onSendMessage(session.id, msg, messages);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I had trouble responding. Please try again.' }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <p className="font-semibold text-sm text-foreground">{session.exam_name || 'AI Tutor'}</p>
          <p className="text-xs text-muted-foreground">
            {session.extracted_topics?.length ? `${session.extracted_topics.length} topics loaded` : 'General prep'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTTS}
          className={ttsEnabled ? 'text-primary' : 'text-muted-foreground'}
        >
          {ttsEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'chat-bubble-user'
                  : 'chat-bubble-ai'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 bg-card">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            placeholder="Ask your tutor..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleVoiceInput}
            className={isListening ? 'text-destructive' : 'text-muted-foreground'}
          >
            {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          <Button size="icon" onClick={handleSend} disabled={!input.trim() || sending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ExamPrepChat;
