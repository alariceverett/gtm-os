# Contact Form Copy (Large Party Inquiry) — v1

Use when no direct email is available.

## Subject / Topic field

`Group Dining Inquiry: {{event_date}} for {{party_size}} guests`

## Message field (standard)

Hi {{restaurant_name}} team,

I’m inquiring about group dining availability for:
- Date: {{event_date}}
- Time: {{time_window}}
- Party size: {{party_size}} (range {{headcount_range}})
- Budget: {{budget_note}}
- Dietary/accessibility notes: {{dietary_accessibility_notes}}

If available, please share terms (minimum spend, deposit, menu options, and cancellation policy).

Fallback times: {{fallback_time_option_1}} or {{fallback_time_option_2}}.

Thank you,
{{sender_name}}
{{sender_email}}
{{sender_phone}}

## Message field (short character-limit version)

Hi — group dining request: {{event_date}}, {{time_window}}, {{party_size}} guests ({{headcount_range}}), budget {{budget_note}}. Please share availability + terms (min spend/deposit/menu/cancel policy). Thanks, {{sender_name}} {{sender_email}}

## Required field mapping checklist

- Name -> `{{sender_name}}`
- Email -> `{{sender_email}}`
- Phone -> `{{sender_phone}}`
- Party size -> `{{party_size}}`
- Date -> `{{event_date}}`
- Time -> `{{time_window}}`
- Notes -> include budget + dietary/accessibility

## Submission logging notes

When submitting a contact form:
- Set outbound `channel = contact_form`
- Persist exact submitted copy in `outreach_messages.body`
- Include `template_id` and `step` in `structured_result`
