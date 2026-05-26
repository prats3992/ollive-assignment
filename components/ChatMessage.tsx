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
import { Edit2, Check, X as XIcon, Copy, Trash2, RotateCcw, Zap } from 'lucide-react'
import 'katex/dist/katex.min.css'

interface ChatMessageProps {
  message: Message
  isLoading?: boolean
  isUser?: boolean
  onEdit?: (messageId: string, newContent: string) => void
  onDelete?: (messageId: string) => void
  onRegenerate?: (messageId: string) => void
}

export function ChatMessage({ message, isLoading, isUser, onEdit, onDelete, onRegenerate }: ChatMessageProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(message.content)

  const handleSaveEdit = () => {
    if (editedContent.trim() && editedContent !== message.content) {
      onEdit?.(message.id, editedContent.trim())
    }
    setIsEditing(false)
  }

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
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full p-2 border border-[#d97706] rounded text-sm bg-[#fffbf0] text-[#2d2d2d]"
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveEdit}
                  className="text-xs"
                >
                  <Check className="w-3 h-3 mr-1" />
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  className="text-xs"
                >
                  <XIcon className="w-3 h-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
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
                    code: ({ node, children, ...props }: any) =>
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
            </>
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

        {/* Action buttons - show on hover */}
        <div className="absolute -right-28 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 flex-col">
          {isUser && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              title="Edit message"
              className="text-xs"
            >
              <Edit2 className="w-3 h-3" />
            </Button>
          )}
          {!isUser && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRegenerate?.(message.id)}
                title="Regenerate response"
                className="text-xs"
              >
                <RotateCcw className="w-3 h-3" />
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (window.confirm('Delete this message?')) {
                    onDelete?.(message.id)
                  }
                }}
                title="Delete message"
                className="text-xs"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(message.content)
                }}
                title="Copy to clipboard"
                className="text-xs"
              >
                <Copy className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
