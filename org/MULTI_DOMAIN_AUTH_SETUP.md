# Supabase Multi-Domain Auth Configuration

## The Solution

**Site URL** (keep existing):
```
https://app.adzeta.io
```

**Redirect URLs** (add these - can have multiple):
```
https://app.adzeta.io/**
https://gtm.adzeta.io/**
https://gtm.adzeta.io/auth/callback
http://localhost:3000/**
http://localhost:3001/**
```

## How It Works

| Setting | Purpose | Multiple Allowed? |
|---------|---------|-------------------|
| Site URL | Default redirect if none specified | ❌ One only |
| Redirect URLs | Allowed callback destinations | ✅ Many allowed |

## Configuration Steps

### 1. Supabase Dashboard → Authentication → URL Configuration

**Site URL:**
```
https://app.adzeta.io
```

**Redirect URLs:** (add all of these)
```
https://app.adzeta.io/**
https://gtm.adzeta.io/**
https://gtm.adzeta.io/auth/callback
```

**Additional Redirect URLs** (for local testing):
```
http://localhost:3000/**
http://localhost:3001/**
http://localhost:3001/auth/callback
```

### 2. Code Changes

Update the auth callback to dynamically detect the current domain:

```typescript
// app/components/auth-provider.tsx
const signInWithGoogle = async () => {
  const currentDomain = window.location.origin; // e.g., https://gtm.adzeta.io
  
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${currentDomain}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
};
```

### 3. Update Auth Callback Route

The callback route already works - it redirects to `requestUrl.origin` which will be the correct domain.

```typescript
// app/auth/callback/route.ts - NO CHANGES NEEDED
// It already uses request.url to get the current domain
```

## Session Cookie Behavior

**Important limitation:** Sessions are domain-scoped by default.

| Scenario | Behavior |
|----------|----------|
| Log in on app.adzeta.io | Session cookie set for app.adzeta.io |
| Visit gtm.adzeta.io | **Not logged in** (different domain) |
| Log in on gtm.adzeta.io | Separate session for gtm.adzeta.io |

**This is actually what you want** for employee-only access: gtm.adzeta.io requires separate auth.

### For True Cross-Domain SSO (Optional)

If you want login on app.adzeta.io to also log you in on gtm.adzeta.io:

**Option A: Custom Domain Auth (Advanced)**
- Requires custom Supabase setup with cookie domain `.adzeta.io`
- Cookies then work on both subdomains
- More complex, may have security implications

**Option B: Redirect Pattern (Recommended)**
- User clicks "GTM Command Center" on app.adzeta.io
- Redirect to `gtm.adzeta.io?token=...` with short-lived token
- gtm.adzeta.io validates token and creates local session

**Option C: Just Keep Separate Login**
- Users log in separately on each subdomain
- Simpler, more secure
- Auth persists independently on each domain

## Recommended Setup

Given your use case (employee-only access on gtm, general access on app):

1. **Keep separate auth flows** - users log in on each subdomain
2. **Keep app.adzeta.io as Site URL** - it's your main app
3. **Add gtm.adzeta.io to Redirect URLs** - allows the secondary login
4. **Use dynamic redirectTo** - code below handles which domain you're on

## Quick Test

After configuration:

1. Open `https://gtm.adzeta.io`
2. Click "Sign in with Google"
3. Should redirect to Google → back to `/auth/callback` on gtm.adzeta.io → dashboard

If you get redirect_mismatch error, the Redirect URLs list needs updating.
