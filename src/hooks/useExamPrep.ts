import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ExamPrepAccess {
  hasAccess: boolean;
  plan: string;
  monthlyLimit: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  studentName: string;
  studentId: string;
}

export interface ExamPrepSession {
  id: string;
  exam_name: string;
  exam_date: string | null;
  target_score: number | null;
  topic_familiarity: string;
  mood: string;
  onboarding_completed: boolean;
  extracted_topics: any[];
  mastery_data: any;
  created_at: string;
  exam_prep_materials?: { id: string; file_name: string; processing_status: string }[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const useExamPrep = () => {
  const [access, setAccess] = useState<ExamPrepAccess | null>(null);
  const [sessions, setSessions] = useState<ExamPrepSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAccess = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase.functions.invoke('exam-prep', {
        body: { action: 'check_access' },
      });
      if (err) throw err;
      if (data?.error) throw new Error(data.error);
      setAccess(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const { data, error: err } = await supabase.functions.invoke('exam-prep', {
        body: { action: 'get_sessions' },
      });
      if (err) throw err;
      setSessions(data?.sessions || []);
    } catch (e: any) {
      console.error('Fetch sessions error:', e);
    }
  }, []);

  const createSession = useCallback(async (params: {
    examName: string;
    examDate?: string;
    targetScore?: number;
    topicFamiliarity: string;
    mood: string;
  }) => {
    const { data, error: err } = await supabase.functions.invoke('exam-prep', {
      body: { action: 'create_session', ...params },
    });
    if (err) throw err;
    if (data?.error) throw new Error(data.error);
    await fetchSessions();
    await checkAccess();
    return data.session;
  }, [fetchSessions, checkAccess]);

  const extractContent = useCallback(async (sessionId: string, fileUrl: string, fileName: string) => {
    const { data, error: err } = await supabase.functions.invoke('exam-prep', {
      body: { action: 'extract_content', sessionId, fileUrl, fileName },
    });
    if (err) throw err;
    if (data?.error) throw new Error(data.error);
    return data.extracted;
  }, []);

  const sendChat = useCallback(async (sessionId: string, message: string, history: ChatMessage[]) => {
    const { data, error: err } = await supabase.functions.invoke('exam-prep', {
      body: { action: 'chat', sessionId, message, history },
    });
    if (err) throw err;
    if (data?.error) throw new Error(data.error);
    return data.reply;
  }, []);

  const generateVirtualExam = useCallback(async (sessionId: string) => {
    const { data, error: err } = await supabase.functions.invoke('exam-prep', {
      body: { action: 'generate_virtual_exam', sessionId },
    });
    if (err) throw err;
    if (data?.error) throw new Error(data.error);
    return data.exam;
  }, []);

  const evaluateVirtualExam = useCallback(async (sessionId: string, examData: any, answers: any[]) => {
    const { data, error: err } = await supabase.functions.invoke('exam-prep', {
      body: { action: 'evaluate_virtual_exam', sessionId, examData, answers },
    });
    if (err) throw err;
    if (data?.error) throw new Error(data.error);
    return data.result;
  }, []);

  const createInvite = useCallback(async (sessionId: string) => {
    const { data, error: err } = await supabase.functions.invoke('exam-prep', {
      body: { action: 'create_invite', sessionId },
    });
    if (err) throw err;
    if (data?.error) throw new Error(data.error);
    return data.invite;
  }, []);

  const joinInvite = useCallback(async (inviteCode: string) => {
    const { data, error: err } = await supabase.functions.invoke('exam-prep', {
      body: { action: 'join_invite', inviteCode },
    });
    if (err) throw err;
    if (data?.error) throw new Error(data.error);
    return data.session;
  }, []);

  useEffect(() => {
    checkAccess();
    fetchSessions();
  }, [checkAccess, fetchSessions]);

  return {
    access,
    sessions,
    loading,
    error,
    createSession,
    extractContent,
    sendChat,
    generateVirtualExam,
    evaluateVirtualExam,
    createInvite,
    joinInvite,
    refresh: () => { checkAccess(); fetchSessions(); },
  };
};
