/**
 * Server configuration loaded from environment variables.
 * Defaults are for local development only.
 */

const path = require('path')

const PORT = process.env.PORT || 3001
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads')
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'
const NODE_ENV = process.env.NODE_ENV || 'development'

module.exports = {
  PORT,
  UPLOAD_DIR,
  CORS_ORIGIN,
  NODE_ENV,
}
