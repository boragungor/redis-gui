"use client"

/**
 * Login Page Component
 * Displays login options (Azure AD and optional local login)
 */

import React, { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { isLocalLoginEnabled } from "@/lib/auth-config"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, LogIn } from "lucide-react"

interface LoginPageProps {
  onSuccess?: () => void
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const { login, isLoading } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [showLocalLogin, setShowLocalLogin] = useState(false)
  const [localUsername, setLocalUsername] = useState("")
  const [localPassword, setLocalPassword] = useState("")
  const [isLocalLoading, setIsLocalLoading] = useState(false)

  const handleAzureLogin = async () => {
    setError(null)
    try {
      await login()
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Azure AD login failed")
    }
  }

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLocalLoading(true)

    try {
      // TODO: Implement local login API call
      // This is a placeholder - you'll need to implement actual local auth
      const response = await fetch("/api/auth/local-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: localUsername, password: localPassword }),
      })

      if (!response.ok) {
        throw new Error("Invalid credentials")
      }

      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Local login failed")
    } finally {
      setIsLocalLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-red-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-2xl font-bold">R</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Redis UI</CardTitle>
          <CardDescription>Sign in to access the Redis management interface</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Azure AD Login */}
          <div className="space-y-3">
            <Button
              onClick={handleAzureLogin}
              disabled={isLoading}
              className="w-full"
              size="lg"
              variant="default"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign in with Azure AD
                </>
              )}
            </Button>
          </div>

          {/* Local Login (Development) */}
          {isLocalLoginEnabled() && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              {!showLocalLogin ? (
                <Button
                  onClick={() => setShowLocalLogin(true)}
                  variant="ghost"
                  className="w-full"
                  type="button"
                >
                  Local Login (Development)
                </Button>
              ) : (
                <form onSubmit={handleLocalLogin} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="Enter username"
                      value={localUsername}
                      onChange={(e) => setLocalUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter password"
                      value={localPassword}
                      onChange={(e) => setLocalPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={isLocalLoading} className="flex-1">
                      {isLocalLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        "Sign in"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowLocalLogin(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}

          <p className="text-xs text-center text-muted-foreground">
            Protected by Azure Active Directory
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
