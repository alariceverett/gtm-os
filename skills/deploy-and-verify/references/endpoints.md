# Critical Endpoints — {YOUR_DOMAIN}

| Endpoint | Method | Expected Status | Expected Response |
|---|---|---|---|
| `/` | GET | 200 | HTML containing `<title>` |
| `/command-center` | GET | 200 | HTML content |
| `/api/cc-data?section=overview` | GET | 200 | JSON with `"data"` key |
| `/api/cc-data?section=skills` | GET | 200 | JSON with `"data"` key |

## Response Validation

- All HTML pages must return `Content-Type` containing `text/html`
- All API endpoints must return valid JSON
- API responses must contain a top-level `"data"` key
- Any 500 status indicates deployment failure
- Any 404 on known endpoints indicates build/routing failure
