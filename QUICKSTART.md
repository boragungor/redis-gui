# 🚀 Quick Start - Azure AD Authentication

## Installation

```bash
# Install dependencies
pnpm install
```

## Configuration

✅ **Already configured!** Your Azure AD credentials are set in `.env.local`:

```env
NEXT_PUBLIC_AZURE_AD_TENANT_ID=68283f3b-8487-4c86-adb3-a5228f18b893
NEXT_PUBLIC_AZURE_AD_CLIENT_ID=43641b8a-dbba-4077-9b92-b71ee9f69be2
NEXT_PUBLIC_AZURE_AD_REDIRECT_URI=http://localhost:3000

# Redis connection auto-configured
NEXT_PUBLIC_REDIS_HOST=localhost
NEXT_PUBLIC_REDIS_PORT=6379
NEXT_PUBLIC_REDIS_DATABASE=0
```

**Note**: These are the same credentials used in the acpanel project. The app will automatically connect to Redis at `localhost:6379` on startup.

## Azure AD Setup - Verify Configuration

Your credentials are already set. Just verify the Azure AD app registration:

1. **Azure Portal** → **Azure Active Directory** → **App registrations** → Find your app

2. **Verify Application ID matches**:
   - Should be: `43641b8a-dbba-4077-9b92-b71ee9f69be2`

3. **Authentication**:
   - Platform: Single-page application
   - Redirect URI: `http://localhost:3000` ✅
   - Enable: ✅ Access tokens + ✅ ID tokens

4. **API Permissions**:
   - Microsoft Graph:
     - ✅ `User.Read`
     - ✅ `openid`
     - ✅ `profile`
     - ✅ `email`
   - Grant admin consent (if needed)

## Run

```bash
pnpm dev
```

Visit `http://localhost:3000`:
1. **Azure AD Login** - Sign in with your Microsoft account (same window redirect)
2. **Auto-connect** - App automatically connects to Redis at `localhost:6379`
3. **Manage Redis** - View keys, execute commands, etc.
4. **Logout** - Click your avatar in the header → "Sign out"

**Note**: Make sure Redis is running at `localhost:6379` before starting the app.

## Usage

### Client Components

```typescript
import { useAuth } from "@/lib/auth-context"

function MyComponent() {
  const { isAuthenticated, user, login, logout } = useAuth()
  
  if (!isAuthenticated) {
    return <button onClick={login}>Sign in</button>
  }
  
  return (
    <div>
      <p>Hello, {user?.name}!</p>
      <button onClick={logout}>Sign out</button>
    </div>
  )
}
```

### Authenticated API Calls

```typescript
import { useAuthenticatedFetch } from "@/hooks/use-auth-fetch"

function MyComponent() {
  const { authFetch } = useAuthenticatedFetch()
  
  const fetchData = async () => {
    const res = await authFetch("/api/protected")
    const data = await res.json()
  }
}
```

### Protected API Routes

```typescript
import { withAuth } from "@/lib/api-auth"

export async function POST(request: NextRequest) {
  return withAuth(request, async (user) => {
    // user.oid, user.name, user.email available
    return Response.json({ success: true })
  })
}
```

## Testing Without Azure AD

Leave credentials empty in `.env.local`:

```env
NEXT_PUBLIC_AZURE_AD_TENANT_ID=
NEXT_PUBLIC_AZURE_AD_CLIENT_ID=
```

App will run without authentication.

## Production

1. Update redirect URI in Azure AD
2. Set production environment variables
3. Enable HTTPS
4. Deploy

## Troubleshooting

**"Reply URL mismatch"**: Update redirect URI in Azure AD to match exactly

**"Token acquisition failed"**: Clear browser storage and try again

**"CORS error"**: Check Azure AD CORS configuration

## More Info

- Full docs: `AZURE_AD_SETUP.md`
- Implementation details: `IMPLEMENTATION_SUMMARY.md`
- Compare with acpanel: See architecture comparison section
