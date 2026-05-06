/**
 * PII field encryption utility for Payload CMS.
 *
 * Uses AES-256-GCM with a single key loaded from PII_ENCRYPTION_KEY env var.
 * Stored format: "enc:v1:<base64(iv|authTag|ciphertext)>" — versioned so we can
 * rotate algorithms without losing old data.
 *
 * Usage in a collection:
 *   import { encryptedFieldHooks } from '../utils/field-encryption.js'
 *   fields: [
 *     { name: 'phone', type: 'text', hooks: encryptedFieldHooks() },
 *     { name: 'email', type: 'email', hooks: encryptedFieldHooks() },
 *   ]
 *
 * Or apply at the collection level to multiple fields:
 *   hooks: buildCollectionEncryptionHooks(['phone','email','address'])
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { CollectionBeforeChangeHook, CollectionAfterReadHook } from 'payload'

const ALGO = 'aes-256-gcm'
const VERSION_PREFIX = 'enc:v1:'
const IV_BYTES = 12 // standard for GCM
const AUTH_TAG_BYTES = 16

function loadKey(): Buffer {
  const raw = process.env.PII_ENCRYPTION_KEY
  if (!raw) {
    throw new Error('PII_ENCRYPTION_KEY env var is not set')
  }
  // Accept either base64 (from `openssl rand -base64 32`) or hex
  const key = raw.trim()
  const decoded = Buffer.from(key, 'base64')
  if (decoded.length === 32) return decoded
  const hex = Buffer.from(key, 'hex')
  if (hex.length === 32) return hex
  throw new Error(`PII_ENCRYPTION_KEY must decode to 32 bytes (got ${decoded.length} or ${hex.length})`)
}

let cachedKey: Buffer | null = null
function getKey(): Buffer {
  if (!cachedKey) cachedKey = loadKey()
  return cachedKey
}

export function encryptValue(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === '') return (plaintext ?? null) as null
  // Already encrypted? pass through (idempotent — safe to call on already-encrypted values)
  if (typeof plaintext === 'string' && plaintext.startsWith(VERSION_PREFIX)) return plaintext
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, getKey(), iv)
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const packed = Buffer.concat([iv, tag, ct]).toString('base64')
  return VERSION_PREFIX + packed
}

export function decryptValue(stored: string | null | undefined): string | null {
  if (stored == null || stored === '') return (stored ?? null) as null
  if (typeof stored !== 'string' || !stored.startsWith(VERSION_PREFIX)) {
    // Not encrypted (legacy/plaintext) — return as-is so existing data still works
    return stored as string
  }
  try {
    const packed = Buffer.from(stored.slice(VERSION_PREFIX.length), 'base64')
    const iv = packed.subarray(0, IV_BYTES)
    const tag = packed.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES)
    const ct = packed.subarray(IV_BYTES + AUTH_TAG_BYTES)
    const decipher = createDecipheriv(ALGO, getKey(), iv)
    decipher.setAuthTag(tag)
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
    return pt
  } catch (err) {
    // Don't leak details; log server-side
    console.error('[field-encryption] decrypt failed:', (err as Error).message)
    return null
  }
}

/**
 * Build Payload hooks that encrypt on write + decrypt on read for a list of field paths.
 * Supports top-level ("phone") and nested ("profile.phone") field paths.
 */
export function buildCollectionEncryptionHooks(fieldPaths: string[]): {
  beforeChange: CollectionBeforeChangeHook[]
  afterRead: CollectionAfterReadHook[]
} {
  const getPath = (obj: any, path: string) => {
    return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj)
  }
  const setPath = (obj: any, path: string, value: any) => {
    const parts = path.split('.')
    const last = parts.pop() as string
    let cur = obj
    for (const p of parts) {
      if (cur[p] == null || typeof cur[p] !== 'object') cur[p] = {}
      cur = cur[p]
    }
    cur[last] = value
  }

  return {
    beforeChange: [
      async ({ data }) => {
        if (!data) return data
        for (const path of fieldPaths) {
          const v = getPath(data, path)
          if (typeof v === 'string' && v.length > 0 && !v.startsWith(VERSION_PREFIX)) {
            setPath(data, path, encryptValue(v))
          }
        }
        return data
      },
    ],
    afterRead: [
      async ({ doc }) => {
        if (!doc) return doc
        for (const path of fieldPaths) {
          const v = getPath(doc, path)
          if (typeof v === 'string' && v.startsWith(VERSION_PREFIX)) {
            setPath(doc, path, decryptValue(v))
          }
        }
        return doc
      },
    ],
  }
}
