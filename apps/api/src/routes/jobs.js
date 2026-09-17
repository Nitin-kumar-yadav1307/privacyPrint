const express = require('express')
const { upload } = require('../utils/fileValidation')
const jobsController = require('../controllers/jobsController')

const router = express.Router()

// Health check
router.get('/health', jobsController.health)

// Job CRUD routes
router.post(
  '/jobs',
  upload.single('document'),
  jobsController.createJob
)

router.get('/jobs', jobsController.listJobs)

router.get('/jobs/:jobId', jobsController.getJob)

router.post('/jobs/:jobId/print', jobsController.startPrint)

router.post('/jobs/:jobId/complete', jobsController.completePrint)

module.exports = router
