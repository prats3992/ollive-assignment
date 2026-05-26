'use client'

import React, { useState } from 'react'
import { Message } from '@/lib/types'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Edit2, Check, X as XIcon, Copy, Trash2, RotateCcw, Zap, MoreVertical } from 'lucide-react'
import 'katex/dist/katex.min.css'

interface ChatMessageProps {
  message: Message
  isLoading?: boolean
  isUser?: boolean
  onEdit?: (messageId: string, newContent: string) => void
  onDelete?: (messageId: string) => void
  onRegenerate?: (messageId: string) => void
  onStartEdit?: (messageId: string, currentContent: string) => void
}

export function ChatMessage({ message, isLoading, isUser, onEdit, onDelete, onRegenerate, onStartEdit }: ChatMessageProps) {

  return (
    <div className={cn('flex w-full mb-4 group', isUser ? 'justify-end' : 'justify-start')}>
      <Card
        className={cn(
          'max-w-xs md:max-w-md lg:max-w-lg relative',
          isUser
            ? 'bg-[#6b8e23] text-white border-none shadow-md'
            : 'bg-[#faf8f3] text-[#2d2d2d] border-[#e8e5df] shadow-md'
        )}
      >
        <CardContent className="px-2">
          {isUser ? (
            <p className="text-sm break-words">{message.content}</p>
          ) : (
            <div className="text-sm prose prose-sm dark:prose-invert max-w-none break-words">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  p: ({ children }) => <p className="mb-2">{children}</p>,
                  h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-bold mb-2">{children}</h3>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                  li: ({ children }) => <li className="ml-2">{children}</li>,
                  code: ({ node, children }: any) =>
                    node?.parent?.type === 'paragraph' ? (
                      <code className="bg-[#f5f3ef] text-[#2d2d2d] px-1 rounded text-xs font-mono border border-[#e8e5df]">{children}</code>
                    ) : (
                      <pre className="bg-[#f5f3ef] text-[#2d2d2d] p-2 rounded overflow-x-auto text-xs border border-[#e8e5df] font-mono">
                        <code>{children}</code>
                      </pre>
                    ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-[#d97706] pl-2 italic mb-2 text-[#7a8566]">{children}</blockquote>
                  ),
                  a: ({ href, children }) => (
                    <a href={href} className="underline text-[#6b8e23] hover:text-[#d97706]" target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </CardContent>
        {message.tokensUsed && !isUser && (
          <div className="flex gap-2 px-4 pb-3 pt-2 border-t border-[#e8e5df]">
            <Badge variant="secondary" className="bg-[#f5f3ef] text-[#2d2d2d] flex gap-1">
              <Zap className="w-3 h-3" />
              {(message.tokensUsed.input + message.tokensUsed.output).toLocaleString()} tokens
            </Badge>
          </div>
        )}
        {isLoading && !isUser && (
          <div className="flex gap-1 px-4 pb-3">
            <div className="w-2 h-2 bg-[#d97706] rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-[#d97706] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-[#d97706] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        )}

        {/* Compact overflow menu for actions to reduce visual noise */}
        <div className="absolute right-2 top-2">
          <div className="relative">
            <button
              aria-label="Message actions"
              onClick={(e) => {
                e.stopPropagation()
                const menu = document.getElementById(`msg-menu-${message.id}`)
                if (menu) menu.classList.toggle('hidden')
              }}
              className="p-1 rounded bg-white/80 hover:bg-white shadow-sm"
            >
              <MoreVertical className="w-4 h-4 text-[#6b8e23]" />
            </button>

            <div id={`msg-menu-${message.id}`} className="hidden absolute right-0 mt-2 w-40 bg-white border border-[#e8e5df] rounded shadow-lg z-50">
              <div className="flex flex-col py-1">
                {/* Edit handled externally for better UX */}

                {!isUser && (
                  <>
                    <button
                      className="text-left px-3 py-2 text-sm hover:bg-[#f5f3ef]"
                      onClick={() => onRegenerate?.(message.id)}
                    >
                      <span className="inline-flex items-center gap-2"><RotateCcw className="w-4 h-4" /> Regenerate</span>
                    </button>
                    <button
                      className="text-left px-3 py-2 text-sm hover:bg-[#f5f3ef] text-[#dc2626]"
                      onClick={() => {
                        if (window.confirm('Delete this message?')) {
                          onDelete?.(message.id)
                        }
                      }}
                    >
                      <span className="inline-flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete</span>
                    </button>
                    <button
                      className="text-left px-3 py-2 text-sm hover:bg-[#f5f3ef]"
                      onClick={() => navigator.clipboard.writeText(message.content)}
                    >
                      <span className="inline-flex items-center gap-2"><Copy className="w-4 h-4" /> Copy</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
