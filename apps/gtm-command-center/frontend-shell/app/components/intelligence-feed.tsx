'use client';

import { useIntelligence } from '@/app/hooks/use-intelligence';
import { SkeletonIntelligenceItem, SkeletonHealthScore, SkeletonText } from '@/app/components/skeleton-loader';
import { SectionErrorFallback } from '@/app/components/error-boundary';
import { formatLastUpdated } from '@/app/hooks/use-data-fetch';
import { cn } from '@/lib/utils';
import { RefreshCw, AlertTriangle, Clock, Users, Activity, MessageSquare, ArrowRight, ChevronRight } from 'lucide-react';
import { useState, useMemo } from 'react';

type IntelligenceTab = 'activity' | 'accounts' | 'actions';

interface IntelligenceFeedProps {
  limit?: number;
}

export function IntelligenceFeed({ limit = 5 }: IntelligenceFeedProps) {
  const [activeTab, setActiveTab] = useState<IntelligenceTab>('activity');
  
  const { 
    intelligence,
    isLoading, 
    isError, 
    error, 
    isStale, 
    lastUpdated, 
    refetch 
  } = useIntelligence(30000);

  const healthScore = intelligence.healthScore;
  const accounts = useMemo(() => 
    intelligence.qualifiedAccounts?.slice(0, limit) || [],
    [intelligence.qualifiedAccounts, limit]
  );
  const activities = useMemo(() => 
    intelligence.recentActivity?.slice(0, limit) || [],
    [intelligence.recentActivity, limit]
  );
  const actions = useMemo(() => 
    intelligence.pendingActions?.slice(0, limit) || [],
    [intelligence.pendingActions, limit]
  );

  const hasData = (intelligence.recentActivity?.length ?? 0) > 0 
    || (intelligence.qualifiedAccounts?.length ?? 0) > 0;

  return (
    <section className="relative">
      {/* Header with tabs and refresh */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-500" />
            Intelligence
          </h2>
          
          <div className="flex items-center gap-2">
            {isStale && (
              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
            )}
            
            <button
              onClick={refetch}
              disabled={isLoading}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                "hover:bg-slate-100 dark:hover:bg-slate-800",
                isLoading && "animate-spin"
              )}
              aria-label="Refresh intelligence"
            >
              <RefreshCw className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
          </div>
        </div>

        {/* Health Score Summary */}
        {!isLoading && healthScore && (
          <div className={cn(
            "p-4 rounded-lg border flex items-center gap-4",
            healthScore.label === 'healthy' && "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900",
            healthScore.label === 'at-risk' && "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900",
            healthScore.label === 'needs-attention' && "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900"
          )}>
            <div className="flex-1">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Relationship Health
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold">{healthScore.overall}</span>
                <span className="text-sm text-slate-500">/100</span>
              </div>
            </div>
            <div className="text-right">
              <span className={cn(
                "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                healthScore.label === 'healthy' && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
                healthScore.label === 'at-risk' 
                && "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
                healthScore.label === 'needs-attention' && "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
              )}>
                {healthScore.label === 'healthy' ? 'Healthy' : 
                 healthScore.label === 'at-risk' ? 'At Risk' : 'Needs Attention'}
              </span>
            </div>
          </div>
        )}

        {isLoading && <SkeletonHealthScore />}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
          <Tab
            label="Activity"
            count={activities.length}
            isActive={activeTab === 'activity'}
            onClick={() => setActiveTab('activity')}
          />
          <Tab
            label="Accounts"
            count={accounts.length}
            isActive={activeTab === 'accounts'}
            onClick={() => setActiveTab('accounts')}
          />
          <Tab
            label="Actions"
            count={actions.length}
            isActive={activeTab === 'actions'}
            onClick={() => setActiveTab('actions')}
          />
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="mb-4">
          <SectionErrorFallback
            title="Failed to load intelligence"
            message={error?.message || 'Unable to fetch relationship data'}
            onRetry={refetch}
          />
        </div>
      )}

      {/* Content based on active tab */}
      <div className="space-y-2">
        {isLoading ? (
          // Loading skeletons
          <>
            <SkeletonIntelligenceItem />
            <SkeletonIntelligenceItem />
            <SkeletonIntelligenceItem />
          </>
        ) : activeTab === 'activity' ? (
          activities.length === 0 ? (
            <EmptyState icon={Activity} message="No recent activity" />
          ) : (
            activities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))
          )
        ) : activeTab === 'accounts' ? (
          accounts.length === 0 ? (
            <EmptyState icon={Users} message="No qualified accounts" />
          ) : (
            accounts.map((account) => (
              <AccountItem key={account.id} account={account} />
            ))
          )
        ) : (
          actions.length === 0 ? (
            <EmptyState icon={MessageSquare} message="No pending actions" />
          ) : (
            actions.map((action) => (
              <ActionItem key={action.id} action={action} />
            ))
          )
        )}
      </div>

      {/* Footer with last updated */}
      {lastUpdated && !isLoading && (
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Updated {formatLastUpdated(lastUpdated)}</span>
            {isStale && (
              <span className="text-amber-600 dark:text-amber-400"> (stale)</span>
            )}
          </div>
          <div className="text-slate-400 hover:text-slate-600">
            <button className="flex items-center gap-1 transition-colors">
              View all
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

interface TabProps {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}

function Tab({ label, count, isActive, onClick }: TabProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
        isActive 
          ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" 
          : "border-transparent text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      )}
    >
      {label}
      <span className={cn(
        "ml-1.5 px-1.5 py-0.5 text-xs rounded-full",
        isActive 
          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
      )}>
        {count}
      </span>
    </button>
  );
}

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
}

