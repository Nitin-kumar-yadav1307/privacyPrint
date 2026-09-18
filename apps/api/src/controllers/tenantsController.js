const tenantService = require('../services/tenantService')
const { TENANT_STATUS, toPublicTenant } = require('../models/Tenant')

/**
 * GET /tenants
 * List the print shops a customer may send a job to.
 * Inactive shops are excluded, so this response is safe to show publicly.
 */
function listTenants(req, res, next) {
  try {
    const tenants = tenantService.listActiveTenants()

    res.json({
      success: true,
      tenants,
      count: tenants.length,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /tenants/:tenantId
 * Look up a single active print shop.
 * Unknown and inactive shops both return 404 so inactive shops stay hidden.
 */
function getTenant(req, res, next) {
  try {
    const tenant = tenantService.findTenant(req.params.tenantId)

    if (!tenant || tenant.status !== TENANT_STATUS.ACTIVE) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Print shop not found',
      })
    }

    res.json({
      success: true,
      tenant: toPublicTenant(tenant),
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listTenants,
  getTenant,
}
