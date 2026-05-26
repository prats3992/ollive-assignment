import { NextRequest, NextResponse } from 'next/server'
import { encryptString, decryptString } from '@/lib/encryption'

// Initialize Firebase Admin only if credentials are available
let adminApp: any = null
let adminAuth: any = null
let adminDb: any = null

async function initFirebaseAdmin() {
  if (adminApp) return // Already initialized

  try {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app')
    const { getAuth } = await import('firebase-admin/auth')
    const { getFirestore } = await import('firebase-admin/firestore')

    const firebaseAdminConfig = {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }

    // Check if required credentials are available
    if (!firebaseAdminConfig.projectId || !firebaseAdminConfig.privateKey || !firebaseAdminConfig.clientEmail) {
      throw new Error('Missing Firebase Admin credentials in environment variables')
    }

    const existingApps = getApps()
    if (existingApps.length === 0) {
      adminApp = initializeApp({
        credential: cert(firebaseAdminConfig as any),
        projectId: firebaseAdminConfig.projectId,
      })
    } else {
      adminApp = existingApps[0]
    }

    adminDb = getFirestore(adminApp)
    adminAuth = getAuth(adminApp)
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error)
    throw error
  }
}

// Save encrypted API keys
export async function POST(request: NextRequest) {
  try {
    await initFirebaseAdmin()

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const decodedToken = await adminAuth.verifyIdToken(token)
    const userId = decodedToken.uid

    const payload = await request.json()
    const { geminiApiKey, openaiApiKey, claudeApiKey, openrouterApiKey } = payload

    // Encrypt each key
    const encryptedData: any = {
      userId,
      updatedAt: Date.now(),
    }

    if (geminiApiKey) {
      encryptedData.geminiApiKey = encryptString(geminiApiKey)
    }
    if (openaiApiKey) {
      encryptedData.openaiApiKey = encryptString(openaiApiKey)
    }
    if (claudeApiKey) {
      encryptedData.claudeApiKey = encryptString(claudeApiKey)
    }
    if (openrouterApiKey) {
      encryptedData.openrouterApiKey = encryptString(openrouterApiKey)
    }

    // Store encrypted data
    await adminDb.collection('userSettings').doc(userId).set(encryptedData, { merge: true })

    return NextResponse.json({ success: true, message: 'API keys saved securely' })
  } catch (error) {
    console.error('Error saving API keys:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to save API keys' },
      { status: 500 }
    )
  }
}

// Retrieve decrypted API key for internal use only
export async function GET(request: NextRequest) {
  try {
    await initFirebaseAdmin()

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const decodedToken = await adminAuth.verifyIdToken(token)
    const userId = decodedToken.uid

    const provider = request.nextUrl.searchParams.get('provider')
    if (!provider) {
      return NextResponse.json({ error: 'Provider parameter required' }, { status: 400 })
    }

    // Retrieve encrypted data
    const settingsDoc = await adminDb.collection('userSettings').doc(userId).get()

    if (!settingsDoc.exists) {
      return NextResponse.json({ error: 'No API keys configured' }, { status: 404 })
    }

    const data = settingsDoc.data()
    const keyField = `${provider}ApiKey`

    if (!data || !data[keyField]) {
      return NextResponse.json({ error: `No API key for ${provider}` }, { status: 404 })
    }

    // Decrypt and return only the requested key
    const decryptedKey = decryptString(data[keyField])

    return NextResponse.json({ apiKey: decryptedKey })
  } catch (error) {
    console.error('Error retrieving API key:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to retrieve API key' },
      { status: 500 }
    )
  }
}
