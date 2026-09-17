const multer = require('multer')
const { v4: uuidv4 } = require('uuid')
const path = require('path')
const fs = require('fs')

const { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } = require('../constants')

/**
 * Multer file filter — only allow permitted MIME types.
 * Rejects files with disallowed types early.
 */
function fileFilter(req, file, cb) {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`), false)
  }
}

const UPLOAD_DIR = path.join(__dirname, '../../uploads')

// Ensure the uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR)
  },
  filename: (req, file, cb) => {
    // Generate a UUID filename, preserving the original extension
    const ext = path.extname(file.originalname)
    cb(null, `${uuidv4()}${ext}`)
  },
})

/**
 * Middleware: validate file size on every request.
 * Multer limits handle the hard cap; this is a secondary guard.
 */
function validateFileSize(req, res, next) {
  next()
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
})

module.exports = {
  upload,
  fileFilter,
  validateFileSize,
  UPLOAD_DIR,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
}
