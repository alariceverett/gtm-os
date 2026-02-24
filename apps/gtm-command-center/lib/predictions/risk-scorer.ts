/**
 * Risk Scoring Engine for Deals at Risk
 *
 * Analyzes engagement, communication, and market signals to score deal risk
 * Output: Risk level (🟢🟡🔴) + reasons
 */

export interface RiskFactor {
  name: string;
  weight: number;
  score: number; // 0-100, higher = more risky
  rawValue: number;
  description: string;
}

export interface DealRiskScore {
  dealId: string;
  dealName: string;
  accountName: string;
  totalScore: number; // 0-100
  level: 'low' | 'medium' | 'high' | 'critical';
  emoji: '🟢' | '🟡' | '🟠' | '🔴';
  color: 'green' | 'yellow' | 'orange' | 'red';
  factors: RiskFactor[];
  topReasons: string[];
  recommendedActions: string[];
  lastUpdated: string;
  trend: 'improving' | 'stable' | 'worsening';
  daysInStage: number;
  estimatedCloseDate?: string;
}

export interface RiskScoringConfig {
  thresholds: {
    low: number;
    medium: number;
    high: number;
  };
  weights: {
    engagementDrop: number;
    communicationLag: number;
    marketSignals: number;
    stageDuration: number;
    stakeholderEngagement: number;
  };
}

export interface RiskReport {
  generatedAt: string;
  deals: DealRiskScore[];
  summary: {
    totalDeals: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    atRiskPipelineValue: number;
    averageRiskScore: number;
  };
  topRisks: DealRiskScore[];
  improvingDeals: DealRiskScore[];
}

// Default scoring configuration
export const DEFAULT_RISK_CONFIG: RiskScoringConfig = {
  thresholds: {
    low: 30,
    medium: 50,
    high: 75,
  },
  weights: {
    engagementDrop: 0.25,
    communicationLag: 0.25,
    marketSignals: 0.20,
    stageDuration: 0.15,
    stakeholderEngagement: 0.15,
  },
};

// Input data structure for risk scoring
export interface DealInputData {
  dealId: string;
  dealName: string;
  accountName: string;
  stage: string;
  stageEnterDate: string;
  dealValue: number;
  // Engagement metrics
  engagement: {
    currentScore: number;
    previousScore: number;
    lastActivityDate: string;
    activitiesLast7Days: number;
    activitiesPrevious7Days: number;
  };
  // Communication metrics
  communication: {
    lastContactDate: string;
    daysSinceLastContact: number;
    responseTimeAverage: number; // hours
    emailOpenRate: number; // 0-1
  };
  // Market/competitive signals
  market: {
    competitorMentioned: boolean;
    budgetConfirmed: boolean;
    decisionMakerEngaged: boolean;
    procurementInvolved: boolean;
  };
  // Stakeholder info
  stakeholders: {
    total: number;
    engaged: number;
    championIdentified: boolean;
    economicBuyerEngaged: boolean;
  };
  closeDate: string;
}

// Score individual risk factors
function scoreEngagementDrop(data: DealInputData): RiskFactor {
  const { engagement } = data;
  const scoreChange = engagement.previousScore - engagement.currentScore;
  const activityChange = engagement.activitiesPrevious7Days - engagement.activitiesLast7Days;

  let score = 0;
  let description = 'Engagement stable';

  if (scoreChange > 30) {
    score = 90;
    description = `Engagement dropped ${scoreChange.toFixed(0)} points`;
  } else if (scoreChange > 15) {
    score = 65;
    description = `Engagement declined ${scoreChange.toFixed(0)} points`;
  } else if (activityChange > 3) {
    score = 55;
    description = `Activity down ${activityChange} from last week`;
  } else if (engagement.currentScore < 30) {
    score = 50;
    description = 'Overall engagement is low';
  }

  return {
    name: 'engagementDrop',
    weight: DEFAULT_RISK_CONFIG.weights.engagementDrop,
    score,
    rawValue: scoreChange,
    description,
  };
}

