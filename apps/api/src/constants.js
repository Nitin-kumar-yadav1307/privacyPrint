/**
 * Job status lifecycle constants.
 * Matches the lifecycle defined in the PrivacyPrint specification.
 *
 * CREATED -> READY -> PRINTING -> PRINTED -> EXPIRED
 *                    |-> FAILED
 * CREATED -> CANCELLED
 */
const JOB_STATUS = Object.freeze({
  CREATED: 'CREATED',
  READY: 'READY',
  PRINTING: 'PRINTING',
  PRINTED: 'PRINTED',
  EXPIRED: 'EXPIRED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
})

/** Allowed file types for upload (MIME types). */
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'text/plain',
]

/** Maximum uploaded file size: 10 MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024

/** Demo mode TTL multiplier — 10 real seconds per 10 retention minutes */
const DEMO_MODE = true

/**
 * Convert customer-selected retention minutes to simulated expiry timestamp.
 * In demo mode, the retention is accelerated so the lifecycle is visible quickly.
 * @param {number} retentionMinutes - The retention period in minutes
 * @returns {number} expiry timestamp in milliseconds (Demo: 10s per 10min)
 */
function calculateExpiry(retentionMinutes) {
  const baseMs = retentionMinutes * 60 * 1000
  if (DEMO_MODE) {
    // 10 real seconds for every 10 retention minutes
    return Date.now() + Math.max(10000, (retentionMinutes / 10) * 10000)
  }
  return Date.now() + baseMs
}

module.exports = {
  JOB_STATUS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  DEMO_MODE,
  calculateExpiry,
}