const fs = require('fs')
const path = require('path')
const { UPLOAD_DIR } = require('../config')

/** Remove only a direct child of the configured private upload directory. */
function removeDocument(document) {
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
