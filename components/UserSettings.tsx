'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, Check, AlertCircle, Lock } from 'lucide-react'

interface UserSettingsProps {
  isOpen: boolean
  onClose: () => void
}

export function UserSettings({ isOpen, onClose }: UserSettingsProps) {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    geminiApiKey: '',
    openaiApiKey: '',
    claudeApiKey: '',
    openrouterApiKey: '',
  })
  const [showKeys, setShowKeys] = useState({
    gemini: false,
    openai: false,
    claude: false,
    openrouter: false,
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSave = async () => {
    if (!user) return

    setLoading(true)
    try {
      const token = await user.getIdToken()

      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          geminiApiKey: formData.geminiApiKey || undefined,
          openaiApiKey: formData.openaiApiKey || undefined,
          claudeApiKey: formData.claudeApiKey || undefined,
          openrouterApiKey: formData.openrouterApiKey || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save settings')
      }

      setMessage({ type: 'success', text: 'Settings saved securely (encrypted)' })
      setTimeout(() => {
        setMessage(null)
        onClose()
      }, 2000)
    } catch (error) {
      console.error('Error saving settings:', error)
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setLoading(false)
    }
  }

  const toggleKeyVisibility = (provider: 'gemini' | 'openai' | 'claude' | 'openrouter') => {
    setShowKeys((prev) => ({
      ...prev,
      [provider]: !prev[provider],
    }))
  }

  const maskKey = (key: string) => {
    if (!key) return ''
    return key.substring(0, 4) + '•'.repeat(Math.max(0, key.length - 8)) + key.substring(key.length - 4)
  }

  if (!isOpen) return null

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>API Key Settings</AlertDialogTitle>
          <AlertDialogDescription>
            Add your LLM provider API keys for deployed use. Keys are stored securely in your account.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {message && (
            <Alert className={message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription
                className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}
              >
                {message.text}
              </AlertDescription>
            </Alert>
          )}

          {/* Gemini API Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Google Gemini API Key</label>
            <div className="flex gap-2">
              <Input
                type={showKeys.gemini ? 'text' : 'password'}
                value={formData.geminiApiKey}
                onChange={(e) => setFormData({ ...formData, geminiApiKey: e.target.value })}
                placeholder="sk-..."
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleKeyVisibility('gemini')}
              >
                {showKeys.gemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* OpenAI API Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium">OpenAI API Key</label>
            <div className="flex gap-2">
              <Input
                type={showKeys.openai ? 'text' : 'password'}
                value={formData.openaiApiKey}
                onChange={(e) => setFormData({ ...formData, openaiApiKey: e.target.value })}
                placeholder="sk-..."
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleKeyVisibility('openai')}
              >
                {showKeys.openai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Claude API Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Claude API Key</label>
            <div className="flex gap-2">
              <Input
                type={showKeys.claude ? 'text' : 'password'}
                value={formData.claudeApiKey}
                onChange={(e) => setFormData({ ...formData, claudeApiKey: e.target.value })}
                placeholder="sk-ant-..."
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleKeyVisibility('claude')}
              >
                {showKeys.claude ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* OpenRouter API Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium">OpenRouter API Key</label>
            <div className="flex gap-2">
              <Input
                type={showKeys.openrouter ? 'text' : 'password'}
                value={formData.openrouterApiKey}
                onChange={(e) => setFormData({ ...formData, openrouterApiKey: e.target.value })}
                placeholder="sk-or-..."
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleKeyVisibility('openrouter')}
              >
                {showKeys.openrouter ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <Alert className="bg-blue-50 border-blue-200">
            <Lock className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-800 ml-2">
              Your API keys are encrypted with AES-256 before storage. Leave empty to use environment keys.
            </AlertDescription>
          </Alert>
        </div>

        <div className="flex gap-2 justify-end">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <>Saving...</>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save Keys
              </>
            )}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
