require('dotenv').config()

const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')

const routes = require('./routes/jobs')
const { errorHandler } = require('./middleware/errorHandler')
const { PORT, UPLOAD_DIR } = require('./config')

const app = express()

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

// Routes
app.use('/api', routes)

// Error handler (must be last)
app.use(errorHandler)

// Start server and background processes only when run directly
if (require.main === module) {
  startExpiryChecker()

  const server = app.listen(PORT, () => {
    console.log(`PrivacyPrint API server running on port ${PORT}`)
    console.log(`Health: http://localhost:${PORT}/api/health`)
  })

  module.exports = { app, server }
} else {
  // When required by tests, export just the app
  module.exports = { app }
}

/**
 * Background process that checks for expired jobs every second.
 * When a job's expiresAt timestamp has passed, it is transitioned to EXPIRED.
 * In production (Phase 9+), this role is handled by EventBridge Scheduler.
 */
function startExpiryChecker() {
  const jobService = require('./services/jobService')

  setInterval(() => {
    const now = Date.now()
    const allJobs = jobService.allJobs()

    for (const job of allJobs) {
      // Only process PRINTED jobs that have passed their expiry time
      if (job.status === 'PRINTED' && job.expiresAt) {
        const expiryTime = new Date(job.expiresAt).getTime()
        if (now >= expiryTime) {
          jobService.expireJob(job.jobId)
          console.log(`[EXPIRY] Job ${job.jobId} expired and temporary document removed`)
        }
      }

      // Safety timeout for abandoned jobs (CREATED > 10 min without PRINT)
      if (job.status === 'CREATED' || job.status === 'READY') {
        const createdAt = new Date(job.createdAt).getTime()
        if (now - createdAt > 10 * 60 * 1000) {
          jobService.cancelJob(job.jobId, job.tenantId, 'Abandoned job — safety timeout reached')
          console.log(`[SAFETY] Job ${job.jobId} cancelled after abandonment timeout`)
        }
      }
    }
  }, 1000)
}
