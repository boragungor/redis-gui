"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Database,
  Settings,
  Moon,
  Sun,
  Terminal,
  Download,
  Upload,
  Info,
  LogOut,
  Shield,
  ShieldOff,
  User,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { isAuthenticationRequired } from "@/lib/auth-config";
import { SessionCountdown } from "@/components/auth/session-countdown";
import type { ConnectionConfig } from "@/components/redis/connection-screen";

interface HeaderProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onToggleCLI: () => void;
  showCLI: boolean;
  connection?: ConnectionConfig;
}

export function Header({
  theme,
  onToggleTheme,
  onToggleCLI,
  showCLI,
  connection,
}: HeaderProps) {
  const { user, logout, isAuthenticated } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const getUserInitials = () => {
    if (!user?.name) return "U";
    const names = user.name.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return user.name.substring(0, 2).toUpperCase();
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border/50 bg-card px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Database className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Redis UI</h1>
          <Badge variant="secondary" className="text-xs">
            v1.0
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {connection && (
          <div className="mr-2 hidden items-center gap-2 sm:flex">
            <Badge
              variant="outline"
              className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {connection.host}:{connection.port}/db{connection.database}
            </Badge>
            {connection.useAuth ? (
              <Shield className="h-3.5 w-3.5 text-primary" />
            ) : (
              <ShieldOff className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
        )}

        {/* Session Countdown (Any Auth) */}
        {isAuthenticationRequired() && isAuthenticated && <SessionCountdown />}

        <Button
          variant={showCLI ? "secondary" : "ghost"}
          size="icon"
          onClick={onToggleCLI}
          title="Toggle CLI"
        >
          <Terminal className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onToggleTheme}>
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>

        {/* User Profile Menu */}
        {isAuthenticationRequired() && isAuthenticated && user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={undefined} alt={user.name || "User"} />
                  <AvatarFallback className="text-xs">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user.name || "User"}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.username || user.localAccountId}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>
              <Download className="mr-2 h-4 w-4" />
              Export Data
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Upload className="mr-2 h-4 w-4" />
              Import Data
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Info className="mr-2 h-4 w-4" />
              About
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
