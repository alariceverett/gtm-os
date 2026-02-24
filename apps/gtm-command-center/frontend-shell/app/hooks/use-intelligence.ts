'use client';

import { useDataFetch } from './use-data-fetch';

export interface RelationshipIntelligence {
  healthScore: {
    overall: number;
    label: 'healthy' | 'at-risk' | 'needs-attention';
    breakdown: Array<{
      dimension: string;
      score: number;
      trend: 'up' | 'down' | 'flat';
    }>;
  };
  recentActivity: Array<{
    id: string;
    type: 'meeting' | 'email' | 'task' | 'note';
    title: string;
    timestamp: string;
    account?: string;
  }>;
  qualifiedAccounts: Array<{
    id: string;
    name: string;
    stage: string;
    health: number;
    lastContact: string;
  }>;
  pendingActions: Array<{
    id: string;
    type: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    dueDate?: string;
  }>;
}

interface ApiIntelligenceResponse {
  marker?: string;
  healthScore?: {
    overall: number;
    label: string;
    breakdown: Array<{
      dimension: string;
      score: number;
      trend: string;
    }>;
  };
  recentActivity?: Array<{
    id: string;
    type: string;
    title: string;
    timestamp: string;
    account?: string;
  }>;
  qualifiedAccounts?: Array<{
    id: string;
    name: string;
    stage: string;
    health: number;
    lastContact: string;
  }>;
  pendingActions?: Array<{
    id: string;
    type: string;
    description: string;
    priority: string;
    dueDate?: string;
  }>;
}

const MOCK_INTELLIGENCE: RelationshipIntelligence = {
  healthScore: {
    overall: 78,
    label: 'healthy',
    breakdown: [
      { dimension: 'Engagement', score: 82, trend: 'up' },
      { dimension: 'Response Time', score: 75, trend: 'flat' },
      { dimension: 'Meeting Quality', score: 88, trend: 'up' },
      { dimension: 'Follow-up', score: 68, trend: 'down' },
    ],
  },
  recentActivity: [
    { id: '1', type: 'meeting', title: 'Discovery call with Acme Corp', timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), account: 'Acme Corp' },
    { id: '2', type: 'email', title: 'Follow-up sent to TechStart', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), account: 'TechStart' },
    { id: '3', type: 'task', title: 'Prepare demo for Beta Labs', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), account: 'Beta Labs' },
  ],
  qualifiedAccounts: [
    { id: '1', name: 'Acme Corp', stage: 'discovery', health: 85, lastContact: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
    { id: '2', name: 'TechStart', stage: 'qualified', health: 72, lastContact: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() },
    { id: '3', name: 'Beta Labs', stage: 'pilot', health: 91, lastContact: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString() },
  ],
  pendingActions: [
    { id: '1', type: 'follow-up', description: 'Send proposal to Acme Corp', priority: 'high', dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString() },
    { id: '2', type: 'meeting', description: 'Schedule demo with new prospect', priority: 'medium' },
  ],
};

function transformApiResponse(response: ApiIntelligenceResponse | null): RelationshipIntelligence {
  if (!response) return MOCK_INTELLIGENCE;
  
  // Normalize health label
  const normalizeLabel = (label: string): 'healthy' | 'at-risk' | 'needs-attention' => {
    const lower = label?.toLowerCase() || '';
    if (lower.includes('healthy') || lower.includes('good')) return 'healthy';
    if (lower.includes('risk') || lower.includes('poor') || lower.includes('critical')) return 'needs-attention';
    return 'at-risk';
  };

  // Normalize trend
  const normalizeTrend = (trend: string): 'up' | 'down' | 'flat' => {
    const lower = trend?.toLowerCase() || '';
    if (lower.includes('up') || lower.includes('increase')) return 'up';
    if (lower.includes('down') || lower.includes('decrease')) return 'down';
    return 'flat';
  };

  // Normalize priority
  const normalizePriority = (priority: string): 'high' | 'medium' | 'low' => {
    const lower = priority?.toLowerCase() || '';
    if (lower.includes('high') || lower.includes('urgent') || lower.includes('critical')) return 'high';
    if (lower.includes('low')) return 'low';
    return 'medium';
  };

  return {
    healthScore: response.healthScore ? {
      overall: response.healthScore.overall ?? 0,
      label: normalizeLabel(response.healthScore.label),
      breakdown: (response.healthScore.breakdown || []).map(item => ({
        dimension: item.dimension,
        score: item.score,
        trend: normalizeTrend(item.trend),
      })),
    } : MOCK_INTELLIGENCE.healthScore,
    recentActivity: (response.recentActivity || MOCK_INTELLIGENCE.recentActivity).map(item => ({
      id: item.id,
      type: item.type as 'meeting' | 'email' | 'task' | 'note',
      title: item.title,
      timestamp: item.timestamp,
      account: item.account,
    })),
    qualifiedAccounts: (response.qualifiedAccounts || MOCK_INTELLIGENCE.qualifiedAccounts).map(item => ({
      id: item.id,
      name: item.name,
      stage: item.stage,
      health: item.health,
      lastContact: item.lastContact,
    })),
    pendingActions: (response.pendingActions || MOCK_INTELLIGENCE.pendingActions).map(item => ({
      id: item.id,
      type: item.type,
      description: item.description,
      priority: normalizePriority(item.priority),
      dueDate: item.dueDate,
    })),
  };
}

export function useIntelligence(refreshInterval = 30000) {
  const result = useDataFetch<ApiIntelligenceResponse>('/api/relationships/intelligence', {
    refreshInterval,
    retryCount: 2,
    initialData: null,
  });

  return {
    ...result,
    intelligence: transformApiResponse(result.data),
  };
}
