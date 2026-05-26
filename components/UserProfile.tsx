'use client'

import { useAuth } from '@/components/AuthContext'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UserSettings } from '@/components/UserSettings'
import { LogOut, User, Mail, Copy, Settings } from 'lucide-react'
import { useState } from 'react'

export function UserProfile() {
  const { user, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  if (!user) return null

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#f5f3ef] transition-colors"
        title="User profile"
      >
        <Avatar size="sm">
          <AvatarImage src={`https://avatar.vercel.sh/${user.email}`} />
          <AvatarFallback className="bg-[#6b8e23] text-white">
            {user.email?.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="text-left hidden sm:block">
          <p className="text-sm font-medium text-[#2d2d2d]">
            {user.email?.split('@')[0] || 'User'}
          </p>
          <Badge variant="secondary" className="text-xs h-5 bg-[#e8f4e3] text-[#6b8e23]">
            Active
          </Badge>
        </div>
      </button>

      {isOpen && (
        <Card className="absolute right-0 mt-2 w-72 bg-white border-[#e8e5df] z-50">
          <div className="p-4 border-b border-[#e8e5df]">
            <div className="flex items-center gap-3">
              <Avatar size="lg">
                <AvatarImage src={`https://avatar.vercel.sh/${user.email}`} />
                <AvatarFallback className="bg-[#6b8e23] text-white">
                  {user.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-[#2d2d2d]">{user.email?.split('@')[0]}</p>
                <p className="text-xs text-[#7a8566]">{user.email}</p>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-[#e8e5df]">
            <p className="text-xs text-[#7a8566] mb-2 flex items-center gap-2">
              <Mail className="w-3 h-3" /> Email
            </p>
            <div className="flex gap-2 items-center">
              <p className="text-xs font-mono text-[#2d2d2d] flex-1 break-all">{user.email}</p>
              <button
                onClick={() => navigator.clipboard.writeText(user.email || '')}
                className="text-[#6b8e23] hover:bg-[#e8f4e3] p-1 rounded"
                title="Copy email"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="p-4 border-b border-[#e8e5df]">
            <p className="text-xs text-[#7a8566] mb-2">User ID</p>
            <p className="text-xs font-mono text-[#2d2d2d] break-all">{user.uid}</p>
          </div>

          <div className="p-4 border-b border-[#e8e5df]">
            <Button
              onClick={() => {
                setSettingsOpen(true)
                setIsOpen(false)
              }}
              variant="outline"
              className="w-full flex items-center gap-2 justify-center bg-[#fffbf0] border-[#6b8e23] text-[#2d2d2d] hover:bg-[#e8f4e3] hover:text-[#6b8e23]"
              size="sm"
            >
              <Settings className="w-4 h-4" />
              API Keys
            </Button>
          </div>

          <div className="p-4">
            <Button
              onClick={() => {
                logout()
                setIsOpen(false)
              }}
              variant="outline"
              className="w-full flex items-center gap-2 justify-center bg-[#fffbf0] border-[#d97706] text-[#2d2d2d] hover:bg-[#faf8f3] hover:text-[#6b8e23]"
              size="sm"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </Card>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      <UserSettings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