function EmptyState({ icon: Icon, message }: EmptyStateProps) {
  return (
    <div className="p-8 text-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
      <Icon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
      <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
}

interface ActivityItemProps {
  activity: {
    id: string;
    type: string;
    title: string;
    timestamp: string;
    account?: string;
  };
}

function ActivityItem({ activity }: ActivityItemProps) {
  const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    meeting: Activity,
    email: MessageSquare,
    task: Activity,
    note: MessageSquare,
  };
  
  const Icon = typeIcons[activity.type] || Activity;
  
  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="group flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors cursor-pointer">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
        <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{activity.title}</p>
        
        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
          {activity.account && (
            <span className="font-medium text-slate-600 dark:text-slate-400">
              {activity.account}
            </span>
          )}
          <span>•</span>
          <span>{timeAgo(activity.timestamp)}</span>
        </div>
      </div>
      
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowRight className="w-4 h-4 text-slate-400" />
      </div>
    </div>
  );
}

interface AccountItemProps {
  account: {
    id: string;
    name: string;
    stage: string;
    health: number;
    lastContact: string;
  };
}

function AccountItem({ account }: AccountItemProps) {
  const stageColors: Record<string, string> = {
    discovery: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    qualified: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    pilot: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    customer: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  };

  const getHealthColor = (health: number) => {
    if (health >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (health >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const stage = account.stage?.toLowerCase() || 'qualified';
  const stageClass = stageColors[stage] || stageColors.qualified;

  return (
    <div className="group flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors cursor-pointer">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <Users className="w-4 h-4 text-slate-600 dark:text-slate-400" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{account.name}</p>
          <span className={cn("px-1.5 py-0.5 text-xs rounded-full", stageClass)}>
            {stage}
          </span>
        </div>
        
        <div className="flex items-center gap-3 mt-1 text-xs">
          <span className={cn("font-medium", getHealthColor(account.health))}>
            Health: {account.health}%
          </span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-500">
            Last contact: {new Date(account.lastContact).toLocaleDateString()}
          </span>
        </div>
      </div>
      
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowRight className="w-4 h-4 text-slate-400" />
      </div>
    </div>
  );
}

interface ActionItemProps {
  action: {
    id: string;
    type: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    dueDate?: string;
  };
}

function ActionItem({ action }: ActionItemProps) {
  const priorityColors: Record<string, string> = {
    high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-900',
    medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-900',
    low: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700',
  };

  return (
    <div className={cn(
      "group flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
      priorityColors[action.priority]
    )}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{action.description}</p>
        
        <div className="flex items-center gap-2 mt-1 text-xs opacity-80">
          <span className="capitalize">{action.type.replace('-', ' ')}</span>
          <span>•</span>
          <span className="capitalize">{action.priority} priority</span>
          {action.dueDate && (
            <>
              <span>•</span>
              <span>Due {new Date(action.dueDate).toLocaleDateString()}</span>
            </>
          )}
        </div>
      </div>
      
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowRight className="w-4 h-4 opacity-60" />
      </div>
    </div>
  );
}
