'use client';

/**
 * Sequences Page
 * A/B visualizer and sequence builder
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GitBranch,
  Plus,
  Mail,
  Linkedin,
  Phone,
  MessageSquare,
  Clock,
  ChevronDown,
  ChevronRight,
  Play,
  Pause,
  MoreVertical,
  Target,
  BarChart3,
  ArrowRightLeft,
  Copy,
  Edit3,
} from 'lucide-react';

interface Sequence {
  id: string;
  name: string;
  status: 'active' | 'draft' | 'paused';
  touches: Touch[];
  variants: Variant[];
  totalProspects: number;
  metrics: {
    openRate: number;
    replyRate: number;
    bookRate: number;
  };
}

interface Touch {
  id: string;
  day: number;
  type: 'email' | 'linkedin' | 'phone' | 'sms';
  order: number;
  variantA?: { subject: string; body: string };
  variantB?: { subject: string; body: string };
  autoSend: boolean;
  condition: string;
}

interface Variant {
  id: string;
  name: string;
  split: number;
  isWinning: boolean;
  metrics: {
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
    booked: number;
    openRate: number;
    replyRate: number;
  };
}

const sequences: Sequence[] = [
  {
    id: '1',
    name: 'Series B SaaS Outreach',
    status: 'active',
    touches: [
      { id: 't1', day: 1, type: 'email', order: 1, autoSend: true, condition: 'always' },
      { id: 't2', day: 3, type: 'email', order: 2, autoSend: false, condition: 'not_opened' },
      { id: 't3', day: 7, type: 'linkedin', order: 3, autoSend: false, condition: 'opened' },
      { id: 't4', day: 10, type: 'email', order: 4, autoSend: false, condition: 'opened' },
      { id: 't5', day: 14, type: 'phone', order: 5, autoSend: false, condition: 'replied' },
    ],
    variants: [
      { 
        id: 'a', 
        name: 'A', 
        split: 50, 
        isWinning: true,
        metrics: { sent: 150, opened: 120, clicked: 35, replied: 22, booked: 6, openRate: 80, replyRate: 15 }
      },
      { 
        id: 'b', 
        name: 'B', 
        split: 50, 
        isWinning: false,
        metrics: { sent: 150, opened: 105, clicked: 25, replied: 15, booked: 3, openRate: 70, replyRate: 10 }
      },
    ],
    totalProspects: 300,
    metrics: { openRate: 75, replyRate: 12, bookRate: 3 },
  },
  {
    id: '2',
    name: 'CMO Value Prop',
    status: 'active',
    touches: [
      { id: 't1', day: 1, type: 'email', order: 1, autoSend: true, condition: 'always' },
      { id: 't2', day: 4, type: 'email', order: 2, autoSend: false, condition: 'not_opened' },
      { id: 't3', day: 8, type: 'email', order: 3, autoSend: false, condition: 'not_replied' },
    ],
    variants: [
      { 
        id: 'a', 
        name: 'A', 
        split: 70, 
        isWinning: true,
        metrics: { sent: 70, opened: 60, clicked: 20, replied: 12, booked: 4, openRate: 86, replyRate: 17 }
      },
      { 
        id: 'b', 
        name: 'B', 
        split: 30, 
        isWinning: false,
        metrics: { sent: 30, opened: 22, clicked: 5, replied: 3, booked: 0, openRate: 73, replyRate: 10 }
      },
    ],
    totalProspects: 100,
    metrics: { openRate: 82, replyRate: 15, bookRate: 4 },
  },
];

const getTouchIcon = (type: Touch['type']) => {
  switch (type) {
    case 'email': return Mail;
    case 'linkedin': return Linkedin;
    case 'phone': return Phone;
    case 'sms': return MessageSquare;
  }
};

const getTouchColor = (type: Touch['type']) => {
  switch (type) {
    case 'email': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'linkedin': return 'bg-sky-500/20 text-sky-400 border-sky-500/30';
    case 'phone': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'sms': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  }
};

const getStatusColor = (status: Sequence['status']) => {
  switch (status) {
    case 'active': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'paused': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'draft': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
  }
};

function SequenceCard({ sequence }: { sequence: Sequence }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTouch, setSelectedTouch] = useState<Touch | null>(sequence.touches[0] ?? null);
  const [selectedVariant, setSelectedVariant] = useState(sequence.variants[0].id);

  const variant = sequence.variants.find(v => v.id === selectedVariant) ?? sequence.variants[0];

  return (
    <motion.div
      layout
      className="rounded-2xl bg-slate-900/50 border-2 border-slate-800 overflow-hidden"
    >
      {/* Header */}
      <motion.div
        layout="position"
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-5 cursor-pointer hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl border-2 ${getStatusColor(sequence.status)}`}>
              <GitBranch className="w-5 h-5" />
            </div>
            
            <div>
              <h3 className="font-semibold text-slate-100 text-lg">{sequence.name}</h3>
              
              <div className="flex items-center gap-4 mt-2">
                <span className={`
                  px-2 py-0.5 rounded-full text-xs font-medium border
                  ${getStatusColor(sequence.status)}
                `}>
                  {sequence.status.charAt(0).toUpperCase() + sequence.status.slice(1)}
                </span>
                <span className="text-xs text-slate-500">{sequence.touches.length} touches</span>
                <span className="text-xs text-slate-500">{sequence.totalProspects} prospects</span>
                <span className="text-xs text-slate-500">A/B Test {sequence.variants.length} variants</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-400">{sequence.metrics.replyRate}%</div>
              <div className="text-xs text-slate-500">Reply Rate</div>
            </div>
            <button className="p-2 text-slate-500 hover:text-slate-200">
              {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-slate-800"
          >
            <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Variant Selector */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4" />
                    A/B Variants
                  </h4>
                  
                  <div className="space-y-2">
                    {sequence.variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariant(v.id)}
                        className={`
                          w-full p-3 rounded-xl border-2 text-left transition-all
                          ${selectedVariant === v.id
                            ? 'bg-indigo-500/10 border-indigo-500/50'
                            : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-100">Variant {v.name}</span>
                          {v.isWinning && (
                            <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">
                              Winner
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-slate-400">
                          {v.split}% split • {v.metrics.sent} sent
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          <div className="text-center p-2 rounded-lg bg-slate-900/50">
                            <div className="text-lg font-semibold text-slate-100">{v.metrics.openRate}%</div>
                            <div className="text-xs text-slate-500">Open</div>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-slate-900/50">
                            <div className="text-lg font-semibold text-slate-100">{v.metrics.replyRate}%</div>
                            <div className="text-xs text-slate-500">Reply</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Winning Indicators */}
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                  <div className="text-sm font-medium text-slate-300 mb-2">Statistical Significance</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: '95%' }}
                        className="h-full bg-emerald-500 rounded-full"
                      />
                    </div>
                    <span className="text-sm font-semibold text-emerald-400">95%</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Variant A is the clear winner with 35% better reply rates</p>
                </div>
              </div>

              {/* Touch Timeline */}
              <div className="lg:col-span-2">
                <h4 className="text-sm font-medium text-slate-400 mb-3">Sequence Flow</h4>
                
                <div className="space-y-3">
                  {sequence.touches.map((touch, i) => {
                    const Icon = getTouchIcon(touch.type);
                    return (
                      <motion.div
                        key={touch.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        onClick={() => setSelectedTouch(touch)}
                        className={`
                          flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
                          ${selectedTouch?.id === touch.id
                            ? 'bg-slate-800 border-indigo-500/50'
                            : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                          }
                        `}
                      >
                        <div className={`
                          p-2 rounded-lg border
                          ${getTouchColor(touch.type)}
                        `}>
                          <Icon className="w-4 h-4" />
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-200 capitalize">{touch.type}</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-400">Day {touch.day}</span>
                          </div>
                          
                          {i === 0 && (
                            <div className="text-xs text-slate-500 mt-1">Initial outreach</div>
                          )}
                          {touch.condition !== 'always' && (
                            <div className="text-xs text-amber-500/70 mt-1">Condition: {touch.condition}</div>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          {touch.autoSend ? (
                            <span className="text-xs text-emerald-500">Auto-send</span>
                          ) : (
                            <span className="text-xs text-slate-500">Manual</span>
                          )}
                          <Clock className="w-4 h-4 text-slate-600" />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Preview Panel */}
                <AnimatePresence mode="wait">
                  {selectedTouch && (
                    <motion.div
                      key={selectedTouch.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-4 p-4 rounded-xl bg-slate-800/30 border border-slate-700"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-slate-400">
                          Preview: Day {selectedTouch.day} - {selectedTouch.type}
                        </span>
                        
                        <div className="flex items-center gap-2">
                          <button className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded-lg transition-colors">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded-lg transition-colors">
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-900 text-slate-400 text-sm">
                        Template preview for Variant {variant.name} will appear here...
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Action Bar */}
            <div className="px-5 py-4 border-t border-slate-800 bg-slate-900/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  View Full Analytics
                </button>
                <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium text-sm transition-colors">
                  <Target className="w-4 h-4 inline mr-2" />
                  Apply Winner to All
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                  <Pause className="w-4 h-4" />
                </button>
                <button className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function SequencesPage() {
  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-6 pt-6"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <GitBranch className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-100">Sequences</h1>
                <p className="text-slate-400">Build multi-touch sequences with A/B testing</p>
              </div>
            </div>

            <button className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Sequence
            </button>
          </div>
        </div>
      </motion.div>

      {/* Sequences List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="px-6 mt-6 pb-12"
      >
        <div className="max-w-7xl mx-auto space-y-4">
          {sequences.map((sequence) => (
            <SequenceCard key={sequence.id} sequence={sequence} />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
