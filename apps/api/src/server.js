require('dotenv').config()

const express = require('express')
const cors = require('cors')
const { startExpiryChecker } = require('./services/expiryService')
const fs = require('fs')

const routes = require('./routes/jobs')
const tenantRoutes = require('./routes/tenants')
const authRoutes = require('./routes/auth')
const connectorRoutes = require('./routes/connector')
const { errorHandler } = require('./middleware/errorHandler')
const { PORT, UPLOAD_DIR } = require('./config')

function isAllowedOrigin(origin) {
  if (!origin) return true
  const allowedOrigins = new Set(
    (process.env.CORS_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .concat(['http://localhost:5174']),
  )
  if (allowedOrigins.has(origin)) return true
  if (process.env.NODE_ENV !== 'production') {
    return /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin)
  }
  return false
}

const app = express()

// Middleware
// In AWS Lambda, CORS is handled at the Function URL layer. Setting CORS headers here
// causes duplicate Access-Control-Allow-Origin headers, which browsers reject with "Failed to fetch".
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.use(cors({
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin))
    },
  }))
}
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// When invoked via serverless-http behind Lambda Function URL, req.body may arrive as a Buffer
// which bypasses express.json(). Parse Buffer bodies to ensure req.body contains JSON object.
app.use((req, res, next) => {
  if (Buffer.isBuffer(req.body)) {
    const contentType = req.headers['content-type'] || ''
    const str = req.body.toString('utf8')
    if (contentType.includes('application/json')) {
      try {
        req.body = str ? JSON.parse(str) : {}
      } catch {}
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      try {
        const querystring = require('querystring')
        req.body = querystring.parse(str)
      } catch {}
    }
  }
  next()
})

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

// Routes
app.use('/api', routes)
app.use('/api', tenantRoutes)
app.use('/api', authRoutes)
app.use('/api', connectorRoutes)

// Error handler (must be last)
app.use(errorHandler)

// Start server and background processes only when run directly
if (require.main === module) {
  require('./services/recoveryService').recoverJobs()
    .then(() => {
      if (process.env.JOBS_TABLE) {
        console.log('[EXPIRY] Remote store — retention is enforced by the expiry-worker Lambda')
      } else {
        startExpiryChecker()
      }
      const server = app.listen(PORT, () => {
        console.log(`PrivacyPrint API server running on port ${PORT}`)
        console.log(`Health: http://localhost:${PORT}/api/health`)
      })
      module.exports = { app, server }
    })
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
} else {
  // When required by tests, export just the app
  module.exports = { app }
}
