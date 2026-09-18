require('dotenv').config()

const express = require('express')
const cors = require('cors')
const { startExpiryChecker } = require('./services/expiryService')
const fs = require('fs')

const routes = require('./routes/jobs')
const tenantRoutes = require('./routes/tenants')
const authRoutes = require('./routes/auth')
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
app.use('/api', tenantRoutes)
app.use('/api', authRoutes)

// Error handler (must be last)
app.use(errorHandler)

// Start server and background processes only when run directly
if (require.main === module) {
  require('./services/recoveryService').recoverJobs()
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
