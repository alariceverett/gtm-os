'use client';

/**
 * Outreach Research Page
 * Command bar interface for prospecting and research
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles,
  Search,
  Users,
  TrendingUp,
  Target,
  Zap,
} from 'lucide-react';

// Import the main components from the dashboard
import {
  CommandBar,
  ResearchCards,
  ProspectStream,
  Suggestions,
  SequenceVisualizer,
  ThreadPanel,
} from '@/components';

import type { 
  CommandIntent, 
  Prospect, 
  ResearchJob, 
  Suggestion as SuggestionType,
  ThreadItem,
  Sequence,
} from '@/types';

// Mock data for initial render
const MOCK_PROSPECTS: Prospect[] = [
  {
    id: '1',
    firstName: 'Sarah',
    lastName: 'Chen',
    name: 'Sarah Chen',
    title: 'VP Marketing',
    company: 'FintechFlow',
    industry: 'Financial Services',
    companySize: '50-200',
    location: 'New York, NY',
    email: 'sarah@fintechflow.com',
    score: 94,
    scoreGrade: 'A+',
    confidence: 95,
    signals: [
      { type: 'funding', label: 'Series B', description: 'Raised $25M last month', timestamp: new Date(), source: 'Apollo', strength: 'high' },
      { type: 'hiring', label: 'Hiring', description: 'Active recruitment for growth team', timestamp: new Date(), source: 'Apollo', strength: 'medium' },
    ],
    enrichedAt: new Date(),
  },
  {
    id: '2',
    firstName: 'Michael',
    lastName: 'Rodriguez',
    name: 'Michael Rodriguez',
    title: 'CTO',
    company: 'ScaleUp SaaS',
    industry: 'Software',
    companySize: '200-500',
    location: 'San Francisco, CA',
    email: 'mike@scaleup.io',
    score: 88,
    scoreGrade: 'A',
    confidence: 92,
    signals: [
      { type: 'expansion', label: 'Expanding', description: 'New office opening in Austin', timestamp: new Date(), source: 'Apollo', strength: 'high' },
    ],
    enrichedAt: new Date(),
  },
];

const MOCK_SUGGESTIONS: SuggestionType[] = [
  {
    id: '1',
    type: 'prospect',
    title: 'New prospects matching your ICP',
    description: 'Found 12 new contacts at Series B+ fintech companies',
    context: 'Auto-discovered',
    actionLabel: 'View Prospects',
    actionType: 'view_prospects',
    priority: 'high',
  },
];

const MOCK_SEQUENCE: Sequence = {
  id: '1',
  name: 'Series B SaaS Outreach',
  status: 'active',
  touches: [
    {
      id: 't1',
      day: 1,
      type: 'email',
      order: 1,
      variantA: {
        subject: 'Congrats on the Series B, {{company}}',
        body: 'Hi {{firstName}},...',
        personalizedFields: ['firstName', 'company'],
      },
      variantB: {
        subject: 'Quick question about {{company}} growth',
        body: 'Hi {{firstName}},...',
        personalizedFields: ['firstName', 'company'],
      },
      autoSend: true,
      condition: 'always',
    },
  ],
  variants: [
    { id: 'a', name: 'A', split: 50, isWinning: true, metrics: { sent: 45, opened: 38, clicked: 12, replied: 8, booked: 3, openRate: 84, replyRate: 18 } },
    { id: 'b', name: 'B', split: 50, isWinning: false, metrics: { sent: 45, opened: 32, clicked: 8, replied: 4, booked: 1, openRate: 71, replyRate: 11 } },
  ],
  prospects: ['1', '2'],
  metrics: { sent: 90, opened: 70, clicked: 20, replied: 12, booked: 4, unsubscribed: 2, openRate: 78, replyRate: 15, bookRate: 4 },
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Quick action cards
const quickActions = [
  { icon: Search, label: 'Find Prospects', description: 'Search by company, role, or signal', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { icon: Users, label: 'Browse Leads', description: 'View your qualified prospects', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { icon: TrendingUp, label: 'Monitor Campaigns', description: 'Track performance metrics', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  { icon: Target, label: 'Optimize Sequences', description: 'A/B test and improve', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
];

export default function OutreachPage() {
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>(MOCK_PROSPECTS);
  const [suggestions] = useState<SuggestionType[]>(MOCK_SUGGESTIONS);
  const [threadItems, setThreadItems] = useState<ThreadItem[]>([]);
  const [isThreadOpen, setIsThreadOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const addToThread = useCallback((item: Omit<ThreadItem, 'id' | 'timestamp'>) => {
    const newItem: ThreadItem = {
      ...item,
      id: `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    setThreadItems(prev => [...prev, newItem]);
  }, []);

  const handleCommand = useCallback(async (intent: CommandIntent) => {
    setIsProcessing(true);
    addToThread({ type: 'command', content: intent.rawInput, data: { intent } });
    
    // Simulate research job
    await new Promise(r => setTimeout(r, 1500));
    
    addToThread({ type: 'result', content: `Found results for: ${intent.rawInput}`, data: {} });
    setIsProcessing(false);
  }, [addToThread]);

  const handleSuggestionAction = useCallback((suggestion: SuggestionType) => {
    addToThread({ type: 'action', content: `Accepted: ${suggestion.title}`, data: { suggestion } });
  }, [addToThread]);

  const handleStartOutreach = useCallback((prospect: Prospect) => {
    addToThread({ type: 'action', content: `Started outreach to ${prospect.name}`, data: { prospect } });
  }, [addToThread]);

  const handleViewSignals = useCallback(() => {}, []);

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-6 pt-6"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-bold text-slate-100">Research</h1>
          </div>
          <p className="text-slate-400">
            Find prospects, analyze signals, and research your target market.
          </p>
        </div>
      </motion.div>

      {/* Quick Actions Grid */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="px-6 mt-6"
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, i) => (
              <motion.button
                key={action.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className={`p-4 rounded-xl border-2 ${action.color} hover:scale-[1.02] transition-all text-left group`}
              >
                <action.icon className="w-6 h-6 mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="font-semibold text-sm mb-1">{action.label}</h3>
                <p className="text-xs opacity-80">{action.description}</p>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Command Interface */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="px-6 mt-6"
      >
        <div className="max-w-3xl mx-auto">
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-5 h-5 text-amber-400" />
              <span className="font-medium text-slate-200">Command Center</span>
            </div>
            <CommandBar onCommand={handleCommand} isProcessing={isProcessing} />
          </div>
        </div>
      </motion.div>

      {/* Active Research */}
      <AnimatePresence>
        {jobs.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-6 mt-6"
          >
            <div className="max-w-7xl mx-auto">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                Active Research
              </h2>
              <ResearchCards
                jobs={jobs}
                onJobClick={(job) => console.log('Clicked job', job.id)}
                onDismissJob={(jobId) => setJobs(prev => prev.filter(j => j.id !== jobId))}
              />
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Recent Prospects */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="px-6 mt-6 pb-12"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              Recent Prospects
            </h2>
            <button className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
              View All →
            </button>
          </div>
          
          <ProspectStream
            prospects={prospects}
            onStartOutreach={handleStartOutreach}
            onViewSignals={handleViewSignals}
          />
        </div>
      </motion.section>

      {/* Thread Panel */}
      <ThreadPanel
        items={threadItems}
        isOpen={isThreadOpen}
        onToggle={() => setIsThreadOpen(!isThreadOpen)}
        onBranch={() => {}}
        onModify={() => {}}
        onReference={() => {}}
      />
    </div>
  );
}
