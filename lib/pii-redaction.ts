// PII patterns and redaction utilities

export interface PIIPattern {
  name: string
  regex: RegExp
  replacement: string
}

// Define common PII patterns
export const PII_PATTERNS: PIIPattern[] = [
  {
    name: 'email',
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '[EMAIL]',
  },
  {
    name: 'phone_us',
    regex: /\b(?:\+?1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\b/g,
    replacement: '[PHONE]',
  },
  {
    name: 'ssn',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[SSN]',
  },
  {
    name: 'credit_card',
    regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: '[CREDIT_CARD]',
  },
  {
    name: 'ip_address',
    regex: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: '[IP_ADDRESS]',
  },
  {
    name: 'url',
    regex: /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&/=]*)/g,
    replacement: '[URL]',
  },
  {
    name: 'date_of_birth',
    regex: /\b(?:0?[1-9]|1[0-2])[-\/](?:0?[1-9]|[12][0-9]|3[01])[-\/](?:19|20)?[0-9]{2}\b/g,
    replacement: '[DOB]',
  },
  {
    name: 'api_key',
    regex: /(?:api[_-]?key|apikey|key|secret|token)[\s:=]+[a-zA-Z0-9\-_]{20,}/gi,
    replacement: '[API_KEY]',
  },
]

/**
 * Redact PII from text
 * @param text Input text that may contain PII
 * @param enabledPatterns Array of pattern names to redact (null = all)
 * @returns Text with PII redacted
 */
export function redactPII(text: string, enabledPatterns?: string[]): string {
  if (!text) return text

  let redacted = text
  const patterns = enabledPatterns
    ? PII_PATTERNS.filter((p) => enabledPatterns.includes(p.name))
    : PII_PATTERNS

  patterns.forEach((pattern) => {
    redacted = redacted.replace(pattern.regex, pattern.replacement)
  })

  return redacted
}

/**
 * Detect PII in text
 * @param text Input text to check for PII
 * @returns Object with detected PII types and counts
 */
export function detectPII(text: string): Record<string, number> {
  const detected: Record<string, number> = {}

  PII_PATTERNS.forEach((pattern) => {
    const matches = text.match(pattern.regex)
    if (matches) {
      detected[pattern.name] = matches.length
    }
  })

  return detected
}

/**
 * Extract PII from text
 * @param text Input text to extract PII from
 * @returns Array of found PII items
 */
export function extractPII(
  text: string
): Array<{ type: string; value: string }> {
  const found: Array<{ type: string; value: string }> = []

  PII_PATTERNS.forEach((pattern) => {
    const matches = text.matchAll(pattern.regex)
    for (const match of matches) {
      found.push({
        type: pattern.name,
        value: match[0],
      })
    }
  })

  return found
}
