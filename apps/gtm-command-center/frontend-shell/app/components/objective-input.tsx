'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useVoiceInput } from '@/app/hooks/use-voice-input';
import { 
  Mic, 
  MicOff, 
  Sparkles, 
  Send, 
  Zap, 
  Target, 
  TrendingUp, 
  Users, 
  Calendar, 
  ChevronRight,
  Command,
  CornerDownLeft,
  Wand2,
  X,
  CheckCircle2,
} from 'lucide-react';

interface AISuggestion {
  id: string;
  text: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const aiSuggestions: AISuggestion[] = [
  { 
    id: '1', 
    text: 'Book 5 demos this week', 
    icon: Calendar, 
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10'
  },
  { 
    id: '2', 
    text: 'Research competitor positioning', 
    icon: Target, 
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10'
  },
  { 
    id: '3', 
    text: 'Launch email sequence to 100 prospects', 
    icon: Users, 
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10'
  },
  { 
    id: '4', 
    text: 'Increase MRR by 10%', 
    icon: TrendingUp, 
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10'
  },
];

// Rotating placeholder examples
const placeholderExamples = [
  "Book 5 demos with enterprise accounts this week...",
  "Research competitor pricing and update battlecards...",
  "Launch outbound sequence to 200 qualified prospects...",
  "Schedule follow-ups with pilot customers before renewal...",
  "Create case study with latest customer win...",
  "Update pitch deck with new product features...",
];

interface ObjectiveInputProps {
  className?: string;
}

// =============================================================================
// VOICE RECORDING OVERLAY
// =============================================================================

interface VoiceRecordingOverlayProps {
  isListening: boolean;
  transcript: string;
  onStop: () => void;
}

function VoiceRecordingOverlay({ isListening, transcript, onStop }: VoiceRecordingOverlayProps) {
  const [ripples, setRipples] = useState<number[]>([0, 1, 2]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setRipples(prev => [...prev, prev.length]);
    }, 600);
    return () => clearInterval(interval);
  }, []);
  
  if (!isListening) return null;
  
  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center"
      onClick={onStop}
    >
      <div 
        className="flex flex-col items-center gap-8 max-w-lg mx-auto px-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animated microphone */}
        <div className="relative h-32 w-32 flex items-center justify-center">
          {/* Concentric animated rings */}
          {ripples.slice(-4).map((ripple, i) => (
            <span
              key={ripple}
              className="absolute inset-0 rounded-full border-2 border-blue-500/30"
              style={{
                animation: `voice-ring 2s ease-out forwards`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
          
          {/* Gradient glow effect */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/20 to-violet-500/20 animate-pulse" />
          
          {/* Main mic button */}
          <div className="relative h-24 w-24 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center shadow-2xl shadow-blue-500/30 animate-pulse">
            <Mic className="h-10 w-10 text-white" />
          </div>
          
          {/* Audio wave visualization */}
          <div className="absolute -bottom-2 flex items-end gap-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-blue-400/60 rounded-full animate-music-bar"
                style={{
                  height: '20px',
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        </div>
        
        {/* Transcript preview */}
        <div className="text-center space-y-3">
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">
            Listening...
          </p>          
          {transcript ? (
            <div className="px-6 py-4 bg-slate-900/50 rounded-xl border border-slate-800/50">
              <p className="text-slate-200 text-lg font-medium leading-relaxed">
                "{transcript}"
              </p>
            </div>
          ) : (
            <p className="text-slate-500 text-sm">
              Speak clearly into your microphone
            </p>
          )}
        </div>
        
        {/* Stop button */}
        <button
          onClick={onStop}
          className="mt-4 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition-all duration-200 hover:shadow-lg flex items-center gap-2"
        >
          <X className="h-4 w-4" />
          Stop Recording
        </button>
      </div>      
      <style jsx>{`
        @keyframes voice-ring {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          100% {
            transform: scale(2.5);
            opacity: 0;
          }
        }
        @keyframes music-bar {
          0%, 100% {
            height: 20px;
          }
          50% {
            height: 40px;
          }
        }
      `}</style>
    </div>
  );
}

// =============================================================================
// AI SUGGESTION CHIPS
// =============================================================================

interface SuggestionChipsProps {
  suggestions: AISuggestion[];
  onSelect: (text: string) => void;
}

function SuggestionChips({ suggestions, onSelect }: SuggestionChipsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-slate-500 mr-1">Quick suggestions:</span>      
      {suggestions.map((suggestion, index) => {
        const Icon = suggestion.icon;
        return (
          <button
            key={suggestion.id}
            onClick={() => onSelect(suggestion.text)}
            className={cn(
              'group inline-flex items-center gap-1.5 px-3 py-1.5',
              'border border-slate-700/50 hover:border-slate-600',
              'text-slate-300 hover:text-slate-100',
              'text-xs font-medium',
              'rounded-full transition-all duration-200',
              'hover:shadow-md hover:shadow-blue-500/5 hover:-translate-y-0.5',
              'active:translate-y-0'
            )}
            style={{
              animationDelay: `${index * 50}ms`,
            }}
          >
            <span className={cn(
              'h-2 w-2 rounded-full transition-transform duration-200 group-hover:scale-125',
              suggestion.bgColor,
              suggestion.color.replace('text-', 'bg-')
            )} />
            <span>{suggestion.text}</span>
            <ChevronRight className="h-3 w-3 opacity-0 -ml-1 transition-all duration-200 group-hover:opacity-100 group-hover:ml-0" />
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// KEYBOARD SHORTCUT HINT
// =============================================================================

function KeyboardShortcutHint({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) return null;
  
  return (
    <div className="absolute right-4 bottom-4 flex items-center gap-1 text-xs text-slate-600 dark:text-slate-500">
      <span className="hidden sm:inline">Press</span>
      <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500 font-mono border border-slate-200 dark:border-slate-700"><Command className="h-3 w-3 inline" />+Enter</kbd>
      <span className="hidden sm:inline">to create</span>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ObjectiveInput({ className }: ObjectiveInputProps) {
  const { 
    isListening, 
    transcript, 
    error, 
    isSupported,
    startListening, 
    stopListening,
    setTranscript 
  } = useVoiceInput();
  
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [charCount, setCharCount] = useState(0);

  // Update input value when transcript changes from voice
  useEffect(() => {
    if (transcript) {
      setInputValue(transcript);
      setCharCount(transcript.length);
    }
  }, [transcript]);
  
  // Rotate placeholder
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isFocused && !inputValue) {
        setPlaceholderIndex(prev => (prev + 1) % placeholderExamples.length);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isFocused, inputValue]);
  
  const handleSubmit = useCallback(async () => {
    if (!inputValue.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    
    // Simulate submission with success animation
    await new Promise(resolve => setTimeout(resolve, 600));
    
    setInputValue('');
    setTranscript('');
    setIsSubmitting(false);
    setShowSuccess(true);
    
    setTimeout(() => {
      setShowSuccess(false);
      textareaRef.current?.focus();
    }, 1500);
  }, [inputValue, isSubmitting, setTranscript]);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    setCharCount(e.target.value.length);
  };
  
  const applySuggestion = (text: string) => {
    setInputValue(text);
    setCharCount(text.length);
    textareaRef.current?.focus();
  };

  const currentPlaceholder = placeholderExamples[placeholderIndex];
  const hasContent = inputValue.trim().length > 0;
  const isAtLimit = charCount > 200;
  
  return (
    <div className={cn('space-y-4', className)}>
      {/* Voice Recording Overlay */}
      <VoiceRecordingOverlay 
        isListening={isListening}
        transcript={transcript}
        onStop={stopListening}
      />
      
      {/* Main Input Card */}
      <div
        className={cn(
          'relative rounded-2xl overflow-hidden',
          'bg-slate-900 border-2',
          'transition-all duration-300 ease-out',
          isFocused 
            ? 'border-blue-500/50 shadow-xl shadow-blue-500/10' 
            : 'border-slate-800/50 hover:border-slate-700/50'
        )}
      >
        {/* Top gradient line when focused */}
        <div className={cn(
          'absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-violet-500 to-purple-500',
          'transition-opacity duration-300',
          isFocused ? 'opacity-100' : 'opacity-0'
        )} />
        
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className={cn(
              'h-10 w-10 rounded-xl flex items-center justify-center',
              'bg-gradient-to-br from-blue-500 to-violet-500 shadow-lg shadow-blue-500/20',
              'transition-transform duration-300',
              isFocused && 'scale-110 rotate-3'
            )}>
              <Zap className="h-5 w-5 text-white" />
            </div>            
            <div className="flex-1">
              <h3 className="text-base font-bold text-slate-100">
                What&apos;s your next GTM move?
              </h3>
              <p className="text-xs text-slate-500">
                Enter to create • Shift+Enter for new line
              </p>
            </div>            
            {/* Close/success indicator */}
            <div className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center transition-all duration-300',
              showSuccess ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
            )}>
              <div className="h-full w-full rounded-full bg-emerald-500 flex items-center justify-center animate-scale-in">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>
          
          {/* Input Area */}
          <div className="relative min-h-[120px]">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder=""
              disabled={isSubmitting || showSuccess}
              className={cn(
                'w-full min-h-[100px] p-0 text-base text-slate-200',
                'bg-transparent border-0 outline-none resize-none',
                'focus:ring-0 focus:outline-none',
                'placeholder:text-slate-500',
                (isSubmitting || showSuccess) && 'opacity-50 cursor-not-allowed'
              )}
              style={{ 
                lineHeight: '1.6',
              }}
            />            
            {/* Animated placeholder overlay */}
            {!hasContent && !isListening && (
              <div 
                className="absolute inset-0 pointer-events-none flex items-start pt-1"
                onClick={() => textareaRef.current?.focus()}
              >
                <p className="text-slate-500 text-base leading-relaxed">
                  {currentPlaceholder}
                  <span className="inline-block w-0.5 h-5 bg-blue-500 ml-0.5 animate-pulse align-middle" />
                </p>
              </div>
            )}
          </div>          
          {/* Character count */}
          <div className={cn(
            'absolute bottom-20 right-6 text-xs transition-all duration-200',
            hasContent ? 'opacity-100' : 'opacity-0'
          )}>
            <span className={cn(
              'font-medium',
              isAtLimit ? 'text-red-400' : 'text-slate-500'
            )}>
              {charCount}
            </span>
            <span className="text-slate-600">&#124;&#126;500</span>
          </div>
        </div>        
        {/* Divider */}
        <div className="h-px bg-slate-800/50" />        
        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Voice Button */}
              <button
                onClick={isListening ? stopListening : startListening}
                disabled={!isSupported || isSubmitting}
                className={cn(
                  'relative p-2.5 rounded-xl transition-all duration-200',
                  isListening
                    ? 'bg-red-500/10 text-red-400 ring-2 ring-red-500/20'
                    : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200',
                  !isSupported && 'opacity-50 cursor-not-allowed',
                  'hover:scale-105 active:scale-95',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50'
                )}
                title={isSupported ? (isListening ? 'Stop recording' : 'Voice input') : 'Voice not supported'}
              >
                {isListening ? (
                  <div className="relative">
                    <MicOff className="h-5 w-5" />
                    <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                  </div>
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>              
              {/* AI Suggest Button */}
              <button 
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-2 rounded-xl',
                  'bg-violet-500/10 hover:bg-violet-500/20',
                  'text-violet-400 text-sm font-medium',
                  'transition-all duration-200',
                  'hover:scale-105 active:scale-95',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                  (isSubmitting && isSupported) && 'opacity-50 pointer-events-none'
                )}
                disabled={isSubmitting}
              >
                <Wand2 className="h-4 w-4" />
                AI Suggest
              </button>              
              {/* Error message */}
              <div className="min-w-0">
                {error && (
                  <span className="text-xs text-red-400">
                    {error}
                  </span>
                )}
              </div>
            </div>            
            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={!hasContent || isSubmitting || showSuccess}
              className={cn(
                'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl',
                'transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
                hasContent && !isSubmitting && !showSuccess
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:-translate-y-0.5 active:translate-y-0'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              )}
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating...</span>
                </>
              ) : showSuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Created!</span>
                </>
              ) : (
                <>
                  <span>Create</span>
                  <CornerDownLeft className="h-4 w-4" />
                </>
              )}
            </button>
          </div>        </div>
      </div>      
      {/* AI Suggestions Row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-slate-500 mr-1">Quick suggestions:</span>        
        {aiSuggestions.map((suggestion, index) => {
          const Icon = suggestion.icon;
          return (
            <button
              key={suggestion.id}
              onClick={() => applySuggestion(suggestion.text)}
              className={cn(
                'group inline-flex items-center gap-1.5 px-3 py-1.5',
                'border border-slate-700/50 hover:border-slate-600',
                'text-slate-300 hover:text-slate-100',
                'text-xs font-medium',
                'rounded-full transition-all duration-200',
                'hover:shadow-md hover:shadow-blue-500/5 hover:-translate-y-0.5',
                'active:translate-y-0'
              )}
              style={{
                animationDelay: `${index * 50}ms`,
              }}
            >
              <span className={cn(
                'h-2 w-2 rounded-full transition-transform duration-200 group-hover:scale-125',
                suggestion.bgColor,
                suggestion.color.replace('text-', 'bg-')
              )} />
              <span>{suggestion.text}</span>
              <ChevronRight className="h-3 w-3 opacity-0 -ml-1 transition-all duration-200 group-hover:opacity-100 group-hover:ml-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
