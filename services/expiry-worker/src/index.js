/**
 * PrivacyPrint expiry worker (Lambda).
 *
 * Invoked by the EventBridge schedule (rate(5 minutes)). Enforces the same
 * lifecycle rules as the in-process local checker:
 *   PRINTED + retention elapsed → delete S3 document, then mark EXPIRED
 *   CREATED/READY + 10 min stale → delete document, mark CANCELLED
 *
 * Ordering matters: the document is deleted BEFORE the status update, so a
 * crash between the two steps only ever leads to a retry, never to an EXPIRED
 * job whose document still exists.
 */

const { planActions } = require('./expiryCore')

async function handler(event, context = {}) {
  const logger = context.logger || console
  const repository = context.repository || require('./dynamoRepository').createRepository()

  const now = Date.now()
  const active = await repository.findActive(now)
  const plan = planActions(active, now)

  const expired = []
  const cancelled = []
  const failures = []

  for (const { jobId, action } of plan) {
    try {
      const job = active.find((j) => j.jobId === jobId)
      // Document deletion always precedes the status transition.
      await repository.deleteDocument(job)
      if (action === 'expire') {
        await repository.markExpired(jobId)
        expired.push(jobId)
        logger.log(`[EXPIRY] Job ${jobId}: temporary document removed`)
      } else {
        await repository.markCancelled(jobId, 'Abandoned job — safety timeout reached')
        cancelled.push(jobId)
        logger.log(`[SAFETY] Job ${jobId}: temporary document removed`)
      }
    } catch (err) {
      // Never log document contents, paths or secrets.
      failures.push({ jobId, action })
      logger.error(`[CLEANUP] Job ${jobId}: ${action} failed; will retry on next invocation`)
    }
  }

  return {
    processed: plan.length,
    expired,
    cancelled,
    failures,
  }
}

module.exports = { handler }