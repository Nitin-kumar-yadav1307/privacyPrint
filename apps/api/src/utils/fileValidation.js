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

const { UPLOAD_DIR } = require('../config')

/**
 * File signatures (magic bytes) for the document types PrivacyPrint accepts.
 *
 * Multer's `file.mimetype` is the client's *claim* — it comes straight from the
 * request's Content-Type header. A plain-text file renamed `invoice.pdf` would
 * otherwise be stored and later fail deep inside the printer's filter chain
 * (CUPS reports "unable to find trailer dictionary/damaged file"), so the bytes
 * are checked as well.
 */
const FILE_SIGNATURES = [
  { mime: 'application/pdf', bytes: Buffer.from('%PDF-') },
  { mime: 'image/jpeg', bytes: Buffer.from([0xff, 0xd8, 0xff]) },
  { mime: 'image/png', bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { mime: 'image/gif', bytes: Buffer.from('GIF8') },
]

const SNIFF_BYTES = 512

/**
 * Best-effort content type from the leading bytes of a document.
 * @param {Buffer} buffer
 * @returns {string|null} Detected MIME type, or null when nothing matches
 */
function sniffContentType(buffer) {
  const head = Buffer.isBuffer(buffer) ? buffer.subarray(0, SNIFF_BYTES) : Buffer.alloc(0)
  for (const signature of FILE_SIGNATURES) {
    if (head.length >= signature.bytes.length && head.subarray(0, signature.bytes.length).equals(signature.bytes)) {
      return signature.mime
    }
  }
  // text/plain has no signature: accept only NUL-free, decodable UTF-8.
  if (head.length > 0 && !head.includes(0) && !head.toString('utf8').includes('\uFFFD')) return 'text/plain'
  return null
}

/**
 * Verify an uploaded document's content matches an allowed type.
 * @param {string} filePath - Where multer stored the upload
 * @param {string} declaredMime - The type the client claimed
 * @returns {string} The detected content type
 * @throws {Error} When the content is empty, unsupported, or does not match
 */
function assertUploadContent(filePath, declaredMime) {
  let head
  try {
    const fd = fs.openSync(filePath, 'r')
    try {
      const buffer = Buffer.alloc(SNIFF_BYTES)
      const read = fs.readSync(fd, buffer, 0, SNIFF_BYTES, 0)
      head = buffer.subarray(0, read)
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    throw new Error('Uploaded document could not be read')
  }

  const detected = sniffContentType(head)
  if (!detected) {
    throw new Error('Uploaded document is empty or in an unsupported format')
  }
  if (detected !== declaredMime) {
    throw new Error(`File content does not match its declared type ${declaredMime} (detected ${detected})`)
  }
  return detected
}

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
  sniffContentType,
  assertUploadContent,
  UPLOAD_DIR,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
}
