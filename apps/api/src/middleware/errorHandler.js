/**
 * Centralized error handler middleware.
 * Provides consistent JSON error responses across all routes.
 *
 * Errors are returned with a safe message (no stack traces to clients).
 * The original error is logged to the console for debugging.
 */

function errorHandler(err, req, res, next) {
  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large',
      message: `Maximum file size is 10MB`,
    })
  }

  // Validation / bad request errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: err.name || 'Error',
      message: err.message,
    })
  }

  // Log unexpected errors server-side
  console.error('[ERROR]', err)

  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred. Please try again.',
  })
}

module.exports = { errorHandler }
