'use client'

import React, { useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { signup } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)

    try {
      await signup(email, password)
      router.push('/chat')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fffbf0]">
      <div className="w-full max-w-md">
        <Card className="border-[#e8e5df] shadow-lg">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge className="bg-[#6b8e23] text-white">LLM Logger</Badge>
              <UserPlus className="w-5 h-5 text-[#6b8e23]" />
            </div>
            <CardTitle className="text-[#2d2d2d]">Create Account</CardTitle>
            <CardDescription className="text-[#7a8566]">Get started with Ollive today</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <Alert className="bg-[#fee8e8] border-[#dc2626]">
                <AlertCircle className="h-4 w-4 text-[#dc2626]" />
                <AlertDescription className="text-[#dc2626] text-sm">{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-[#2d2d2d]">
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="border-[#e8e5df] focus:border-[#6b8e23]"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-[#2d2d2d]">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="border-[#e8e5df] focus:border-[#6b8e23]"
                  required
                />
                <p className="text-xs text-[#7a8566]">Minimum 6 characters</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm" className="text-sm font-medium text-[#2d2d2d]">
                  Confirm Password
                </label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="border-[#e8e5df] focus:border-[#6b8e23]"
                  required
                />
              </div>

              <Button type="submit" className="w-full bg-[#6b8e23] hover:bg-[#5a7620] text-white" disabled={isLoading}>
                {isLoading ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#e8e5df]"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-[#7a8566]">Already have an account?</span>
              </div>
            </div>

            <Link href="/auth/login" className="w-full block">
              <Button type="button" variant="outline" className="w-full border-[#d97706] text-[#2d2d2d] hover:bg-[#faf8f3]">
                Sign In
              </Button>
            </Link>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-xs text-[#7a8566] space-y-2">
          <p className="flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#6b8e23]" />
            Secure authentication
          </p>
        </div>
      </div>
    </div>
  )
}
