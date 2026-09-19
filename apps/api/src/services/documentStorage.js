const fs = require('fs')
const path = require('path')
const { UPLOAD_DIR } = require('../config')
const { getS3Deleter } = require('./s3Client')

/**
 * Remove a stored temporary document.
 *
 * Local storage: only a direct child of the configured private upload
 * directory may be removed. S3 storage: the exact recorded object key is
 * deleted; S3 deletion is idempotent (a missing object still succeeds), so a
 * retry after an interrupted deletion cannot resurrect a document.
 *
 * @returns {Promise<void>} Resolves only once the copy is gone (or, for
 *   local storage, once the unlink has completed). A failed removal throws so
 *   callers keep the job state unchanged and can retry.
 */
async function removeDocument(document) {
  if (document?.storage === 's3') {
    if (typeof document?.bucket !== 'string' || !document.bucket ||
        typeof document?.key !== 'string' || !document.key) {
      throw new Error('Remote document storage metadata is incomplete')
    }
    const deleteObject = getS3Deleter()
    if (!deleteObject) throw new Error('Remote document deletion requires S3 configuration')
    await deleteObject({ Bucket: document.bucket, Key: document.key })
    return
  }
  if (document?.storage !== undefined && document.storage !== 'local') {
    throw new Error('Local deletion cannot remove a remote document')
  }
  if (typeof document?.path !== 'string' || !document.path) {
    throw new Error('Document storage path is missing')
  }
  const filePath = path.resolve(document.path)
  if (path.dirname(filePath) !== UPLOAD_DIR || path.basename(filePath) === '.gitkeep') {
    throw new Error('Document storage path is outside the upload area')
  }
  try {
    // unlink never recursively deletes directories or follows a file symlink.
    fs.unlinkSync(filePath)
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('Temporary document removal failed')
  }
}

module.exports = { removeDocument }
