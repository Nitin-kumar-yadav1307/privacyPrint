/**
 * Server configuration loaded from environment variables.
 * Defaults are for local development only.
 */

const path = require('path')
const crypto = require('crypto')

const PORT = process.env.PORT || 3001
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../uploads'))
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '../data'))
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'
const DOCUMENT_BUCKET = process.env.DOCUMENT_BUCKET || ''
const NODE_ENV = process.env.NODE_ENV || 'development'

/**
 * Session secret for shop tokens.
 *
 * In development mode, a generated secret is acceptable for local demo use only.
 * In production or any shared/deployed environment, AUTH_SECRET must be set in
 * the environment and must never be generated silently.
 */
const isDevelopment = (process.env.NODE_ENV || 'development') === 'development'
const AUTH_SECRET = process.env.AUTH_SECRET || (isDevelopment ? crypto.randomBytes(32).toString('hex') : (() => {
  throw new Error('AUTH_SECRET must be set in the environment for non-development deployments')
})())
const AUTH_SECRET_SOURCE = process.env.AUTH_SECRET ? 'env' : (isDevelopment ? 'generated' : 'missing')
const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 3600)

/**
 * Demo shop passcode. The hackathon uses mock shop authentication (plan Phase 6).
 * This is a shared demo credential, not a real secret, and must be replaced by a
 * real identity provider before any deployment.
 */
const SHOP_DEMO_PASSCODE = process.env.SHOP_DEMO_PASSCODE || 'privacyprint-demo'

/**
 * Whether a shop session is mandatory for shop-only operations.
 *
 * Defaults to false so the local demo works without signing in. Set
 * AUTH_REQUIRED=true in any shared or deployed environment: callers can then no
 * longer act on a tenant merely by supplying its id as a query parameter.
 */
const AUTH_REQUIRED = process.env.AUTH_REQUIRED === 'true'

module.exports = {
  PORT,
  UPLOAD_DIR,
  DATA_DIR,
  CORS_ORIGIN,
  DOCUMENT_BUCKET,
  NODE_ENV,
  AUTH_SECRET,
  AUTH_SECRET_SOURCE,
  SESSION_TTL_SECONDS,
  SHOP_DEMO_PASSCODE,
  AUTH_REQUIRED,
}
