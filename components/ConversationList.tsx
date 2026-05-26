'use client'

import React, { useEffect, useState } from 'react'
import { Conversation } from '@/lib/types'
import { db } from '@/lib/firebase'
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MessageSquare, Plus, Trash2, Clock, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface ConversationListProps {
  userId: string
  onSelectConversation: (conversationId: string, title: string) => void
  onNewConversation: () => void
  onDeleteConversation?: (conversationId: string) => void
  currentConversationId?: string
}

export function ConversationList({
  userId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  currentConversationId,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [conversationToDelete, setConversationToDelete] = useState<{ id: string; title: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async (e: React.MouseEvent, conversationId: string, title: string) => {
    e.stopPropagation()
    setConversationToDelete({ id: conversationId, title })
  }

  const confirmDelete = async () => {
    if (!conversationToDelete) return

    setIsDeleting(true)
    try {
      // Delete conversation document
      await deleteDoc(doc(db, 'conversations', conversationToDelete.id))
      
      // Delete all messages in subcollection
      const messagesRef = collection(db, 'messages', conversationToDelete.id, 'items')
      const messagesSnap = await query(messagesRef)
      // Note: You'll need to batch delete these in production
      
      onDeleteConversation?.(conversationToDelete.id)
      setConversationToDelete(null)
    } catch (error) {
      console.error('Error deleting conversation:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  useEffect(() => {
    if (!userId) return

    const q = query(
      collection(db, 'conversations'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const convs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Conversation[]
        setConversations(convs)
        setLoading(false)
      },
      (error) => {
        console.error('Error fetching conversations:', error)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [userId])

  return (
    <div className="w-full max-w-xs bg-[#faf8f3] border-r border-[#e8e5df] flex flex-col h-full">
      <div className="p-4 border-b border-[#e8e5df]">
        <Button onClick={onNewConversation} className="w-full bg-[#6b8e23] hover:bg-[#5a7620] text-white" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-2 py-2">
          {loading ? (
            <div className="p-4 text-center text-sm text-[#7a8566]">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-[#7a8566]">No conversations yet</div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <div key={conv.id} className="group flex items-center gap-2">
                  <button
                    onClick={() => onSelectConversation(conv.id, conv.title)}
                    className={`flex-1 text-left px-3 py-2 rounded-lg transition-colors text-sm truncate ${
                      currentConversationId === conv.id
                        ? 'bg-[#e8f4e3] text-[#6b8e23] border-l-4 border-[#6b8e23]'
                        : 'hover:bg-[#f5f3ef] text-[#2d2d2d]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MessageSquare className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate font-medium">{conv.title}</span>
                    </div>
                    <div className="text-xs text-[#a8a092] ml-6 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true })}
                    </div>
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, conv.id, conv.title)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#dc2626] hover:bg-[#fee8e8] rounded transition-all"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      {conversationToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-[#fee8e8]">
                <AlertTriangle className="h-6 w-6 text-[#dc2626]" />
              </div>
              <h3 className="text-lg font-semibold text-[#2d2d2d]">Delete Conversation</h3>
            </div>

            <Alert className="bg-[#fef2f2] border-[#fecaca]">
              <AlertDescription className="text-[#991b1b] text-sm">
                Are you sure you want to delete <span className="font-semibold">"{conversationToDelete.title}"</span>? This cannot be undone.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3 justify-end pt-4">
              <Button
                onClick={() => setConversationToDelete(null)}
                disabled={isDeleting}
                className="border-[#d97706] text-[#2d2d2d] hover:bg-[#faf8f3]"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="bg-[#dc2626] hover:bg-[#b91c1c] text-white"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
