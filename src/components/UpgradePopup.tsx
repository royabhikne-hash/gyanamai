import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, MessageSquare, ImageIcon, Loader2, ArrowUpCircle } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';

interface UpgradePopupProps {
  open: boolean;
  onClose: () => void;
  studentId: string | null;
  limitType: 'chats' | 'images';
}

export const UpgradePopup = ({ open, onClose, studentId, limitType }: UpgradePopupProps) => {
  const { toast } = useToast();
  const [requesting, setRequesting] = useState(false);
  const { subscription, studentType, requestUpgrade } = useSubscription(studentId);

  const isCoaching = studentType === 'coaching_student';
  const currentPlan = subscription?.plan || 'basic';

  const handleUpgrade = async (plan: string) => {
    setRequesting(true);
    const result = await requestUpgrade(plan);
    setRequesting(false);

    if (result.success) {
      toast({
        title: 'Upgrade Request Sent! 🎉',
        description: `Your ${plan} plan request has been sent for approval.`,
      });
      onClose();
    } else {
      toast({
        title: 'Request Failed',
        description: result.error || 'Could not submit upgrade request.',
        variant: 'destructive',
      });
    }
  };

  const icon = limitType === 'chats' 
    ? <MessageSquare className="w-8 h-8 text-primary" /> 
    : <ImageIcon className="w-8 h-8 text-primary" />;

  const limitLabel = limitType === 'chats' ? 'chat' : 'image';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex justify-center mb-2">{icon}</div>
          <DialogTitle className="text-center">
            Daily {limitLabel} limit reached! 😔
          </DialogTitle>
          <DialogDescription className="text-center">
            Your daily {limitLabel} limit has been reached. Upgrade your plan to get more {limitLabel}s!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Show Pro upgrade for everyone */}
          {currentPlan !== 'pro' && (
            <div className="border-2 border-amber-500/30 rounded-xl p-4 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold flex items-center gap-1">
                  <Crown className="w-4 h-4 text-amber-500" />
                  Pro Plan
                </h4>
                <span className="text-sm font-bold text-amber-600">₹299/mo</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 mb-3">
                <li>✅ 100 chats/day</li>
                <li>✅ 15 images/day</li>
                <li>🎤 Premium AI Voice + Hindi</li>
              </ul>
              <Button 
                onClick={() => handleUpgrade('pro')} 
                disabled={requesting} 
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600" 
                size="sm"
              >
                {requesting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Crown className="w-4 h-4 mr-1" />}
                Request Pro
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradePopup;
