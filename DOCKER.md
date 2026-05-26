# Docker Deployment Guide

This guide explains how to containerize and deploy Ollive using Docker and Docker Compose.

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Firebase project with Firestore, Auth, and Generative AI API enabled
- LLM API keys (Gemini, OpenAI, Claude, or OpenRouter)

### 1. Prepare Environment

Copy the example environment file:

```bash
cp .env.docker .env.local
```

Edit `.env.local` with your actual values:

```env
# Firebase credentials
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...  # From Firebase Console → Service Accounts
FIREBASE_CLIENT_EMAIL=...

# LLM Provider Keys
NEXT_PUBLIC_GEMINI_API_KEY=...
OPENAI_API_KEY=...

# Encryption Key (generate: openssl rand -hex 32)
ENCRYPTION_KEY=...
```

### 2. Build and Start

```bash
# Build the Docker image
docker-compose build

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f app

# Verify health
curl http://localhost:3000
```

### 3. Verify Deployment

1. Open `http://localhost:3000` in browser
2. Sign up or login with Firebase
3. Test chat functionality
4. Check dashboard for logs

### 4. Stop Services

```bash
docker-compose down

# Also remove volumes (careful - deletes data)
docker-compose down -v
```

## Docker Architecture

### Services

#### `app` (Next.js Application)
- **Port**: 3000
- **Health Check**: HTTP GET /
- **Restart Policy**: unless-stopped
- **Environment**: Production

#### `firebase-emulator` (Optional)
- **Port**: 4000 (Firestore)
- **Use Case**: Local development without Firebase Cloud project
- **Status**: Disabled by default (comment out to use)

## Configuration Options

### Environment Variables

All environment variables from `.env.local` are supported. Key ones:

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | Firebase client config |
| `FIREBASE_PRIVATE_KEY` | Yes | Firebase Admin SDK (for encryption) |
| `ENCRYPTION_KEY` | Yes | AES-256-GCM key for API key storage |
| `NEXT_PUBLIC_GEMINI_API_KEY` | No | Fallback Gemini key (local dev) |
| `NEXT_PUBLIC_API_BASE_URL` | No | Frontend API base URL |

### Build-time Customization

#### Using .env File for Docker Compose

Create `.env` file in project root:

```bash
# .env
NEXT_PUBLIC_FIREBASE_PROJECT_ID=my-project
ENCRYPTION_KEY=abc123...
```

Docker Compose automatically loads this file.

#### Using Command-line Overrides

```bash
ENCRYPTION_KEY=xyz789 docker-compose up -d
```

## Production Deployment

### Recommended Settings

```yaml
# docker-compose.override.yml (not committed)
services:
  app:
    restart: always
    healthcheck:
      interval: 15s
      retries: 5
    resources:
      limits:
        cpus: '2'
        memory: 2G
      reservations:
        cpus: '1'
        memory: 1G
```

### Network Security

```yaml
services:
  app:
    ports:
      - "127.0.0.1:3000:3000"  # Only accessible locally
```

Then use reverse proxy (Nginx, Traefik) for external access with SSL.

### Database Backup

Firebase Firestore is cloud-managed and automatically backed up. No additional configuration needed.

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs app

# Check health
docker-compose ps
```

**Common issues:**
- Missing environment variables → Check `.env.local`
- Port 3000 already in use → Change port in `docker-compose.yml`
- Build failed → Run `docker-compose build --no-cache`

### High Memory Usage

Reduce Node.js memory:

```yaml
environment:
  NODE_OPTIONS: "--max-old-space-size=512"
```

### Firebase Connection Issues

If using Firebase Emulator:

```yaml
environment:
  FIRESTORE_EMULATOR_HOST: firebase-emulator:4000
```

Otherwise, verify Firebase credentials in `.env.local`.

### Slow Performance

- Increase container resources in `docker-compose.override.yml`
- Check Firebase quota usage (Console → Firestore → Quotas)
- Profile with: `docker stats ollive-app-1`

## Advanced: Multi-Stage Build

The Dockerfile uses multi-stage build to reduce image size:

1. **Dependencies stage**: Install production dependencies
2. **Builder stage**: Install all deps + build Next.js
3. **Runner stage**: Minimal runtime with built app

**Image size**: ~300MB (optimized from ~800MB)

## Advanced: Custom Nginx Reverse Proxy

For production with SSL:

```yaml
# docker-compose.yml addition
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
```

```nginx
# nginx.conf
upstream app {
    server app:3000;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    location / {
        proxy_pass http://app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## Monitoring

### View Real-time Logs

```bash
docker-compose logs -f --tail=50 app
```

### CPU/Memory Usage

```bash
docker stats ollive-app-1
```

### Health Status

```bash
docker-compose ps
```

## Scaling

### Horizontal Scaling (Multiple Instances)

Use Docker Swarm or Kubernetes. For simple multi-instance:

```bash
# Run multiple containers
docker-compose up -d --scale app=3
```

(Requires load balancer in front - Nginx, HAProxy, etc.)

### Vertical Scaling (More Resources)

Increase resource limits in `docker-compose.override.yml`.

## Cleanup

```bash
# Stop and remove containers
docker-compose down

# Remove unused images/volumes
docker system prune -a

# Full cleanup (CAREFUL - removes all Docker data)
docker system prune -a --volumes
```

## Security Notes

1. **Don't commit `.env.local`** - Only commit `.env.docker`
2. **Use secrets management** for production:
   - Docker secrets (Swarm)
   - Kubernetes secrets (K8s)
   - HashiCorp Vault
   - AWS Secrets Manager
3. **Run as non-root**: Dockerfile uses `nextjs` user
4. **SSL/TLS**: Use reverse proxy with certificates
5. **Rate limiting**: Add at reverse proxy level

## Support

For issues:
1. Check logs: `docker-compose logs app`
2. Verify environment variables: `.env.local`
3. Test Firebase connection: `curl https://firestore.googleapis.com`
4. See main [SECURITY.md](./SECURITY.md) for security details
