# Ollive - LLM Inference Logging & Ingestion System

A lightweight inference logging and ingestion system for LLM applications built with Next.js, Firebase, and Google's Generative AI.

## Features

- **Multi-turn Conversations**: Maintain context across multiple turns with configurable history
- **Multi-Provider Support**: Gemini, OpenAI, Claude, OpenRouter with intelligent fallback
- **Real-time Streaming**: Server-Sent Events (SSE) for streaming responses with typing animation
- **Comprehensive Logging**: Captures model, provider, latency, token usage, timestamps, and errors
- **Firebase Integration**: Firestore for data storage, Firebase Auth for user management
- **Analytics Dashboard**: Real-time metrics with auto-refresh, charts for latency, tokens, and error tracking
- **Conversation Management**: List, resume, edit, delete, and regenerate messages
- **Security Features**:
  - **API Key Encryption**: AES-256-GCM encryption for user-provided API keys (Firestore-stored)
  - **PII Redaction**: Automatic redaction of emails, phone numbers, SSN, credit cards, and other sensitive data
  - **User API Keys**: Deploy with user-provided keys instead of hardcoded .env keys
- **Advanced Message Operations**: Edit, delete, and regenerate responses inline

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth (Email/Password)
- **LLM**: Google Generative AI (Gemini)
- **Package Manager**: pnpm

## Project Structure

```
ollive/
├── app/
│   ├── api/
│   │   ├── chat/route.ts           # Main chat endpoint with streaming
│   │   └── logs/
│   │       └── ingest/route.ts     # Inference log ingestion
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── chat/page.tsx               # Main chat interface
│   ├── dashboard/page.tsx          # Analytics dashboard
│   ├── layout.tsx
│   └── page.tsx                    # Root redirect
├── components/
│   ├── ui/                         # shadcn UI components
│   ├── AuthContext.tsx             # Firebase Auth context
│   ├── ChatMessage.tsx             # Message display component
│   ├── ChatInput.tsx               # Message input component
│   └── ConversationList.tsx        # Conversation sidebar
├── lib/
│   ├── firebase.ts                 # Firebase configuration
│   ├── types/index.ts              # TypeScript types
│   └── llm/
│       ├── client.ts               # Gemini client initialization
│       └── chat.ts                 # Chat logic with fallback & logging
└── .env.local                      # Environment variables
```

## Firestore Schema

### Collections

#### `conversations`
```
{
  id: string (auto-generated)
  userId: string
  title: string
  createdAt: number (timestamp)
  updatedAt: number (timestamp)
  model: string
  messageCount: number
}
```

#### `messages/{conversationId}/items`
```
{
  id: string (auto-generated)
  role: 'user' | 'assistant'
  content: string
  createdAt: number (timestamp)
  tokensUsed?: {
    input: number
    output: number
  }
}
```

#### `inferenceLogs`
```
{
  id: string (auto-generated)
  conversationId: string
  messageId: string
  model: string
  provider: 'gemini' | 'gemma'
  isFallback: boolean
  latencyMs: number
  tokensInput: number
  tokensOutput: number
  status: 'success' | 'failed' | 'partial'
  error?: string
  timestamp: number
  metadata?: object
}
```

## Setup Instructions

### Prerequisites

- Node.js 18+ and pnpm
- Google Cloud Project with Generative AI API enabled
- Firebase Project

### 1. Environment Configuration

Create `.env.local` and add your Firebase and API provider credentials:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin (for encrypted API key storage)
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email

# LLM Provider Keys (fallback for local development)
# Note: In production, users provide these via Settings → API Keys
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_key
CLAUDE_API_KEY=your_claude_key
OPENROUTER_API_KEY=your_openrouter_key

# Encryption Key for Storing User API Keys (256-bit hex)
# Generate with: openssl rand -hex 32
ENCRYPTION_KEY=your_32_byte_encryption_key_in_hex

# App Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

**Security Note**: 
- For **local development**: Use `.env.local` with environment API keys
- For **production/deployed**: Users provide their own API keys via Settings → API Keys
  - Keys are encrypted with AES-256-GCM before storage
  - See [ARCHITECTURE.md](./ARCHITECTURE.md) for encryption architecture
  - Deploy Firestore rules: `firebase deploy --only firestore:rules`

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Run Development Server

```bash
pnpm dev
```

Visit `http://localhost:3000` and sign up or login.

### 4. Build for Production

```bash
pnpm build
pnpm start
```

## Architecture & Design Decisions

### Ingestion Flow

1. **Client Request**: User sends a message in the chat UI
2. **Server-side Processing**: Next.js API route receives the message
3. **LLM Call**: Chat SDK calls Gemini with full context (limited to last 5 messages)
4. **Streaming Response**: Response streams back to client via SSE
5. **Logging**: Metadata captured automatically during the call
6. **Async Ingestion**: Logs sent to ingestion endpoint without blocking the response
7. **Storage**: Logs persisted to Firestore for analytics

### Logging Strategy

