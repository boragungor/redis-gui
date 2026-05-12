# Azure AD Authentication Setup for Redis GUI

This application uses **Microsoft Authentication Library (MSAL)** for Azure AD authentication, following the patterns from the acpanel implementation.

## 🚀 Quick Start

### 1. Azure AD App Registration

First, register your application in Azure AD:

1. Go to [Azure Portal](https://portal.azure.com) → **Azure Active Directory** → **App registrations**
2. Click **New registration**
3. Configure:
   - **Name**: Redis GUI
   - **Supported account types**: Choose based on your needs
   - **Redirect URI**: `http://localhost:3000` (for development)
4. After registration, note down:
   - **Application (client) ID**
   - **Directory (tenant) ID**

### 2. Configure Authentication

Go to **Authentication** in your app registration:

1. Under **Implicit grant and hybrid flows**, enable:
   - ✅ Access tokens
   - ✅ ID tokens
2. Under **Advanced settings**:
   - Allow public client flows: **No**
3. Add additional redirect URIs for production

### 3. API Permissions

Go to **API permissions**:

1. Click **Add a permission**
2. Select **Microsoft Graph**
3. Add these delegated permissions:
   - `User.Read`
   - `openid`
   - `profile`
   - `email`
4. Click **Grant admin consent** (if you have admin access)

### 4. Environment Configuration

Create a `.env.local` file in the project root:

```bash
# Copy from .env.local.example
cp .env.local.example .env.local
```

Edit `.env.local` with your values:

```env
# Azure AD Configuration
NEXT_PUBLIC_AZURE_AD_TENANT_ID=your-tenant-id-here
NEXT_PUBLIC_AZURE_AD_CLIENT_ID=your-client-id-here
NEXT_PUBLIC_AZURE_AD_REDIRECT_URI=http://localhost:3000

# Scopes (space-separated)
NEXT_PUBLIC_AZURE_AD_SCOPES=User.Read openid profile email

# Enable local login for development
NEXT_PUBLIC_ENABLE_LOCAL_LOGIN=true
```

### 5. Install Dependencies

```bash
pnpm install
# or
npm install
# or
yarn install
```

### 6. Run the Application

```bash
pnpm dev
# or
npm run dev
# or
yarn dev
```

Visit `http://localhost:3000` and you should see the login page.

## 📚 Architecture Overview

### Authentication Flow

```
User clicks "Sign in with Azure AD"
    ↓
Redirected to Azure AD login
    ↓
User authenticates
    ↓
Azure AD redirects back with authorization code
    ↓
MSAL exchanges code for tokens (ID token, Access token)
    ↓
Tokens stored in localStorage
    ↓
User profile fetched from Microsoft Graph
    ↓
App displays authenticated UI
```

### File Structure

```
redis-gui/
├── lib/
│   ├── auth-config.ts          # Azure AD configuration
│   ├── auth-context.tsx        # Authentication context & hooks
│   ├── msal-provider.tsx       # MSAL provider wrapper
│   └── api-auth.ts             # Server-side token validation
├── components/
│   └── auth/
│       └── login-page.tsx      # Login UI component
├── hooks/
│   └── use-auth-fetch.ts       # Authenticated fetch hook
├── middleware.ts               # Route protection middleware
└── .env.local.example          # Environment template
```

## 🔐 Key Components

### 1. Authentication Context

Use the `useAuth` hook anywhere in your app:

```typescript
import { useAuth } from "@/lib/auth-context"

function MyComponent() {
  const { isAuthenticated, user, login, logout, getAccessToken } = useAuth()
  
  if (!isAuthenticated) {
    return <button onClick={login}>Sign in</button>
  }
  
  return (
    <div>
      <p>Welcome, {user?.name}!</p>
      <button onClick={logout}>Sign out</button>
    </div>
  )
}
```

### 2. Authenticated API Calls

#### Client-side (using hook):

```typescript
import { useAuthenticatedFetch } from "@/hooks/use-auth-fetch"

function MyComponent() {
  const { authFetch } = useAuthenticatedFetch()
  
  const fetchData = async () => {
    const response = await authFetch("/api/protected-endpoint", {
      method: "POST",
      body: JSON.stringify({ data: "example" })
    })
    const data = await response.json()
  }
}
```

#### Server-side (API route):

```typescript
// app/api/protected/route.ts
import { NextRequest } from "next/server"
import { withAuth } from "@/lib/api-auth"

export async function POST(request: NextRequest) {
  return withAuth(request, async (user) => {
    // user contains verified token payload
    console.log("User:", user.name, user.oid)
    
    // Your protected logic here
    return Response.json({ success: true, user })
  })
}
```

### 3. Protected Routes

The middleware automatically protects API routes. For client-side protection, check authentication status:

```typescript
"use client"
import { useAuth } from "@/lib/auth-context"
import { LoginPage } from "@/components/auth/login-page"

export default function ProtectedPage() {
  const { isAuthenticated } = useAuth()
  
  if (!isAuthenticated) {
    return <LoginPage />
  }
  
  return <div>Protected content</div>
}
```

## 🔧 Configuration Options

### Disable Authentication (Development)

To run without Azure AD during development:

```env
# Don't set these variables or leave them empty
NEXT_PUBLIC_AZURE_AD_TENANT_ID=
NEXT_PUBLIC_AZURE_AD_CLIENT_ID=
```

The app will detect missing configuration and skip authentication.

### Token Storage

Tokens are stored in `localStorage` by default. Change in `lib/auth-config.ts`:

```typescript
export const msalConfig: Configuration = {
  cache: {
    cacheLocation: "sessionStorage", // or "localStorage"
    storeAuthStateInCookie: true,    // For IE11/Edge
  },
}
```

## 🚨 Security Best Practices

1. **Never commit `.env.local`** - Add to `.gitignore`
2. **Use HTTPS in production** - Update redirect URIs
3. **Validate tokens server-side** - Use `withAuth` helper
4. **Implement proper RBAC** - Check user roles/groups
5. **Set appropriate token lifetimes** - Configure in Azure AD
6. **Monitor authentication logs** - Azure AD sign-in logs

## 📖 Comparison with acpanel

This implementation mirrors the acpanel Azure AD authentication with modern improvements:

| Feature | acpanel (Angular/ADAL) | redis-gui (Next.js/MSAL) |
|---------|------------------------|--------------------------|
| Library | ADAL (deprecated) | MSAL 3.x (modern) |
| Token Storage | localStorage | localStorage/sessionStorage |
| Auth Flow | Popup/Redirect | Popup/Redirect |
| Token Refresh | Manual | Automatic (silent) |
| TypeScript | Partial | Full |
| Server Validation | Custom | jose + JWKS |
| Multi-tenant | ✅ | ✅ |
| Local Login | ✅ | ✅ (optional) |

### Key Improvements

1. **MSAL instead of ADAL**: Microsoft's latest auth library
2. **Better TypeScript**: Full type safety throughout
3. **React Context**: Cleaner state management
4. **Server-side validation**: Using `jose` library for JWT verification
5. **Hooks-based API**: Modern React patterns

## 🐛 Troubleshooting

### "AADSTS50011: Reply URL mismatch"

- Check redirect URI matches Azure AD app registration exactly
- Include protocol (`http://` or `https://`)
- No trailing slashes

### "Token acquisition failed"

- Clear localStorage/sessionStorage
- Check browser console for errors
- Verify API permissions are granted

### "User not authenticated" errors

- Ensure MSAL provider wraps your component tree
- Check environment variables are set
- Verify token hasn't expired

### CORS errors

- Configure allowed origins in Azure AD
- Check API endpoint configuration

## 📚 Additional Resources

- [MSAL.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js)
- [Azure AD App Registration Guide](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)
- [Microsoft Graph API](https://docs.microsoft.com/en-us/graph/overview)
- [Next.js Authentication Patterns](https://nextjs.org/docs/authentication)

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section
2. Review Azure AD sign-in logs
3. Check browser console for errors
4. Refer to acpanel implementation for reference patterns
