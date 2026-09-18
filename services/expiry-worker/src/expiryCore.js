/**
 * Expiry decision rules — the single source of truth for the worker, mirroring
 * the in-process checker in apps/api/src/services/expiryService.js exactly:
 *
 * - PRINTED jobs whose retention window has passed → expire (delete document,
 *   mark EXPIRED)
 * - CREATED/READY jobs older than 10 minutes → abandon (safety cleanup)
 *
 * Keeping the rules in one pure module lets the same lifecycle be enforced by
 * the in-process checker locally and by the EventBridge-driven Lambda in AWS,
 * and makes both unit-testable without AWS.
 */

const STALE_MS = 10 * 60 * 1000

/**
 * Classify one job against the retention/safety rules.
 * @param {{status: string, expiresAt?: string, createdAt: string}} job
 * @param {number} now
 * @returns {'expire'|'abandon'|null}
 */
function classify(job, now = Date.now()) {
  if (job.status === 'PRINTED' && job.expiresAt && now >= Date.parse(job.expiresAt)) {
    return 'expire'
  }
  if (
    (job.status === 'CREATED' || job.status === 'READY') &&
    now - Date.parse(job.createdAt) > STALE_MS
  ) {
    return 'abandon'
  }
  return null
}

/**
 * Plan the actions for a batch of jobs.
 * @returns {Array<{jobId: string, tenantId: string, action: 'expire'|'abandon'}>}
 */
function planActions(jobs, now = Date.now()) {
  const plan = []
  for (const job of jobs) {
    const action = classify(job, now)
    if (action) plan.push({ jobId: job.jobId, tenantId: job.tenantId, action })
  }
  return plan
}

module.exports = { STALE_MS, classify, planActions }