- **Capture Point**: Logging happens at the LLM SDK layer (`lib/llm/chat.ts`)
- **Metadata Collection**: Automatic capture of model, provider, latency, tokens, status, and errors
- **Fallback Tracking**: Tracks when fallback model is used
- **Async Delivery**: Log ingestion doesn't block user responses
- **Error Handling**: Failures in logging don't crash the chat application

### Latency Measurement

**For API-based Models:**
- Captures end-to-end request time (network + model inference)
- Measured from request start to final token received
- Includes network latency and model processing time

**For Self-hosted Models (Future):**
- Can extend to capture GPU/CPU metrics
- Support for torch profiling and nvidia-smi integration
- Environment variable detection: `MODEL_TYPE=api|local`

### Scaling Considerations

1. **Firestore Limits**: 
   - Current design scales to ~10k messages/day per user
   - For higher throughput, implement message batching before ingestion

2. **Streaming Optimization**:
   - SSE used for client-side efficiency
   - Chunks streamed immediately to reduce latency perception

3. **Context Window**:
   - Only last 5 messages kept in context to manage token usage
   - Reduces API costs and maintains performance

4. **Database**:
   - Firestore auto-scales, no infrastructure management needed
   - Read/write operations are indexed for fast queries

### Failure Handling Assumptions

1. **Model Fallback**: If Gemini fails, automatically retry with fallback model
2. **Logging Failures**: Log ingestion errors don't block the chat flow
3. **Connection Loss**: Frontend automatically retries on SSE connection loss
4. **Rate Limiting**: Relies on Firebase and Google API rate limits with exponential backoff (can be added)

## Recent Improvements (Session 4+)

### ✅ Completed
- Auth persistence on page reload (Firebase `browserLocalPersistence`)
- Stop button relocated closer to input field
- Dashboard auto-refresh with manual refresh button
- Collapsible sidebar with shadcn integration
- User API key management with AES-256-GCM encryption
- PII redaction for stored messages (emails, phones, SSN, credit cards, etc.)
- Multi-provider support (Gemini, OpenAI, Claude, OpenRouter)
- Message operations (edit, delete, regenerate inline)

### 🚀 Upcoming
- [ ] Advanced PII settings per conversation
- [ ] Rate limiting at API routes
- [ ] Key rotation schedule

## Future Improvements

### Short-term (MVP+)
- [ ] Conversation search and filtering
- [ ] Export conversations as PDF/Markdown
- [ ] Rate limiting per user
- [ ] Audit logging for key access
- [ ] Conversation sharing with role-based access

### Medium-term
- [ ] Self-hosted model support
- [ ] Streaming response cancellation improvements
- [ ] Advanced dashboard with custom date ranges
- [ ] Custom system prompts per conversation
- [ ] Conversation sharing and collaboration

### Long-term (Bonus Features)
- [ ] Kubernetes deployment manifests
- [ ] Event-driven architecture with message queues
- [ ] Advanced analytics and cost tracking
- [ ] Real-time collaboration (WebSocket support)
- [ ] Multi-language support

## Tradeoffs Made

1. **Simplicity over Features**: Started with single provider to avoid complexity
2. **Firebase over Self-hosted**: Reduced DevOps overhead, automatic scaling
3. **Context Window**: Limited to 5 messages to balance cost and quality
4. **Async Logging**: Non-blocking logging may have rare loss (acceptable for analytics)
5. **No Message Queue**: Simple HTTP for logs; add Redis/RabbitMQ if guaranteed delivery needed

## Performance Metrics

- **Message Latency**: 2-5 seconds (depends on Gemini API response time)
- **Token Cost**: ~1-2 tokens per word (configurable via system prompt)
- **Log Ingestion**: <100ms (async, non-blocking)
- **Dashboard Load**: <500ms (Firestore indexed queries)

## Deployment

### Prerequisites for Production Deployment

1. **Deploy Firestore Security Rules**:
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy rules
firebase deploy --only firestore:rules
```

The `firestore.rules` file defines user-scoped access:
- Users can only read/write their own conversations and messages
- API keys are encrypted and user-scoped
- All unauthorized access is denied by default

2. **Set Environment Variables**:
Ensure all required variables are set (see `.env.docker` template):
- Firebase credentials
- Encryption key (ENCRYPTION_KEY or ENCRYPTION_SALT)
- LLM provider keys (optional - users provide via Settings)

### Quick Start with Docker

```bash
# Copy environment template
cp .env.docker .env.local

# Edit with your Firebase and API keys
nano .env.local

# Build and start
docker-compose up -d

# Verify running
curl http://localhost:3000

# View logs
docker-compose logs -f app

# Stop
docker-compose down
```

For detailed Docker setup, see [DOCKER.md](./DOCKER.md).

### Vercel (Recommended for Production)

```bash
# Push to GitHub, connect to Vercel
# Environment variables configured in dashboard
# Auto-deploys on push to main

# After deployment, deploy Firestore rules:
firebase deploy --only firestore:rules
```

### Self-hosted Node.js

```bash
pnpm build
NODE_ENV=production pnpm start
# Set environment variables before running

# Deploy Firestore rules:
firebase deploy --only firestore:rules
```

## License

MIT

## Support

For issues or questions, contact work@ollive.ai
