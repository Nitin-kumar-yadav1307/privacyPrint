const fs = require('node:fs/promises')
const { constants } = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { UPLOAD_DIR } = require('../config')
const { MAX_FILE_SIZE } = require('../constants')

/**
 * Upload boundary for a validated Multer file. S3 client contract:
 * async putObject({ Bucket, Key, Body, ContentType, ServerSideEncryption }).
 * The caller owns the local staging file, including cleanup after persistence.
 * This module does not configure AWS credentials or expose document URLs.
 */
function createDocumentUploader({ provider = 'local', bucket, client } = {}) {
  if (!['local', 's3'].includes(provider)) throw new Error('Unknown document storage provider')
  if (provider === 's3' && (
    typeof bucket !== 'string' || !bucket.trim() || typeof client?.putObject !== 'function'
  )) {
    throw new Error('S3 storage requires a bucket and an async putObject client')
  }

  return async function uploadDocument(file, tenantId) {
    if (typeof file?.path !== 'string' || !file.path) throw new Error('Document storage path is missing')
    const filePath = path.resolve(file.path)
    if (path.dirname(filePath) !== UPLOAD_DIR || path.basename(filePath) === '.gitkeep') {
      throw new Error('Document storage path is outside the upload area')
    }
    if (typeof tenantId !== 'string' || !tenantId.trim() || tenantId.length > 128) {
      throw new Error('A tenant identifier of at most 128 characters is required')
    }

    // Do not follow a staging-file symlink or read a non-regular/oversized file.
    const handle = await fs.open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
    let body
    try {
      const stat = await handle.stat()
      if (!stat.isFile() || stat.size > MAX_FILE_SIZE) throw new Error('Invalid temporary document')
      if (provider === 's3') {
        // Bound the read even if a writer changes the file after stat().
        body = Buffer.alloc(MAX_FILE_SIZE + 1)
        let size = 0
        while (size < body.length) {
          const { bytesRead } = await handle.read(body, size, body.length - size, null)
          if (!bytesRead) break
          size += bytesRead
        }
        if (size > MAX_FILE_SIZE) throw new Error('Invalid temporary document')
        body = body.subarray(0, size)
      }
    } finally {
      await handle.close()
    }

    const metadata = {
      filename: file.filename,
      originalName: file.originalname,
    }
    if (provider === 'local') return { ...metadata, storage: 'local', path: filePath }

    // Opaque filenames avoid putting customer document names in object keys.
    // Encoding keeps the supplied tenant value within a single key segment.
    const key = `documents/${encodeURIComponent(tenantId)}/${randomUUID()}`
    await client.putObject({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: file.mimetype || 'application/octet-stream',
      ServerSideEncryption: 'AES256',
    })
    return { ...metadata, storage: 's3', bucket, key }
  }
}

module.exports = { createDocumentUploader }
