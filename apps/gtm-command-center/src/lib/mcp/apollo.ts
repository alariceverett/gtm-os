/**
 * Apollo MCP Integration
 * Model Context Protocol client for Apollo.io prospecting
 * 
 * Provides:
 * - searchProspects() - Search via MCP protocol
 * - enrichProspect() - Enrich single prospect
 * - verifyContact() - Verify email/phone
 * - Real-time job progress via Supabase
 */

import { ApolloClient, ApolloSearchFilters, ApolloPerson, ApolloOrganization, ApolloSearchResult } from '../apollo/client';
import { ResearchJob, Prospect, CommandIntent, ProspectSignal } from '@/types';

// MCP Client Configuration
interface MCPConfig {
  serverUrl: string;
  apiKey: string;
  timeout?: number;
  maxRetries?: number;
}

// MCP Request/Response types
interface MCPRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params?: unknown;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Search options via MCP
interface MCPSearchOptions {
  naturalLanguageQuery?: string;
  structuredFilters?: ApolloSearchFilters;
  enrichmentLevel: 'basic' | 'full' | 'premium';
  scoringEnabled: boolean;
  maxResults: number;
}

// MCP Apollo Client
export class ApolloMCPClient {
  private config: MCPConfig;
  private apollo: ApolloClient;
  private requestId = 0;

