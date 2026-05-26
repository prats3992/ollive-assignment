# Ollive - Architecture & Technical Design

## System Overview

Ollive is a lightweight LLM inference logging and ingestion system that captures comprehensive metadata about LLM API calls and stores them for analytics.

```
┌─────────────────┐
│   Frontend      │
│  (Next.js 16)   │
├─────────────────┤
│ • Chat UI       │
│ • Auth Pages    │
│ • Dashboard     │
└────────┬────────┘
         │ HTTP/SSE
         ↓
┌─────────────────────┐
│  Backend (Next.js)  │
├─────────────────────┤
│ • /api/chat         │
│ • /api/logs/ingest  │
│ • LLM SDK           │
└────────┬───────────┬┘
         │           │
    HTTP │ (stream)  │ HTTP (async)
         ↓           ↓
    ┌─────────┐   ┌──────────────┐
    │ Gemini  │   │ Firestore    │
    │ API     │   │ • Messages   │
    │         │   │ • Logs       │
    └─────────┘   │ • Sessions   │
                  └──────────────┘
```

## Component Architecture

### 1. Frontend Layer

#### Pages
- **`/page.tsx`**: Root page that redirects authenticated users to `/chat` or unauthenticated to `/auth/login`
- **`/auth/login`**: Email/password login form
- **`/auth/signup`**: User registration with Firebase Auth
- **`/chat`**: Main conversation interface
- **`/dashboard`**: Analytics and metrics display

#### Components
- **`AuthContext.tsx`**: React Context for Firebase Auth state management
  - Provides `useAuth()` hook across the app
  - Handles signup, login, logout, and error states

- **`ChatMessage.tsx`**: Individual message display
  - Renders user messages (right-aligned, blue)
  - Renders assistant messages (left-aligned, gray)
  - Displays token usage for assistant messages
  - Typing animation for streaming messages

- **`ChatInput.tsx`**: Message input form
  - Send button with loading state
  - Keyboard shortcut (Enter to send, Shift+Enter for new line)
  - Prevents submission while loading

- **`ConversationList.tsx`**: Sidebar with conversation history
  - Real-time updates via Firestore listener
  - Click to resume conversation
  - "New Chat" button to create fresh conversation
  - Shows last updated timestamp

### 2. Backend API Layer

#### `/api/chat` (POST)
```
Request:
{
  conversationId: string
  message: string
  userId: string
  messages: Array<{role: string, content: string}>
}

Response: Server-Sent Events (text/event-stream)
- data: {type: "chunk", content: string}  (streaming)
- data: {type: "done", messageId, tokensUsed, model, isFallback}  (completion)
- data: {type: "error", error: string}  (errors)
```

**Flow:**
1. Validate request parameters
2. Load conversation from Firestore
3. Call LLM SDK with message history
4. Stream chunks back via SSE with `onChunk` callback
5. Save user & assistant messages to Firestore
6. Update conversation metadata (messageCount, lastUpdated)
7. Send completion event with metadata

#### `/api/logs/ingest` (POST)
```
Request:
{
  conversationId: string
  messageId: string
  model: string
  provider: string
  isFallback: boolean
  latencyMs: number
  tokensInput: number
  tokensOutput: number
  status: string
  error?: string
  metadata?: object
}

Response:
{
  success: true
  logId: string
}
```

**Flow:**
1. Validate required fields
2. Add server-side timestamp
3. Store in Firestore `inferenceLogs` collection
4. Return immediately (fire-and-forget)

### 3. LLM SDK Layer

#### `lib/llm/client.ts`
- Initializes Google Generative AI client
- Provides `getModel()` helper for accessing specific models
- `getPrimaryModel()` → Gemini 2.5 Flash
- `getFallbackModel()` → Gemini 2.0 Flash

#### `lib/llm/chat.ts`
Core chat logic with streaming and fallback:

