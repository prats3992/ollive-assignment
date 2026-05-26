import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore'
import { IngestLogPayload } from '@/lib/types'

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

    // Get userId from conversation document
    let userId = 'anonymous'
    try {
      const convRef = doc(db, 'conversations', payload.conversationId)
      const convSnap = await getDoc(convRef)
      if (convSnap.exists()) {
        userId = convSnap.data().userId || 'anonymous'
      }
    } catch (err) {
      console.warn('Could not fetch conversation for userId:', err)
    }

    // Store in Firestore
    const logsRef = collection(db, 'inferenceLogs')
    const docRef = await addDoc(logsRef, {
      ...payload,
      userId, // Add userId for filtering in dashboard
      timestamp: Date.now(),
      createdAt: serverTimestamp(),
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
