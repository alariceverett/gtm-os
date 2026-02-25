'use client';

/**
 * Prospects Page
 * Swipeable/prospects view for browsing qualified leads
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Filter, 
  Search, 
  Download,
  MoreHorizontal,
  Star,
  Mail,
  Linkedin,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import type { Prospect } from '@/types';

const filters = [
  { label: 'All', count: 247 },
  { label: 'A+', count: 42 },
  { label: 'A', count: 89 },
  { label: 'B+', count: 76 },
  { label: 'New', count: 24 },
];

const mockProspects: Prospect[] = [
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
  {
    id: '4',
    firstName: 'David',
    lastName: 'Kim',
    name: 'David Kim',
    title: 'VP Growth',
    company: 'StartupX',
    industry: 'Technology',
    companySize: '20-50',
    location: 'Seattle, WA',
    score: 91,
    scoreGrade: 'A+',
    confidence: 94,
    signals: [
      { type: 'hiring', label: 'Growth Team', description: 'Hiring 5 new sales reps', timestamp: new Date(), source: 'Apollo', strength: 'high' },
    ],
    enrichedAt: new Date(),
  },
  {
    id: '5',
    firstName: 'Lisa',
    lastName: 'Thompson',
    name: 'Lisa Thompson',
    title: 'CMO',
    company: 'CloudScale',
    industry: 'SaaS',
    companySize: '500+',
    location: 'Austin, TX',
    score: 86,
    scoreGrade: 'A',
    confidence: 90,
    signals: [],
    enrichedAt: new Date(),
  },
];

export default function ProspectsPage() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedProspects, setSelectedProspects] = useState<Set<string>>(new Set());

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedProspects);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedProspects(newSet);
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'A': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'B+': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

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
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-100">Prospects</h1>
                  <p className="text-slate-400">Browse and manage qualified leads</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {selectedProspects.size > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 transition-colors flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Message {selectedProspects.size}
                </motion.button>
              )}
              <button className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                <Download className="w-5 h-5" />
              </button>
              <button className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                <Filter className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search prospects..."
                className="pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 w-64"
              />
            </div>

            <div className="h-6 w-px bg-slate-700 mx-2" />

            {filters.map((filter) => (
              <button
                key={filter.label}
                onClick={() => setActiveFilter(filter.label)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  activeFilter === filter.label
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {filter.label} <span className="text-slate-500 ml-1">({filter.count})</span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Prospects Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="px-6 mt-6 pb-12"
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockProspects.map((prospect, i) => (
              <motion.div
                key={prospect.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => toggleSelection(prospect.id)}
                className={`
                  group relative p-5 rounded-2xl border-2 transition-all cursor-pointer
                  ${selectedProspects.has(prospect.id)
                    ? 'bg-indigo-500/10 border-indigo-500/50'
                    : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                  }
                `}
              >
                {/* Selection Checkbox */}
                <div className={`
                  absolute top-4 right-4 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                  ${selectedProspects.has(prospect.id)
                    ? 'bg-indigo-500 border-indigo-500'
                    : 'border-slate-600 group-hover:border-slate-500'
                  }
                `}>
                  {selectedProspects.has(prospect.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                </div>

                {/* Header */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center shrink-0">
                    <span className="text-lg font-bold text-slate-300">
                      {prospect.firstName[0]}{prospect.lastName[0]}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-100 truncate group-hover:text-indigo-400 transition-colors">
                      {prospect.name}
                    </h3>
                    <p className="text-sm text-slate-400 truncate">{prospect.title}</p>
                    <p className="text-sm text-slate-500 truncate">{prospect.company}</p>
                  </div>
                </div>

                {/* Score Badge */}
                <div className="flex items-center justify-between mt-4">
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${getGradeColor(prospect.scoreGrade || 'B')}`}>
                    {prospect.scoreGrade} • {prospect.score}
                  </span>
                  <span className="text-xs text-slate-500">
                    {prospect.confidence}% confidence
                  </span>
                </div>

                {/* Signals */}
                {prospect.signals && prospect.signals.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {prospect.signals.map((signal, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <span className={`
                          w-2 h-2 rounded-full
                          ${signal.strength === 'high' ? 'bg-emerald-400' : 'bg-amber-400'}
                        `} />
                        <span className="font-medium text-slate-300">{signal.label}:</span>
                        <span className="text-slate-500">{signal.description}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-800">
                  <button className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                    <Mail className="w-4 h-4" /> Email
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                    <Linkedin className="w-4 h-4" /> LinkedIn
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                    <MoreHorizontal className="w-4 h-4" /> More
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Load More */}
          <div className="flex justify-center mt-8">
            <button className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors flex items-center gap-2">
              Load More Prospects
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
