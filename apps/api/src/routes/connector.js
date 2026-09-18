const express = require('express')
const connectorController = require('../controllers/connectorController')
const { resolveTenant, requireShopTenant } = require('../middleware/shopAuth')

const router = express.Router()

// Connector work queue — PRINTING jobs for the authenticated shop.
router.get('/connector/jobs', requireShopTenant, connectorController.listJobs)

// Actual document bytes — tenant-checked, PRINTING only.
router.get('/connector/jobs/:jobId/document', requireShopTenant, connectorController.getDocument)

// Print outcome reported back by the connector.
router.post('/connector/jobs/:jobId/complete', requireShopTenant, connectorController.completePrint)

// Liveness so the shop dashboard can show connector online/offline.
router.post('/connector/heartbeat', requireShopTenant, connectorController.heartbeat)
router.get('/connector/status', resolveTenant, connectorController.status)

module.exports = router