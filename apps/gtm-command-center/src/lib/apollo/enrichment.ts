/**
 * Apollo Enrichment Service
 * Handles prospect data enrichment and transformation
 */

import { 
  ApolloClient, 
  ApolloPerson, 
  ApolloOrganization, 
  ApolloSearchFilters,
  ApolloSearchResult,
  createApolloClientFromEnv
} from './client';
import { QualitySignals, ScoredProspect } from '../scoring/prospect-quality';

export interface EnrichmentConfig {
  enableEmailReveal: boolean;
  enablePhoneReveal: boolean;
  enrichCompany: boolean;
  enrichTechnologies: boolean;
  signalDetectionEnabled: boolean;
}

export interface EnrichmentResult {
  person: ApolloPerson | null;
  organization: ApolloOrganization | null;
  signals: QualitySignals;
  enrichedAt: Date;
  source: string;
  confidence: number;
  rawData: unknown;
}

export interface BulkEnrichmentOptions {
  batchSize?: number;
  concurrency?: number;
  onProgress?: (current: number, total: number) => void;
  onBatchComplete?: (batch: EnrichmentResult[]) => void;
}

const DEFAULT_ENRICHMENT_CONFIG: EnrichmentConfig = {
  enableEmailReveal: false,
  enablePhoneReveal: false,
  enrichCompany: true,
  enrichTechnologies: true,
  signalDetectionEnabled: true,
};

const DEFAULT_BULK_OPTIONS: BulkEnrichmentOptions = {
  batchSize: 10,
  concurrency: 2,
};

/**
 * Detect buying signals from Apollo data
 */
export function detectSignals(
  person: ApolloPerson,
  org: ApolloOrganization
): QualitySignals {
  const signals: QualitySignals = {
    isHiring: false,
    hiringRoles: [],
    raisedFunding: false,
    fundingAmount: undefined,
    fundingStage: undefined,
    fundingDate: undefined,
    techStackMatch: [],
    intentData: false,
    recentEvent: false,
    eventType: undefined,
  };

  // Funding signal detection
  if (org.funding_stage && org.funding_amount) {
    signals.raisedFunding = true;
    signals.fundingStage = org.funding_stage;
    signals.fundingAmount = org.funding_amount;
    // Funding within last 6 months considered recent
    signals.recentEvent = true;
    signals.eventType = 'funding';
  }

  // Company size growth (proxy for hiring)
  if (org.employee_count && org.employee_count > 50) {
    signals.isHiring = true;
    signals.hiringRoles = [person.department].filter(Boolean) as string[];
  }

  // Tech stack indicators
  if (org.technologies) {
    const targetTechs = [
      'aws', 'amazon web services', 'gcp', 'google cloud', 'azure', 'microsoft azure',
      'kubernetes', 'k8s', 'docker', 'terraform', 'pulumi',
      'datadog', 'grafana', 'prometheus', 'new relic',
      'snowflake', 'databricks', 'dbt',
      'stripe', 'twilio', 'segment',
    ];

    signals.techStackMatch = org.technologies.filter(tech => 
      targetTechs.some(target => 
        tech.toLowerCase().includes(target) || target.includes(tech.toLowerCase())
      )
    );
  }

  // High-growth intent indicators
  if (org.funding_stage && ['series_b', 'series_c', 'series_d', 'growth'].includes(org.funding_stage.toLowerCase())) {
    signals.intentData = true;
  }

  // Keywords suggesting buying intent
  if (org.keywords) {
    const intentKeywords = ['scale', 'growth', 'expand', 'new initiative', 'digital transformation'];
    if (org.keywords.some(kw => intentKeywords.some(ik => kw.toLowerCase().includes(ik)))) {
      signals.intentData = true;
    }
  }

  return signals;
}

/**
 * Calculate enrichment confidence score
 */
export function calculateConfidence(
  person: ApolloPerson,
  org: ApolloOrganization
): number {
  let confidence = 0;
  const factors: string[] = [];

  // Person data completeness
  if (person.email || person.work_email || person.personal_email) {
    confidence += 20;
    factors.push('has_email');
  }
  if (person.linkedin_url) {
    confidence += 15;
    factors.push('has_linkedin');
  }
  if (person.title) {
    confidence += 15;
    factors.push('has_title');
  }
  if (person.department) {
    confidence += 10;
    factors.push('has_department');
  }

  // Organization data completeness
  if (org.domain) {
    confidence += 15;
    factors.push('has_domain');
  }
  if (org.employee_count) {
    confidence += 10;
    factors.push('has_size');
  }
  if (org.industry) {
    confidence += 10;
    factors.push('has_industry');
  }
  if (org.technologies && org.technologies.length > 0) {
    confidence += 5;
    factors.push('has_tech_stack');
  }

  return Math.min(confidence, 100);
}

