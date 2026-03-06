import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Loader2, SkipForward, Plus, Camera, Mic } from 'lucide-react';
import { ExamPrepSession, ChatMessage } from '@/hooks/useExamPrep';

interface Props {
  session: ExamPrepSession;
  studentName: string;
  onSendMessage: (sessionId: string, message: string, history: ChatMessage[]) => Promise<string>;
  onBack: () => void;
}

const ExamPrepChat: React.FC<Props> = ({ session, studentName, onSendMessage, onBack }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Welcome ${studentName}! 🎓\n\nI'm your AI exam prep tutor for **${session.exam_name || 'your exam'}**. ${
        session.exam_date ? `Your exam is on ${session.exam_date}. ` : ''
      }${session.target_score ? `Aiming for ${session.target_score}? Let's make it happen! ` : ''}\n\nI've adapted my teaching style based on your preferences. What would you like to start with?\n\n1. 📚 Review a specific topic\n2. ❓ Practice questions\n3. 💡 Explain a concept\n4. 📝 Quick revision`,
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput('');
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
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card/80 backdrop-blur-sm">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <p className="font-semibold text-sm text-foreground">{session.exam_name || 'AI Tutor'}</p>
          <p className="text-xs text-muted-foreground">
            {session.extracted_topics?.length ? `${session.extracted_topics.length} topics loaded` : 'General prep'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <SkipForward className="h-4 w-4 mr-1" /> Skip
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-muted text-foreground rounded-bl-md'
              }`}
            >
              {msg.content}
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
      <div className="border-t border-border p-3 bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground">
            <Plus className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground">
            <Camera className="h-5 w-5" />
          </Button>
          <Input
            ref={inputRef}
            placeholder="Ask your tutor..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="flex-1"
          />
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground">
            <Mic className="h-5 w-5" />
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
