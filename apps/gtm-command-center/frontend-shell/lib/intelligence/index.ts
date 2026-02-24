/**
 * Intelligence Module
 * 
 * Decision synthesis and recommendation engine for the GTM Command Center.
 * 
 * ```ts
 * import { 
 *   generateRecommendations,
 *   getAutoExecutableRecommendations,
 *   useIntelligenceStream 
 * } from '@/lib/intelligence';
 * ```
 */

// Engine exports
export {
  generateRecommendations,
  getAutoExecutableRecommendations,
  getReviewQueueRecommendations,
  getAverageConfidence,
  getConfidenceDistribution,
  type Recommendation,
  type SynthesisInput,
  type RecommendationType,
  type RecommendationPriority,
  type RecommendationStatus,
} from './recommendation-engine';

// Re-export hook for convenience
export { 
  useIntelligenceStream,
  type UseIntelligenceBridgeResult,
  type ActionItem,
  type IntelligenceStreamState,
} from '@/app/hooks/use-intelligence-bridge';
