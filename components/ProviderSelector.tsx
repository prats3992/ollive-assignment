'use client'

import { Button } from '@/components/ui/button'
import { ProviderFactory } from '@/lib/providers/provider'
import { useState } from 'react'

interface ProviderSelectorProps {
  onSelect: (provider: string, model: string) => void
  currentProvider?: string
  currentModel?: string
}

export function ProviderSelector({
  onSelect,
  currentProvider = 'gemini',
  currentModel = 'gemini-2.5-flash',
}: ProviderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const providers = ProviderFactory.getAvailableProviders()
  const selectedProvider = providers.find((p) => p.name === currentProvider)
  const selectedModel = selectedProvider?.models.find((m) => m === currentModel) || selectedProvider?.models[0] || ''

  return (
    <div className="relative inline-block">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="text-sm bg-[#fffbf0] border-[#d97706] text-[#2d2d2d] hover:bg-[#faf8f3] hover:text-[#6b8e23]"
        title="Select LLM provider"
      >
        {selectedProvider?.label || 'Select Provider'} / {selectedModel}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-[#e8e5df] z-50 p-4">
          <div className="grid gap-2">
            {providers.map((provider) => (
              <div key={provider.name} className="border border-[#e8e5df] rounded p-3 hover:bg-[#faf8f3]">
                <p className="font-semibold text-sm mb-2 text-[#2d2d2d]">{provider.label}</p>
                <div className="flex gap-2 flex-wrap">
                  {provider.models.map((model) => (
                    <button
                      key={model}
                      onClick={() => {
                        onSelect(provider.name, model)
                        setIsOpen(false)
                      }}
                      className={`text-xs px-2 py-1 rounded font-medium ${
                        currentProvider === provider.name && currentModel === model
                          ? 'bg-[#6b8e23] text-white'
                          : 'bg-[#f5f3ef] text-[#2d2d2d] hover:bg-[#d97706] hover:text-white'
                      }`}
                    >
                      {model.split('/').pop()}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#7a8566] mt-4 border-t border-[#e8e5df] pt-2">
            💡 Tip: OpenAI, Claude, and OpenRouter require their respective API keys in .env.local
          </p>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
