"use client"

import { Card, CardContent } from "@/components/ui/card"
import { type RedisStats } from "@/lib/redis-mock-data"
import {
  Database,
  Gauge,
  HardDrive,
  Timer,
  Users,
  Zap,
} from "lucide-react"

interface StatsCardsProps {
  stats: RedisStats
  isLoading?: boolean
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  const statItems = [
    {
      label: "Total Keys",
      value: stats.totalKeys.toLocaleString(),
      icon: Database,
      color: "text-primary",
    },
    {
      label: "Memory Used",
      value: stats.usedMemory,
      icon: HardDrive,
      color: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Connected Clients",
      value: stats.connectedClients.toString(),
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Ops/sec",
      value: stats.opsPerSec.toLocaleString(),
      icon: Zap,
      color: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Hit Rate",
      value: `${stats.hitRate}%`,
      icon: Gauge,
      color: "text-indigo-600 dark:text-indigo-400",
    },
    {
      label: "Uptime",
      value: `${stats.uptimeDays} days`,
      icon: Timer,
      color: "text-rose-600 dark:text-rose-400",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {statItems.map((item) => (
        <Card key={item.label} className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`${item.color}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">
                  {item.label}
                </p>
                <p className={`truncate text-lg font-semibold tabular-nums ${isLoading ? "animate-pulse text-muted-foreground" : ""}`}>
                  {item.value}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
