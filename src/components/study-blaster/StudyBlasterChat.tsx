import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Bot, User, Sparkles, ArrowDown, BookOpen, HelpCircle, Lightbulb, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  projectId: string;
  projectTitle: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-blaster`;

const StudyBlasterChat = ({ projectId, projectTitle }: Props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadMessages = async () => {
      const { data } = await supabase
        .from("study_project_messages")
        .select("role, content")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      if (data && data.length > 0) {
        setMessages(data.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
      }
    };
    loadMessages();
  }, [projectId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Track scroll position for "scroll to bottom" button
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100);
    };
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 150) + "px";
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    await supabase.from("study_project_messages").insert({
      project_id: projectId,
      role: "user",
      content: userMsg.content,
    });

    let assistantContent = "";

    try {
      const { data: session } = await supabase.auth.getSession();
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session?.access_token}`,
        },
        body: JSON.stringify({
          action: "chat",
          projectId,
          messages: newMessages,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${resp.status})`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (assistantContent) {
        await supabase.from("study_project_messages").insert({
          project_id: projectId,
          role: "assistant",
          content: assistantContent,
        });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      if (!assistantContent) {
        setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickPrompts = [
    { icon: <BookOpen className="w-4 h-4" />, text: "Summarize all sources", desc: "Get a complete overview" },
    { icon: <FileQuestion className="w-4 h-4" />, text: "Generate practice questions", desc: "Test your knowledge" },
    { icon: <Lightbulb className="w-4 h-4" />, text: "Explain key concepts", desc: "Break down the hard stuff" },
    { icon: <HelpCircle className="w-4 h-4" />, text: "Compare topics across sources", desc: "Find connections" },
  ];

  return (
    <div className="flex flex-col h-full relative">
      {/* Messages Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto min-h-0 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 py-6">
            {/* Empty State - ChatGPT style */}
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--gradient-primary)' }}>
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="text-lg font-bold text-foreground font-display mb-1">
              Study Blaster AI
            </h3>
            <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">
              Ask anything about <span className="font-semibold text-foreground">{projectTitle}</span>. I'll answer from your sources only.
            </p>
            
            <div className="grid grid-cols-2 gap-2.5 w-full max-w-sm">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt.text}
                  onClick={() => { setInput(prompt.text); textareaRef.current?.focus(); }}
                  className="group flex flex-col items-start gap-1.5 p-3 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 text-left"
                >
                  <span className="text-primary/70 group-hover:text-primary transition-colors">
                    {prompt.icon}
                  </span>
                  <span className="text-xs font-medium text-foreground leading-tight">{prompt.text}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{prompt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-1 py-4">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`px-3 sm:px-4 py-3 ${
                  msg.role === "assistant" ? "bg-secondary/30" : ""
                }`}
              >
                <div className="max-w-2xl mx-auto flex gap-3">
                  {/* Avatar */}
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    msg.role === "assistant" 
                      ? "bg-primary/10 ring-1 ring-primary/20" 
                      : "bg-accent/10 ring-1 ring-accent/20"
                  }`}>
                    {msg.role === "assistant" 
                      ? <Sparkles className="w-3.5 h-3.5 text-primary" />
                      : <User className="w-3.5 h-3.5 text-accent" />
                    }
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-muted-foreground mb-1 block">
                      {msg.role === "assistant" ? "Study Blaster AI" : "You"}
                    </span>
                    {msg.role === "assistant" ? (
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

            {/* Typing indicator */}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="px-3 sm:px-4 py-3 bg-secondary/30">
                <div className="max-w-2xl mx-auto flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-semibold text-muted-foreground mb-1.5 block">Study Blaster AI</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-card border border-border shadow-lg flex items-center justify-center hover:bg-secondary transition-colors z-10"
        >
          <ArrowDown className="w-4 h-4 text-muted-foreground" />
        </button>
      )}

      {/* Input Area - ChatGPT style */}
      <div className="border-t border-border/40 pt-3 pb-1">
        <div className="max-w-2xl mx-auto">
          <div className="relative flex items-end gap-2 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm px-3 py-2 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all duration-200">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your study materials..."
              className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground/60 min-h-[24px] max-h-[150px] py-1 leading-relaxed"
              rows={1}
            />
            <Button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              size="icon"
              className="shrink-0 h-8 w-8 rounded-xl transition-all duration-200"
              variant={input.trim() ? "default" : "ghost"}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/50 text-center mt-1.5">
            Answers are grounded in your uploaded sources only
          </p>
        </div>
      </div>
    </div>
  );
};

export default StudyBlasterChat;
