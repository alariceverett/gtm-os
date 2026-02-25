/**
 * Apollo.io MCP Client
 * Model Context Protocol client for prospect search and enrichment
 * @see https://www.apollo.io/
 */

export interface ApolloConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface ApolloPerson {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  linkedin_url?: string;
  title: string;
  email?: string;
  work_email?: string;
  personal_email?: string;
  phone_numbers?: string[];
  department?: string;
  subdepartments?: string[];
  seniority?: string;
  contact_stage?: string;
  owner?: string;
}

export interface ApolloOrganization {
  id: string;
  name: string;
  domain?: string;
  website_url?: string;
  linkedin_url?: string;
  twitter_url?: string;
  facebook_url?: string;
  phone?: string;
  industry?: string;
  subindustry?: string;
  size?: string;
  employee_count?: number;
  annual_revenue?: string;
  estimated_annual_revenue?: number;
  revenue_range?: string;
  funding_total?: string;
  funding_amount?: number;
  funding_stage?: string;
  founded_year?: number;
  location?: {
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
  };
  technologies?: string[];
  keywords?: string[];
}

export interface ApolloSearchResult {
  people: ApolloPerson[];
  organizations: ApolloOrganization[];
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
}

export interface ApolloSearchFilters {
  // Person filters
  person_titles?: string[];
  person_seniorities?: string[];
  person_departments?: string[];
  person_locations?: string[];
  person_location_radius?: number; // miles
  person_location_radius_unit?: 'miles' | 'kilometers';
  q_keywords?: string[];
  
  // Organization filters
  organization_ids?: string[];
  organization_names?: string[];
  organization_domains?: string[];
  organization_locations?: string[];
  organization_industry_tag_ids?: number[];
  organization_industries?: string[];
  organization_size?: string[];
  organization_num_employees_ranges?: string[];
  organization_revenue_ranges?: string[];
  organization_funding_stages?: string[];
  organization_funding_amount_ranges?: string[];
  organization_technologies?: string[];
  organization_keywords?: string[];
  
  // Email/Contact filters
  contact_email_status?: ('verified' | 'unverified' | 'bounce' | 'catch_all')[];
  email_verified?: boolean;
  has_direct_dial?: boolean;
  
  // Pagination
  page?: number;
  per_page?: number;
  sort_by_field?: string;
  sort_ascending?: boolean;
}

export interface ApolloEnrichmentResult {
  person?: ApolloPerson;
  organization?: ApolloOrganization;
  confidence_score?: number;
  match_reasons?: string[];
}

const DEFAULT_CONFIG: Partial<ApolloConfig> = {
  baseUrl: 'https://api.apollo.io/v1',
  timeout: 30000,
  maxRetries: 3,
};

/**
 * Apollo API Error
 */
export class ApolloApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'ApolloApiError';
  }
}

/**
 * Apollo MCP Client
 * Handles all communication with Apollo.io API
 */
export class ApolloClient {
  private config: Required<ApolloConfig>;
  private rateLimitRemaining: number = 1000;
  private rateLimitReset: Date | null = null;

