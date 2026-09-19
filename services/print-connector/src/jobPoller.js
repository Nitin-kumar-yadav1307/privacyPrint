/**
 * Polls the API for PRINTING jobs and drives them to completion.
 * Idempotency: an in-memory processing set prevents a job from being
 * handled twice even when polls overlap; the backend state machine remains
 * the source of truth (only PRINTING jobs can transition).
 */
const fs = require('fs')
const path = require('path')
const { TMP_DIR } = require('./config')

class JobPoller {
  constructor({ api, printer, logger, pollIntervalMs = 3000 }) {
    this.api = api
    this.printer = printer
    this.logger = logger
    this.pollIntervalMs = pollIntervalMs
    this.processing = new Set()
    this.timer = null
    this.ticking = false
  }

  start() {
    if (this.timer) return
    this.timer = setInterval(() => this.tick(), this.pollIntervalMs)
    this.tick()
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async tick() {
    if (this.ticking) return
    this.ticking = true
    try {
      const jobs = await this.api.listPrintingJobs()
      for (const job of jobs) {
        if (this.processing.has(job.jobId)) continue
        this.processing.add(job.jobId)
        try {
          await this.handle(job)
        } catch (err) {
          this.logger.error(`Job ${job.jobId} handler failed: ${err.message}`)
          await this.reportFailureSafe(job, err.message)
        } finally {
          this.processing.delete(job.jobId)
        }
      }
    } catch (err) {
      this.logger.warn(`Poll failed: ${err.message}`)
    } finally {
      this.ticking = false
    }
  }

  async handle(job) {
    fs.mkdirSync(TMP_DIR, { recursive: true })
    const tmpPath = path.join(TMP_DIR, `${job.jobId}-${job.document?.filename || 'document'}`)
    try {
      this.logger.info(`Job ${job.jobId}: downloading document`)
      await this.api.downloadDocument(job, tmpPath)

      const result = await this.printer.printDocument(tmpPath, job)
      if (!result.ok) {
        this.logger.error(`Job ${job.jobId}: print failed — ${result.error}`)
        await this.api.reportPrintResult(job.jobId, { result: 'failed', reason: result.error })
        return
      }

      this.logger.info(`Job ${job.jobId}: printed (mode=${result.mode})`)
      await this.api.reportPrintResult(job.jobId, { result: 'completed', mode: result.mode })
    } finally {
      // The temporary download never survives the attempt, success or failure.
      fs.rm(tmpPath, { force: true }, () => {})
    }
  }

  async reportFailureSafe(job, message) {
    try {
      await this.api.reportPrintResult(job.jobId, { result: 'failed', reason: message })
    } catch {
      /* best-effort — the backend recovery flow also handles stuck jobs */
    }
  }
}

module.exports = { JobPoller }