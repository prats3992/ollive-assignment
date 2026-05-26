import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY

if (!apiKey) {
  throw new Error('NEXT_PUBLIC_GEMINI_API_KEY is not set')
}

const genAI = new GoogleGenerativeAI(apiKey)

export function getModel(modelName: string) {
  return genAI.getGenerativeModel({ model: modelName })
}

export function getPrimaryModel() {
  return getModel(process.env.PRIMARY_MODEL || 'gemini-2.5-flash')
}

export function getFallbackModel() {
  return getModel(process.env.FALLBACK_MODEL || 'gemini-2.0-flash')
}
