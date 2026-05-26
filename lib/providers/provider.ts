// Provider abstraction for multi-provider support

export interface Provider {
  name: 'gemini' | 'openai' | 'claude' | 'openrouter'
  models: string[]
  sendMessage(
    messages: Array<{ role: string; content: string }>,
    model: string,
    systemPrompt?: string
  ): Promise<{
    text: string
    tokensUsed: { input: number; output: number }
  }>
}

export class ProviderFactory {
  static getProvider(provider: string): Provider {
    switch (provider) {
      case 'openai':
        return new OpenAIProvider()
      case 'claude':
        return new ClaudeProvider()
      case 'openrouter':
        return new OpenRouterProvider()
      case 'gemini':
      default:
        return new GeminiProvider()
    }
  }

  static getAvailableProviders(): Array<{ name: string; label: string; models: string[] }> {
    return [
      {
        name: 'gemini',
        label: 'Google Gemini',
        models: ['gemini-2.5-flash', 'gemini-2.0-flash'],
      },
      {
        name: 'openai',
        label: 'OpenAI (requires API key)',
        models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      },
      {
        name: 'claude',
        label: 'Claude (requires API key)',
        models: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
      },
      {
        name: 'openrouter',
        label: 'OpenRouter (multi-model, requires API key)',
        models: ['openrouter/auto', 'anthropic/claude-3.5-sonnet', 'openai/gpt-4-turbo'],
      },
    ]
  }
}

// Gemini Provider
class GeminiProvider implements Provider {
  name: 'gemini' = 'gemini'
  models = ['gemini-2.5-flash', 'gemini-2.0-flash']

  async sendMessage(
    messages: Array<{ role: string; content: string }>,
    model: string,
    systemPrompt?: string
  ): Promise<{ text: string; tokensUsed: { input: number; output: number } }> {
    // This will be implemented in lib/llm/chat.ts using the existing Google SDK
    throw new Error('Use Gemini provider through lib/llm/chat.ts')
  }
}

// OpenAI Provider
class OpenAIProvider implements Provider {
  name: 'openai' = 'openai'
  models = ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo']

  async sendMessage(
    messages: Array<{ role: string; content: string }>,
    model: string,
    systemPrompt?: string
  ): Promise<{ text: string; tokensUsed: { input: number; output: number } }> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${error}`)
    }

    const data = await response.json()
    const text = data.choices[0].message.content

    return {
      text,
      tokensUsed: {
        input: data.usage.prompt_tokens,
        output: data.usage.completion_tokens,
      },
    }
  }
}

// Claude Provider
class ClaudeProvider implements Provider {
  name: 'claude' = 'claude'
  models = ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5']

  async sendMessage(
    messages: Array<{ role: string; content: string }>,
    model: string,
    systemPrompt?: string
  ): Promise<{ text: string; tokensUsed: { input: number; output: number } }> {
    const apiKey = process.env.CLAUDE_API_KEY
    if (!apiKey) {
      throw new Error('CLAUDE_API_KEY not configured')
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        system: systemPrompt || 'You are a helpful assistant.',
        messages,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Claude API error: ${error}`)
    }

    const data = await response.json()
    const text = data.content[0].text

    return {
      text,
      tokensUsed: {
        input: data.usage.input_tokens,
        output: data.usage.output_tokens,
      },
    }
  }
}

// OpenRouter Provider
class OpenRouterProvider implements Provider {
  name: 'openrouter' = 'openrouter'
  models = ['openrouter/auto', 'anthropic/claude-4.6-sonnet', 'openai/gpt-4-turbo']

  async sendMessage(
    messages: Array<{ role: string; content: string }>,
    model: string,
    systemPrompt?: string
  ): Promise<{ text: string; tokensUsed: { input: number; output: number } }> {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured')
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ollive.vercel.app',
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenRouter API error: ${error}`)
    }

    const data = await response.json()
    const text = data.choices[0].message.content

    return {
      text,
      tokensUsed: {
        input: data.usage.prompt_tokens,
        output: data.usage.completion_tokens,
      },
    }
  }
}
