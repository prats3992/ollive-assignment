'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'

export default function Home() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/chat')
      } else {
        router.push('/auth/login')
      }
    }
  }, [user, loading, router])

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#fffbf0]">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4 text-[#6b8e23]">Ollive</h1>
        <p className="text-[#7a8566]">Loading...</p>
      </div>
    </div>
  )
}
