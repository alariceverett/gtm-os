# GTM.adzeta.io URL Configuration Checklist

## Supabase Authentication Settings

### 1. Site URL (Required)
**Location:** Supabase Dashboard → Authentication → URL Configuration

Set to:
```
https://gtm.adzeta.io
```

### 2. Redirect URLs (Required)
Add these allowed redirect URLs:

```
https://gtm.adzeta.io/auth/callback
https://gtm.adzeta.io/**
```

**Note:** The wildcard `**` allows any sub-path after the domain.

### 3. Additional Redirect URLs (For Testing)
If you want to test locally before production:
```
http://localhost:3000/**
http://localhost:3001/**
```

---

## Google OAuth Configuration

### 4. Authorized Redirect URIs (in Google Cloud Console)
Go to: [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → Your OAuth 2.0 Client

Add:
```
https://hqhliqjpovtncrwbhlpx.supabase.co/auth/v1/callback
```

This is your Supabase Auth callback URL, NOT your app URL. Supabase handles the redirect to your app.

---

## Vercel Configuration

### 5. Custom Domain (Already Set)
If Vercel project is linked to `gtm.adzeta.io`, verify:
- Go to [vercel.com/dashboard](https://vercel.com/dashboard) → Your project → Settings → Domains
- Confirm `gtm.adzeta.io` is listed and configured

---

## CORS Origins (Already Configured)

### 6. Check middleware.ts
Your `middleware.ts` already has:
```typescript
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'https://gtm.adzeta.io',
  'https://app.adzeta.io'
]
```

✅ This is correct for cross-domain auth.

---

## Summary: URLs You NEED to Configure

| Service | URL | Status |
|---------|-----|--------|
| Supabase Site URL | `https://gtm.adzeta.io` | ⏳ Check needed |
| Supabase Redirect URLs | `https://gtm.adzeta.io/auth/callback` | ⏳ Check needed |
| Google OAuth | `https://hqhliqjpovtncrwbhlpx.supabase.co/auth/v1/callback` | ⏳ Likely needs update |
| Vercel Custom Domain | `gtm.adzeta.io` | ✅ Likely set |

---

## Quick Test

After configuring, test the auth flow:

1. Open `https://gtm.adzeta.io`
2. Click "Sign in with Google"
3. Should redirect to Google → authorize → back to `/auth/callback` → dashboard

If you get a "redirect_uri_mismatch" error, the Google OAuth URL needs fixing.

---

## Cross-Domain Auth Notes

**Session cookie domain:**
Supabase cookies are scoped to the domain. Both `app.adzeta.io` and `gtm.adzeta.io` should share the session if configured correctly, but they'll need separate login flows unless you set up custom cookie domain handling.

**For true cross-domain SSO:**
You'd need to configure cookie domain to `.adzeta.io` (with leading dot) which requires custom Supabase setup or a custom auth proxy.

**Simple approach that works:**
Users log in separately on each subdomain, but session persists on each domain independently.