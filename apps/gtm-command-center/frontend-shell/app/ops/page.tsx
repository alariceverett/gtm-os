'use client';

import { useState } from 'react';
import { useIntelligenceStream } from '@/app/hooks/use-intelligence-bridge';
import { 
  useAutonomyMetrics, 
  useAutonomousTasks, 
  useSelfHealingEvents,
  getOverrideRateColor,
  getHealingStatusColor,
  getTaskTypeIcon,
  formatHealingStrategy,
  formatDuration,
  formatAutonomyTime,
} from '@/app/hooks/use-autonomy';
import { PageCard } from '@/components/page-card';
import type { Recommendation } from '@/lib/intelligence/recommendation-engine';
import type { AutonomousTask, HealingEvent } from '@/lib/autonomy/types';

// Mock KPI data for demo/development
const MOCK_KPI_DATA: Array<{ key: string; label: string; value: number | string }> = [
  { key: 'delegations_24h', label: 'Delegations (24h)', value: 24 },
  { key: 'completed_24h', label: 'Completed (24h)', value: 18 },
  { key: 'open_priorities', label: 'Open Priorities', value: 12 },
  { key: 'active_runs', label: 'Active Runs', value: 4 },
];

// Get priority badge color
function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'critical':
      return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'high':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'medium':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

// Get confidence badge color
function getConfidenceColor(score: number): string {
  if (score >= 80) return 'bg-emerald-100 text-emerald-700';
  if (score >= 60) return 'bg-blue-100 text-blue-700';
  if (score >= 40) return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-700';
}

// Confidence trend indicator
function ConfidenceTrend({ trend }: { trend: 'rising' | 'stable' | 'falling' }) {
  const icons = {
    rising: '↗',
    stable: '→',
    falling: '↘',
  };
  const colors = {
    rising: 'text-emerald-600',
    stable: 'text-slate-400',
    falling: 'text-rose-500',
  };
  return (
    <span className={`text-sm font-medium ${colors[trend]}`} title={`Confidence ${trend}`}>
      {icons[trend]}
    </span>
  );
}

