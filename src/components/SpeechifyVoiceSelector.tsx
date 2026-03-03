import React, { useState } from 'react';
import { Volume2, Play, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SPEECHIFY_VOICES, SpeechifyVoice } from '@/hooks/useSpeechifyTTS';

interface SpeechifyVoiceSelectorProps {
  selectedVoiceId: string;
  onVoiceChange: (voiceId: string) => void;
  onPreview: (voiceId: string) => Promise<void>;
  isPreviewing: boolean;
  isPlaying: boolean;
  onStop: () => void;
  disabled?: boolean;
  showLanguageFilter?: boolean;
}

const SpeechifyVoiceSelector: React.FC<SpeechifyVoiceSelectorProps> = ({
  selectedVoiceId,
  onVoiceChange,
  onPreview,
  isPreviewing,
  isPlaying,
  onStop,
  disabled = false,
  showLanguageFilter = false, // Disabled by default since all voices support multilingual
}) => {
  const getLanguageEmoji = (voice: SpeechifyVoice): string => {
    if (voice.languageCode === 'en-IN') return '🇮🇳';
    if (voice.languageCode === 'en-GB') return '🇬🇧';
    return '🇺🇸';
  };

  const getGenderIcon = (gender: string): string => {
    if (gender === 'male') return '♂️';
    if (gender === 'female') return '♀️';
    return '⚧️';
  };

  const handlePreviewClick = () => {
    if (isPreviewing || isPlaying) {
      onStop();
    } else if (selectedVoiceId) {
      onPreview(selectedVoiceId);
    }
  };

  return (
    <div className="space-y-2">
      {/* Voice selector with preview */}
      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        
        <Select
          value={selectedVoiceId}
          onValueChange={onVoiceChange}
          disabled={disabled}
        >
          <SelectTrigger className="flex-1 h-9 text-xs bg-background">
            <SelectValue placeholder="Voice चुनें" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px] bg-background z-50">
            {SPEECHIFY_VOICES.map((voice) => (
              <SelectItem 
                key={voice.id} 
                value={voice.id}
                className="text-xs py-2"
              >
                <div className="flex items-center gap-2">
                  <span>{getLanguageEmoji(voice)}</span>
                  <span className="font-medium">{voice.name}</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1">
                    {getGenderIcon(voice.gender)}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Preview button */}
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 flex-shrink-0"
          onClick={handlePreviewClick}
          disabled={!selectedVoiceId || disabled}
          title={isPreviewing || isPlaying ? "Stop preview" : "Preview voice"}
        >
          {isPreviewing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isPlaying ? (
            <Square className="h-3.5 w-3.5 text-destructive" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Selected voice description */}
      {selectedVoiceId && (
        <div className="text-xs text-muted-foreground pl-6">
          {SPEECHIFY_VOICES.find(v => v.id === selectedVoiceId)?.description || 'Voice selected'} 
          <span className="ml-1 text-primary/70">• Multi-language supported</span>
        </div>
      )}
    </div>
  );
};

export default SpeechifyVoiceSelector;