  constructor(config: ApolloConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<ApolloConfig>;
    
    if (!this.config.apiKey) {
      throw new Error('Apollo API key is required');
    }
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(endpoint: string, params?: Record<string, unknown>): string {
    const url = new URL(endpoint, this.config.baseUrl);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => url.searchParams.append(`${key}[]`, String(v)));
          } else {
            url.searchParams.set(key, String(value));
          }
        }
      });
    }
    
    return url.toString();
  }

  /**
   * Make authenticated API request with retry logic
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    params?: Record<string, unknown>
  ): Promise<T> {
    const url = this.buildUrl(endpoint, params);
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        // Check rate limits
        if (this.rateLimitRemaining <= 0 && this.rateLimitReset) {
          const waitMs = this.rateLimitReset.getTime() - Date.now();
          if (waitMs > 0) {
            await new Promise(resolve => setTimeout(resolve, waitMs));
          }
        }

        const response = await fetch(url, {
          ...options,
          headers: {
            'X-Api-Key': this.config.apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'AdZeta-MCP/1.0',
            ...options.headers,
          },
        });

        // Update rate limit info
        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
        const rateLimitReset = response.headers.get('X-RateLimit-Reset');
        
        if (rateLimitRemaining) {
          this.rateLimitRemaining = parseInt(rateLimitRemaining, 10);
        }
        if (rateLimitReset) {
          this.rateLimitReset = new Date(parseInt(rateLimitReset, 10) * 1000);
        }

        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText };
          }

          // Retry on rate limit or server errors
          if (response.status === 429 || response.status >= 500) {
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          throw new ApolloApiError(
            errorData.error || `Apollo API error: ${response.statusText}`,
            response.status,
            errorData
          );
        }

        return await response.json() as T;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors
        if (error instanceof ApolloApiError && error.statusCode && error.statusCode < 500) {
          throw error;
        }

        if (attempt < this.config.maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Search for prospects using Apollo's mixed search
   */
  async searchProspects(filters: ApolloSearchFilters): Promise<ApolloSearchResult> {
    const result = await this.request<ApolloSearchResult>(
      '/mixed_people/search',
      {
        method: 'POST',
        body: JSON.stringify({ ...filters }),
      }
    );
    
    return result;
  }

  /**
   * Search for companies
   */
  async searchOrganizations(filters: ApolloSearchFilters): Promise<ApolloSearchResult> {
    const result = await this.request<ApolloSearchResult>(
      '/organizations/search',
      {
        method: 'POST',
        body: JSON.stringify({ ...filters }),
      }
    );
    
    return result;
  }

  /**
   * Enrich person by email
   */
  async enrichPersonByEmail(email: string, revealOnDemand?: boolean): Promise<ApolloEnrichmentResult> {
    return this.request<ApolloEnrichmentResult>(
      '/people/match',
      {
        method: 'POST',
        body: JSON.stringify({
          email,
          reveal_personal_emails: revealOnDemand ?? false,
          reveal_phone_number: revealOnDemand ?? false,
        }),
      }
    );
  }

  /**
   * Enrich person by LinkedIn URL
   */
  async enrichPersonByLinkedIn(linkedinUrl: string): Promise<ApolloEnrichmentResult> {
    return this.request<ApolloEnrichmentResult>(
      '/people/match',
      {
        method: 'POST',
        body: JSON.stringify({ linkedin_url: linkedinUrl }),
      }
    );
  }

  /**
   * Bulk enrich multiple people
   */
  async bulkEnrichPeople(emails: string[]): Promise<ApolloEnrichmentResult[]> {
    const results: ApolloEnrichmentResult[] = [];
    
    // Process in batches of 10 (Apollo limit)
    const batchSize = 10;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const response = await this.request<{ mappings?: Record<string, ApolloEnrichmentResult> }>(
        '/people/bulk_match',
        {
          method: 'POST',
          body: JSON.stringify({
            email: batch,
            first_name: [],
            last_name: [],
            organization_name: [],
            domain: [],
          }),
        }
      );
      
      if (response.mappings) {
        results.push(...Object.values(response.mappings));
      }
      
      // Small delay between batches
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  /**
   * Enrich company by domain
   */
  async enrichOrganizationByDomain(domain: string): Promise<ApolloOrganization> {
    const result = await this.request<{ organization?: ApolloOrganization }>(
      '/organizations/enrich',
      {
        method: 'POST',
        body: JSON.stringify({ domain }),
      }
    );
    
    if (!result.organization) {
      throw new ApolloApiError('Organization not found', 404);
    }
    
    return result.organization;
  }

  /**
   * Get contact stages for workflow
   */
  async getContactStages(): Promise<string[]> {
    const result = await this.request<{ contact_stages: string[] }>(
      '/contact_stages',
      { method: 'GET' }
    );
    return result.contact_stages;
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): { remaining: number; resetAt: Date | null } {
    return {
      remaining: this.rateLimitRemaining,
      resetAt: this.rateLimitReset,
    };
  }
}

/**
 * Create Apollo client from environment variables
 */
export function createApolloClientFromEnv(): ApolloClient {
  const apiKey = process.env.APOLLO_API_KEY;
  
  if (!apiKey) {
    throw new Error('APOLLO_API_KEY environment variable is required');
  }
  
  return new ApolloClient({
    apiKey,
    baseUrl: process.env.APOLLO_BASE_URL,
    timeout: process.env.APOLLO_TIMEOUT ? parseInt(process.env.APOLLO_TIMEOUT, 10) : undefined,
    maxRetries: process.env.APOLLO_MAX_RETRIES ? parseInt(process.env.APOLLO_MAX_RETRIES, 10) : undefined,
  });
}

export default ApolloClient;
