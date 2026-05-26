// Conversation type
export interface Conversation {
  id: string
  userId: string
  title: string
  createdAt: number // timestamp
  updatedAt: number // timestamp
  model: string
  provider: 'gemini' | 'openai' | 'claude' | 'openrouter'
  messageCount: number
}

// Message type
export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number // timestamp
  tokensUsed?: {
    input: number
    output: number
  }
}

// Inference Log type
export interface InferenceLog {
  id: string
  conversationId: string
  messageId: string
  model: string
  provider: 'gemini' | 'openai' | 'claude' | 'openrouter'
  isFallback: boolean
  latencyMs: number
  tokensInput: number
  tokensOutput: number
  status: 'success' | 'failed' | 'partial'
  error?: string
  timestamp: number
  metadata?: {
    gpuUtilization?: number
    cpuUtilization?: number
    memoryUsageMb?: number
    [key: string]: any
  }
}

// Chat request type
export interface ChatRequest {
  conversationId: string
  message: string
  userId: string
}

// Chat response type
export interface ChatResponse {
  messageId: string
  content: string
  tokensUsed: {
    input: number
    output: number
  }
  model: string
  isFallback: boolean
}

// Ingestion log payload
export interface IngestLogPayload {
  conversationId: string
  messageId: string
  model: string
  provider: 'gemini' | 'openai' | 'claude' | 'openrouter'
  isFallback: boolean
  latencyMs: number
  tokensInput: number
  tokensOutput: number
  status: 'success' | 'failed' | 'partial'
  error?: string
  metadata?: Record<string, any>
}

// User Settings type (for API keys and preferences)
export interface UserSettings {
  userId: string
  geminiApiKey?: string
  openaiApiKey?: string
  claudeApiKey?: string
  openrouterApiKey?: string
  piiRedactionEnabled: boolean
  createdAt: number
  updatedAt: number
}

// User session type
export interface UserSession {
  userId: string
  email: string
  name?: string
  createdAt: number
  lastActivityAt: number
}
