"use client";

/**
 * Session Countdown Component
 * Displays remaining session time and provides token refresh functionality
 * Based on acpanel's session countdown (15-minute timeout)
 */

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  SESSION_TIMEOUT_MINUTES,
  SESSION_WARNING_THRESHOLD_MINUTES,
} from "@/lib/auth-config";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function SessionCountdown() {
  const { isAuthenticated, renewToken, logout } = useAuth();
  const [timeLeft, setTimeLeft] = useState<{
    minutes: number;
    seconds: number;
  } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  // Initialize session start time from localStorage or set new one
  useEffect(() => {
    if (isAuthenticated) {
      const storedTime = localStorage.getItem("azure-session-start");
      if (storedTime) {
        setSessionStartTime(new Date(storedTime));
      } else {
        const now = new Date();
        localStorage.setItem("azure-session-start", now.toISOString());
        setSessionStartTime(now);
      }
    } else {
      setSessionStartTime(null);
      localStorage.removeItem("azure-session-start");
    }
  }, [isAuthenticated]);

  // Countdown timer
  useEffect(() => {
    if (!sessionStartTime || !isAuthenticated) {
      setTimeLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      const sessionEnd = new Date(
        sessionStartTime.getTime() + SESSION_TIMEOUT_MINUTES * 60 * 1000,
      );
      const difference = sessionEnd.getTime() - now.getTime();

      if (difference <= 0) {
        // Session expired - logout
        console.log("Session expired, logging out...");
        setTimeLeft(null);
        clearInterval(interval);
        logout();
        return;
      }

      const minutes = Math.floor(difference / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ minutes, seconds });

      // Auto-refresh when less than threshold remains
      if (minutes < SESSION_WARNING_THRESHOLD_MINUTES && !isRefreshing) {
        handleRefresh();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionStartTime, isAuthenticated, isRefreshing, logout]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      await renewToken();
      // Reset session start time
      const now = new Date();
      localStorage.setItem("azure-session-start", now.toISOString());
      setSessionStartTime(now);
    } catch (error) {
      console.error("Token renewal failed:", error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  }, [renewToken, isRefreshing]);

  if (!isAuthenticated || !timeLeft) {
    return null;
  }

  const isWarning = timeLeft.minutes < SESSION_WARNING_THRESHOLD_MINUTES;
  const minutes = String(timeLeft.minutes).padStart(2, "0");
  const seconds = String(timeLeft.seconds).padStart(2, "0");

  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md font-mono transition-colors",
          isWarning
            ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
            : "bg-muted text-muted-foreground",
        )}
        title="Session time remaining"
      >
        <Clock className="h-3.5 w-3.5" />
        <span>
          {minutes}:{seconds}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="h-8 px-2 text-xs"
        title="Refresh session to extend timeout"
      >
        <RefreshCw
          className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
        />
        <span className="ml-1.5 hidden md:inline">Refresh</span>
      </Button>
    </div>
  );
}
