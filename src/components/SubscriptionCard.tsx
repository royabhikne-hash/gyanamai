import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Crown, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Loader2,
  Volume2,
  Ban,
  ArrowUpCircle
} from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionCardProps {
  studentId: string | null;
  onRefresh?: () => void;
}

export const SubscriptionCard = ({ studentId, onRefresh }: SubscriptionCardProps) => {
  const { toast } = useToast();
  const [requesting, setRequesting] = useState(false);
  
  const {
    subscription,
    pendingRequest,
    loading,
    requestUpgrade,
    getStatusLabel,
    getDaysRemaining,
    getTTSUsagePercent,
    refreshSubscription,
  } = useSubscription(studentId);

  if (loading) {
    return (
      <div className="edu-card p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
        <div className="h-8 bg-muted rounded w-2/3"></div>
      </div>
    );
  }

  if (!subscription) return null;

  const statusLabel = getStatusLabel();
  const daysRemaining = getDaysRemaining();
  const usagePercent = getTTSUsagePercent();
  const isPro = subscription.plan === 'pro';

  const handleRequestUpgrade = async () => {
    setRequesting(true);
    const result = await requestUpgrade();
    setRequesting(false);

    if (result.success) {
      toast({
        title: 'Request Submitted! 🎉',
        description: 'Your Pro plan request has been sent to your school for approval.',
      });
      onRefresh?.();
    } else {
      toast({
        title: 'Request Failed',
        description: result.error || 'Could not submit upgrade request. Try again later.',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = () => {
    switch (statusLabel) {
      case 'Active Pro':
        return (
          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
            <Crown className="w-3 h-3 mr-1" />
            Pro Active
          </Badge>
        );
      case 'Pending Approval':
        return (
          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">
            <Clock className="w-3 h-3 mr-1" />
            Pending Approval
          </Badge>
        );
      case 'Expired':
        return (
          <Badge variant="destructive">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Expired
          </Badge>
        );
      case 'Blocked':
        return (
          <Badge variant="destructive">
            <Ban className="w-3 h-3 mr-1" />
            Blocked
          </Badge>
        );
      case 'Voice Limit Reached':
        return (
          <Badge variant="outline" className="border-orange-500 text-orange-600">
            <Volume2 className="w-3 h-3 mr-1" />
            Voice Limit Reached
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            Basic Plan
          </Badge>
        );
    }
  };

  return (
    <div className={`edu-card p-4 ${isPro ? 'ring-2 ring-amber-500/30' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-sm text-muted-foreground mb-1">Your Plan</h3>
          {getStatusBadge()}
        </div>
        {isPro && (
          <Crown className="w-6 h-6 text-amber-500" />
        )}
      </div>

      {/* Pro Plan Details */}
      {isPro && (
        <div className="space-y-3 mb-4">
          {/* Days remaining */}
          {daysRemaining !== null && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>
                {daysRemaining > 0 
                  ? `${daysRemaining} days remaining`
                  : 'Expired'
                }
              </span>
            </div>
          )}

          {/* TTS Usage */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Premium Voice Usage</span>
              <span>{subscription.tts_used.toLocaleString()} / {subscription.tts_limit.toLocaleString()}</span>
            </div>
            <Progress value={usagePercent} className="h-2" />
          </div>
        </div>
      )}

      {/* Basic Plan - Show upgrade button */}
      {!isPro && statusLabel !== 'Pending Approval' && statusLabel !== 'Blocked' && (
        <div className="mt-3">
          <div className="text-sm text-muted-foreground mb-3">
            <p>📢 Basic: Browser voice only</p>
            <p className="mt-1">✨ Pro: Premium AI voice + Hindi support</p>
          </div>
          <Button 
            onClick={handleRequestUpgrade}
            disabled={requesting}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
          >
            {requesting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <ArrowUpCircle className="w-4 h-4 mr-2" />
            )}
            Request Pro Plan (₹299/month)
          </Button>
        </div>
      )}

      {/* Pending Request Message */}
      {statusLabel === 'Pending Approval' && (
        <div className="mt-3 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
          <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">Awaiting School Approval</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Your request has been sent to your school admin. You'll be notified once approved.
          </p>
        </div>
      )}

      {/* Blocked Message */}
      {statusLabel === 'Blocked' && (
        <div className="mt-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
          <div className="flex items-center gap-2 text-destructive">
            <Ban className="w-4 h-4" />
            <span className="text-sm font-medium">Pro Access Blocked</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Your Pro access has been blocked by school admin. Contact your school for more info.
          </p>
        </div>
      )}

      {/* Price info for Basic */}
      {!isPro && statusLabel === 'Basic' && (
        <p className="text-xs text-muted-foreground mt-2">
          Basic plan: ₹149/month | Pro plan: ₹299/month
        </p>
      )}
    </div>
  );
};

export default SubscriptionCard;
