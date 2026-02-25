'use client';

/**
 * GTM Command Center - Agentic Outreach Interface
 * Natural language first, MCP-powered prospecting
 * NO FORMS - only conversational commands and visual cards
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CommandBar,
  ResearchCards,
  ProspectStream,
  Suggestions,
  SequenceVisualizer,
  ThreadPanel,
} from '@/components';
import { 
  CommandIntent, 
  Prospect, 
  ResearchJob, 
  Suggestion as SuggestionType,
  ThreadItem,
  Sequence,
} from '@/types';
import { createApolloClientFromEnv } from '@/lib/apollo/client';
import { ApolloMCPClient } from '@/lib/mcp/apollo';

// Lazy initialize API clients (browser only)
let apolloClient: ReturnType<typeof createApolloClientFromEnv> | null = null;
let mcpClient: ApolloMCPClient | null = null;

function getClients() {
  if (typeof window === 'undefined') return null;
  if (!apolloClient) {
    try {
      apolloClient = createApolloClientFromEnv();
      mcpClient = new ApolloMCPClient(apolloClient, {
        serverUrl: process.env.NEXT_PUBLIC_MCP_SERVER_URL || 'http://localhost:3001/mcp',
        apiKey: process.env.NEXT_PUBLIC_MCP_API_KEY || 'local',
      });
    } catch {
      // Client not available (missing env vars)
      return null;
    }
  }
  return { apolloClient, mcpClient };
}

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
  {
    id: '3',
    firstName: 'Emily',
    lastName: 'Watson',
    name: 'Emily Watson',
    title: 'Head of Sales',
    company: 'GrowthTech',
    industry: 'Enterprise Software',
    companySize: '100-200',
    location: 'Boston, MA',
    score: 82,
    scoreGrade: 'B+',
    confidence: 88,
    signals: [
      { type: 'tech_stack', label: 'Modern Stack', description: 'Using your target technologies', timestamp: new Date(), source: 'Apollo', strength: 'medium' },
    ],
    enrichedAt: new Date(),
  },
];

const MOCK_SUGGESTIONS: SuggestionType[] = [
  {
    id: '1',
    type: 'campaign',
    title: 'Create campaign for these 3 A+ prospects',
    description: 'You found 3 prospects with A+ scores. Launch a targeted outreach sequence?',
    context: '3 A+ prospects in NYC fintech',
    actionLabel: 'Create Campaign',
    actionType: 'create_campaign',
    priority: 'high',
  },
  {
    id: '2',
    type: 'optimization',
    title: 'Your reply rates dropped — try varying subject lines',
    description: 'Last week: 18% reply rate. This week: 11%. Test subject line variants?',
    context: 'Based on campaign performance',
    actionLabel: 'A/B Test Subjects',
    actionType: 'ab_test',
    priority: 'medium',
  },
  {
    id: '3',
    type: 'prospect',
    title: 'Sarah Chen opened your email 3 times',
    description: 'High engagement detected. Perfect time to follow up with a personalized note.',
    context: 'VP Marketing @ FintechFlow',
    actionLabel: 'Send Follow-up',
    actionType: 'follow_up',
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
        body: 'Hi {{firstName}},\n\nSaw the news about {{company}} Series B. We help companies like yours scale faster...',
        personalizedFields: ['firstName', 'company', 'fundingAmount'],
      },
      variantB: {
        subject: 'Quick question about {{company}} growth',
        body: 'Hi {{firstName}},\n\nNoticed {{company}} just raised funding. Curious about how you are handling scale challenges...',
        personalizedFields: ['firstName', 'company'],
      },
      autoSend: true,
      condition: 'always',
    },
    {
      id: 't2',
      day: 4,
      type: 'linkedin',
      order: 2,
      autoSend: false,
      condition: 'not_opened',
    },
    {
      id: 't3',
      day: 7,
      type: 'email',
      order: 3,
      variantA: {
        subject: 'Following up: {{company}} growth',
        body: 'Hi {{firstName}},\n\nWanted to make sure you saw my previous message...',
        personalizedFields: ['firstName', 'company'],
      },
      autoSend: false,
      condition: 'opened',
    },
  ],
  variants: [
    { id: 'a', name: 'A', split: 50, isWinning: true, metrics: { sent: 45, opened: 38, clicked: 12, replied: 8, booked: 3, openRate: 84, replyRate: 18 } },
    { id: 'b', name: 'B', split: 50, isWinning: false, metrics: { sent: 45, opened: 32, clicked: 8, replied: 4, booked: 1, openRate: 71, replyRate: 11 } },
  ],
  prospects: ['1', '2', '3', '4', '5'],
  metrics: { sent: 90, opened: 70, clicked: 20, replied: 12, booked: 4, unsubscribed: 2, openRate: 78, replyRate: 15, bookRate: 4 },
  createdAt: new Date(),
  updatedAt: new Date(),
};

export default function HomePage() {
  // State
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>(MOCK_PROSPECTS);
  const [suggestions] = useState<SuggestionType[]>(MOCK_SUGGESTIONS);
  const [threadItems, setThreadItems] = useState<ThreadItem[]>([]);
  const [isThreadOpen, setIsThreadOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Add to thread
  const addToThread = useCallback((item: Omit<ThreadItem, 'id' | 'timestamp'>) => {
    const newItem: ThreadItem = {
      ...item,
      id: `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    setThreadItems(prev => [...prev, newItem]);
  }, []);

  // Handle command from CommandBar
  const handleCommand = useCallback(async (intent: CommandIntent) => {
    setIsProcessing(true);

    // Add command to thread
    addToThread({
      type: 'command',
      content: intent.rawInput,
      data: { intent },
    });

    // Create new research job
    const newJob: ResearchJob = {
      id: `job-${Date.now()}`,
      status: 'pending',
      query: intent.rawInput,
      intent,
      progress: { found: 0, enriched: 0, scored: 0 },
      results: [],
      startedAt: new Date(),
      updatedAt: new Date(),
    };
    setJobs(prev => [newJob, ...prev]);

    // Simulate job progress
    try {
      // Phase 1: Searching
      setJobs(prev => prev.map(j => 
        j.id === newJob.id ? { ...j, status: 'running' } : j
      ));
      await new Promise(r => setTimeout(r, 800));
      
      const found = Math.floor(Math.random() * 30) + 20;
      setJobs(prev => prev.map(j => 
        j.id === newJob.id 
          ? { ...j, status: 'enriching', progress: { ...j.progress, found } } 
          : j
      ));

      // Phase 2: Enriching
      await new Promise(r => setTimeout(r, 1200));
      const enriched = Math.floor(found * 0.7);
      setJobs(prev => prev.map(j => 
        j.id === newJob.id 
          ? { ...j, status: 'scoring', progress: { ...j.progress, enriched } } 
          : j
      ));

      // Phase 3: Scoring (simulate results)
      await new Promise(r => setTimeout(r, 1000));
      const scored = Math.floor(enriched * 0.9);
      
      // Generate mock results
      const results: Prospect[] = Array.from({ length: Math.min(scored, 5) }, (_, i) => ({
        id: `prospect-${Date.now()}-${i}`,
        firstName: ['Alex', 'Jordan', 'Taylor', 'Casey', 'Morgan'][i],
        lastName: ['Smith', 'Johnson', 'Williams', 'Brown', 'Davis'][i],
        name: ['Alex Smith', 'Jordan Johnson', 'Taylor Williams', 'Casey Brown', 'Morgan Davis'][i],
        title: ['VP Sales', 'CMO', 'Head of Growth', 'Director of Marketing', 'VP Revenue'][i],
        company: ['TechCorp', 'GrowthInc', 'ScaleUp', 'CloudFirst', 'DataFlow'][i],
        industry: intent.icp?.industries?.[0] || 'Technology',
        location: intent.icp?.locations?.[0] || 'San Francisco, CA',
        score: Math.floor(Math.random() * 20) + 75,
        scoreGrade: (Math.random() > 0.5 ? 'A' : 'B+') as Prospect['scoreGrade'],
        confidence: Math.floor(Math.random() * 10) + 85,
        signals: [
          { 
            type: 'funding', 
            label: 'Series B', 
            description: 'Recently funded', 
            timestamp: new Date(), 
            source: 'Apollo', 
            strength: 'high' 
          },
        ],
        enrichedAt: new Date(),
      }));

      setJobs(prev => prev.map(j => 
        j.id === newJob.id 
          ? { 
              ...j, 
              status: 'completed', 
              progress: { ...j.progress, scored },
              results,
              completedAt: new Date(),
            } 
          : j
      ));

      setProspects(prev => [...results, ...prev]);

      // Add result to thread
      addToThread({
        type: 'result',
        content: `Found ${scored} prospects matching "${intent.rawInput}"`,
        data: { job: { ...newJob, status: 'completed', results } },
      });

    } catch (error) {
      setJobs(prev => prev.map(j => 
        j.id === newJob.id 
          ? { ...j, status: 'error', error: String(error) } 
          : j
      ));

      addToThread({
        type: 'system',
        content: `Error: ${error}`,
      });
    }

    setIsProcessing(false);
  }, [addToThread]);

  // Handle suggestions
  const handleSuggestionAction = useCallback((suggestion: SuggestionType) => {
    addToThread({
      type: 'action',
      content: `Accepted suggestion: ${suggestion.title}`,
      data: { suggestion },
    });
  }, [addToThread]);

  // Handle prospect actions
  const handleStartOutreach = useCallback((prospect: Prospect) => {
    addToThread({
      type: 'action',
      content: `Started outreach to ${prospect.name} at ${prospect.company}`,
      data: { prospect },
    });
  }, [addToThread]);

  const handleViewSignals = useCallback((prospect: Prospect) => {
    console.log('View signals for', prospect.name);
  }, []);

  // Handle thread actions
  const handleBranchThread = useCallback((itemId: string) => {
    addToThread({
      type: 'system',
      content: `Branched from ${itemId}`,
      parentId: itemId,
    });
  }, [addToThread]);

  const handleModifyThread = useCallback((itemId: string, modifiedIntent: CommandIntent) => {
    addToThread({
      type: 'command',
      content: `Modified: ${modifiedIntent.rawInput}`,
      isModified: true,
      modifiedFrom: itemId,
    });
    
    handleCommand(modifiedIntent);
  }, [addToThread, handleCommand]);

  const handleReferenceThread = useCallback((itemId: string) => {
    addToThread({
      type: 'command',
      content: `Reference @${itemId} — add these to campaign`,
    });
  }, [addToThread]);

  return (
    <div className="min-h-screen bg-slate-950">
      <CommandBar 
        onCommand={handleCommand}
        isProcessing={isProcessing}
      />

      <ThreadPanel
        items={threadItems}
        isOpen={isThreadOpen}
        onToggle={() => setIsThreadOpen(!isThreadOpen)}
        onBranch={handleBranchThread}
        onModify={handleModifyThread}
        onReference={handleReferenceThread}
      />

      <main className="pt-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto pb-12">
          {threadItems.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <div className="text-6xl mb-6">🎯</div>
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-100 mb-4">
                Agentic GTM Command Center
              </h1>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-8">
                Find prospects, launch campaigns, and track performance. All with natural language.
                No forms. Just talk to your GTM assistant.
              </p>
              
              <div className="flex flex-wrap justify-center gap-3 text-sm text-slate-500">
                <span className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800">
                  🔍 Find CMOs at fintechs Series B+
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800">
                  📧 Create 3-touch sequence
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800">
                  📊 Analyze my campaigns
                </span>
              </div>
            </motion.div>
          )}

          {jobs.length > 0 && (
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-8"
            >
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                Active Research
              </h2>
              <ResearchCards
                jobs={jobs}
                onJobClick={(job) => console.log('Clicked job', job.id)}
                onDismissJob={(jobId) => setJobs(prev => prev.filter(j => j.id !== jobId))}
              />
            </motion.section>
          )}

          {suggestions.length > 0 && prospects.length > 0 && (
            <section className="mb-8">
              <Suggestions
                suggestions={suggestions}
                onAction={handleSuggestionAction}
              />
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              {prospects.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                      Prospects ({prospects.length})
                    </h2>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">
                        A+ ({prospects.filter(p => p.scoreGrade === 'A+').length}) • 
                        A ({prospects.filter(p => p.scoreGrade === 'A').length})
                      </span>
                    </div>
                  </div>
                  
                  <ProspectStream
                    prospects={prospects}
                    onStartOutreach={handleStartOutreach}
                    onViewSignals={handleViewSignals}
                  />
                </>
              )}
            </div>

            <div className="space-y-8">
              <div>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                  Active Sequence
                </h2>
                <SequenceVisualizer
                  sequence={MOCK_SEQUENCE}
                />
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50"
              >
                <h3 className="text-sm font-medium text-slate-300 mb-4">Today&apos;s Activity</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-slate-800/50">
                    <div className="text-2xl font-bold text-emerald-400">{prospects.length}</div>
                    <div className="text-xs text-slate-500">Prospects Found</div>
                  </div>
                  
                  <div className="p-3 rounded-xl bg-slate-800/50">
                    <div className="text-2xl font-bold text-indigo-400">{threadItems.filter(t => t.type === 'action').length}</div>
                    <div className="text-xs text-slate-500">Actions Taken</div>
                  </div>
                  
                  <div className="p-3 rounded-xl bg-slate-800/50">
                    <div className="text-2xl font-bold text-amber-400">{MOCK_SEQUENCE.metrics.openRate}%</div>
                    <div className="text-xs text-slate-500">Open Rate</div>
                  </div>
                  
                  <div className="p-3 rounded-xl bg-slate-800/50">
                    <div className="text-2xl font-bold text-blue-400">{MOCK_SEQUENCE.metrics.replyRate}%</div>
                    <div className="text-xs text-slate-500">Reply Rate</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
