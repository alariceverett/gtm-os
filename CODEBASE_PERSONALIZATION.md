# CODEBASE_PERSONALIZATION.md

## Personalization Engine + API Endpoints Documentation

**Phase 2A Foundation - Email Sequences System**

---

## Table of Contents

1. [Personalization Engine](#personalization-engine)
2. [API Endpoints](#api-endpoints)
3. [Validation](#validation)
4. [Database Schema](#database-schema)
5. [API Examples](#api-examples)
6. [Test Coverage](#test-coverage)

---

## Personalization Engine

Located in: `lib/personalization.ts`

### Supported Tokens

| Token | Source | Fallback |
|-------|--------|----------|
| `{{first_name}}` | prospect.first_name | "there" |
| `{{last_name}}` | prospect.last_name | "friend" |
| `{{company}}` | prospect.company | "your company" |
| `{{title}}` | prospect.title | "professional" |
| `{{industry}}` | prospect.industry | "your industry" |
| `{{tech_stack}}` | prospect.tech_stack | "your current stack" |
| `{{days_since_research}}` | context.days_since_research | "recently" |

### Features

#### 1. Basic Token Replacement
```typescript
import { personalize } from '@/lib/personalization';

const result = personalize(
  'Hello {{first_name}}, welcome to {{company}}',
  {
    prospect: { first_name: 'John', company: 'Acme Corp' }
  }
);
// Result: { text: "Hello John, welcome to Acme Corp", replaced: ["first_name", "company"], ... }
```

#### 2. Fallback Values
```typescript
const result = personalize(
  'Hi {{first_name|there}}',
  { prospect: {} } // first_name is undefined
);
// Result: "Hi there"
```

#### 3. Nested Object Access
```typescript
const result = personalize(
  'Contact at {{company.name}}',
  {
    prospect: { company: { name: 'TechCorp' } }
  }
);
// Result: "Contact at TechCorp"
```

#### 4. Conditional Blocks
```typescript
const template = '{{#if first_name}}Hello {{first_name}}{{/if}}{{#unless first_name}}Hello there{{/unless}}';

const withName = personalize(template, { prospect: { first_name: 'John' } }).text;
// "Hello John"

const withoutName = personalize(template, { prospect: {} }).text;
// "Hello there"
```

#### 5. HTML Escaping (Default: true)
```typescript
const result = personalize('{{script}}', {
  prospect: { script: '<script>alert("xss")</script>' }
});
// Result: "&lt;script&gt;..."

const safe = personalize('{{b}}', {
  prospect: { b: '<b>Bold</b>' }
}, { escapeHtml: false });
// Result: "<b>Bold</b>"
```

#### 6. Date Formatting
```typescript
const result = personalize('Research from {{days_since_research}} days ago', {
  prospect: {},
  days_since_research: 3
});
// Result: "Research from 3 days ago"
```

### API Functions

```typescript
// Personalize single text
function personalize(
  template: string,
  context: PersonalizationContext,
  options?: PersonalizationOptions
): PersonalizationResult;

// Personalize email (subject + body)
function personalizeEmail(
  subject: string,
  body: string,
  context: PersonalizationContext,
  options?: PersonalizationOptions
): { subject: string; body: string; tokens: string[]; missing: string[] };

// Extract tokens from template
function extractTokens(template: string): string[];

// Validate template
function validateTemplate(template: string, requiredFields?: string[]): 
  { valid: boolean; errors: string[] };

// Preview with sample data
function previewTemplate(subject: string, body: string, options?: PersonalizationOptions):
  { subject: string; body: string; tokens: string[] };
```

---

## API Endpoints

### Sequences API

**Base:** `/api/sequences`

#### List Sequences
```
GET /api/sequences?status=active&limit=20&offset=0
```

**Query Parameters:**
- `status` (optional): 'all' | 'draft' | 'active' | 'paused' | 'archived'
- `sequence_type` (optional): 'cold_outreach' | 'nurture' | 're_engagement' | 'follow_up'
- `limit` (optional): number (1-100, default: 20)
- `offset` (optional): number (default: 0)
- `search` (optional): string

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "slug": "cold-outreach-v1",
      "name": "Cold Outreach Sequence",
      "sequence_type": "cold_outreach",
      "status": "active",
      "total_enrolled": 150,
      "step_count": 5
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 150,
    "has_more": true
  }
}
```

#### Create Sequence
```
POST /api/sequences
```

**Request Body:**
```json
{
  "slug": "nurture-sequence",
  "name": "Nurture Campaign",
  "sequence_type": "nurture",
  "status": "draft",
  "steps": [
    {
      "step_number": 0,
      "template_id": "uuid",
      "wait_days": 0,
      "send_window_start": "09:00",
      "send_window_end": "17:00"
    },
    {
      "step_number": 1,
      "template_id": "uuid",
      "wait_days": 3,
      "condition_config": {
        "skip_if_opened_prev": true
      }
    }
  ]
}
```

#### Get Sequence
```
GET /api/sequences/:id
```

**Response includes steps and analytics.**

#### Update Sequence
```
PUT /api/sequences/:id
```

**Request Body:** (any sequence fields)
```json
{
  "name": "Updated Name",
  "status": "active",
  "steps": [...]  // Optional - replaces all steps
}
```

#### Delete Sequence (Soft)
```
DELETE /api/sequences/:id
```

Sets status to 'archived'.

---

### Templates API

**Base:** `/api/templates`

#### List Templates
```
GET /api/templates?status=active&category=outreach
```

**Query Parameters:**
- `status` (optional): 'all' | 'draft' | 'active' | 'archived'
- `category` (optional): string
- `limit`, `offset`, `search` (optional)

#### Create Template
```
POST /api/templates
```

**Request Body:**
```json
{
  "slug": "welcome-email",
  "name": "Welcome Email",
  "subject": "Welcome {{first_name}}, thanks for joining {{company}}!",
  "body_text": "Hi {{first_name|there}},\n\nWe're excited to have you at {{company}}...",
  "body_html": "<p>Hi {{first_name|there}}</p>...",
  "tokens_used": ["first_name", "company"],
  "category": "outreach",
  "status": "draft"
}
```

#### Get Template
```
GET /api/templates/:id
```

#### Update Template
```
PUT /api/templates/:id
```

#### Preview Template
```
POST /api/templates/:id/preview
```

**Request Body (optional):**
```json
{
  "customContext": {
    "first_name": "Test",
    "company": "TestCorp"
  }
}
```

---

### Enrollments API

**Base:** `/api/enrollments`

#### List Enrollments
```
GET /api/enrollments?status=active&sequence_id=uuid
```

**Query Parameters:**
- `sequence_id` (optional): UUID
- `status` (optional): 'all' | 'pending' | 'active' | 'paused' | 'completed' | 'cancelled' | 'bounced'

#### Enroll Prospect
```
POST /api/enrollments
```

**Request Body:**
```json
{
  "sequence_id": "uuid",
  "prospect_id": "uuid",
  "assigned_variant": "control",
  "start_immediately": true,
  "initial_context": {
    "source": "linkedin"
  }
}
```

**OR for bulk enrollment:**
```json
{
  "sequence_id": "uuid",
  "prospect_ids": ["uuid1", "uuid2", "uuid3"],
  "start_immediately": false,
  "scheduled_for": "2026-03-01T09:00:00Z"
}
```

#### Get Enrollment
```
GET /api/enrollments/:id
```

Returns enrollment with sends and events.

#### Update Enrollment (Pause/Resume)
```
PUT /api/enrollments/:id
```

**Request Body:**
```json
{
  "action": "pause"  // or "resume"
}
```

#### Cancel Enrollment
```
DELETE /api/enrollments/:id
```

Sets status to 'cancelled' and cancels pending sends.

---

## Validation

Located in: `lib/validation.ts`

All API endpoints use validation functions:

```typescript
// Sequence validation
validateCreateSequence(body): { valid: boolean, errors: string[] }
validateUpdateSequence(body): { valid: boolean, errors: string[] }
validateSequenceQuery(params): { valid: boolean, errors: string[] }

// Template validation
validateCreateTemplate(body): { valid: boolean, errors: string[] }
validateUpdateTemplate(body): { valid: boolean, errors: string[] }
validateTemplateQuery(params): { valid: boolean, errors: string[] }

// Enrollment validation
validateCreateEnrollment(body): { valid: boolean, errors: string[] }
validateBulkEnrollment(body): { valid: boolean, errors: string[] }
validateEnrollmentQuery(params): { valid: boolean, errors: string[] }
```

---

## Database Schema

### Tables Created by Migration

1. `email_templates` - Reusable templates with tokens
2. `email_sequences` - Multi-step sequence definitions
3. `email_sequence_steps` - Individual steps with timing
4. `sequence_enrollments` - Prospect enrollment tracking
5. `email_sends` - Queue & send history
6. `email_events` - Open, click, reply tracking

**See:** `migrations/004_email_sequences_core.sql`

---

## API Examples

### Create Sequence with Steps

```bash
curl -X POST http://localhost:3000/api/sequences \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "cold-outreach-v1",
    "name": "Cold Outreach Sequence",
    "sequence_type": "cold_outreach",
    "steps": [
      {
        "step_number": 0,
        "template_id": "550e8400-e29b-41d4-a716-446655440000",
        "wait_days": 0,
        "send_window_start": "09:00",
        "send_window_end": "17:00"
      },
      {
        "step_number": 1,
        "template_id": "550e8400-e29b-41d4-a716-446655440001",
        "wait_days": 3,
        "condition_config": {"skip_if_replied": true}
      }
    ]
  }'
```

### Enroll Prospect

```bash
curl -X POST http://localhost:3000/api/enrollments \
  -H "Content-Type: application/json" \
  -d '{
    "sequence_id": "550e8400-e29b-41d4-a716-446655440000",
    "prospect_id": "550e8400-e29b-41d4-a716-446655440002",
    "start_immediately": true
  }'
```

### Personalize Template

```typescript
import { personalize } from '@/lib/personalization';

const template = "Hi {{first_name|there}},\n\nI noticed {{company.name}} is hiring for {{title}} positions...";

const result = personalize(template, {
  prospect: {
    first_name: 'Sarah',
    company: { name: 'TechCorp' },
    title: 'Engineering Manager'
  },
  days_since_research: 2
});

// Output: "Hi Sarah,\n\nI noticed TechCorp is hiring for Engineering Manager positions..."
```

---

## Test Coverage

**Tests Location:** `lib/personalization.test.ts`

### Running Tests

```bash
npm test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Coverage Targets

- Lines: >80%
- Functions: >80%
- Branches: >80%
- Statements: >80%

### Test Categories

1. **Token Extraction** - `extractTokens()`
2. **Value Resolution** - `getNestedValue()`
3. **Token Parsing** - `parseToken()`
4. **Basic Personalization** - Simple token replacement
5. **Nested Access** - Dot notation paths
6. **Fallback Values** - Default handling
7. **Conditional Blocks** - #if and #unless
8. **HTML Escaping** - XSS prevention
9. **Edge Cases** - Empty templates, special characters, arrays

---

## Architecture

### Server-Side Supabase Client

Create a server-side Supabase client for API routes:

```typescript
// lib/supabase/server.ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }
  
  return createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
```

### RLS Compliance

All API endpoints respect Row Level Security policies:
- Users can only access their own sequences, templates, and enrollments
- Created by `created_by` field filtering
- Soft deletes via status changes

---

## Migration Status

✅ Personalization Engine (`lib/personalization.ts`)
✅ Validation Schemas (`lib/validation.ts`)
✅ Sequence API Routes
✅ Template API Routes
✅ Enrollment API Routes
✅ Unit Tests for Personalization
⏳ Supabase client helper (needs implementation in target app)

**Files Created:**
- `lib/personalization.ts`
- `lib/personalization.test.ts`
- `lib/validation.ts`
- `apps/gtm-command-center/src/app/api/sequences/route.ts`
- `apps/gtm-command-center/src/app/api/sequences/[id].ts`
- `apps/gtm-command-center/src/app/api/templates/route.ts`
- `apps/gtm-command-center/src/app/api/templates/[id].ts`
- `apps/gtm-command-center/src/app/api/enrollments/route.ts`
- `apps/gtm-command-center/src/app/api/enrollments/[id].ts`
- `CODEBASE_PERSONALIZATION.md` (this file)

---

**Last Updated:** 2026-02-25
