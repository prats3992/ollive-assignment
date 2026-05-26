import { getPrimaryModel, getFallbackModel } from './client'
import { IngestLogPayload, Message } from '../types'
import { v4 as uuidv4 } from 'uuid'

export interface ChatOptions {
  conversationId: string
  userId: string
  systemPrompt?: string
  temperature?: number
  onChunk?: (chunk: string) => void
  onLog?: (log: IngestLogPayload) => Promise<void>
}

interface ContentPart {
  text?: string
}

export async function chat(
  messages: Array<{ role: string; content: string }>,
  options: ChatOptions
): Promise<{
  response: string
  tokensUsed: { input: number; output: number }
  model: string
  isFallback: boolean
}> {
  const startTime = Date.now()
  const messageId = uuidv4()
  let response = ''
  let tokensUsed = { input: 0, output: 0 }
  let usedFallback = false
  let currentModel = 'gemini-2.5-flash'
  let error: string | undefined

  try {
    const primaryModel = getPrimaryModel()
    const formattedMessages = messages.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }))

    const systemInstruction = {
      role: 'user',
      parts: [{ text: options.systemPrompt || 'You are a helpful assistant.' }],
    }

    const chat = primaryModel.startChat({
      history: formattedMessages.slice(0, -1),
      systemInstruction,
    })

    const userMessage = messages[messages.length - 1].content
    const result = await chat.sendMessageStream(userMessage)

    for await (const chunk of result.stream) {
      const text = chunk.text?.()
      if (text) {
        response += text
        if (options.onChunk) {
          options.onChunk(text)
        }
      }
    }

    const finalResult = await result.response
    tokensUsed = {
      input: finalResult.usageMetadata?.promptTokenCount || 0,
      output: finalResult.usageMetadata?.candidatesTokenCount || 0,
    }
  } catch (err) {
    console.error('Primary model failed, attempting fallback:', err)
    usedFallback = true
    currentModel = process.env.FALLBACK_MODEL || 'gemini-2.0-flash'
    error = (err as Error).message

    try {
      const fallbackModel = getFallbackModel()
      const formattedMessages = messages.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }))

      const systemInstruction = {
        role: 'user',
        parts: [{ text: options.systemPrompt || 'You are a helpful assistant.' }],
      }

      const chat = fallbackModel.startChat({
        history: formattedMessages.slice(0, -1),
        systemInstruction,
      })

      const userMessage = messages[messages.length - 1].content
      const result = await chat.sendMessageStream(userMessage)

      for await (const chunk of result.stream) {
        const text = chunk.text?.()
        if (text) {
          response += text
          if (options.onChunk) {
            options.onChunk(text)
          }
        }
      }

      const finalResult = await result.response
      tokensUsed = {
        input: finalResult.usageMetadata?.promptTokenCount || 0,
        output: finalResult.usageMetadata?.candidatesTokenCount || 0,
      }

      error = undefined // Clear error since fallback succeeded
    } catch (fallbackErr) {
      error = (fallbackErr as Error).message
      throw new Error(`Both primary and fallback models failed: ${error}`)
    }
  }

  const latencyMs = Date.now() - startTime

  // Log the inference
  if (options.onLog) {
    const logPayload: IngestLogPayload = {
      conversationId: options.conversationId,
      messageId,
      model: currentModel,
      provider: 'gemini',
      isFallback: usedFallback,
      latencyMs,
      tokensInput: tokensUsed.input,
      tokensOutput: tokensUsed.output,
      status: error ? 'failed' : 'success',
      error,
    }
    await options.onLog(logPayload)
  }

  return {
    response,
    tokensUsed,
    model: currentModel,
    isFallback: usedFallback,
  }
}
