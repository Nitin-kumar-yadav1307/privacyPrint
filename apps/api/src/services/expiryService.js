const jobService = require('./jobService')
const { JOB_STATUS } = require('../constants')

/** A failed removal leaves the state unchanged and is retried on the next tick. */
async function processExpiredJobs(now = Date.now(), log = console.log, onError = console.error) {
  for (const job of await jobService.allJobs()) {
    try {
      if (job.status === JOB_STATUS.PRINTED && job.expiresAt &&
          now >= Date.parse(job.expiresAt)) {
        await jobService.expireJob(job.jobId)
        log(`[EXPIRY] Job ${job.jobId}: temporary document removed`)
      } else if ([JOB_STATUS.CREATED, JOB_STATUS.READY].includes(job.status) &&
          now - Date.parse(job.createdAt) > 10 * 60 * 1000) {
        await jobService.cancelJob(job.jobId, job.tenantId, 'Abandoned job — safety timeout reached')
        log(`[SAFETY] Job ${job.jobId}: temporary document removed`)
      }
    } catch {
      // Do not log document paths, filenames, or contents.
      onError(`[CLEANUP] Job ${job.jobId}: removal failed; will retry`)
    }
  }
}

function startExpiryChecker() {
  return setInterval(processExpiredJobs, 1000)
}

module.exports = { processExpiredJobs, startExpiryChecker }