// Recommendation card component
function RecommendationCard({
  recommendation,
  onApprove,
  onReject,
  onDismiss,
}: {
  recommendation: Recommendation;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getPriorityColor(
                recommendation.priority
              )}`}
            >
              {recommendation.priority}
            </span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${getConfidenceColor(
                recommendation.confidenceScore
              )}`}
            >
              {recommendation.confidenceScore}% confidence
            </span>
            <ConfidenceTrend trend={recommendation.confidenceTrend} />
          </div>
          <h4 className="font-medium text-slate-900">{recommendation.title}</h4>
          <p className="text-sm text-slate-600 mt-1">{recommendation.description}</p>
          
          {/* Scoring breakdown */}
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            <div className="text-slate-500">
              Trend: <span className="font-medium text-slate-700">
                {recommendation.scores.trendImpact > 0 ? '+' : ''}{recommendation.scores.trendImpact}
              </span>
            </div>
            <div className="text-slate-500">
              Preference: <span className="font-medium text-slate-700">
                {recommendation.scores.preferenceMatch}%
              </span>
            </div>
            <div className="text-slate-500">
              History: <span className="font-medium text-slate-700">
                {Math.round(recommendation.scores.historicalAccuracy * 100)}%
              </span>
            </div>
          </div>
          
          {/* Action description */}
          {recommendation.suggestedAction && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-sm text-slate-600">
                <span className="font-medium text-slate-700">Suggested: </span>
                {recommendation.suggestedAction.description}
                {recommendation.suggestedAction.estimatedImpact && (
                  <span className="text-emerald-600 ml-1">
                    ({recommendation.suggestedAction.estimatedImpact})
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onApprove(recommendation.id)}
            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-md hover:bg-emerald-100 transition-colors border border-emerald-200"
          >
            ✓ Accept
          </button>
          <button
            onClick={() => onReject(recommendation.id)}
            className="px-3 py-1.5 bg-rose-50 text-rose-700 text-sm font-medium rounded-md hover:bg-rose-100 transition-colors border border-rose-200"
          >
            ✕ Reject
          </button>
          <button
            onClick={() => onDismiss(recommendation.id)}
            className="px-3 py-1.5 bg-slate-50 text-slate-600 text-sm rounded-md hover:bg-slate-100 transition-colors border border-slate-200"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

// Autonomy Task Card
function AutonomyTaskCard({ task }: { task: AutonomousTask }) {
  const statusColors: Record<string, string> = {
    pending: 'bg-slate-100 text-slate-700 border-slate-200',
    assigned: 'bg-blue-50 text-blue-700 border-blue-200',
    in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  
  const priorityColors: Record<string, string> = {
    critical: 'text-rose-600',
    high: 'text-orange-600',
    medium: 'text-amber-600',
    low: 'text-slate-500',
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:shadow-sm transition-shadow">
      <div className="text-xl">{getTaskTypeIcon(task.type)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColors[task.status]}`}>
            {task.status}
          </span>
          <span className={`text-xs font-medium ${priorityColors[task.priority]}`}>
            {task.priority}
          </span>
          {task.autoAssigned && (
            <span className="text-xs text-slate-400">🤖 auto</span>
          )}
        </div>
        <h4 className="text-sm font-medium text-slate-900 truncate">{task.title}</h4>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{task.description}</p>
        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
          <span>{formatAutonomyTime(task.createdAt)}</span>
          {task.assignedTo && (
            <span className="text-slate-500">→ {task.assignedTo.replace('agent:', '')}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Self-Healing Event Card
function HealingEventCard({ event }: { event: HealingEvent }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:shadow-sm transition-shadow">
      <div className="text-xl">
        {event.status === 'healed' ? '🏥' : event.status === 'escalated' ? '⚠️' : '🔧'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${getHealingStatusColor(event.status)}`}>
            {event.status}
          </span>
          <span className="text-xs text-slate-500">
            {formatHealingStrategy(event.strategy)}
          </span>
        </div>
        <p className="text-xs text-slate-600">
          {event.attempts.length} attempt{event.attempts.length !== 1 ? 's' : ''}
          {event.resolvedAt && (
            <span className="text-emerald-600 ml-1">
              (resolved in {formatDuration(new Date(event.resolvedAt).getTime() - new Date(event.startedAt).getTime())})
            </span>
          )}
        </p>
        <div className="text-xs text-slate-400 mt-1">
          {formatAutonomyTime(event.startedAt)}
        </div>
      </div>
    </div>
  );
}

// Override Rate Indicator
function OverrideRateIndicator({ rate }: { rate: number }) {
  const colorClass = getOverrideRateColor(rate);
  const isGood = rate < 5;
  
  return (
    <div className="flex items-center gap-2">
      <div className={`text-2xl font-bold ${colorClass}`}>
        {rate.toFixed(1)}%
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-slate-500">override rate</span>
        <span className={`text-xs ${isGood ? 'text-emerald-600' : 'text-amber-600'}`}>
          {isGood ? '✓ On target' : '⚠ Above 5%'}
        </span>
      </div>
    </div>
  );
}

// Action item card for auto-executed actions
function ActionItemCard({ action }: { action: { id: string; title: string; status: string; priority: string; createdAt: string } }) {
  const statusColors: Record<string, string> = {
    executed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    failed: 'bg-rose-50 text-rose-700 border-rose-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    queued: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-3">
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${statusColors[action.status] || 'bg-slate-50 text-slate-600'}`}>
          {action.status}
        </span>
        <span className={`text-sm ${action.status === 'executed' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
          {action.title}
        </span>
      </div>
      <span className="text-xs text-slate-400">
        {new Date(action.createdAt).toLocaleTimeString()}
      </span>
    </div>
  );
}

// Confidence distribution bar
function ConfidenceDistributionBar({ 
  high, medium, low 
}: { 
  high: number; 
  medium: number; 
  low: number;
}) {
  const total = high + medium + low || 1; // Avoid division by zero
  
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
      <div 
        className="bg-emerald-500 transition-all duration-500" 
        style={{ width: `${(high / total) * 100}%` }}
        title={`High confidence: ${high}`}
      />
      <div 
        className="bg-amber-500 transition-all duration-500" 
        style={{ width: `${(medium / total) * 100}%` }}
        title={`Medium confidence: ${medium}`}
      />
      <div 
        className="bg-slate-400 transition-all duration-500" 
        style={{ width: `${(low / total) * 100}%` }}
        title={`Low confidence: ${low}`}
      />
    </div>
  );
}

export default function OpsPage() {
  const [activeTab, setActiveTab] = useState<'review' | 'executed' | 'stats' | 'autonomy'>('review');
  
  // Use the intelligence bridge hook
  const {
    recommendations,
    reviewQueue,
    autoExecuted,
    isProcessing,
    lastUpdated,
    error,
    stats,
    approveRecommendation,
    rejectRecommendation,
    dismissRecommendation,
    refresh,
  } = useIntelligenceStream('demo-user-123', 80, MOCK_KPI_DATA);

  // Autonomy hooks
  const { 
    data: autonomyMetrics, 
    isLoading: autonomyLoading,
    refetch: refetchAutonomy 
  } = useAutonomyMetrics(30000);
  
  const { 
    tasks: autonomousTasks,
    pendingTasks,
    createdToday: tasksCreatedToday,
    completedToday: tasksCompletedToday,
    refetch: refetchTasks 
  } = useAutonomousTasks(30000);
  
  const { 
    events: healingEvents,
    todayCount: healingToday,
    weekCount: healingWeek,
    successRate: healingSuccessRate,
    avgTimeToHealMs,
    escalationRate,
    refetch: refetchHealing 
  } = useSelfHealingEvents(30000);

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Operations Intelligence</h1>
          <p className="text-sm text-slate-500 mt-1">
            {lastUpdated 
              ? `Last updated: ${new Date(lastUpdated).toLocaleTimeString()}` 
              : 'Initializing...'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isProcessing && (
            <span className="text-sm text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              Processing...
            </span>
          )}
          <button
            onClick={refresh}
            className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-200 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg">
          <p className="text-sm text-rose-700">{error.message}</p>
        </div>
      )}

      {/* Stats overview */}
      <div className="grid grid-cols-4 gap-4">
        <PageCard title="Total Recommendations">
          <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
        </PageCard>
        <PageCard title="Auto-Executed">
          <div className="text-3xl font-bold text-emerald-600">{stats.autoExecutable}</div>
          <p className="text-xs text-slate-500 mt-1">
            {stats.total > 0 ? Math.round((stats.autoExecutable / stats.total) * 100) : 0}% of total
          </p>
        </PageCard>
        <PageCard title="Queued for Review">
          <div className="text-3xl font-bold text-amber-600">{stats.queuedForReview}</div>
          <p className="text-xs text-slate-500 mt-1">
            {stats.total > 0 ? Math.round((stats.queuedForReview / stats.total) * 100) : 0}% of total
          </p>
        </PageCard>
        <PageCard title="Avg Confidence">
          <div className="text-3xl font-bold text-blue-600">{stats.avgConfidence}%</div>
          <p className="text-xs text-slate-500 mt-1">Across all recommendations</p>
        </PageCard>
      </div>

      {/* Confidence distribution */}
      <PageCard title="Confidence Distribution">
        <ConfidenceDistributionBar 
          high={stats.highConfidence} 
          medium={stats.mediumConfidence} 
          low={stats.lowConfidence} 
        />
        <div className="flex gap-6 mt-3 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full" />
            <span className="text-slate-600">High ({stats.highConfidence})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-amber-500 rounded-full" />
            <span className="text-slate-600">Medium ({stats.mediumConfidence})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-slate-400 rounded-full" />
            <span className="text-slate-600">Low ({stats.lowConfidence})</span>
          </div>
        </div>
      </PageCard>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1">
          {[
            { id: 'review', label: `Review Queue (${stats.queuedForReview})`, icon: '👁' },
            { id: 'executed', label: `Auto-Executed (${autoExecuted.length})`, icon: '✓' },
            { id: 'stats', label: 'All Recommendations', icon: '📊' },
            { id: 'autonomy', label: 'Autonomy', icon: '🤖' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="space-y-4">
        {activeTab === 'review' && (
          <>
            {reviewQueue.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <div className="text-4xl mb-2">✓</div>
                <p className="text-lg font-medium">No recommendations in review queue</p>
                <p className="text-sm">All high-confidence recommendations have been auto-executed</p>
              </div>
            ) : (
              reviewQueue.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  onApprove={approveRecommendation}
                  onReject={rejectRecommendation}
                  onDismiss={dismissRecommendation}
                />
              ))
            )}
          </>
        )}

        {activeTab === 'executed' && (
          <>
            {autoExecuted.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <div className="text-4xl mb-2">⏳</div>
                <p className="text-lg font-medium">No auto-executed actions yet</p>
                <p className="text-sm">High-confidence recommendations will appear here</p>
              </div>
            ) : (
              autoExecuted.map((action) => (
                <ActionItemCard key={action.id} action={action} />
              ))
            )}
          </>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 mb-4">
              Showing all {recommendations.length} generated recommendations:
            </p>
            {recommendations.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <p>No recommendations generated yet</p>
              </div>
            ) : (
              recommendations.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  onApprove={approveRecommendation}
                  onReject={rejectRecommendation}
                  onDismiss={dismissRecommendation}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'autonomy' && (
          <div className="space-y-6">
            {/* Autonomy Metrics Overview */}
            <div className="grid grid-cols-4 gap-4">
              <PageCard title="Override Rate">
                {autonomyLoading ? (
                  <div className="h-10 bg-slate-100 animate-pulse rounded" />
                ) : autonomyMetrics ? (
                  <OverrideRateIndicator rate={autonomyMetrics.decisions.overrideRate} />
                ) : (
                  <div className="text-slate-400">--</div>
                )}
              </PageCard>
              
              <PageCard title="Decisions Today">
                {autonomyLoading ? (
                  <div className="h-10 bg-slate-100 animate-pulse rounded" />
                ) : autonomyMetrics ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-slate-900">
                      {autonomyMetrics.decisions.today.total}
                    </span>
                    <span className="text-sm text-slate-500">
                      {autonomyMetrics.decisions.today.autoExecuted} auto
                    </span>
                  </div>
                ) : (
                  <div className="text-slate-400">--</div>
                )}
              </PageCard>
              
              <PageCard title="Healing Events (24h)">
                {autonomyLoading ? (
                  <div className="h-10 bg-slate-100 animate-pulse rounded" />
                ) : autonomyMetrics ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-slate-900">
                      {healingToday}
                    </span>
                    <span className="text-sm text-emerald-600">
                      {healingSuccessRate}% success
                    </span>
                  </div>
                ) : (
                  <div className="text-slate-400">--</div>
                )}
              </PageCard>
              
              <PageCard title="Auto Tasks Today">
                {autonomyLoading ? (
                  <div className="h-10 bg-slate-100 animate-pulse rounded" />
                ) : autonomyMetrics ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-slate-900">
                      {tasksCreatedToday}
                    </span>
                    <span className="text-sm text-blue-600">
                      {pendingTasks.length} pending
                    </span>
                  </div>
                ) : (
                  <div className="text-slate-400">--</div>
                )}
              </PageCard>
            </div>

            {/* Additional Healing Stats */}
            <PageCard title="Self-Healing Statistics">
              {autonomyLoading ? (
                <div className="space-y-2">
                  <div className="h-6 bg-slate-100 animate-pulse rounded" />
                  <div className="h-6 bg-slate-100 animate-pulse rounded" />
                  <div className="h-6 bg-slate-100 animate-pulse rounded" />
                </div>
              ) : autonomyMetrics ? (
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-slate-500">Success Rate</p>
                    <p className="text-xl font-semibold text-emerald-600">
                      {healingSuccessRate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Avg Time to Heal</p>
                    <p className="text-xl font-semibold text-slate-700">
                      {formatDuration(avgTimeToHealMs)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Escalation Rate</p>
                    <p className={`text-xl font-semibold ${escalationRate < 5 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {escalationRate}%
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500">No healing data available</p>
              )}
            </PageCard>

            {/* Two Column Layout */}
            <div className="grid grid-cols-2 gap-6">
              {/* Autonomous Tasks */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Autonomous Tasks</h3>
                  <span className="text-sm text-slate-500">
                    {pendingTasks.length} pending
                  </span>
                </div>
                
                {autonomousTasks.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 border border-slate-200 rounded-lg">
                    <div className="text-3xl mb-2">🤖</div>
                    <p>No autonomous tasks created yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {autonomousTasks.slice(0, 6).map((task) => (
                      <AutonomyTaskCard key={task.id} task={task} />
                    ))}
                    {autonomousTasks.length > 6 && (
                      <p className="text-center text-sm text-slate-500 py-2">
                        +{autonomousTasks.length - 6} more tasks
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Healing Events */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Self-Healing Events</h3>
                  <span className="text-sm text-slate-500">
                    {healingWeek} this week
                  </span>
                </div>
                
                {healingEvents.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 border border-slate-200 rounded-lg">
                    <div className="text-3xl mb-2">🏥</div>
                    <p>No healing events recorded</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {healingEvents.slice(0, 6).map((event) => (
                      <HealingEventCard key={event.id} event={event} />
                    ))}
                    {healingEvents.length > 6 && (
                      <p className="text-center text-sm text-slate-500 py-2">
                        +{healingEvents.length - 6} more events
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legacy section */}
      <div className="mt-8 pt-8 border-t border-slate-200">
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-700 transition-colors">
            Legacy API Bridge (click to expand)
          </summary>
          <div className="mt-4 p-4 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">
              Legacy metrics endpoint: /api/metrics/snapshot
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
