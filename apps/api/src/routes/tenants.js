const express = require('express')
const tenantsController = require('../controllers/tenantsController')

const router = express.Router()

// Print shop (tenant) directory — active shops only
router.get('/tenants', tenantsController.listTenants)

router.get('/tenants/:tenantId', tenantsController.getTenant)

module.exports = router