/**
 * Enrichment Service
 */
export class EnrichmentService {
  private client: ApolloClient;
  private config: EnrichmentConfig;

  constructor(client?: ApolloClient, config?: Partial<EnrichmentConfig>) {
    this.client = client || createApolloClientFromEnv();
    this.config = { ...DEFAULT_ENRICHMENT_CONFIG, ...config };
  }

  /**
   * Enrich a single contact by email
   */
  async enrichByEmail(email: string): Promise<EnrichmentResult> {
    const match = await this.client.enrichPersonByEmail(
      email, 
      this.config.enableEmailReveal
    );

    if (!match.person) {
      throw new Error('Person not found');
    }

    let org = match.organization;

    // Enrich organization if needed
    if (this.config.enrichCompany && match.person?.id && !org?.technologies) {
      try {
        const domain = email.split('@')[1];
        if (domain) {
          org = await this.client.enrichOrganizationByDomain(domain);
        }
      } catch {
        // Org enrichment failed, use what we have
      }
    }

    return this.transformToEnrichmentResult(match.person, org || undefined);
  }

  /**
   * Enrich a single contact by LinkedIn URL
   */
  async enrichByLinkedIn(linkedinUrl: string): Promise<EnrichmentResult> {
    const match = await this.client.enrichPersonByLinkedIn(linkedinUrl);

    if (!match.person) {
      throw new Error('Person not found');
     }

    let org = match.organization;

    // Try to enrich org by domain
    if (this.config.enrichCompany && org?.domain) {
      try {
        org = await this.client.enrichOrganizationByDomain(org.domain);
      } catch {
        // Use basic org data
      }
    }

    return this.transformToEnrichmentResult(match.person, org || undefined);
  }

  /**
   * Search and enrich multiple prospects
   */
  async searchAndEnrich(
    filters: ApolloSearchFilters,
    options?: Partial<BulkEnrichmentOptions>
  ): Promise<EnrichmentResult[]> {
    const searchResults = await this.client.searchProspects(filters);
    if (!searchResults.people?.length) {
      return [];
    }

    const enriched: EnrichmentResult[] = [];
    const opts = { ...DEFAULT_BULK_OPTIONS, ...options };

    // Process each person
    for (const person of searchResults.people) {
      try {
        // Find matching organization
        const org = searchResults.organizations?.find(o => {
          // Try to match by domain or other criteria
          const personDomain = person.email?.split('@')[1] || 
                              person.work_email?.split('@')[1];
          return o.domain === personDomain;
        });

        enriched.push(this.transformToEnrichmentResult(person, org));
      } catch (error) {
        console.error(`Failed to enrich ${person.email}:`, error);
      }
    }

    return enriched;
  }

  /**
   * Bulk enrich contacts
   */
  async bulkEnrich(
    emails: string[],
    options?: Partial<BulkEnrichmentOptions>
  ): Promise<EnrichmentResult[]> {
    const opts = { ...DEFAULT_BULK_OPTIONS, ...options };
    const results: EnrichmentResult[] = [];
    
    // Process in batches
    for (let i = 0; i < emails.length; i += opts.batchSize!) {
      const batch = emails.slice(i, i + opts.batchSize!);
      const batchResults: EnrichmentResult[] = [];

      for (const email of batch) {
        try {
          const result = await this.enrichByEmail(email);
          batchResults.push(result);
          results.push(result);
        } catch (error) {
          console.error(`Failed to enrich ${email}:`, error);
        }
      }

      opts.onBatchComplete?.(batchResults);
      opts.onProgress?.(Math.min(i + opts.batchSize!, emails.length), emails.length);

      // Small delay between batches
      if (i + opts.batchSize! < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  /**
   * Transform Apollo data to our enrichment format
   */
  private transformToEnrichmentResult(
    person: ApolloPerson,
    org?: ApolloOrganization
  ): EnrichmentResult {
    const signals = this.config.signalDetectionEnabled && org 
      ? detectSignals(person, org)
      : {} as QualitySignals;

    return {
      person,
      organization: org || null,
      signals,
      enrichedAt: new Date(),
      source: 'apollo',
      confidence: org ? calculateConfidence(person, org) : 50,
      rawData: { person, organization: org },
    };
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus() {
    return this.client.getRateLimitStatus();
  }
}

/**
 * Create enrichment service from environment
 */
export function createEnrichmentService(
  config?: Partial<EnrichmentConfig>
): EnrichmentService {
  return new EnrichmentService(undefined, config);
}

export default EnrichmentService;