**Algorithm:**
```
1. Start timer
2. Try PRIMARY_MODEL:
   - Format messages (user/model roles)
   - startChat() with history
   - sendMessageStream() for streaming
   - OnChunk callback fires as chunks arrive
   - Collect tokens from usageMetadata
3. If FAILED → Try FALLBACK_MODEL (same flow)
4. Calculate latencyMs
5. Invoke onLog callback with metadata
6. Return response + metadata
```

**Key Features:**
- Streaming via `sendMessageStream()`
- Automatic fallback on error
- Configurable system prompt
- Context limiting (slices to last 5 messages for cost)
- Token usage tracking from metadata

### 4. Data Layer

#### Firebase Firestore
Serverless NoSQL database with real-time capabilities.

**Collections:**
```
firestore
├── conversations/{conversationId}
│   └── Contains: userId, title, createdAt, updatedAt, model, messageCount
│
├── messages/{conversationId}/items/{messageId}
│   └── Contains: role, content, createdAt, tokensUsed
│
└── inferenceLogs/{logId}
    └── Contains: conversationId, model, latencyMs, tokensInput, tokensOutput, status, etc.
```

**Indexes:**
- `conversations`: userId + updatedAt (for listing user's chats)
- `inferenceLogs`: userId + timestamp (for dashboard queries)

#### Firebase Authentication
- Email/password authentication
- Session management via `onAuthStateChanged()`
- Automatic token refresh
- CORS pre-configured

## Data Flow

### Chat Flow (Happy Path)

```
User Input
    ↓
[ChatInput] onSend triggered
    ↓
Create local Message (user)
    ↓
POST /api/chat {conversationId, message, userId, messages}
    ↓
[chat/route.ts] validate & load conversation
    ↓
[llm/chat.ts] call LLM SDK
    ↓
[GenAI SDK] startChat().sendMessageStream()
    ↓
[chat/route.ts] Stream chunks via SSE (onChunk callback)
    ↓
Frontend receives SSE events
    ↓
[ChatMessage] Typing animation as chunks arrive
    ↓
[llm/chat.ts] onLog callback fires
    ↓
POST /api/logs/ingest (async, fire-and-forget)
    ↓
[logs/ingest/route.ts] Validate & save to Firestore
    ↓
[ChatInput] Enable input again
    ↓
User sees full response
```

### Fallback Flow (Primary Fails)

```
[llm/chat.ts] startChat().sendMessageStream() throws error
    ↓
Catch error block
    ↓
isFallback = true
    ↓
Try getFallbackModel().startChat().sendMessageStream()
    ↓
If success: continue normal flow with isFallback=true
If fails: throw "Both models failed"
    ↓
Error logged with isFallback flag
```

## Key Design Decisions

### 1. **Server-Sent Events for Streaming**
- ✅ Simpler than WebSockets for this use case
- ✅ Native browser support
- ✅ Text-based events easy to parse
- ✅ Automatic reconnection
- ⚠️ Unidirectional (server → client only)

### 2. **Firebase over Self-hosted DB**
- ✅ Zero infrastructure management
- ✅ Auto-scaling built-in
- ✅ Real-time listeners for conversations
- ✅ Integrated authentication
- ⚠️ Vendor lock-in
- ⚠️ Higher cost at extreme scale (10k+/day)

### 3. **Async Logging (Fire-and-Forget)**
- ✅ No blocking on user experience
- ✅ Faster perceived response time
- ⚠️ Rare loss of logs possible (e.g., process crash)
- 💡 Mitigation: Could add local queue + retry

### 4. **Context Window = Last 5 Messages**
- ✅ Cost optimization (fewer tokens)
- ✅ Better relevance than full history
- ✅ Reduces API latency
- ⚠️ May lose distant context
- 💡 Could be configurable per conversation

### 5. **Next.js for Backend**
- ✅ Single codebase (Frontend + Backend)
- ✅ Easy deployment (Vercel, self-hosted)
- ✅ Built-in middleware support
- ✅ Type safety across API boundary
- ⚠️ Overkill for API-only service (could use FastAPI)

### 6. **Metadata Capture at SDK Layer**
- ✅ Centralized logging logic
- ✅ Captures all necessary context
- ✅ Works with or without streaming
- ⚠️ Requires callback pattern

## Performance Considerations

### Latency Breakdown (Example: 3-second response)

```
User Input → API Request:           ~50ms (network)
API Processing (auth, load conv):   ~50ms
LLM Streaming (first token):        ~800ms (to API)
Token streaming (avg):              ~30ms per token
Full response received:             ~2000ms (for ~50 tokens)
Log Ingestion:                      <10ms (async)
─────────────────────────────────────
Total User-visible:                 ~3000ms
```

### Token Optimization

**Without Context Limit:**
```
Full 50-message conversation × 50 tokens average = 2500 tokens
Cost: 2500 × $0.075/1M = $0.000188 per request
```

**With Last 5 Messages:**
```
5 messages × 50 tokens = 250 tokens + new message 20 tokens = 270 tokens
Cost: 270 × $0.075/1M = $0.00002 per request
Savings: 89% reduction in token usage
```

### Firestore Read/Write Costs

**Free Tier (Firebase):**
- 50k reads/day
- 20k writes/day
- 1GB storage

**Breakdown per user per day (10 messages):**
- Writes: 10 messages + 10 logs + 10 updates = 30 writes
- Reads: 1 load conversation + 1 load messages = 2 reads
- Scale: 1600 users = 48k writes + 3.2k reads (fits free tier!)

## Security Architecture

### Authentication & Authorization

1. **Firebase Authentication**:
   - Email/password signup/login
   - JWT token-based session management
   - `browserLocalPersistence` for sustained user sessions
   - Automatic token refresh

2. **User Data Isolation**:
   - All queries filtered by `userId`
   - Firestore security rules enforce user-only access
   - Messages and logs scoped to authenticated user

### API Key Management (Session 4+)

**Problem**: Production deployments need user-provided API keys instead of hardcoded `.env` keys.

**Solution**: AES-256-GCM encrypted key storage

```
User Input (Settings Dialog)
    ↓
[UserSettings Component] User enters key
    ↓
POST /api/settings/api-keys (with Firebase ID token)
    ↓
[api-keys/route.ts] Verify token, extract userId
    ↓
[lib/encryption.ts] AES-256-GCM encrypt each key
    ↓
Firestore: userSettings/{userId} (encrypted blobs)
    ↓
When chat called: GET /api/settings/api-keys?provider=gemini
    ↓
[api-keys/route.ts] Decrypt server-side only (never to client)
    ↓
Use decrypted key for API calls
```

**Architecture Details:**
- **Encryption Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Management**: `ENCRYPTION_KEY` env var (256-bit, server-only)
- **Storage**: Firestore (encrypted ciphertext + IV + auth tag)
- **Access**: Only server-side decryption, client never sees plaintext
- **Fallback**: If no user key → use `NEXT_PUBLIC_*_API_KEY` from `.env` (local dev only)

**Security Layers:**
| Layer | Protection |
|-------|-----------|
| Transport | HTTPS only |
| Authentication | Firebase ID token required |
| Authorization | User can only access own keys |
| Encryption | AES-256-GCM (tamper-proof) |
| Key Storage | Server environment (not in code) |
| Access Pattern | Decryption on demand, no key caching |

### PII Redaction (Session 4+)

**Problem**: Users may send sensitive data (emails, phone numbers, SSN) that gets stored in Firestore.

**Solution**: Automatic redaction before storage

```
User Message: "My email is john@example.com and phone 555-1234"
    ↓
[lib/pii-redaction.ts] detectPII() scan
    ↓
Patterns matched:
  - email: [EMAIL]
  - phone_us: [PHONE]
    ↓
redactPII() output: "My email is [EMAIL] and phone [PHONE]"
    ↓
Stored in Firestore (redacted version)
```

**Supported Patterns:**
- Email addresses: `[EMAIL]`
- Phone numbers (US & intl): `[PHONE]`
- Social Security Numbers: `[SSN]`
- Credit card numbers: `[CREDIT_CARD]`
- IP addresses: `[IP_ADDRESS]`
- URLs: `[URL]`
- Dates of birth: `[DOB]`
- API keys/secrets: `[API_KEY]`

**Applied In:**
- `/api/chat/route.ts`: Both user and assistant messages redacted before storage
- Optional: Could be toggled per-conversation in user settings

### Additional Security Considerations

1. **Firestore Security Rules**: Restrict to authenticated users only
2. **Rate Limiting**: Should be added at API routes for DDoS protection
3. **Audit Logging**: Track access to encrypted keys (future enhancement)
4. **Key Rotation**: Implement periodic encryption key rotation
5. **Data Deletion**: Users should be able to delete conversations and associated logs

## Current Implementation

### Previous Design (Sessions 1-3)
1. **Authentication**: Firebase handles via JWT tokens
2. **Authorization**: User can only access own conversations
3. **API Keys**: Stored in `.env.local` (frontend only, safe for public API)
4. **Data Privacy**: No user data sharing between conversations

### Enhanced Design (Session 4+)
1. **Authentication**: Firebase JWT + multi-factor (future)
2. **Authorization**: User-scoped Firestore rules + server-side verification
3. **API Keys**: Encrypted storage in Firestore for multi-provider support
4. **Data Privacy**: PII automatic redaction before storage
5. **Deployment**: User keys for production, .env keys for local dev

## Scalability Path

### Current State (MVP)
- ~100 concurrent users
- ~1000 requests/day
- ~10KB per conversation average
- Single region (Firebase auto-replicates)

### Scale to 10k Users
- Add Redis for session caching
- Implement request batching for logs
- Split inferenceLogs into time-series partitions
- Add CDN for frontend assets

### Scale to 100k+ Users
- Migrate to PostgreSQL with read replicas
- Implement message queue (RabbitMQ/Kafka) for logs
- Add ElasticSearch for conversation search
- Multi-region deployment with fallback
- Dedicated LLM proxy layer

## Deployment Checklist

- [ ] Configure Firebase project (Firestore, Auth, APIs)
- [ ] Create Google Cloud project for Generative AI
- [ ] Set environment variables
- [ ] Run `pnpm build` to verify no errors
- [ ] Deploy to Vercel (or self-hosted)
- [ ] Test login/signup
- [ ] Test chat with streaming
- [ ] Verify logs appear in Firestore
- [ ] Monitor error rates in dashboard
- [ ] Set up monitoring/alerts (optional)

## Monitoring & Debugging

### Key Metrics to Track

1. **API Response Time**: `latencyMs` in logs
2. **Error Rate**: Count of status='failed' logs
3. **Fallback Rate**: Count of isFallback=true logs
4. **Token Usage**: Sum of tokensInput + tokensOutput
5. **Concurrent Users**: Active sessions

### Debugging Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "No streaming" | API not returning chunks | Check Gemini API key, verify SSE connection |
| "Logs not saving" | Firestore permissions | Check Firestore security rules |
| "Authentication fails" | Firebase config wrong | Verify env vars match Firebase project |
| "High latency" | Large context window | Reduce message history from 5 to 3 |

## Future Architecture Evolution

### Event-driven (Phase 2)
```
Chat API → Message Queue → Log Processor → Firestore
                        ↓
                   Notification Service
                   Analytics Aggregator
```

### Multi-provider (Phase 3)
```
Chat Router (cost-optimized)
├── Gemini (cheap, fast)
├── Claude (accurate, slow)
├── Local LLaMA (free if available)
└── Fallback chain
```

### Self-hosted (Bonus)
```
Docker Compose:
- frontend (Next.js)
- backend (Next.js)
- postgres (data)
- redis (cache)
- local-llm (ollama/vLLM)
```
