'use client';

/**
 * Command Bar - Natural Language Input
 * Fixed top, always accessible
 * Shows suggestions dropdown as you type
 * Integrates with Apollo MCP
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseCommand, formatIntentDescription, parseCommandWithSuggestions } from '@/lib/nlp/command-parser';
import { CommandIntent } from '@/types';

interface CommandBarProps {
  onCommand: (intent: CommandIntent) => void;
  isProcessing?: boolean;
  className?: string;
}

interface Suggestion {
  id: string;
  type: 'example' | 'correction' | 'recent';
  text: string;
  label?: string;
  icon?: string;
}

const EXAMPLE_COMMANDS: Suggestion[] = [
  {
    id: 'ex1',
    type: 'example',
    text: 'Find me CMOs at fintechs Series B or later in NYC with recent hiring',
    label: 'Example',
    icon: '🔍',
  },
  {
    id: 'ex2',
    type: 'example',
    text: 'Search for VP Engineering at SaaS startups in San Francisco',
    label: 'Example',
    icon: '🔍',
  },
  {
    id: 'ex3',
    type: 'example',
    text: 'Create campaign for CTOs who just raised Series A',
    label: 'Example',
    icon: '⭐',
  },
  {
    id: 'ex4',
    type: 'example',
    text: 'Find companies like Stripe but smaller, with engineering leaders',
    label: 'Example',
    icon: '🔍',
  },
];

export default function CommandBar({ onCommand, isProcessing, className = '' }: CommandBarProps) {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [parsedIntent, setParsedIntent] = useState<CommandIntent | null>(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!input.trim()) {
      setParsedIntent(null);
      setSuggestions(EXAMPLE_COMMANDS);
      return;
    }

    const { intent, suggestions: nlpSuggestions } = parseCommandWithSuggestions(input);
    setParsedIntent(intent);

    const dynamicSuggestions: Suggestion[] = [];

    if (intent.confidence > 0.3) {
      dynamicSuggestions.push({
        id: 'preview',
        type: 'example',
        text: formatIntentDescription(intent),
        label: 'Interpreted as',
        icon: '✨',
      });
    }

    for (const suggestion of nlpSuggestions.slice(0, 2)) {
      dynamicSuggestions.push({
        id: `sugg-${dynamicSuggestions.length}`,
        type: 'correction',
        text: suggestion,
        label: 'Tip',
        icon: '💡',
      });
    }

    setSuggestions(dynamicSuggestions.slice(0, 4));
  }, [input]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => prev > -1 ? prev - 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      
      if (activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) {
        const suggestion = suggestions[activeSuggestionIndex];
        if (suggestion.id === 'preview' && parsedIntent) {
          onCommand(parsedIntent);
          setInput('');
          setSuggestions([]);
        } else {
          setInput(suggestion.text);
        }
      } else if (input.trim() && parsedIntent) {
        onCommand(parsedIntent);
        setInput('');
        setSuggestions([]);
      }
    } else if (e.key === 'Escape') {
      inputRef.current?.blur();
      setIsFocused(false);
    }
  }, [activeSuggestionIndex, suggestions, input, parsedIntent, onCommand]);

  const handleSuggestionClick = (suggestion: Suggestion) => {
    if (suggestion.id === 'preview' && parsedIntent) {
      onCommand(parsedIntent);
      setInput('');
    } else {
      setInput(suggestion.text);
    }
    inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && parsedIntent) {
      onCommand(parsedIntent);
      setInput('');
      setSuggestions([]);
    }
  };

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${className}`}>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mx-auto max-w-4xl px-4 pt-4"
      >
        <div className={`relative rounded-2xl border bg-slate-950/95 backdrop-blur-xl shadow-2xl transition-all duration-200 ${isFocused ? 'border-indigo-500/50 shadow-indigo-500/20' : 'border-slate-800'}`}
        >
          <form onSubmit={handleSubmit}>
            <div className="flex items-center px-4 py-3 gap-3">
              <div className="flex items-center gap-2 text-slate-400">
                <span className="text-xl">🎯</span>
                <span className="hidden sm:block text-sm font-medium">GTM</span>
              </div>
              
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                  onKeyDown={handleKeyDown}
                  placeholder="Find me CMOs at fintechs Series B+..."
                  className="w-full bg-transparent text-lg text-slate-100 placeholder-slate-500 outline-none"
                  disabled={isProcessing}
                />
                
                {isProcessing && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute right-0 top-1/2 -translate-y-1/2"
                  >
                    <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                  </motion.div>
                )}
              </div>
              
              <div className="hidden sm:flex items-center gap-2">
                <button
                  type="button"
                  className="px-2 py-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  ⌘K
                </button>
              </div>
            </div>
          </form>

          <AnimatePresence>
            {isFocused && suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="border-t border-slate-800"
              >
                <div className="py-2">
                  {suggestions.map((suggestion, index) => (
                    <motion.button
                      key={suggestion.id}
                      type="button"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => handleSuggestionClick(suggestion)}
                      onMouseEnter={() => setActiveSuggestionIndex(index)}
                      className={`w-full px-4 py-2 flex items-center gap-3 text-left transition-colors ${activeSuggestionIndex === index ? 'bg-slate-800/50' : 'hover:bg-slate-800/30'}`}
                    >
                      <span className="text-lg">{suggestion.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-500 uppercase tracking-wider">
                          {suggestion.label}
                        </div>
                        <div className="text-sm text-slate-300 truncate">
                          {suggestion.text}
                        </div>
                      </div>
                      
                      {index === 0 && (
                        <span className="text-xs text-slate-500">↵</span>
                      )}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {parsedIntent && parsedIntent.confidence > 0.5 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t border-slate-800 px-4 py-2"
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">{parsedIntent.action.toUpperCase()}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400">{Math.round(parsedIntent.confidence * 100)}% confidence</span>
                  
                  {parsedIntent.icp?.titles && (
                    <>
                      <span className="text-slate-600">•</span>
                      <span className="text-indigo-400">{parsedIntent.icp.titles.join(', ')}</span>
                    </>
                  )}
                  
                  {parsedIntent.icp?.industries && (
                    <>
                      <span className="text-slate-600">•</span>
                      <span className="text-emerald-400">{parsedIntent.icp.industries[0]}</span>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
