'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/navigation'
import { ChatMessage } from '@/components/ChatMessage'
import { ChatInput } from '@/components/ChatInput'
import { ConversationList } from '@/components/ConversationList'
import { UserProfile } from '@/components/UserProfile'
import { ProviderSelector } from '@/components/ProviderSelector'
import { Message, Conversation } from '@/lib/types'
import { db } from '@/lib/firebase'
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore'
import { v4 as uuidv4 } from 'uuid'
import { Loader, BarChart3, Menu, X, Edit2, Check, X as XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

export default function ChatPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [conversationId, setConversationId] = useState<string>('')
  const [conversationTitle, setConversationTitle] = useState<string>('New Chat')
  const [provider, setProvider] = useState<string>('gemini')
  const [model, setModel] = useState<string>('gemini-2.5-flash')
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [editModeId, setEditModeId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [editHistory, setEditHistory] = useState<Record<string, Array<{ oldUser: string; oldAssistantId?: string; oldAssistantContent?: string; editedAt?: number; editorId?: string }>>>({})
  const [showPreviousMap, setShowPreviousMap] = useState<Record<string, number | null>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Redirect to login if not authenticated (wait until auth finished initializing)
  useEffect(() => {
    if (!user && !loading) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load messages for current conversation
  useEffect(() => {
    if (!conversationId) return

    setIsLoadingMessages(true)

    const loadMessages = async () => {
      try {
        const q = query(
          collection(db, 'messages', conversationId, 'items'),
          orderBy('createdAt', 'asc')
        )
        const snapshot = await getDocs(q)
        const msgs = snapshot.docs.map((doc, idx) => ({
          id: doc.id,
          conversationId,
          ...doc.data(),
        })) as Message[]
        setMessages(msgs)

      } catch (error) {
        console.error('Error loading messages:', error)
      } finally {
        setIsLoadingMessages(false)
      }
    }

    loadMessages()
  }, [conversationId])

  const createNewConversation = async (selectedProvider?: string, selectedModel?: string) => {
    if (!user) return

    let providerToUse = selectedProvider || provider
    let modelToUse = selectedModel || model

    // Ensure provider and model are strings (not objects)
    if (typeof providerToUse !== 'string') {
      providerToUse = 'gemini'
    }
    if (typeof modelToUse !== 'string') {
      modelToUse = 'gemini-2.5-flash'
    }

    try {
      const newConv = await addDoc(collection(db, 'conversations'), {
        userId: user.uid,
        title: 'New Chat',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        provider: providerToUse,
        model: modelToUse,
        messageCount: 0,
      })

      setConversationId(newConv.id)
      setConversationTitle('New Chat')
      setProvider(providerToUse)
      setModel(modelToUse)
      setMessages([])
    } catch (error) {
      console.error('Error creating conversation:', error)
    }
  }

  const handleSelectConversation = async (id: string, title?: string) => {
    setConversationId(id)
    try {
      const convSnap = await getDoc(doc(db, 'conversations', id))
      if (convSnap.exists()) {
        const data = convSnap.data()
        setConversationTitle(title || data.title || 'Chat')
        
        // Sanitize provider and model (ensure they're strings)
        let loadedProvider = data.provider || 'gemini'
        let loadedModel = data.model || 'gemini-2.5-flash'
        
        if (typeof loadedProvider !== 'string') {
          loadedProvider = 'gemini'
        }
        if (typeof loadedModel !== 'string') {
          loadedModel = 'gemini-2.5-flash'
        }
        
        setProvider(loadedProvider)
        setModel(loadedModel)
      }
    } catch (error) {
      console.error('Error fetching conversation:', error)
    }
  }

  const handleTitleUpdate = async () => {
    if (!conversationId || !editedTitle.trim()) {
      setIsEditingTitle(false)
      return
    }

    try {
      await updateDoc(doc(db, 'conversations', conversationId), {
        title: editedTitle.trim(),
        updatedAt: Date.now(),
      })
      setConversationTitle(editedTitle.trim())
      setIsEditingTitle(false)
    } catch (error) {
      console.error('Error updating title:', error)
    }
  }

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsLoading(false)
    }
  }

  const handleEditMessage = async (messageId: string, newContent: string) => {
    try {
      await updateDoc(doc(db, 'messages', conversationId, 'items', messageId), {
        content: newContent,
        editedAt: Date.now(),
        editorId: user?.uid || null,
      })
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, content: newContent } : msg))
      )
    } catch (error) {
      console.error('Error editing message:', error)
    }
  }

  const handleStartEditMessage = (messageId: string, currentContent: string) => {
    setEditModeId(messageId)
    setEditDraft(currentContent)
  }

  const cancelInlineEdit = () => {
    setEditModeId(null)
    setEditDraft('')
  }

  // Send assistant reply for an existing user message without adding a new user message
  const sendAssistantForMessage = async (userMessageId: string, content: string) => {
    try {
      // Create abort controller for this request
      abortControllerRef.current = new AbortController()

      const conversationHistory = messages
        .slice(-5)
        .map((msg) => ({ role: msg.role, content: msg.content }))

      // Ensure provider and model are strings before sending
      const safeProvider = typeof provider === 'string' ? provider : 'gemini'
      const safeModel = typeof model === 'string' ? model : 'gemini-2.5-flash'

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: content,
          userId: user?.uid,
          messages: [...conversationHistory, { role: 'user', content }],
          provider: safeProvider,
          model: safeModel,
        }),
        signal: abortControllerRef.current?.signal,
      })

      if (!response.ok) throw new Error('Failed to get chat response')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      let assistantContent = ''
      const decoder = new TextDecoder()
      let messageId = uuidv4()

      // Create placeholder assistant message
      const assistantMessage: Message = {
        id: messageId,
        conversationId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
      }

      setMessages((prev) => [...prev, assistantMessage])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'chunk') {
                assistantContent += data.content
                setMessages((prev) => {
                  const newMessages = [...prev]
                  const lastMsg = newMessages[newMessages.length - 1]
                  if (lastMsg && lastMsg.role === 'assistant') {
                    lastMsg.content = assistantContent
                  }
                  return newMessages
                })
              } else if (data.type === 'done') {
                messageId = data.messageId
              }
            } catch (e) {
              // ignore
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Generation aborted')
      } else {
        console.error('Error generating assistant reply:', error)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveInlineEdit = async (messageId: string) => {
    const next = editDraft.trim()
    if (!next) return

    const idx = messages.findIndex((m) => m.id === messageId)
    if (idx === -1) return

    const userMsg = messages[idx]
    const oldUser = userMsg.content

    // capture assistant after this user message
    const assistantMsg = messages[idx + 1] && messages[idx + 1].role === 'assistant' ? messages[idx + 1] : null

    // save history (prepend to array)
    const editRecord = {
      oldUser,
      oldAssistantId: assistantMsg?.id || null,
      oldAssistantContent: assistantMsg?.content || null,
      editedAt: Date.now(),
      editorId: user?.uid || null,
    }
    setEditHistory((prev) => ({
      ...prev,
      [messageId]: [editRecord as any].concat(prev[messageId] || []),
    }))

    // persist history to Firestore
    try {
      await addDoc(collection(db, 'messages', conversationId, 'items', messageId, 'edits'), editRecord)
    } catch (err) {
      console.error('Error persisting edit history:', err)
    }

    // update user message in DB and state
    await handleEditMessage(messageId, next)

    // if assistant exists, delete it and regenerate reply for the same user message
    if (assistantMsg) {
      await handleDeleteMessage(assistantMsg.id)
      await sendAssistantForMessage(messageId, next)
    } else {
      // No assistant yet; trigger a reply for this message
      await sendAssistantForMessage(messageId, next)
    }

    setEditModeId(null)
    setEditDraft('')
  }

  const fetchEditHistory = async (messageId: string) => {
    if (editHistory[messageId]) return
    try {
      const q = query(collection(db, 'messages', conversationId, 'items', messageId, 'edits'), orderBy('editedAt', 'desc'))
      const snap = await getDocs(q)
      const edits = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
      setEditHistory((prev) => ({ ...prev, [messageId]: edits }))
    } catch (err) {
      console.error('Error fetching edit history for', messageId, err)
    }
  }

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteDoc(doc(db, 'messages', conversationId, 'items', messageId))
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId))
    } catch (error) {
      console.error('Error deleting message:', error)
    }
  }

  const handleRegenerateMessage = async (messageId: string) => {
    const messageIndex = messages.findIndex((m) => m.id === messageId)
    if (messageIndex === -1) return

    // Get the user message before this response
    const userMessageIndex = messageIndex - 1
    if (userMessageIndex < 0 || messages[userMessageIndex].role !== 'user') return

    const userMessage = messages[userMessageIndex].content

    // Delete the old response
    await handleDeleteMessage(messageId)

    // Send the message again
    await handleSendMessage(userMessage)
  }

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await deleteDoc(doc(db, 'conversations', conversationId))
      if (conversationId === conversationId) {
        setConversationId('')
        setConversationTitle('New Chat')
        setMessages([])
      }
    } catch (error) {
      console.error('Error deleting conversation:', error)
    }
  }

  const handleSendMessage = async (content: string) => {
    if (!conversationId || !user) {
      // Create a new conversation if none exists
      await createNewConversation()
      return
    }

    // Add user message to local state immediately
    const userMessage: Message = {
      id: uuidv4(),
      conversationId,
      role: 'user',
      content,
      createdAt: Date.now(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      // Create abort controller for this request
      abortControllerRef.current = new AbortController()

      // Prepare conversation history for the API
      const conversationHistory = messages
        .slice(-5) // Keep last 5 messages for context
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }))

      conversationHistory.push({ role: 'user', content })

      // Ensure provider and model are strings before sending
      const safeProvider = typeof provider === 'string' ? provider : 'gemini'
      const safeModel = typeof model === 'string' ? model : 'gemini-2.5-flash'

      // Call the chat API with streaming
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          message: content,
          userId: user.uid,
          messages: conversationHistory,
          provider: safeProvider,
          model: safeModel,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error('Failed to get chat response')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      let assistantContent = ''
      const decoder = new TextDecoder()
      let messageId = uuidv4()
      let tokensUsed = { input: 0, output: 0 }
      let responseModel = model
      let isFallback = false

      // Create placeholder for assistant message
      const assistantMessage: Message = {
        id: messageId,
        conversationId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
      }

      setMessages((prev) => [...prev, assistantMessage])

      // Process the stream
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'chunk') {
                assistantContent += data.content
                setMessages((prev) => {
                  const newMessages = [...prev]
                  const lastMsg = newMessages[newMessages.length - 1]
                  if (lastMsg && lastMsg.role === 'assistant') {
                    lastMsg.content = assistantContent
                  }
                  return newMessages
                })
              } else if (data.type === 'done') {
                messageId = data.messageId
                tokensUsed = data.tokensUsed
                responseModel = data.model
                isFallback = data.isFallback

                // Update title if it's the first message
                if (messages.length === 0) {
                  const newTitle = content.substring(0, 50)
                  setConversationTitle(newTitle)
                }
              } else if (data.type === 'error') {
                throw new Error(data.error)
              }
            } catch (parseError) {
              // Ignore parse errors on incomplete JSON
              if (!line.includes('data: ')) continue
            }
          }
        }
      }
    } catch (error) {
      // Don't treat abort as an error
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Message generation was cancelled by user')
      } else {
        console.error('Error sending message:', error)
        // Remove the user message on error (but not for abort)
        setMessages((prev) => prev.filter((msg) => msg.content !== content))
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) {
    return null // Will redirect via useEffect
  }

  return (
    <div className="flex h-screen bg-[#fffbf0]">
      {/* Sidebar */}
      <div className="hidden md:flex md:w-64 flex-col">
        <ConversationList
          userId={user.uid}
          onSelectConversation={handleSelectConversation}
          onNewConversation={createNewConversation}
          onDeleteConversation={handleDeleteConversation}
          currentConversationId={conversationId}
        />
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col bg-[#fffbf0]">
        {/* Header */}
        <div className="border-b border-[#e8e5df] bg-white p-4 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3 flex-1">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="md:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <ConversationList
                  userId={user?.uid || ''}
                  onSelectConversation={(convId) => {
                    handleSelectConversation(convId)
                    setSidebarOpen(false)
                  }}
                  onNewConversation={() => {
                    createNewConversation()
                    setSidebarOpen(false)
                  }}
                  onDeleteConversation={(convId) => {
                    handleDeleteConversation(convId)
                    setSidebarOpen(false)
                  }}
                  currentConversationId={conversationId}
                />
              </SheetContent>
            </Sheet>
            
            {isEditingTitle ? (
              <div className="flex gap-2 flex-1">
                <input
                  autoFocus
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="flex-1 px-2 py-1 border border-[#d97706] rounded text-sm bg-white text-[#2d2d2d]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTitleUpdate()
                    if (e.key === 'Escape') setIsEditingTitle(false)
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleTitleUpdate}
                  title="Save title"
                  className="text-[#6b8e23] hover:bg-[#e8f4e3]"
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingTitle(false)}
                  title="Cancel"
                  className="text-[#dc2626] hover:bg-[#fee8e8]"
                >
                  <XIcon className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1">
                <h1 className="text-xl font-bold text-[#2d2d2d] truncate">{conversationTitle}</h1>
                {conversationId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditedTitle(conversationTitle)
                      setIsEditingTitle(true)
                    }}
                    title="Edit title"
                    className="text-[#6b8e23] hover:bg-[#e8f4e3]"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 items-center flex-1 ml-4">
            <ProviderSelector
              onSelect={(selectedProvider, selectedModel) => {
                const safeProvider = typeof selectedProvider === 'string' ? selectedProvider : 'gemini'
                const safeModel = typeof selectedModel === 'string' ? selectedModel : 'gemini-2.5-flash'

                if (!conversationId) {
                  setProvider(safeProvider)
                  setModel(safeModel)
                } else {
                  // Update existing conversation
                  // Ensure selectedProvider and selectedModel are strings
                  const safeProvider = typeof selectedProvider === 'string' ? selectedProvider : 'gemini'
                  const safeModel = typeof selectedModel === 'string' ? selectedModel : 'gemini-2.5-flash'
                  
                  updateDoc(doc(db, 'conversations', conversationId), {
                    provider: safeProvider,
                    model: safeModel,
                    updatedAt: Date.now(),
                  }).catch((err) => console.error('Error updating provider:', err))
                  setProvider(safeProvider)
                  setModel(safeModel)
                }
              }}
              currentProvider={provider}
              currentModel={model}
            />
          </div>

          <div className="flex gap-2 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/dashboard')}
              title="View analytics dashboard"
            >
              <BarChart3 className="w-4 h-4" />
            </Button>
            <UserProfile />
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#fffbf0]">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <Loader className="w-8 h-8 animate-spin text-[#d97706]" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[#7a8566]">
              <div className="text-center">
                <p className="text-lg font-medium mb-2">Start a new conversation</p>
                <p className="text-sm">Ask me anything!</p>
              </div>
            </div>
          ) : (
            messages.map((message, i) => {
              // Determine overrides for showing previous versions
              let renderedMessage = { ...message }
              if (message.role === 'assistant') {
                const prev = messages[i - 1]
                if (prev && prev.role === 'user') {
                  const history = editHistory[prev.id]
                  if (history && history.length > 0 && typeof showPreviousMap[prev.id] === 'number') {
                    const idx = showPreviousMap[prev.id] as number
                    renderedMessage = { ...renderedMessage, content: history[idx]?.oldAssistantContent || renderedMessage.content }
                  }
                }
              } else if (message.role === 'user') {
                const history = editHistory[message.id]
                if (history && history.length > 0 && typeof showPreviousMap[message.id] === 'number') {
                  const idx = showPreviousMap[message.id] as number
                  renderedMessage = { ...renderedMessage, content: history[idx]?.oldUser || renderedMessage.content }
                }
              }

              return (
                <div key={message.id} className="flex flex-col gap-2">
                  <ChatMessage
                    message={renderedMessage}
                    isUser={message.role === 'user'}
                    isLoading={isLoading && message.role === 'assistant' && message === messages[messages.length - 1]}
                    onEdit={handleEditMessage}
                    onDelete={handleDeleteMessage}
                    onRegenerate={handleRegenerateMessage}
                    isEditing={editModeId === message.id}
                    editValue={editDraft}
                    onEditChange={(v) => setEditDraft(v)}
                    onSaveEdit={() => handleSaveInlineEdit(message.id)}
                    onCancelEdit={cancelInlineEdit}
                  />

                  {message.role === 'user' && (
                    <div className="flex items-center justify-end gap-2 px-1 -mt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStartEditMessage(message.id, message.content)}
                        className="h-8 gap-2 text-[#6b8e23] hover:bg-[#e8f4e3] hover:text-[#5a7620]"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </Button>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (!editHistory[message.id]) await fetchEditHistory(message.id)
                            // show latest previous revision (index 0)
                            setShowPreviousMap((prev) => ({ ...prev, [message.id]: prev[message.id] == null ? 0 : null }))
                          }}
                          className="h-8 gap-2 text-[#7a8566] hover:bg-[#f5f3ef]"
                        >
                          {typeof showPreviousMap[message.id] === 'number' ? 'Show edited' : 'Show previous'}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            await fetchEditHistory(message.id)
                            setShowPreviousMap((prev) => ({ ...prev, [message.id]: prev[message.id] ?? 0 }))
                          }}
                          className="h-8 gap-2 text-[#7a8566] hover:bg-[#f5f3ef]"
                        >
                          History
                        </Button>

                        {editHistory[message.id] && editHistory[message.id].length > 0 && (
                          <>
                            <select
                              value={typeof showPreviousMap[message.id] === 'number' ? (showPreviousMap[message.id] as number) : 0}
                              onChange={(e) => setShowPreviousMap((prev) => ({ ...prev, [message.id]: Number(e.target.value) }))}
                              className="h-8 rounded border border-[#e8e5df] bg-white px-2 text-xs text-[#2d2d2d]"
                            >
                              {editHistory[message.id].map((rev, revIdx) => (
                                <option key={revIdx} value={revIdx}>
                                  Rev {editHistory[message.id].length - revIdx} • {rev.editedAt ? new Date(rev.editedAt).toLocaleString() : 'unknown time'}
                                </option>
                              ))}
                            </select>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-[#e8e5df] bg-white p-4 shadow-sm">
          {conversationId ? (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <ChatInput onSend={handleSendMessage} disabled={isLoading} />
              </div>
              {isLoading && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCancel}
                  title="Stop generation"
                  className="bg-[#dc2626] hover:bg-[#b91c1c] text-white"
                >
                  <X className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <ChatInput onSend={handleSendMessage} disabled={true} />
              <Button onClick={() => createNewConversation()} className="bg-[#6b8e23] hover:bg-[#5a7620] text-white">Create Chat</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
