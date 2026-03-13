import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Subscription {
  id: string;
  student_id: string;
  plan: 'basic' | 'pro';
  start_date: string;
  end_date: string | null;
  tts_used: number;
  tts_limit: number;
  is_active: boolean;
}

export interface UpgradeRequest {
  id: string;
  student_id: string;
  requested_plan: 'basic' | 'pro';
  status: 'pending' | 'approved' | 'rejected' | 'blocked';
  requested_at: string;
  processed_at: string | null;
  rejection_reason: string | null;
}

export interface DailyUsage {
  chatsUsed: number;
  imagesUsed: number;
  chatsLimit: number;
  imagesLimit: number;
}

export interface PlanLimits {
  chatsPerDay: number;
  imagesPerDay: number;
  premiumTTS: boolean;
  monthlyPrice: number;
}

interface UseSubscriptionReturn {
  subscription: Subscription | null;
  pendingRequest: UpgradeRequest | null;
  loading: boolean;
  error: string | null;
  studentType: 'school_student' | 'coaching_student';
  dailyUsage: DailyUsage | null;
  planLimits: PlanLimits | null;
  refreshSubscription: () => Promise<void>;
  requestUpgrade: (requestedPlan?: string) => Promise<{ success: boolean; error?: string }>;
  canUsePremiumTTS: () => boolean;
  getStatusLabel: () => string;
  getDaysRemaining: () => number | null;
  getTTSUsagePercent: () => number;
}

export const useSubscription = (studentId: string | null): UseSubscriptionReturn => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [pendingRequest, setPendingRequest] = useState<UpgradeRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentType, setStudentType] = useState<'school_student' | 'coaching_student'>('school_student');
  const [dailyUsage, setDailyUsage] = useState<DailyUsage | null>(null);
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'get_subscription', studentId },
      });

      if (fetchError) throw fetchError;
      if (data?.error) throw new Error(data.error);

      setSubscription(data?.subscription || null);
      setPendingRequest(data?.pendingRequest || null);
      setStudentType(data?.studentType || 'school_student');
      setDailyUsage(data?.dailyUsage || null);
      setPlanLimits(data?.planLimits || null);
      setError(null);
    } catch (err: any) {
      console.error('Subscription fetch error:', err);
      setError(err.message || 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const requestUpgrade = useCallback(async (requestedPlan?: string): Promise<{ success: boolean; error?: string }> => {
    if (!studentId) {
      return { success: false, error: 'No student ID' };
    }

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'request_upgrade', studentId, requestedPlan: requestedPlan || 'pro' },
      });

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

      await fetchSubscription();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to submit request' };
    }
  }, [studentId, fetchSubscription]);

  const canUsePremiumTTS = useCallback((): boolean => {
    if (!subscription) return false;
    if (subscription.plan !== 'pro') return false;
    if (!subscription.is_active) return false;
    if (subscription.end_date && new Date(subscription.end_date) < new Date()) return false;
    if (subscription.tts_used >= subscription.tts_limit) return false;
    return true;
  }, [subscription]);

  const getStatusLabel = useCallback((): string => {
    if (!subscription) return 'No Plan';
    if (pendingRequest?.status === 'blocked') return 'Blocked';
    if (pendingRequest?.status === 'pending') return 'Pending Approval';
    
    if (subscription.plan === 'pro') {
      if (subscription.end_date && new Date(subscription.end_date) < new Date()) return 'Expired';
      if (subscription.tts_used >= subscription.tts_limit) return 'Voice Limit Reached';
      return 'Active Pro';
    }
    
    return 'Basic';
  }, [subscription, pendingRequest]);

  const getDaysRemaining = useCallback((): number | null => {
    if (!subscription?.end_date) return null;
    if (subscription.plan !== 'pro') return null;
    const endDate = new Date(subscription.end_date);
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [subscription]);

  const getTTSUsagePercent = useCallback((): number => {
    if (!subscription) return 0;
    if (subscription.tts_limit === 0) return 0;
    return Math.min(100, (subscription.tts_used / subscription.tts_limit) * 100);
  }, [subscription]);

  return {
    subscription,
    pendingRequest,
    loading,
    error,
    studentType,
    dailyUsage,
    planLimits,
    refreshSubscription: fetchSubscription,
    requestUpgrade,
    canUsePremiumTTS,
    getStatusLabel,
    getDaysRemaining,
    getTTSUsagePercent,
  };
};

export default useSubscription;