  constructor(apolloClient: ApolloClient, config: MCPConfig) {
    this.apollo = apolloClient;
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      ...config,
    };
  }

  private generateId(): string {
    return `${Date.now()}-${++this.requestId}`;
  }

  /**
   * Make MCP protocol request
   */
  private async mcpRequest<T>(method: string, params?: unknown): Promise<T> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.generateId(),
      method,
      params,
    };

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.config.maxRetries!; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(this.config.serverUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
            'X-MCP-Version': '1.0',
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 429) {
            // Rate limited - exponential backoff
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          throw new Error(`MCP request failed: ${response.statusText}`);
        }

        const data: MCPResponse = await response.json();

        if (data.error) {
          throw new Error(`MCP error ${data.error.code}: ${data.error.message}`);
        }

        return data.result as T;
      } catch (error) {
        lastError = error as Error;
        
        // Retry on network errors
        if (attempt < this.config.maxRetries! - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    throw lastError || new Error('MCP request failed after retries');
  }

  /**
   * Search prospects via MCP with natural language
   */
  async searchProspects(
    intent: CommandIntent,
    options: Partial<MCPSearchOptions> = {}
  ): Promise<{ prospects: Prospect[]; total: number }> {
    const searchOptions: MCPSearchOptions = {
      enrichmentLevel: 'full',
      scoringEnabled: true,
      maxResults: 100,
      ...options,
    };

    // Try MCP first, fall back to direct Apollo API
    try {
      const result = await this.mcpRequest<{
        prospects: Array<{
          person: ApolloPerson;
          organization: ApolloOrganization;
          score: number;
          signals: ProspectSignal[];
        }>;
        total: number;
        queryId: string;
      }>('apollo/search', {
        query: intent.rawInput,
        structuredQuery: this.convertIntentToFilters(intent),
        options: searchOptions,
      });

      return {
        prospects: result.prospects.map(p => this.transformToProspect(p.person, p.organization, p.score, p.signals)),
        total: result.total,
      };
    } catch (mcpError) {
      console.warn('MCP search failed, falling back to direct API:', mcpError);
      
      // Fallback to direct Apollo API
      const filters = this.convertIntentToFilters(intent);
      const searchResult = await this.apollo.searchProspects({
        ...filters,
        per_page: searchOptions.maxResults,
      });

      const prospects = await this.enrichAndScoreBatch(
        searchResult.people,
        searchResult.organizations
      );

      return {
        prospects,
        total: searchResult.pagination.total_entries,
      };
    }
  }

  /**
   * Enrich a single prospect
   */
  async enrichProspect(prospectId: string): Promise<Prospect> {
    try {
      // Try MCP first
      const result = await this.mcpRequest<{
        person: ApolloPerson;
        organization: ApolloOrganization;
        score: number;
        signals: ProspectSignal[];
      }>('apollo/enrich', {
        id: prospectId,
        includeSignals: true,
        includeTechStack: true,
        includeFunding: true,
      });

      return this.transformToProspect(
        result.person,
        result.organization,
        result.score,
        result.signals
      );
    } catch (mcpError) {
      console.warn('MCP enrich failed, falling back to direct API:', mcpError);
      
      // Fallback to direct enrichment
      const match = await this.apollo.enrichPersonByLinkedIn(prospectId);
      
      if (!match.person) {
        throw new Error('Prospect not found');
      }

      return this.transformToProspect(
        match.person,
        match.organization || undefined,
        match.confidence_score || 50,
        []
      );
    }
  }

  /**
   * Verify contact information (email/phone)
   */
  async verifyContact(
    prospectId: string,
    type: 'email' | 'phone' | 'both' = 'both'
  ): Promise<{
    emailVerified: boolean;
    emailStatus?: 'valid' | 'invalid' | 'catch_all' | 'unknown';
    phoneVerified: boolean;
    phoneStatus?: string;
  }> {
    try {
      return await this.mcpRequest('apollo/verify', {
        id: prospectId,
        verifyType: type,
      });
    } catch (mcpError) {
      console.warn('MCP verify failed, falling back to direct API:', mcpError);
      
      // Direct verification via Apollo
      // Note: This is a simplified fallback
      return {
        emailVerified: false,
        emailStatus: 'unknown',
        phoneVerified: false,
      };
    }
  }

  /**
   * Get real-time job progress
   * Returns a function to unsubscribe
   */
  subscribeToJobProgress(
    jobId: string,
    onProgress: (update: {
      status: ResearchJob['status'];
      progress: ResearchJob['progress'];
      results: Prospect[];
    }) => void
  ): () => void {
    // This would connect to Supabase Realtime
    // For now, return a mock implementation
    const interval = setInterval(async () => {
      try {
        const status = await this.mcpRequest<{
          status: ResearchJob['status'];
          progress: ResearchJob['progress'];
          results: Prospect[];
        }>('apollo/job/status', { jobId });
        
        onProgress(status);

        if (status.status === 'completed' || status.status === 'error') {
          clearInterval(interval);
        }
      } catch {
        // Silently fail - job might not exist in MCP
      }
    }, 2000);

    // Return unsubscribe function
    return () => clearInterval(interval);
  }

  /**
   * Convert CommandIntent to Apollo search filters
   */
  private convertIntentToFilters(intent: CommandIntent): ApolloSearchFilters {
    const filters: ApolloSearchFilters = {
      per_page: 100,
    };

    if (intent.icp) {
      // Titles
      if (intent.icp.titles?.length) {
        filters.person_titles = intent.icp.titles.flatMap(title => [
          title,
          `VP ${title}`,
          `Senior ${title}`,
          `Head of ${title}`,
        ]);
      }

      // Industries
      if (intent.icp.industries?.length) {
        filters.organization_industries = intent.icp.industries;
      }

      // Company size
      if (intent.icp.companySize) {
        filters.organization_num_employees_ranges = [intent.icp.companySize];
      }

      // Location
      if (intent.icp.locations?.length) {
        filters.person_locations = intent.icp.locations;
      }

      // Funding stage
      if (intent.icp.fundingStage?.length) {
        filters.organization_funding_stages = intent.icp.fundingStage;
      }

      // Technologies
      if (intent.icp.technologies?.length) {
        filters.organization_technologies = intent.icp.technologies;
      }

      // Signals/keywords
      if (intent.icp.signals?.length) {
        filters.q_keywords = intent.icp.signals;
      }
    }

    // Require verified emails by default for better data quality
    filters.email_verified = true;

    return filters;
  }

  /**
   * Transform Apollo data to Prospect format
   */
  private transformToProspect(
    person: ApolloPerson,
    org?: ApolloOrganization,
    score?: number,
    signals?: ProspectSignal[]
  ): Prospect {
    const fullName = person.name || `${person.first_name} ${person.last_name}`.trim();
    
    return {
      id: person.id,
      firstName: person.first_name,
      lastName: person.last_name,
      name: fullName,
      title: person.title || '',
      company: org?.name || '',
      companyDomain: org?.domain,
      industry: org?.industry,
      companySize: org?.size,
      location: [org?.location?.city, org?.location?.state, org?.location?.country]
        .filter(Boolean)
        .join(', ') || undefined,
      email: person.email || person.work_email || person.personal_email,
      phone: person.phone_numbers?.[0],
      linkedInUrl: person.linkedin_url,
      photoUrl: undefined, // Apollo doesn't provide photos directly
      score: score || this.calculateBaseScore(person, org),
      scoreGrade: this.calculateGrade(score || 0),
      signals: signals || this.detectSignals(person, org),
      lastContacted: undefined,
      lastContactType: undefined,
      enrichedAt: new Date(),
      confidence: this.calculateConfidence(person, org),
    };
  }

  /**
   * Enrich and score a batch of prospects
   */
  private async enrichAndScoreBatch(
    people: ApolloPerson[],
    organizations: ApolloOrganization[]
  ): Promise<Prospect[]> {
    return people.map(person => {
      const org = organizations.find(o => {
        const personDomain = person.email?.split('@')[1] || 
                            person.work_email?.split('@')[1];
        return o.domain === personDomain;
      });

      return this.transformToProspect(person, org);
    });
  }

  /**
   * Calculate base score from Apollo data
   */
  private calculateBaseScore(person: ApolloPerson, org?: ApolloOrganization): number {
    let score = 50;

    // Data completeness
    if (person.email || person.work_email) score += 10;
    if (person.linkedin_url) score += 5;
    if (person.phone_numbers?.length) score += 5;
    
    // Org quality
    if (org?.funding_stage) score += 10;
    if (org?.employee_count && org.employee_count > 50) score += 10;
    if (org?.technologies?.length) score += 5;
    if (org?.annual_revenue || org?.estimated_annual_revenue) score += 5;

    return Math.min(score, 100);
  }

  /**
   * Calculate letter grade from score
   */
  private calculateGrade(score: number): Prospect['scoreGrade'] {
    if (score >= 95) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 75) return 'B+';
    if (score >= 65) return 'B';
    if (score >= 50) return 'C';
    return 'D';
  }

  /**
   * Calculate confidence level
   */
  private calculateConfidence(person: ApolloPerson, org?: ApolloOrganization): number {
    let confidence = 50;

    if (person.email || person.work_email) confidence += 20;
    if (person.linkedin_url) confidence += 15;
    if (person.department) confidence += 10;
    if (org?.domain) confidence += 5;

    return Math.min(confidence, 100);
  }

  /**
   * Detect buying signals from Apollo data
   */
  private detectSignals(person: ApolloPerson, org?: ApolloOrganization): ProspectSignal[] {
    const signals: ProspectSignal[] = [];

    if (org?.funding_stage && org.funding_amount) {
      signals.push({
        type: 'funding',
        label: 'Recent Funding',
        description: `${org.funding_stage} round of $${org.funding_amount}`,
        timestamp: new Date(),
        source: 'Apollo',
        strength: 'high',
      });
    }

    if (org?.technologies && org.technologies.length > 0) {
      signals.push({
        type: 'tech_stack',
        label: 'Modern Tech Stack',
        description: `Uses ${org.technologies.slice(0, 3).join(', ')}`,
        timestamp: new Date(),
        source: 'Apollo',
        strength: 'medium',
      });
    }

    if (org?.keywords?.some(kw => kw.toLowerCase().includes('hiring') || kw.toLowerCase().includes('growth'))) {
      signals.push({
        type: 'hiring',
        label: 'Hiring Signal',
        description: 'Company shows growth/hiring signals',
        timestamp: new Date(),
        source: 'Apollo',
        strength: 'medium',
      });
    }

    return signals;
  }
}

// Singleton instance
let mcpClient: ApolloMCPClient | null = null;

export function getApolloMCPClient(
  apolloClient: ApolloClient,
  config: MCPConfig
): ApolloMCPClient {
  if (!mcpClient) {
    mcpClient = new ApolloMCPClient(apolloClient, config);
  }
  return mcpClient;
}

export default ApolloMCPClient;
