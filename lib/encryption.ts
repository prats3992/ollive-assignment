import crypto from 'crypto'

// Use a server-side encryption key from environment
// For production, use a proper key management service (AWS KMS, Google Secret Manager, etc.)
// Key should be a 256-bit (64 hex chars) value from environment
let ENCRYPTION_KEY = process.env.ENCRYPTION_KEY

// If no key provided, derive one from ENCRYPTION_SALT
// WARNING: This is for development only. In production, set ENCRYPTION_KEY directly.
if (!ENCRYPTION_KEY && process.env.ENCRYPTION_SALT) {
  // Derive key using PBKDF2 (Password-Based Key Derivation Function 2)
  const salt = Buffer.from(process.env.ENCRYPTION_SALT, 'utf8')
  const derivedKey = crypto.pbkdf2Sync(
    process.env.ENCRYPTION_SALT,
    salt,
    100000, // iterations (increase for more security)
    32, // 256 bits
    'sha256'
  )
  ENCRYPTION_KEY = derivedKey.toString('hex')

  if (typeof window === 'undefined') {
    console.warn(
      'ENCRYPTION_KEY derived from ENCRYPTION_SALT using PBKDF2. For production, set ENCRYPTION_KEY directly.'
    )
  }
} else if (!ENCRYPTION_KEY) {
  // Fallback: generate random key (should only happen in dev without env vars)
  if (typeof window === 'undefined') {
    console.warn(
      'WARNING: Neither ENCRYPTION_KEY nor ENCRYPTION_SALT set. Using random key. Keys will not persist across restarts. Set ENCRYPTION_KEY in environment variables for production.'
    )
  }
  ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex')
}

/**
 * Encrypt a string using AES-256-GCM
 * @param plaintext The text to encrypt
 * @returns Object with iv, authTag, and ciphertext (all hex-encoded)
 */
export function encryptString(plaintext: string): {
  iv: string
  authTag: string
  ciphertext: string
} {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY!, 'hex'), iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext: encrypted,
  }
}

/**
 * Decrypt a string encrypted with encryptString
 * @param encrypted Object with iv, authTag, and ciphertext
 * @returns Decrypted plaintext
 */
export function decryptString(encrypted: {
  iv: string
  authTag: string
  ciphertext: string
}): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(ENCRYPTION_KEY!, 'hex'),
    Buffer.from(encrypted.iv, 'hex')
  )

  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'))

  let decrypted = decipher.update(encrypted.ciphertext, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
