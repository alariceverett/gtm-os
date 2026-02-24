# Outreach Template Variables Dictionary (v1)

Canonical placeholder definitions for email/contact-form templates.

| Variable | Required | Example | Description |
|---|---|---|---|
| `{{restaurant_name}}` | yes | Lilia | Target restaurant name |
| `{{event_date}}` | yes | Thursday, March 19, 2026 | Preferred event date |
| `{{time_window}}` | yes | 7:00–8:30 PM | Preferred seating window |
| `{{party_size}}` | yes | 14 | Target headcount |
| `{{headcount_range}}` | no | 12–16 | Flex range for staffing/capacity |
| `{{budget_note}}` | no | ~$90/person before tax/tip | Budget framing |
| `{{dietary_accessibility_notes}}` | no | 2 vegetarian, 1 gluten-free; step-free access preferred | Constraints restaurants need |
| `{{fallback_time_option_1}}` | no | 6:30 PM | Backup slot option 1 |
| `{{fallback_time_option_2}}` | no | 8:45 PM | Backup slot option 2 |
| `{{occasion}}` | no | team celebration | Context for warm template |
| `{{sender_name}}` | yes | Alex Rivera | Organizer/contact person |
| `{{sender_contact}}` | yes | alex@email.com · (917) 555-0198 | Signature contact line |
| `{{sender_email}}` | yes (forms) | alex@email.com | Contact-form email field |
| `{{sender_phone}}` | no | (917) 555-0198 | Contact-form phone field |

## Validation Rules

- Always render `event_date`, `time_window`, and `party_size`; block send if missing.
- If `headcount_range` is omitted, derive from `party_size` (e.g., `party_size ± 2`).
- Cap `dietary_accessibility_notes` at 180 characters for contact-form safety.
- If both fallback options are missing, remove fallback sentence from template.
