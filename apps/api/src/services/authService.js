const crypto = require('node:crypto')

/**
 * Minimal signed session tokens for shop (tenant) authorization.
 *
 * Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256 payload)
 *
 * This is deliberately small and dependency-free. It provides integrity and
 * expiry, but NOT confidentiality (the payload is readable) and no revocation
 * list. It exists to move tenant identity to a server-verified value; a real
 * identity provider should replace it before deployment.
 */

const TOKEN_VERSION = 1
const SHOP_ROLE = 'shop'
const MIN_SECRET_LENGTH = 16

function sign(payloadB64, secret) {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url')
}

/** Constant-time comparison of two strings of any length. */
function safeEqual(a, b) {
  const left = crypto.createHash('sha256').update(String(a)).digest()
  const right = crypto.createHash('sha256').update(String(b)).digest()
  return crypto.timingSafeEqual(left, right)
}

/**
 * Issue a shop session token.
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.secret
 * @param {number} params.ttlSeconds
 * @param {number} [params.now] - Override for tests
 * @returns {{token: string, expiresAt: string}}
 */
function issueToken({ tenantId, secret, ttlSeconds, now = Date.now() }) {
  if (typeof tenantId !== 'string' || !tenantId.trim()) {
    throw new Error('tenantId is required to issue a session')
  }
  if (typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`A session secret of at least ${MIN_SECRET_LENGTH} characters is required`)
  }
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error('A positive session lifetime is required')
  }

  const issuedAt = Math.floor(now / 1000)
  const payload = {
    v: TOKEN_VERSION,
    sub: tenantId.trim(),
    role: SHOP_ROLE,
    iat: issuedAt,
    exp: issuedAt + Math.floor(ttlSeconds),
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return {
    token: `${payloadB64}.${sign(payloadB64, secret)}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  }
}

/**
 * Verify a shop session token.
 * @param {string} token
 * @param {Object} params
 * @param {string} params.secret
 * @param {number} [params.now] - Override for tests
 * @returns {{tenantId: string, role: string, expiresAt: string}|null}
 */
function verifyToken(token, { secret, now = Date.now() }) {
  if (typeof token !== 'string' || typeof secret !== 'string' || !secret) return null

  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, signature] = parts
  if (!payloadB64 || !signature) return null

  // Verify integrity before parsing any attacker-controlled payload.
  const expected = sign(payloadB64, secret)
  const provided = Buffer.from(signature)
  const computed = Buffer.from(expected)
  if (provided.length !== computed.length) return null
  if (!crypto.timingSafeEqual(provided, computed)) return null

  let payload
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  if (payload.v !== TOKEN_VERSION) return null
  if (payload.role !== SHOP_ROLE) return null
  if (typeof payload.sub !== 'string' || !payload.sub) return null
  if (!Number.isFinite(payload.exp) || payload.exp * 1000 <= now) return null

  return {
    tenantId: payload.sub,
    role: payload.role,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  }
}

module.exports = {
  TOKEN_VERSION,
  SHOP_ROLE,
  MIN_SECRET_LENGTH,
  safeEqual,
  issueToken,
  verifyToken,
}
