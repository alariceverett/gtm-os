'use client';

/**
 * Campaigns Page
 * Campaigns list and management dashboard
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Megaphone,
  Plus,
  Play,
  Pause,
  RotateCcw,
  MoreVertical,
  Users,
  MailOpen,
  MousePointer,
  Reply,
  Calendar,
  TrendingUp,
  ArrowRight,
  Target,
} from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'completed' | 'draft';
  sequenceName: string;
  prospectsTotal: number;
  prospectsContacted: number;
  metrics: {
    openRate: number;
    replyRate: number;
    clickRate: number;
    bookRate: number;
  };
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  booked: number;
  createdAt: Date;
  lastActive: Date;
}

const campaigns: Campaign[] = [
  {
    id: '1',
    name: 'Series B SaaS Outreach',
    status: 'active',
    sequenceName: '5-Touch SaaS Sequence',
    prospectsTotal: 150,
    prospectsContacted: 89,
    metrics: { openRate: 78, replyRate: 15, clickRate: 22, bookRate: 4 },
    sent: 89,
    opened: 70,
    clicked: 20,
    replied: 12,
    booked: 4,
    createdAt: new Date('2025-02-01'),
    lastActive: new Date(),
  },
  {
    id: '2',
    name: 'Fintech CMO Targeting',
    status: 'active',
    sequenceName: 'CMO Value Prop Sequence',
    prospectsTotal: 75,
    prospectsContacted: 45,
    metrics: { openRate: 82, replyRate: 18, clickRate: 25, bookRate: 5 },
    sent: 45,
    opened: 37,
    clicked: 11,
    replied: 8,
    booked: 2,
    createdAt: new Date('2025-02-10'),
    lastActive: new Date(),
  },
  {
    id: '3',
    name: 'Enterprise CTOs',
    status: 'paused',
    sequenceName: 'Enterprise Technical Pitch',
    prospectsTotal: 200,
    prospectsContacted: 60,
    metrics: { openRate: 65, replyRate: 8, clickRate: 15, bookRate: 2 },
    sent: 60,
    opened: 39,
    clicked: 9,
    replied: 5,
    booked: 1,
    createdAt: new Date('2025-01-15'),
    lastActive: new Date('2025-02-20'),
  },
  {
    id: '4',
    name: 'SMB Decision Makers',
    status: 'completed',
    sequenceName: 'Quick Win Sequence',
    prospectsTotal: 300,
    prospectsContacted: 300,
    metrics: { openRate: 71, replyRate: 12, clickRate: 18, bookRate: 3 },
    sent: 300,
    opened: 213,
    clicked: 54,
    replied: 36,
    booked: 9,
    createdAt: new Date('2025-01-01'),
    lastActive: new Date('2025-02-15'),
  },
];

const getStatusColor = (status: Campaign['status']) => {
  switch (status) {
    case 'active': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'paused': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'completed': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    case 'draft': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
  }
};

const getStatusIcon = (status: Campaign['status']) => {
  switch (status) {
    case 'active': return Play;
    case 'paused': return Pause;
    case 'completed': return TrendingUp;
    case 'draft': return Target;
  }
};

export default function CampaignsPage() {
  const [hoveredCampaign, setHoveredCampaign] = useState<string | null>(null);

  const totalProspects = campaigns.reduce((acc, c) => acc + c.prospectsTotal, 0);
  const totalBooked = campaigns.reduce((acc, c) => acc + c.booked, 0);
  const avgReplyRate = Math.round(
    campaigns.reduce((acc, c) => acc + c.metrics.replyRate, 0) / campaigns.length
  );

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
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Megaphone className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-100">Campaigns</h1>
                <p className="text-slate-400">Manage your outreach campaigns and sequences</p>
              </div>
            </div>

            <button className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Campaign
            </button>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            {[
              { label: 'Active Prospects', value: totalProspects.toLocaleString(), icon: Users, color: 'text-blue-400' },
              { label: 'Meetings Booked', value: totalBooked.toString(), icon: Calendar, color: 'text-emerald-400' },
              { label: 'Avg Reply Rate', value: `${avgReplyRate}%`, icon: TrendingUp, color: 'text-amber-400' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 rounded-xl bg-slate-900/50 border border-slate-800"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">{stat.label}</span>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div className="text-2xl font-bold text-slate-100 mt-1">{stat.value}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Campaigns List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="px-6 mt-6 pb-12"
      >
        <div className="max-w-7xl mx-auto">
          <div className="space-y-4">
            {campaigns.map((campaign, i) => {
              const StatusIcon = getStatusIcon(campaign.status);
              const isHovered = hoveredCampaign === campaign.id;

              return (
                <motion.div
                  key={campaign.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  onMouseEnter={() => setHoveredCampaign(campaign.id)}
                  onMouseLeave={() => setHoveredCampaign(null)}
                  className="group p-5 rounded-2xl bg-slate-900/50 border-2 border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl border-2 ${getStatusColor(campaign.status)}`}>
                        <StatusIcon className="w-5 h-5" />
                      </div>
                      
                      <div>
                        <h3 className="font-semibold text-slate-100 text-lg group-hover:text-indigo-400 transition-colors">
                          {campaign.name}
                        </h3>
                        <p className="text-sm text-slate-400">{campaign.sequenceName}</p>
                        
                        <div className="flex items-center gap-4 mt-2">
                          <span className={`
                            px-2 py-0.5 rounded-full text-xs font-medium border
                            ${getStatusColor(campaign.status)}
                          `}>
                            {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                          </span>
                          <span className="text-xs text-slate-500">
                            {campaign.prospectsContacted}/{campaign.prospectsTotal} contacted
                          </span>
                          <span className="text-xs text-slate-600">
                            Last active {campaign.lastActive.toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-800">
                    <div>
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <MailOpen className="w-4 h-4" />
                        <span className="text-xs">Open Rate</span>
                      </div>
                      <div className="text-lg font-semibold text-slate-100">
                        {campaign.metrics.openRate}%
                      </div>
                      <div className="text-xs text-slate-500">{campaign.opened} opened</div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Reply className="w-4 h-4" />
                        <span className="text-xs">Reply Rate</span>
                      </div>
                      <div className="text-lg font-semibold text-slate-100">
                        {campaign.metrics.replyRate}%
                      </div>
                      <div className="text-xs text-slate-500">{campaign.replied} replied</div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <MousePointer className="w-4 h-4" />
                        <span className="text-xs">Click Rate</span>
                      </div>
                      <div className="text-lg font-semibold text-slate-100">
                        {campaign.metrics.clickRate}%
                      </div>
                      <div className="text-xs text-slate-500">{campaign.clicked} clicked</div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs">Book Rate</span>
                      </div>
                      <div className="text-lg font-semibold text-emerald-400">
                        {campaign.metrics.bookRate}%
                      </div>
                      <div className="text-xs text-emerald-500/70">{campaign.booked} meetings</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                      <span>Campaign Progress</span>
                      <span>{Math.round((campaign.prospectsContacted / campaign.prospectsTotal) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(campaign.prospectsContacted / campaign.prospectsTotal) * 100}%` }}
                        transition={{ duration: 0.5, delay: 0.2 + i * 0.05 }}
                        className={`h-full rounded-full ${
                          campaign.status === 'active' ? 'bg-gradient-to-r from-indigo-500 to-purple-500' :
                          campaign.status === 'paused' ? 'bg-amber-500' :
                          campaign.status === 'completed' ? 'bg-emerald-500' :
                          'bg-purple-500'
                        }`}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Empty State (show if no campaigns) */}
          {campaigns.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800 flex items-center justify-center">
                <Megaphone className="w-8 h-8 text-slate-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-300">No campaigns yet</h3>
              <p className="text-slate-500 mt-2">Create your first campaign to start reaching prospects</p>
              <button className="mt-6 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Create Campaign
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
