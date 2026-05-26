import { NextRequest, NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { getApps } from 'firebase-admin/app'
import { IngestLogPayload } from '@/lib/types'

function initAdmin() {
  if (getApps().length === 0) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload: IngestLogPayload = await request.json()

    // Validate required fields
    const required = [
      'conversationId',
      'messageId',
      'model',
      'provider',
      'latencyMs',
      'tokensInput',
      'tokensOutput',
      'status',
    ]

    for (const field of required) {
      if (!(field in payload)) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // Use Admin SDK for server-side reads/writes (bypass security rules)
    initAdmin()
    const adminDb = admin.firestore()

    // Get userId from conversation document
    let userId = 'anonymous'
    try {
      const convDoc = await adminDb.collection('conversations').doc(payload.conversationId).get()
      if (convDoc.exists) {
        userId = convDoc.data()?.userId || 'anonymous'
      }
    } catch (err) {
      console.warn('Could not fetch conversation for userId:', err)
    }

    // Store in Firestore via Admin SDK
    const docRef = await adminDb.collection('inferenceLogs').add({
      ...payload,
      userId,
      timestamp: Date.now(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return NextResponse.json(
      {
        success: true,
        logId: docRef.id,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Ingestion error:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Internal server error' },
      { status: 500 }
    )
  }
}
