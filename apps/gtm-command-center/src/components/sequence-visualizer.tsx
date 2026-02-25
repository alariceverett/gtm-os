'use client';

/**
 * Sequence Visualizer
 * Timeline view of multi-touch campaigns
 * Shows A/B variants side-by-side with performance
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sequence, SequenceTouch, SequenceVariant } from '@/types';

interface SequenceVisualizerProps {
  sequence: Sequence;
  onVariantSelect?: (variantId: string) => void;
  className?: string;
}

interface TouchCardProps {
  touch: SequenceTouch;
  variants: SequenceVariant[];
  isLast: boolean;
}

const TOUCH_ICONS: Record<SequenceTouch['type'], string> = {
  email: '✉️',
  linkedin: '👤',
  call: '📞',
  sms: '💬',
  voicemail: '🎙️',
};

const CONDITION_LABELS: Record<NonNullable<SequenceTouch['condition']>, string> = {
  always: 'Always send',
  opened: 'If opened',
  replied: 'If replied',
  not_opened: 'If not opened',
  linked_in_accepted: 'If LinkedIn accepted',
};

function VariantComparison({ 
  variants, 
  touch, 
  onSelect 
}: { 
  variants: SequenceVariant[]; 
  touch: SequenceTouch;
  onSelect?: (variantId: string) => void;
}) {
  if (!touch.variantA && !touch.variantB) return null;

  const hasA = !!touch.variantA;
  const hasB = !!touch.variantB;
  const variantA = variants.find(v => v.id === 'a') || variants[0];
  const variantB = variants.find(v => v.id === 'b') || variants[1];

  return (
    <div className="mt-3 grid grid-cols-2 gap-3">
      {hasA && (
        <motion.div
          whileHover={{ scale: 1.02 }}
          onClick={() => onSelect?.('a')}
          className={`
            p-3 rounded-xl border cursor-pointer transition-colors
            ${variantA?.isWinning 
              ? 'border-emerald-500/50 bg-emerald-500/5' 
              : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800'}
          `}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Variant A</span>
            {variantA?.isWinning && (
              <span className="text-emerald-400">✓ Winner</span>
            )}
          </div>
          <div className="text-xs text-slate-200 line-clamp-2">
            {touch.variantA?.subject && (
              <div className="font-medium mb-1">{touch.variantA.subject}</div>
            )}
            <div className="text-slate-400">{touch.variantA?.body.slice(0, 80)}...</div>
          </div>
          
          {variantA?.metrics && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-slate-500">📊 {variantA.metrics.replyRate}% reply</span>
            </div>
          )}
        </motion.div>
      )}
      
      {hasB && (
        <motion.div
          whileHover={{ scale: 1.02 }}
          onClick={() => onSelect?.('b')}
          className={`
            p-3 rounded-xl border cursor-pointer transition-colors
            ${variantB?.isWinning 
              ? 'border-emerald-500/50 bg-emerald-500/5' 
              : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800'}
          `}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Variant B</span>
            {variantB?.isWinning && (
              <span className="text-emerald-400">✓ Winner</span>
            )}
          </div>
          <div className="text-xs text-slate-200 line-clamp-2">
            {touch.variantB?.subject && (
              <div className="font-medium mb-1">{touch.variantB.subject}</div>
            )}
            <div className="text-slate-400">{touch.variantB?.body.slice(0, 80)}...</div>
          </div>
          
          {variantB?.metrics && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-slate-500">📊 {variantB.metrics.replyRate}% reply</span>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function TouchCard({ touch, variants, isLast }: TouchCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClick = () => {
    if (touch.variantA || touch.variantB) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className="relative flex gap-4">
      {!isLast && (
        <div className="absolute left-6 top-14 bottom-0 w-px bg-slate-800" />
      )}

      <div className="flex flex-col items-center">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-lg">
          {TOUCH_ICONS[touch.type]}
        </div>
        <div className="mt-1 text-xs font-medium text-slate-500">
          Day {touch.day}
        </div>
      </div>

      <div className="flex-1 pb-6">
        <div 
          onClick={handleClick}
          className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 cursor-pointer hover:bg-slate-900/80 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-300">
                {touch.type === 'email' ? 'Email' : 
                 touch.type === 'linkedin' ? 'LinkedIn' :
                 touch.type === 'call' ? 'Call' :
                 touch.type === 'sms' ? 'SMS' : 'Voicemail'}
              </span>
              
              {touch.condition && touch.condition !== 'always' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400"
                >
                  {CONDITION_LABELS[touch.condition]}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {touch.autoSend && (
                <span className="text-xs text-emerald-400">Auto-send</span>
              )}
              <span className="text-slate-500">{isExpanded ? '▼' : '▶'}</span>
            </div>
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <VariantComparison
                  variants={variants}
                  touch={touch}
                />

                {touch.variantA?.personalizedFields && touch.variantA.personalizedFields.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    <span className="text-xs text-slate-500">Personalized: </span>
                    {touch.variantA.personalizedFields.map((field) => (
                      <span 
                        key={field}
                        className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                )}

                {touch.autoSend && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <span>🕐</span>
                    <span>Est. send: {touch.type === 'email' ? '9:00 AM EST' : '10:00 AM local'}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default function SequenceVisualizer({ sequence, onVariantSelect, className = '' }: SequenceVisualizerProps) {
  const metrics = sequence.metrics;
  
  const variantA = sequence.variants.find(v => v.name === 'A');
  const variantB = sequence.variants.find(v => v.name === 'B');
  const isAbTest = sequence.variants.length > 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden ${className}`}
    >
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📧</span>
            <div>
              <h3 className="font-semibold text-slate-200">{sequence.name}</h3>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className={`
                  px-2 py-0.5 rounded-full
                  ${sequence.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                    sequence.status === 'paused' ? 'bg-amber-500/20 text-amber-400' :
                    sequence.status === 'draft' ? 'bg-slate-700 text-slate-400' :
                    'bg-slate-700 text-slate-400'}
                `}
                >
                  {sequence.status.toUpperCase()}
                </span>
                <span>•</span>
                <span>{sequence.touches.length} touches</span>
                <span>•</span>
                <span>{sequence.prospects.length} prospects</span>
              </div>
            </div>
          </div>

          {isAbTest && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">A/B Test:</span>
              <div className="flex items-center gap-1">
                {variantA?.isWinning && (
                  <span className="text-emerald-400">✓</span>
                )}
                <span className={`
                  text-xs px-2 py-1 rounded-lg
                  ${variantA?.isWinning ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}
                `}
                >
                  A ({Math.round((variantA?.split || 50))}%)
                </span>
                
                {variantB?.isWinning && (
                  <span className="text-emerald-400">✓</span>
                )}
                <span className={`
                  text-xs px-2 py-1 rounded-lg
                  ${variantB?.isWinning ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}
                `}
                >
                  B ({Math.round((variantB?.split || 50))}%)
                </span>
              </div>
              
              {(variantA?.isWinning || variantB?.isWinning) && (
                <span className="text-xs text-emerald-400 ml-2"
                >
                  {(variantA?.isWinning ? variantA : variantB)?.metrics && Math.abs(
                    (variantA?.metrics.replyRate || 0) - (variantB?.metrics.replyRate || 0)
                  ).toFixed(1)}% margin
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-4 gap-4">
          <div>
            <div className="text-2xl font-bold text-slate-100">{metrics.replyRate}%</div>
            <div className="text-xs text-slate-500">Reply Rate</div>
          </div>
          
          <div>
            <div className="text-2xl font-bold text-slate-100">{metrics.openRate}%</div>
            <div className="text-xs text-slate-500">Open Rate</div>
          </div>
          
          <div>
            <div className="text-2xl font-bold text-slate-100">{metrics.bookRate}%</div>
            <div className="text-xs text-slate-500">Book Rate</div>
          </div>
          
          <div>
            <div className="text-2xl font-bold text-slate-100">{metrics.sent.toLocaleString()}</div>
            <div className="text-xs text-slate-500">Sent</div>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-4">
          Sequence Timeline
        </div>
        
        <div className="space-y-0">
          {sequence.touches.map((touch, idx) => (
            <TouchCard
              key={touch.id}
              touch={touch}
              variants={sequence.variants}
              isLast={idx === sequence.touches.length - 1}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
