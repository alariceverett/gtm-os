/**
 * Natural Language Command Parser
 * Converts free-form text → structured CommandIntent
 * Keywords: title, industry, size, location, signals
 */

import { CommandIntent } from '@/types';

// Keyword patterns for intent parsing
const PATTERNS = {
  // Action patterns
  actions: {
    research: /\b(find|search|get|look for|prospect|identify|discover|hunt)\b/gi,
    enrich: /\b(enrich|validate|verify|update|refresh|augment)\b/gi,
    campaign: /\b(create|build|launch|start|setup|make)\s+(?:a\s+)?(campaign|sequence|outreach)\b/gi,
    sequence: /\b(sequence|flow|drip|follow.up|multi.touch)\b/gi,
    analyze: /\b(analyze|review|report|insights|performance|metrics|stats)\b/gi,
    export: /\b(export|download|save|csv|spreadsheet)\b/gi,
  },

  // Title extraction patterns
  titles: {
    // Common executive titles
    cmo: /\bCMO\b|\bchief marketing officer\b/gi,
    cto: /\bCTO\b|\bchief technology officer\b/gi,
    coo: /\bCOO\b|\bchief operating officer\b/gi,
    cfo: /\bCFO\b|\bchief financial officer\b/gi,
    ceo: /\bCEO\b|\bchief executive officer\b/gi,
    vp: /\bVP\s+(?:of\s+)?([\w\s]+)|\bvice president(?:\s+of)?\s+([\w\s]+)/gi,
    director: /\bdirector(?:\s+of)?\s+([\w\s]+)|\b([\w\s]+)\s+director\b/gi,
    head: /\bhead\s+(?:of\s+)?([\w\s]+)/gi,
    manager: /\b([\w\s]+)\s+manager\b/gi,
    lead: /\b([\w\s]+)\s+lead\b|\blead\s+([\w\s]+)/gi,
    engineer: /\b(?:senior|staff|principal)?\s*(?:software|frontend|backend|full.?stack|devops|ml|data)\s+engineer\b/gi,
    generic: /\b([\w\s]{3,30}?)(?:\s+(?:at|from|in|@))|\btarget\s+([\w\s]+?)\s+(?:at|from)/gi,
  },

  // Industry patterns
  industries: {
    fintech: /\b(?:fin.?.?tech|financial\s+technology)\b/gi,
    saas: /\bsaa[s]?\b|\bsoftware\s+as\s+a\s+service\b/gi,
    healthtech: /\bhealth(?:care)?\s*(?:tech|technology)\b/gi,
    biotech: /\bbio(?:.?.?)?tech\b/gi,
    edtech: /\bed(?:ucation)?.?.?tech\b/gi,
    ecom: /\be.?.commerce\b|\bonline\s+retail\b/gi,
    marketplace: /\bmarketplace\b/gi,
    ai: /\bai\s+(?:company|startup|platform)|\bartificial\s+intelligence\b/gi,
    ml: /\bmachine\s+learning\b/gi,
    tech: /\b(?:software|tech|technology)\s+(?:company|startup|firm)\b/gi,
    enterprise: /\benterprise\s+(?:software|saas|tech)\b/gi,
  },

  // Company size patterns
  companySize: {
    startup: /\b(?:early\s+stage|seed|startup|pre.?.?series\s+a)\b/gi,
    small: /\bsmall\s+(?:company|team|startup)|\b(10|20|30|40|50)\s*(?:-|to|–)\s*(?:100|200)\s*(?:people|employees)\b/gi,
    mid: /\bmid.?.?size\b|\bmedium\s+size|\b(100|200|300|400|500)\s*(?:-|to|–)\s*(?:500|1000)\s*(?:people|employees)\b/gi,
    enterprise: /\benterprise\b|\blarge\s+(?:company|org|organization)|\b(1000|5000|10000)\+?\s*(?:people|employees|emps)\b/gi,
    seriesA: /\bseries\s*a\b/gi,
    seriesB: /\bseries\s*b\b|\bseries\s*b\+|\bb.?.?series\b/gi,
    seriesC: /\bseries\s*c\b/gi,
    seriesD: /\bseries\s*d\b/gi,
    growth: /\bgrowth\s+(?:stage|phase)|\blate.?.?stage\b/gi,
  },

  // Location patterns
  locations: {
    // Major US tech hubs
    nyc: /\b(?:new\s+york(?:\s+city)?|nyc)\b/gi,
    sf: /\b(?:san\s+francisco|sf|bay\s+area|silicon\s+valley)\b/gi,
    la: /\b(?:los\s+angeles|la)\b/gi,
    chicago: /\b(?:chicago|chi)\b/gi,
    boston: /\bboston\b/gi,
    austin: /\baustin\b/gi,
    seattle: /\bseattle\b/gi,
    denver: /\bdenver\b/gi,
    miami: /\bmiami\b/gi,
    atlanta: /\batlanta\b/gi,
    dallas: /\bdallas\b/gi,
    // International
    london: /\blondon\b/gi,
    toronto: /\btoronto\b/gi,
    berlin: /\bberlin\b/gi,
    paris: /\bparis\b/gi,
    // Generic location
    cityMatch: /\b(?:in|at|from|near)\s+([A-Z][\w\s]+(?:,\s*(?:CA|NY|TX|FL|WA|CO|MA|IL|GA))?)/g,
  },

  // Signal patterns
  signals: {
    hiring: /\b(?:hiring|recruiting|actively\s+hiring|hiring\s+spree|expanding\s+team)\b/gi,
    funding: /\b(?:just\s+raised|funding|series\s+[a-f]|recently\s+funded|valuation)\b/gi,
    growth: /\b(?:fast\s+growing|rapid\s+growth|scaling|expansion|expanding)\b/gi,
    layoffs: /\blayoffs?\b|\bdownsiz(?:ing|ed)\b|\brif\b/gi,
    acquisition: /\bacquisition|acquired|merger|ipo|went\s+public\b/gi,
    newProduct: /\bnew\s+(?:product|launch|feature|platform)\b/gi,
    hiringSignal: /\b(?:engineering|sales|marketing)\s+(?:recruiting|hiring)\b/gi,
    intent: /\b(showing\s+intent|in.market|evaluating|comparing|researching)\b/gi,
  },

  // Quality filters
  filters: {
    highScore: /\b(?:a\+|a\s+score|high\s+quality|top\s+(?:tier|10%))\b/gi,
    requireEmail: /\b(?:with\s+email|email\s+verified|has\s+email)\b/gi,
    requirePhone: /\b(?:with\s+phone|phone\s+number|direct\s+dial|has\s+phone)\b/gi,
    notContacted: /\b(?:not\s+contacted|never\s+emailed|new\s+prospects|fresh)\b/gi,
    minScore: /\bscore\s*(?::|above|over|>|greater\s+than)\s*(\d{1,3})\b/gi,
  },

  // Campaign/sequence patterns
  campaign: {
    name: /\b(?:called|named|\")(.+?)(?:\"|$|campaign|sequence)\b/gi,
    touches: /\b(\d)\s+(?:touch|step|email|message)(?:es)?\b/gi,
    variants: /\b(\d)\s+variant(?:s)?\b|\ba.?.?b\s+test\b/gi,
  },
};

// Title normalization map
const TITLE_MAP: Record<string, string[]> = {
  'CMO': ['cmo', 'chief marketing officer'],
  'CTO': ['cto', 'chief technology officer', 'chief technical officer'],
  'COO': ['coo', 'chief operating officer', 'chief operations officer'],
  'CFO': ['cfo', 'chief financial officer'],
  'CEO': ['ceo', 'chief executive officer'],
  'VP Sales': ['vp sales', 'vice president sales', 'head of sales'],
  'VP Marketing': ['vp marketing', 'vice president marketing', 'head of marketing'],
  'VP Engineering': ['vp engineering', 'vice president engineering', 'head of engineering'],
  'VP Product': ['vp product', 'vice president product', 'head of product'],
  'Sales Director': ['sales director', 'director of sales'],
  'Marketing Director': ['marketing director', 'director of marketing'],
  'Engineering Director': ['engineering director', 'director of engineering', 'director engineering'],
  'Product Director': ['product director', 'director of product'],
};

// Industry normalization
const INDUSTRY_MAP: Record<string, string> = {
  'fintech': 'Financial Services',
  'saas': 'Software',
  'healthtech': 'Healthcare Technology',
  'biotech': 'Biotechnology',
  'edtech': 'Education Technology',
  'ecommerce': 'E-commerce',
  'marketplace': 'Marketplace',
  'ai': 'Artificial Intelligence',
  'ml': 'Machine Learning',
  'enterprise': 'Enterprise Software',
  'tech': 'Technology',
};

// Size normalization
const SIZE_MAP: Record<string, string> = {
  'startup': '1-10',
  'small': '10-200',
  'mid': '200-1000',
  'enterprise': '1000+',
  'seriesA': '10-50',
  'seriesB': '50-200',
  'seriesC': '200-500',
  'seriesD': '500+',
  'growth': '200-1000',
};

// Location normalization
const LOCATION_MAP: Record<string, string> = {
  'nyc': 'New York',
  'sf': 'San Francisco',
  'la': 'Los Angeles',
  'chicago': 'Chicago',
  'boston': 'Boston',
  'austin': 'Austin',
  'seattle': 'Seattle',
  'denver': 'Denver',
  'miami': 'Miami',
  'atlanta': 'Atlanta',
  'dallas': 'Dallas',
  'london': 'London',
  'toronto': 'Toronto',
  'berlin': 'Berlin',
  'paris': 'Paris',
};

/**
 * Extract action type from input
 */
function detectAction(input: string): CommandIntent['action'] {
  for (const [action, pattern] of Object.entries(PATTERNS.actions)) {
    if (pattern.test(input) || input.toLowerCase().includes(action.toLowerCase())) {
      if (action === 'campaign' || action === 'sequence') return 'campaign';
      return action as CommandIntent['action'];
    }
  }
  return 'research'; // Default to research
}

/**
 * Extract titles from input
 */
function extractTitles(input: string): string[] {
  const titles: string[] = [];
  const normalizedInput = input.toLowerCase();

  // Check title patterns
  for (const [key, pattern] of Object.entries(PATTERNS.titles)) {
    const matches = [...input.matchAll(pattern)];
    
    for (const match of matches) {
      let title = '';
      
      // Check against TITLE_MAP
      for (const [canonical, variants] of Object.entries(TITLE_MAP)) {
        if (variants.some(v => normalizedInput.includes(v))) {
          titles.push(canonical);
          break;
        }
      }
    }
  }

  // Remove duplicates
  return [...new Set(titles)];
}

/**
 * Extract industries from input
 */
function extractIndustries(input: string): string[] {
  const industries: string[] = [];
  const normalizedInput = input.toLowerCase();

  for (const [key, pattern] of Object.entries(PATTERNS.industries)) {
    if (pattern.test(input)) {
      const mapped = INDUSTRY_MAP[key] || key;
      if (!industries.includes(mapped)) {
        industries.push(mapped);
      }
    }
  }

  return industries;
}

/**
 * Extract company size from input
 */
function extractCompanySize(input: string): string | undefined {
  const normalizedInput = input.toLowerCase();

  for (const [key, pattern] of Object.entries(PATTERNS.companySize)) {
    if (pattern.test(input)) {
      return SIZE_MAP[key] || key;
    }
  }

  return undefined;
}

/**
 * Extract locations from input
 */
function extractLocations(input: string): string[] {
  const locations: string[] = [];

  for (const [key, pattern] of Object.entries(PATTERNS.locations)) {
    if (key === 'cityMatch') continue;
    
    if (pattern.test(input)) {
      const mapped = LOCATION_MAP[key.toLowerCase()] || key;
      if (!locations.includes(mapped)) {
        locations.push(mapped);
      }
    }
  }

  // Try cityMatch pattern
  const cityMatches = [...input.matchAll(PATTERNS.locations.cityMatch)];
  for (const match of cityMatches) {
    if (match[1]) {
      locations.push(match[1].trim());
    }
  }

  return [...new Set(locations)];
}

/**
 * Extract signals from input
 */
function extractSignals(input: string): string[] {
  const signals: string[] = [];

  for (const [key, pattern] of Object.entries(PATTERNS.signals)) {
    if (pattern.test(input)) {
      signals.push(key);
    }
  }

  return signals;
}

/**
 * Extract funding stage
 */
function extractFundingStage(input: string): string[] | undefined {
  const stages: string[] = [];
  const normalizedInput = input.toLowerCase();

  if (/\bseries\s*a\b/.test(input)) stages.push('series_a');
  if (/\bseries\s*b(?:\+)?\b/.test(input)) stages.push('series_b');
  if (/\bseries\s*c\b/.test(input)) stages.push('series_c');
  if (/\bseries\s*d\b/.test(input)) stages.push('series_d');
  if (/\bseed\b/.test(input)) stages.push('seed');
  if (/\bpre.seed\b/.test(input)) stages.push('pre_seed');
  if (/\bgrowth\b/.test(input) || /\blate.stage\b/.test(input)) stages.push('growth');

  return stages.length > 0 ? stages : undefined;
}

/**
 * Extract filters from input
 */
function extractFilters(input: string): CommandIntent['filters'] {
  const filters: CommandIntent['filters'] = {};

  if (PATTERNS.filters.requireEmail.test(input) || input.toLowerCase().includes('email')) {
    filters.requireEmail = true;
  }

  if (PATTERNS.filters.requirePhone.test(input)) {
    filters.requirePhone = true;
  }

  if (PATTERNS.filters.notContacted.test(input)) {
    filters.excludeContacted = true;
  }

  const minScoreMatch = input.match(PATTERNS.filters.minScore);
  if (minScoreMatch) {
    filters.minScore = parseInt(minScoreMatch[1], 10);
  }

  return Object.keys(filters).length > 0 ? filters : undefined;
}

/**
 * Extract campaign info from input
 */
function extractCampaignInfo(input: string): CommandIntent['campaign'] {
  const campaign: CommandIntent['campaign'] = {};

  const nameMatch = input.match(PATTERNS.campaign.name);
  if (nameMatch) {
    campaign.name = nameMatch[1].trim();
  }

  const touchesMatch = input.match(PATTERNS.campaign.touches);
  if (touchesMatch) {
    campaign.touchCount = parseInt(touchesMatch[1], 10);
  }

  if (PATTERNS.campaign.variants.test(input)) {
    campaign.variantCount = 2; // Default A/B
  }

  return Object.keys(campaign).length > 0 ? campaign : undefined;
}

/**
 * Calculate parsing confidence
 */
function calculateConfidence(
  input: string,
  intent: Partial<CommandIntent>
): number {
  let confidence = 0.5; // Base confidence

  // Increase confidence based on extracted data
  if (intent.icp?.titles?.length) confidence += 0.15;
  if (intent.icp?.industries?.length) confidence += 0.15;
  if (intent.icp?.locations?.length) confidence += 0.1;
  if (intent.icp?.signals?.length) confidence += 0.1;
  if (intent.icp?.companySize) confidence += 0.1;
  if (intent.icp?.fundingStage?.length) confidence += 0.1;

  // Penalize very short queries
  if (input.length < 20) confidence -= 0.2;

  // Bonus for clear action verbs
  if (/\b(find|search|get|create|build|launch)\b/gi.test(input)) {
    confidence += 0.1;
  }

  return Math.min(Math.max(confidence, 0), 1);
}

/**
 * Main parse function
 * Converts natural language → structured CommandIntent
 */
export function parseCommand(input: string): CommandIntent {
  const normalizedInput = input.trim();
  
  const action = detectAction(normalizedInput);
  
  // Extract ICP criteria
  const titles = extractTitles(normalizedInput);
  const industries = extractIndustries(normalizedInput);
  const locations = extractLocations(normalizedInput);
  const signals = extractSignals(normalizedInput);
  const companySize = extractCompanySize(normalizedInput);
  const fundingStage = extractFundingStage(normalizedInput);
  
  const icp: CommandIntent['icp'] = {
    ...(titles.length > 0 && { titles }),
    ...(industries.length > 0 && { industries }),
    ...(locations.length > 0 && { locations }),
    ...(signals.length > 0 && { signals }),
    ...(companySize && { companySize }),
    ...(fundingStage && { fundingStage }),
  };

  const filters = extractFilters(normalizedInput);
  const campaign = action === 'campaign' || action === 'sequence' 
    ? extractCampaignInfo(normalizedInput)
    : undefined;

  const intent: CommandIntent = {
    action,
    icp: Object.keys(icp).length > 0 ? icp : undefined,
    filters,
    campaign,
    query: normalizedInput,
    rawInput: normalizedInput,
    confidence: 0,
  };

  // Calculate final confidence
  intent.confidence = calculateConfidence(normalizedInput, intent);

  return intent;
}

/**
 * Parse command with suggestions fallback
 */
export function parseCommandWithSuggestions(input: string): {
  intent: CommandIntent;
  suggestions: string[];
} {
  const intent = parseCommand(input);
  const suggestions: string[] = [];

  // Low confidence suggestions
  if (intent.confidence < 0.5) {
    if (!intent.icp?.titles?.length) {
      suggestions.push('Try specifying a job title, like "CTOs at fintechs"');
    }
    if (!intent.icp?.industries?.length) {
      suggestions.push('Add an industry, like "in healthcare or SaaS"');
    }
    if (!intent.icp?.locations?.length) {
      suggestions.push('Specify a location like "in San Francisco" or "remote-friendly"');
    }
  }

  // Context-aware suggestions based on what was extracted
  if (intent.icp?.titles?.length && !intent.icp.signals?.length) {
    suggestions.push('Add buying signals like "recently funded" or "actively hiring"');
  }

  if (intent.action === 'research' && !intent.icp?.companySize) {
    suggestions.push('Filter by company size: "Series B+" or "200-500 employees"');
  }

  return { intent, suggestions };
}

/**
 * Format intent as human-readable description
 */
export function formatIntentDescription(intent: CommandIntent): string {
  const parts: string[] = [];

  // Action
  const actionVerbs: Record<CommandIntent['action'], string> = {
    research: 'Find',
    enrich: 'Enrich',
    campaign: 'Create campaign for',
    sequence: 'Build sequence for',
    analyze: 'Analyze',
    export: 'Export',
  };

  parts.push(actionVerbs[intent.action] || 'Find');

  // ICP description
  const icpParts: string[] = [];
  
  if (intent.icp?.titles?.length) {
    icpParts.push(intent.icp.titles.join(', '));
  }

  if (intent.icp?.industries?.length) {
    const industryText = intent.icp.industries.length === 1 
      ? intent.icp.industries[0]
      : intent.icp.industries.join(' or ');
    icpParts.push(`at ${industryText} companies`);
  }

  if (intent.icp?.companySize) {
    icpParts.push(`(${intent.icp.companySize} employees)`);
  }

  if (intent.icp?.fundingStage?.length) {
    const stages = intent.icp.fundingStage.map(s => s.replace('_', ' ').toUpperCase());
    icpParts.push(`that raised ${stages.join(' or ')}`);
  }

  if (intent.icp?.locations?.length) {
    icpParts.push(`in ${intent.icp.locations.join(', ')}`);
  }

  if (intent.icp?.signals?.length) {
    const signalText = intent.icp.signals.map(s => 
      s.replace(/([A-Z])/g, ' $1').toLowerCase()
    ).join(', ');
    icpParts.push(`showing signals: ${signalText}`);
  }

  if (icpParts.length > 0) {
    parts.push(icpParts.join(' '));
  } else {
    parts.push('contacts matching your query');
  }

  // Filters
  if (intent.filters) {
    const filterParts: string[] = [];
    if (intent.filters.minScore) filterParts.push(`score ≥ ${intent.filters.minScore}`);
    if (intent.filters.requireEmail) filterParts.push('with verified emails');
    if (intent.filters.requirePhone) filterParts.push('with phone numbers');
    
    if (filterParts.length > 0) {
      parts.push(`(${filterParts.join(', ')})`);
    }
  }

  return parts.join(' ');
}

export default parseCommand;