function scoreCommunicationLag(data: DealInputData): RiskFactor {
  const { communication } = data;
  let score = 0;
  let description = 'Communication regular';

  if (communication.daysSinceLastContact > 14) {
    score = 90;
    description = `No contact for ${communication.daysSinceLastContact} days`;
  } else if (communication.daysSinceLastContact > 7) {
    score = 60;
    description = `No contact for ${communication.daysSinceLastContact} days`;
  } else if (communication.responseTimeAverage > 48) {
    score = 50;
    description = `Slow response time (${communication.responseTimeAverage.toFixed(0)}h avg)`;
  } else if (communication.emailOpenRate < 0.2) {
    score = 45;
    description = 'Low email open rate';
  }

  return {
    name: 'communicationLag',
    weight: DEFAULT_RISK_CONFIG.weights.communicationLag,
    score,
    rawValue: communication.daysSinceLastContact,
    description,
  };
}

function scoreMarketSignals(data: DealInputData): RiskFactor {
  const { market } = data;
  let score = 0;
  let description = 'Market signals positive';
  let riskCount = 0;

  if (market.competitorMentioned) {
    score += 25;
    riskCount++;
  }
  if (!market.budgetConfirmed) {
    score += 20;
    riskCount++;
  }
  if (!market.decisionMakerEngaged) {
    score += 20;
    riskCount++;
  }
  if (market.procurementInvolved) {
    score += 10;
    riskCount++;
  }

  if (riskCount >= 3) {
    description = 'Multiple negative market signals';
  } else if (riskCount > 0) {
    description = `${riskCount} market risk factors present`;
  }

  return {
    name: 'marketSignals',
    weight: DEFAULT_RISK_CONFIG.weights.marketSignals,
    score: Math.min(100, score),
    rawValue: riskCount,
    description,
  };
}

function scoreStageDuration(data: DealInputData): RiskFactor {
  const stageEnterDate = new Date(data.stageEnterDate);
  const daysInStage = Math.floor((Date.now() - stageEnterDate.getTime()) / (1000 * 60 * 60 * 24));

  // Expected days per stage
  const stageExpectations: Record<string, number> = {
    'discovery': 14,
    'qualified': 21,
    'pilot': 30,
    'negotiation': 14,
    'proposal': 10,
  };

  const expectedDays = stageExpectations[data.stage.toLowerCase()] || 21;
  const ratio = daysInStage / expectedDays;

  let score = 0;
  let description = 'On track for stage';

  if (ratio > 2.5) {
    score = 85;
    description = `Stalled for ${daysInStage} days (2.5x expected)`;
  } else if (ratio > 1.8) {
    score = 55;
    description = `Slow progress: ${daysInStage} days in stage`;
  } else if (ratio > 1.2) {
    score = 30;
    description = `Approaching stage limit (${daysInStage} days)`;
  }

  return {
    name: 'stageDuration',
    weight: DEFAULT_RISK_CONFIG.weights.stageDuration,
    score,
    rawValue: daysInStage,
    description,
  };
}

function scoreStakeholderEngagement(data: DealInputData): RiskFactor {
  const { stakeholders } = data;
  const engagementRate = stakeholders.engaged / Math.max(1, stakeholders.total);

  let score = 0;
  let description = 'Strong stakeholder engagement';

  if (!stakeholders.championIdentified) {
    score += 40;
    description = 'No internal champion identified';
  }

  if (!stakeholders.economicBuyerEngaged) {
    score += 30;
    description = description === 'Strong stakeholder engagement'
      ? 'Economic buyer not engaged'
      : description + ', no economic buyer';
  }

  if (engagementRate < 0.3 && stakeholders.total > 2) {
    score += 25;
    description += ', low overall engagement';
  }

  return {
    name: 'stakeholderEngagement',
    weight: DEFAULT_RISK_CONFIG.weights.stakeholderEngagement,
    score: Math.min(100, score),
    rawValue: engagementRate,
    description,
  };
}

