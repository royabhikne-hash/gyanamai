import { useEffect } from 'react';
import { MessageSquare, ImageIcon, Volume2, Calendar, Crown } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/useSubscription';

interface DailyUsageWidgetProps {
  studentId: string | null;
}

export const DailyUsageWidget = ({ studentId }: DailyUsageWidgetProps) => {
  const { subscription, dailyUsage, planLimits, loading } = useSubscription(studentId);

  if (loading) {
    return (
      <div className="edu-card p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-3"></div>
        <div className="space-y-3">
          <div className="h-6 bg-muted rounded w-full"></div>
          <div className="h-6 bg-muted rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (!subscription || !dailyUsage || !planLimits) return null;

  const chatsPercent = planLimits.chatsPerDay > 0 
    ? Math.min(100, (dailyUsage.chatsUsed / planLimits.chatsPerDay) * 100) 
    : 0;
  const imagesPercent = planLimits.imagesPerDay > 0 
    ? Math.min(100, (dailyUsage.imagesUsed / planLimits.imagesPerDay) * 100) 
    : 0;
  
  const chatsRemaining = Math.max(0, planLimits.chatsPerDay - dailyUsage.chatsUsed);
  const imagesRemaining = Math.max(0, planLimits.imagesPerDay - dailyUsage.imagesUsed);

  const isPro = subscription.plan === 'pro';
  const ttsPercent = subscription.tts_limit > 0
    ? Math.min(100, (subscription.tts_used / subscription.tts_limit) * 100)
    : 0;

  const planLabel = subscription.plan === 'basic' ? 'Basic' : 'Pro';

  // Calculate expiry
  const daysRemaining = subscription.end_date 
    ? Math.max(0, Math.ceil((new Date(subscription.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="edu-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm text-muted-foreground">Daily Usage</h3>
        <Badge variant={isPro ? 'default' : 'secondary'} className={isPro ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white' : ''}>
          {isPro && <Crown className="w-3 h-3 mr-1" />}
          {planLabel} Plan
        </Badge>
      </div>

      <div className="space-y-3">
        {/* Chats */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <MessageSquare className="w-3.5 h-3.5" />
              Chats Today
            </span>
            <span className={`font-medium ${chatsRemaining === 0 ? 'text-destructive' : 'text-foreground'}`}>
              {chatsRemaining} / {planLimits.chatsPerDay} left
            </span>
          </div>
          <Progress value={chatsPercent} className="h-2" />
        </div>

        {/* Images */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <ImageIcon className="w-3.5 h-3.5" />
              Images Today
            </span>
            <span className={`font-medium ${imagesRemaining === 0 ? 'text-destructive' : 'text-foreground'}`}>
              {imagesRemaining} / {planLimits.imagesPerDay} left
            </span>
          </div>
          <Progress value={imagesPercent} className="h-2" />
        </div>

        {/* Pro TTS Quota */}
        {isPro && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Volume2 className="w-3.5 h-3.5" />
                Premium Voice Quota
              </span>
              <span className={`font-medium ${ttsPercent >= 100 ? 'text-destructive' : 'text-foreground'}`}>
                {subscription.tts_used.toLocaleString()} / {subscription.tts_limit.toLocaleString()}
              </span>
            </div>
            <Progress value={ttsPercent} className="h-2" />
          </div>
        )}

        {/* Plan Expiry */}
        {daysRemaining !== null && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-border">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {daysRemaining > 0 
                ? `Plan expires in ${daysRemaining} days`
                : 'Plan expired'
              }
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyUsageWidget;
