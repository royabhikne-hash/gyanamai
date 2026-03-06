import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Check, Link2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  inviteCode: string | null;
  loading: boolean;
  onClose: () => void;
}

const InviteModal: React.FC<Props> = ({ inviteCode, loading, onClose }) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const inviteUrl = inviteCode
    ? `${window.location.origin}/exam-prep?invite=${inviteCode}`
    : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast({ title: 'Link copied to clipboard!' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Invite a Study Buddy</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Share this link with a friend to study and practice together!
          </p>
          {loading ? (
            <div className="h-12 bg-muted rounded-xl animate-pulse" />
          ) : inviteCode ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-xl px-4 py-3 text-sm text-foreground truncate flex items-center gap-2">
                <Link2 className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{inviteUrl}</span>
              </div>
              <Button size="icon" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-destructive">Failed to generate invite</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InviteModal;
