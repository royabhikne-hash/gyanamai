import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, X, Volume2, VolumeX, Loader2, Bot, User, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ParentChatbotProps {
  token: string;
  studentName: string;
}

const ParentChatbot = ({ token, studentName }: ParentChatbotProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hello! I'm Gyanam AI's Parent Assistant. Ask me anything about ${studentName}'s study progress, performance, or how you can help them improve! You can also ask in Hindi if you prefer.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Auto-speak the first welcome message
  useEffect(() => {
    if (autoSpeak && messages.length === 1 && messages[0].role === "assistant") {
      speakText(messages[0].content);
    }
  }, []);

  const speakText = useCallback((text: string) => {
    if (!autoSpeak || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    
    // Break into chunks for stability
    const chunks = text.match(/.{1,150}[.!?,\s]|.+$/g) || [text];
    
    setIsSpeaking(true);
    let chunkIndex = 0;

    const speakNext = () => {
      if (chunkIndex >= chunks.length) {
        setIsSpeaking(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex].trim());
      utterance.lang = "en-IN";
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      // Try to find an Indian English voice
      const voices = window.speechSynthesis.getVoices();
      const indianVoice = voices.find(
        (v) => v.lang === "en-IN" || (v.lang.startsWith("en") && v.name.toLowerCase().includes("india"))
      );
      const englishVoice = voices.find((v) => v.lang.startsWith("en"));
      if (indianVoice) utterance.voice = indianVoice;
      else if (englishVoice) utterance.voice = englishVoice;

      utterance.onend = () => {
        chunkIndex++;
        speakNext();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNext();
  }, [autoSpeak]);

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("parent-chat", {
        body: {
          token,
          message: userMsg.content,
          chatHistory: messages.slice(-6),
        },
      });

      if (error) throw error;

      const aiText = data?.response || "Sorry, I could not get a response. Please try again.";
      const assistantMsg: Message = { role: "assistant", content: aiText };
      setMessages((prev) => [...prev, assistantMsg]);

      // Auto-speak the response
      if (autoSpeak) {
        speakText(aiText);
      }
    } catch (err) {
      console.error("Parent chat error:", err);
      toast.error("Could not get a response. Please try again.");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestedQuestions = [
    "How is my child performing?",
    "What are the weak areas?",
    "How many hours studied this week?",
    "Any tips to improve?",
  ];

  if (!isOpen) {
    return (
      <div 
        style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999 }}
      >
        <button
          onClick={() => setIsOpen(true)}
          className="bg-primary text-primary-foreground rounded-full p-4 shadow-2xl hover:shadow-xl transition-all hover:scale-105 animate-bounce"
          style={{ width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label="Open Parent Chatbot"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 99999, width: '380px', maxWidth: 'calc(100vw - 2rem)' }} className="animate-in slide-in-from-bottom-4 fade-in duration-300">
      <Card className="flex flex-col h-[520px] max-h-[70vh] shadow-2xl border-border/30 overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">Parent Assistant</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                Ask about {studentName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => {
                setAutoSpeak(!autoSpeak);
                if (isSpeaking) stopSpeaking();
              }}
              title={autoSpeak ? "Turn off auto-speak" : "Turn on auto-speak"}
            >
              {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => {
                setIsOpen(false);
                stopSpeaking();
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages - ChatGPT Style */}
        <div className="flex-1 overflow-y-auto bg-background">
          {messages.map((msg, i) => (
            <div key={i} className={`px-3 py-2.5 ${msg.role === "assistant" ? "bg-muted/20" : "bg-background"}`}>
              <div className="flex gap-2.5">
                {/* Avatar */}
                <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                  msg.role === "assistant"
                    ? "bg-primary/10 ring-1 ring-primary/20"
                    : "bg-accent/10 ring-1 ring-accent/20"
                }`}>
                  {msg.role === "assistant"
                    ? <Sparkles className="w-3 h-3 text-primary" />
                    : <User className="w-3 h-3 text-accent" />
                  }
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-semibold text-muted-foreground mb-0.5 block">
                    {msg.role === "assistant" ? "Parent Assistant" : "You"}
                  </span>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed [&>p]:mb-1.5 [&>ul]:mb-1.5 [&>ol]:mb-1.5">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-[13px] text-foreground leading-relaxed">{msg.content}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="px-3 py-2.5 bg-muted/20">
              <div className="flex gap-2.5">
                <div className="w-6 h-6 rounded-md bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3 h-3 text-primary" />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-semibold text-muted-foreground mb-1 block">Parent Assistant</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions (show only at start) */}
        {messages.length <= 1 && (
          <div className="px-3 py-2 flex flex-wrap gap-1.5 border-t border-border/40 bg-background">
            {suggestedQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => {
                  const userMsg: Message = { role: "user", content: q };
                  setMessages((prev) => [...prev, userMsg]);
                  setIsLoading(true);
                  supabase.functions.invoke("parent-chat", {
                    body: { token, message: q, chatHistory: messages.slice(-6) },
                  }).then(({ data, error }) => {
                    const aiText = data?.response || "Sorry, please try again.";
                    setMessages((prev) => [...prev, { role: "assistant", content: aiText }]);
                    if (autoSpeak) speakText(aiText);
                  }).catch(() => {
                    setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong." }]);
                  }).finally(() => setIsLoading(false));
                }}
                className="text-xs px-2.5 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input - ChatGPT Style */}
        <div className="p-2.5 border-t border-border/40 bg-background">
          <div className="relative flex items-end gap-2 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm px-3 py-1.5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all duration-200">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask about your child..."
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-8 text-sm"
              disabled={isLoading}
            />
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="shrink-0 h-7 w-7 rounded-lg"
              variant={input.trim() ? "default" : "ghost"}
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ParentChatbot;