// Calculate total risk score for a deal
export function calculateDealRisk(data: DealInputData): DealRiskScore {
  const factors = [
    scoreEngagementDrop(data),
    scoreCommunicationLag(data),
    scoreMarketSignals(data),
    scoreStageDuration(data),
    scoreStakeholderEngagement(data),
  ];

  // Weighted average
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const totalScore = factors.reduce((sum, f) => sum + (f.score * f.weight), 0) / totalWeight;

  // Determine level
  let level: 'low' | 'medium' | 'high' | 'critical' = 'low';
  let emoji: '🟢' | '🟡' | '🟠' | '🔴' = '🟢';
  let color: 'green' | 'yellow' | 'orange' | 'red' = 'green';

  if (totalScore >= DEFAULT_RISK_CONFIG.thresholds.high) {
    level = 'critical';
    emoji = '🔴';
    color = 'red';
  } else if (totalScore >= DEFAULT_RISK_CONFIG.thresholds.medium) {
    level = 'high';
    emoji = '🟠';
    color = 'orange';
  } else if (totalScore >= DEFAULT_RISK_CONFIG.thresholds.low) {
    level = 'medium';
    emoji = '🟡';
    color = 'yellow';
  }

  // Get top reasons (highest scoring factors)
  const topRiskFactors = factors
    .filter(f => f.score > 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const topReasons = topRiskFactors.map(f => f.description);

  // Generate recommendations
  const recommendedActions = generateRecommendations(factors, level);

  // Calculate trend
  const engagementTrend = data.engagement.currentScore - data.engagement.previousScore;
  const trend: 'improving' | 'stable' | 'worsening' =
    engagementTrend > 10 ? 'improving' :
    engagementTrend < -10 ? 'worsening' : 'stable';

  const stageEnterDate = new Date(data.stageEnterDate);
  const daysInStage = Math.floor((Date.now() - stageEnterDate.getTime()) / (1000 * 60 * 60 * 24));

  return {
    dealId: data.dealId,
    dealName: data.dealName,
    accountName: data.accountName,
    totalScore,
    level,
    emoji,
    color,
    factors,
    topReasons,
    recommendedActions,
    lastUpdated: new Date().toISOString(),
    trend,
    daysInStage,
    estimatedCloseDate: data.closeDate,
  };
}

function generateRecommendations(factors: RiskFactor[], level: string): string[] {
  const actions: string[] = [];

  const highRiskFactors = factors.filter(f => f.score > 50);

  highRiskFactors.forEach(f => {
    switch (f.name) {
      case 'engagementDrop':
        actions.push('Schedule urgent check-in call with key stakeholders');
        actions.push('Send personalized value-focused follow-up');
        break;
      case 'communicationLag':
        actions.push('Attempt alternative contact methods (phone, LinkedIn)');
        actions.push('Check for internal reorganization or priority shifts');
        break;
      case 'marketSignals':
        actions.push('Prepare competitive differentiation document');
        actions.push('Schedule meeting with economic buyer to confirm budget');
        break;
      case 'stageDuration':
        actions.push('Identify and address specific blockers in current stage');
        actions.push('Consider offering pilot or proof of concept to re-engage');
        break;
      case 'stakeholderEngagement':
        actions.push('Map out decision-making committee');
        actions.push('Leverage existing champion to connect with economic buyer');
        break;
    }
  });

  if (level === 'critical') {
    actions.unshift('🚨 ESCALATE TO SALES LEADERSHIP IMMEDIATELY');
  }

  return [...new Set(actions)].slice(0, 5);
}

// Generate risk report for multiple deals
export function generateRiskReport(deals: DealInputData[]): RiskReport {
  const generatedAt = new Date().toISOString();

  const scoredDeals = deals.map(calculateDealRisk);

  // Sort by risk score descending
  scoredDeals.sort((a, b) => b.totalScore - a.totalScore);

  const criticalCount = scoredDeals.filter(d => d.level === 'critical').length;
  const highCount = scoredDeals.filter(d => d.level === 'high').length;
  const mediumCount = scoredDeals.filter(d => d.level === 'medium').length;
  const lowCount = scoredDeals.filter(d => d.level === 'low').length;

  const atRiskDeals = scoredDeals.filter(d => d.level === 'critical' || d.level === 'high');
  const atRiskPipelineValue = atRiskDeals.reduce((sum, d) => {
    // In real implementation, would have deal value
    return sum + (deals.find(input => input.dealId === d.dealId)?.dealValue || 0);
  }, 0);

  const averageRiskScore = scoredDeals.length > 0
    ? scoredDeals.reduce((sum, d) => sum + d.totalScore, 0) / scoredDeals.length
    : 0;

  const improvingDeals = scoredDeals.filter(d => d.trend === 'improving').slice(0, 3);

  return {
    generatedAt,
    deals: scoredDeals,
    summary: {
      totalDeals: scoredDeals.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      atRiskPipelineValue,
      averageRiskScore,
    },
    topRisks: scoredDeals.slice(0, 5),
    improvingDeals,
  };
}

// Generate mock deal data for testing
export function generateMockDealData(count: number = 10): DealInputData[] {
  const stages = ['discovery', 'qualified', 'pilot', 'negotiation', 'proposal'];
  const accounts = ['Acme Corp', 'TechStart Inc', 'Beta Labs', 'Global Dynamics', 'NexGen Solutions'];

  return Array.from({ length: count }, (_, i) => {
    const engagementScore = 20 + Math.random() * 80;
    const daysSinceContact = Math.floor(Math.random() * 20);

    return {
      dealId: `deal-${i + 1}`,
      dealName: `Deal ${i + 1}: Enterprise Package`,
      accountName: accounts[i % accounts.length],
      stage: stages[Math.floor(Math.random() * stages.length)],
      stageEnterDate: new Date(Date.now() - Math.random() * 45 * 24 * 60 * 60 * 1000).toISOString(),
      dealValue: 50000 + Math.random() * 200000,
      engagement: {
        currentScore: engagementScore,
        previousScore: engagementScore + (Math.random() - 0.5) * 40,
        lastActivityDate: new Date(Date.now() - daysSinceContact * 24 * 60 * 60 * 1000).toISOString(),
        activitiesLast7Days: Math.floor(Math.random() * 10),
        activitiesPrevious7Days: Math.floor(Math.random() * 10),
      },
      communication: {
        lastContactDate: new Date(Date.now() - daysSinceContact * 24 * 60 * 60 * 1000).toISOString(),
        daysSinceLastContact: daysSinceContact,
        responseTimeAverage: 4 + Math.random() * 72,
        emailOpenRate: Math.random(),
      },
      market: {
        competitorMentioned: Math.random() > 0.7,
        budgetConfirmed: Math.random() > 0.4,
        decisionMakerEngaged: Math.random() > 0.5,
        procurementInvolved: Math.random() > 0.6,
      },
      stakeholders: {
        total: 2 + Math.floor(Math.random() * 5),
        engaged: Math.floor(Math.random() * 4),
        championIdentified: Math.random() > 0.3,
        economicBuyerEngaged: Math.random() > 0.5,
      },
      closeDate: new Date(Date.now() + (30 + Math.random() * 60) * 24 * 60 * 60 * 1000).toISOString(),
    };
  });
}

// Format risk score for display
export function formatRiskMessage(deal: DealRiskScore): string {
  const reasons = deal.topReasons.length > 0 ? ` • ${deal.topReasons[0]}` : '';
  return `${deal.emoji} ${deal.accountName}: ${deal.totalScore.toFixed(0)}% risk${reasons}`;
}
