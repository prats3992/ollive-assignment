import { NextRequest, NextResponse } from 'next/server'
import { chat } from '@/lib/llm/chat'
import { db } from '@/lib/firebase'
import {
  collection,
  addDoc,
  getDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { redactPII } from '@/lib/pii-redaction'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const { conversationId, message, userId, messages: previousMessages } = await request.json()

    if (!conversationId || !message || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: conversationId, message, userId' },
        { status: 400 }
      )
    }

    // Create encoder for streaming
    const encoder = new TextEncoder()
    let messageId = uuidv4()
    let logPayload: any = null

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Get conversation to retrieve context
          const convRef = doc(db, 'conversations', conversationId)
          const convSnap = await getDoc(convRef)

          if (!convSnap.exists()) {
            controller.enqueue(encoder.encode('data: {"error": "Conversation not found"}\n\n'))
            controller.close()
            return
          }

          const conversationData = convSnap.data()

          // Format messages for the chat
          const formattedMessages = [
            ...(previousMessages || []),
            { role: 'user', content: message },
          ]

          // Call the LLM with streaming
          const response = await chat(formattedMessages, {
            conversationId,
            userId,
            systemPrompt:
              'You are a helpful assistant. Keep responses concise and engaging. Maximum response length is 500 tokens.',
            onChunk: (chunk: string) => {
              try {
                // Check if stream is still open before enqueueing
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`)
                )
              } catch (err) {
                // Stream was closed (aborted), ignore
                if ((err as any).code === 'ERR_INVALID_STATE') {
                  console.log('Stream closed by client')
                  return
                }
                throw err
              }
            },
            onLog: async (log: any) => {
              logPayload = log
              messageId = log.messageId

              // Send ingestion event
              try {
                await fetch(new URL('/api/logs/ingest', request.url), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(log),
                })
              } catch (logErr) {
                console.error('Failed to send log:', logErr)
              }
            },
          })

          // Save user message with optional PII redaction
          await addDoc(collection(db, 'messages', conversationId, 'items'), {
            role: 'user',
            content: redactPII(message), // Apply PII redaction
            createdAt: Date.now(),
          })

          // Save assistant message with optional PII redaction
          await addDoc(collection(db, 'messages', conversationId, 'items'), {
            role: 'assistant',
            content: redactPII(response.response), // Apply PII redaction
            createdAt: Date.now(),
            tokensUsed: response.tokensUsed,
          })

          // Update conversation
          await updateDoc(convRef, {
            updatedAt: Date.now(),
            messageCount: (conversationData.messageCount || 0) + 2,
          })

          // Send final message with metadata
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'done',
                messageId,
                tokensUsed: response.tokensUsed,
                model: response.model,
                isFallback: response.isFallback,
              })}\n\n`
            )
          )

          controller.close()
        } catch (error) {
          console.error('Stream error:', error)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', error: (error as Error).message })}\n\n`
            )
          )
          controller.close()
        }
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Internal server error' },
      { status: 500 }
    )
  }
}
