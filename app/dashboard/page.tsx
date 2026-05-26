'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, BarChart3, RefreshCw, TrendingUp, TrendingDown, AlertCircle, Zap } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface Stats {
  totalMessages: number
  totalTokens: number
  averageLatency: number
  successRate: number
  fallbackCount: number
  errorCount: number
}

interface LatencyData {
  time: string
  latency: number
}

interface TokenData {
  time: string
  input: number
  output: number
}

interface ModelData {
  name: string
  value: number
}

interface HourlyData {
  hour: string
  count: number
}

export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [latencyData, setLatencyData] = useState<LatencyData[]>([])
  const [tokenData, setTokenData] = useState<TokenData[]>([])
  const [modelData, setModelData] = useState<ModelData[]>([])
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const COLORS = ['#6b8e23', '#d97706', '#8b5a3c']

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    const loadStats = async () => {
      try {
        const logsRef = collection(db, 'inferenceLogs')
        const q = query(logsRef, where('userId', '==', user.uid))
        const snapshot = await getDocs(q)

        let totalMessages = 0
        let totalTokens = 0
        let totalLatency = 0
        let successCount = 0
        let fallbackCount = 0
        let errorCount = 0

        const latencyByMinute: { [key: string]: number[] } = {}
        const tokenByHour: { [key: string]: { input: number; output: number }[] } = {}
        const modelCounts: { [key: string]: number } = {}
        const hourlyRequests: { [key: string]: number } = {}

        snapshot.forEach((doc) => {
          const log = doc.data()
          const timestamp = log.timestamp || Date.now()
          const date = new Date(timestamp)

          totalMessages++
          totalTokens += (log.tokensInput || 0) + (log.tokensOutput || 0)
          totalLatency += log.latencyMs || 0

          if (log.status === 'success') {
            successCount++
          } else if (log.status === 'failed') {
            errorCount++
          }

          if (log.isFallback) {
            fallbackCount++
          }

          // Group latency by minute
          const minuteKey = date.toLocaleTimeString()
          if (!latencyByMinute[minuteKey]) {
            latencyByMinute[minuteKey] = []
          }
          latencyByMinute[minuteKey].push(log.latencyMs || 0)

          // Group tokens by hour
          const hourKey = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })
          if (!tokenByHour[hourKey]) {
            tokenByHour[hourKey] = []
          }
          tokenByHour[hourKey].push({
            input: log.tokensInput || 0,
            output: log.tokensOutput || 0,
          })

          // Count by model
          const model = log.model || 'unknown'
          modelCounts[model] = (modelCounts[model] || 0) + 1

          // Count by hour
          const hourKey2 = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })
          hourlyRequests[hourKey2] = (hourlyRequests[hourKey2] || 0) + 1
        })

        // Process latency data
        const latencyChartData = Object.entries(latencyByMinute)
          .map(([time, latencies]) => ({
            time,
            latency: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
          }))
          .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

        // Process token data
        const tokenChartData = Object.entries(tokenByHour)
          .map(([time, tokens]) => ({
            time,
            input: Math.round(tokens.reduce((a, b) => a + b.input, 0) / tokens.length),
            output: Math.round(tokens.reduce((a, b) => a + b.output, 0) / tokens.length),
          }))
          .sort((a, b) => a.time.localeCompare(b.time))

        // Process model data
        const modelChartData = Object.entries(modelCounts).map(([name, value]) => ({
          name: name.replace('gemini-', '').replace('-flash', '').replace('gemma-', ''),
          value,
        }))

        // Process hourly data
        const hourlyChartData = Object.entries(hourlyRequests)
          .map(([hour, count]) => ({
            hour,
            count,
          }))
          .sort((a, b) => a.hour.localeCompare(b.hour))

        setLatencyData(latencyChartData.slice(-10)) // Last 10 data points
        setTokenData(tokenChartData.slice(-10))
        setModelData(modelChartData)
        setHourlyData(hourlyChartData)

        setStats({
          totalMessages,
          totalTokens,
          averageLatency: totalMessages > 0 ? Math.round(totalLatency / totalMessages) : 0,
          successRate:
            totalMessages > 0
              ? Math.round(((totalMessages - errorCount) / totalMessages) * 100)
              : 0,
          fallbackCount,
          errorCount,
        })
      } catch (error) {
        console.error('Error loading stats:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
    setLastRefresh(new Date())

    // Refresh data every 10 seconds
    const interval = setInterval(() => {
      loadStats()
      setLastRefresh(new Date())
    }, 10000)

    return () => clearInterval(interval)
  }, [user, router])

  const handleManualRefresh = async () => {
    setRefreshing(true)
    try {
      const logsRef = collection(db, 'inferenceLogs')
      const q = query(logsRef, where('userId', '==', user?.uid))
      const snapshot = await getDocs(q)
      // Simplified refresh - just reload the page to get latest data
      window.location.reload()
    } catch (error) {
      console.error('Error refreshing:', error)
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fffbf0] flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="w-8 h-8 animate-spin text-[#6b8e23] mx-auto mb-2" />
          <p className="text-[#2d2d2d]">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fffbf0]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-[#2d2d2d]">Dashboard</h1>
              <p className="text-[#7a8566] mt-1">Inference analytics & insights</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={refreshing}
                title="Refresh data now"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              <Link href="/chat">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Chat
                </Button>
              </Link>
            </div>
          </div>
          {lastRefresh && (
            <Alert className="bg-[#e8f4e3] border-[#d4e5c1]">
              <AlertDescription className="text-sm text-[#6b8e23]">
                Auto-refreshing every 10 seconds. Last updated: {lastRefresh.toLocaleTimeString()}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {stats && stats.totalMessages > 0 ? (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
              <Card className="border-[#e8e5df] bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-[#7a8566]">Total Messages</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-[#2d2d2d]">{stats.totalMessages}</div>
                </CardContent>
              </Card>

              <Card className="border-[#e8e5df] bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-[#7a8566]">Total Tokens</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-[#2d2d2d]">
                    {(stats.totalTokens / 1000).toFixed(1)}k
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#e8e5df] bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-[#7a8566] flex items-center gap-1">
                    <TrendingUp className="w-4 h-4 text-[#6b8e23]" /> Avg Latency
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-[#6b8e23]">{stats.averageLatency}ms</div>
                </CardContent>
              </Card>

              <Card className="border-[#e8e5df] bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-[#7a8566]">Success Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-[#6b8e23]">{stats.successRate}%</div>
                </CardContent>
              </Card>

              <Card className="border-[#e8e5df] bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-[#7a8566]">Fallbacks</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary" className="bg-[#fef3e2] text-[#d97706]">
                    {stats.fallbackCount} times
                  </Badge>
                </CardContent>
              </Card>

              <Card className="border-[#e8e5df] bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-[#7a8566] flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 text-[#dc2626]" /> Errors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="destructive" className="bg-[#fee8e8] text-[#dc2626]">
                    {stats.errorCount}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Latency Trend */}
              {latencyData.length > 0 && (
                <Card className="border-[#e8e5df]">
                  <CardHeader>
                    <CardTitle className="text-[#2d2d2d]">Latency Trend (ms)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={latencyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8e5df" />
                      <XAxis dataKey="time" angle={-45} textAnchor="end" height={80} stroke="#7a8566" />
                      <YAxis stroke="#7a8566" />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="latency"
                        stroke="#6b8e23"
                        isAnimationActive={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Success vs Failure */}
              {stats && (
                <Card className="border-[#e8e5df]">
                  <CardHeader>
                    <CardTitle className="text-[#2d2d2d]">Request Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          {
                            name: 'Success',
                            value: stats.totalMessages - stats.errorCount,
                          },
                          { name: 'Failed', value: stats.errorCount },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value, percent }) =>
                          `${name}: ${value} (${(percent ? percent * 100 : 0).toFixed(0)}%)`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        <Cell fill="#6b8e23" />
                        <Cell fill="#dc2626" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Token Usage */}
              {tokenData.length > 0 && (
                <Card className="border-[#e8e5df]">
                  <CardHeader>
                    <CardTitle className="text-[#2d2d2d] flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#d97706]" /> Token Usage
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={tokenData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8e5df" />
                      <XAxis dataKey="time" angle={-45} textAnchor="end" height={80} stroke="#7a8566" />
                      <YAxis stroke="#7a8566" />
                      <Tooltip />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="input"
                        stackId="1"
                        stroke="#6b8e23"
                        fill="#6b8e23"
                        isAnimationActive={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="output"
                        stackId="1"
                        stroke="#d97706"
                        fill="#d97706"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Model Distribution */}
              {modelData.length > 0 && (
                <Card className="border-[#e8e5df]">
                  <CardHeader>
                    <CardTitle className="text-[#2d2d2d]">Model Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={modelData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value, percent }) =>
                          `${name}: ${value} (${(percent ? percent * 100 : 0).toFixed(0)}%)`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {modelData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Requests per Hour */}
              {hourlyData.length > 0 && (
                <Card className="border-[#e8e5df] lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-[#2d2d2d]">Requests per Time Period</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8e5df" />
                      <XAxis dataKey="hour" angle={-45} textAnchor="end" height={80} stroke="#7a8566" />
                      <YAxis stroke="#7a8566" />
                      <Tooltip />
                      <Bar dataKey="count" fill="#d97706" isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white p-8 rounded-lg shadow border border-[#e8e5df] text-center">
            <p className="text-[#7a8566]">No data available yet. Start chatting to see analytics!</p>
          </div>
        )}
      </div>
    </div>
  )
}
