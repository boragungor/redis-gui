# Changelog - Redis GUI

## Latest Changes (March 16, 2026)

### Azure AD Authentication Improvements

✅ **1. Same-window login (like acpanel)**
- Changed from popup to redirect flow
- Login now happens in the same window/tab
- Uses `loginRedirect()` and `logoutRedirect()` instead of popup methods
- Matches acpanel behavior exactly

✅ **2. Logout functionality added**
- Users can now logout from the header user menu
- Click on user avatar → "Sign out"
- Logout clears Azure AD session and Redis connection
- Redirects to home page after logout

✅ **3. Removed connection screen - Auto-connect to Redis**
- Redis connection now automatically uses default from environment variables
- No more connection screen on startup
- Default connection: `localhost:6379` (configurable via .env.local)
- Connection auto-initializes on app load

### Environment Variables

New Redis configuration variables in `.env.local`:

```env
# Redis Default Connection
NEXT_PUBLIC_REDIS_HOST=localhost
NEXT_PUBLIC_REDIS_PORT=6379
NEXT_PUBLIC_REDIS_DATABASE=0
```

### User Flow (Updated)

```
User visits app (http://localhost:3000)
    ↓
Azure AD login required?
    ↓ YES
Redirect to Azure AD login (same window)
    ↓
User authenticates with Microsoft
    ↓
Redirect back to app (authenticated)
    ↓
Auto-connect to Redis (localhost:6379 by default)
    ↓
Show Redis UI with data
    ↓
User can logout via header menu
```

### Technical Changes

**Files Modified:**
- `lib/auth-context.tsx` - Changed to redirect flow
- `app/page.tsx` - Removed ConnectionScreen, added auto-connect
- `.env.local` - Added Redis default connection variables
- `.env.local.example` - Updated with new variables

**Behavior Changes:**
- ✅ Login: Same window redirect (not popup)
- ✅ Logout: Available in header dropdown
- ✅ Redis: Auto-connects to default on app load
- ✅ Connection: Can be customized via environment variables

### Configuration

To customize default Redis connection, edit `.env.local`:

```env
NEXT_PUBLIC_REDIS_HOST=your-redis-host
NEXT_PUBLIC_REDIS_PORT=6379
NEXT_PUBLIC_REDIS_DATABASE=0
```

For remote Redis with authentication, you'll need to modify the app to accept these parameters or handle them differently.
