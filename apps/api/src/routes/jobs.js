const express = require('express')
const { upload } = require('../utils/fileValidation')
const jobsController = require('../controllers/jobsController')
const {
  resolveTenant,
  requireShopTenant,
  resolveCreateTenant,
} = require('../middleware/shopAuth')

const router = express.Router()

// Health check
router.get('/health', jobsController.health)

// Job creation.
// The tenant guard runs BEFORE multer so an unauthorized request is rejected
// without writing a customer document to disk.
router.post(
  '/jobs',
  resolveCreateTenant,
  upload.single('document'),
  jobsController.createJob
)

router.get('/jobs', resolveTenant, jobsController.listJobs)

// Printer queue — shop sees READY + PRINTING jobs
router.get('/jobs/queue', requireShopTenant, jobsController.getQueue)

// Lightweight status check
router.get('/jobs/:jobId/status', resolveTenant, jobsController.getStatus)

router.get('/jobs/:jobId', resolveTenant, jobsController.getJob)

// Shop-only operations
router.post('/jobs/:jobId/print', requireShopTenant, jobsController.startPrint)

router.post('/jobs/:jobId/complete', requireShopTenant, jobsController.completePrint)

// Customer/shop cancels a job that hasn't been printed
router.post('/jobs/:jobId/cancel', resolveTenant, jobsController.cancelJob)

// Printer simulator auto-complete
router.post('/jobs/:jobId/autocomplete', requireShopTenant, jobsController.autoComplete)

module.exports = router
