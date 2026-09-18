const tenantService = require('../services/tenantService')
const { TENANT_STATUS, toPublicTenant } = require('../models/Tenant')
const { issueToken, safeEqual, SHOP_ROLE } = require('../services/authService')
const { AUTH_SECRET, SESSION_TTL_SECONDS, SHOP_DEMO_PASSCODE } = require('../config')

/**
 * POST /auth/shop/login
 *
 * Mock shop authentication (plan Phase 6). A shared demo passcode stands in for
 * a real identity provider; the response is a signed, expiring session token
 * whose `sub` claim is the shop's tenantId. Every later shop request derives its
 * tenant from that token instead of trusting a client-supplied tenantId.
 *
 * @body {string} tenantId - The shop the operator is signing in to
 * @body {string} passcode - Demo credential
 */
function shopLogin(req, res, next) {
  try {
    const { tenantId, passcode } = req.body || {}

    if (typeof tenantId !== 'string' || !tenantId.trim()) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'tenantId is required',
      })
    }
    if (typeof passcode !== 'string' || !passcode) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'passcode is required',
      })
    }

    const tenant = tenantService.findTenant(tenantId)
    if (!tenant) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Print shop not found',
      })
    }
    if (tenant.status !== TENANT_STATUS.ACTIVE) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This shop is not active',
      })
    }

    // Constant-time comparison so the passcode cannot be probed byte by byte.
    if (!safeEqual(passcode, SHOP_DEMO_PASSCODE)) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid shop credentials',
      })
    }

    const { token, expiresAt } = issueToken({
      tenantId: tenant.id,
      secret: AUTH_SECRET,
      ttlSeconds: SESSION_TTL_SECONDS,
    })

    res.json({
      success: true,
      token,
      role: SHOP_ROLE,
      expiresAt,
      tenant: toPublicTenant(tenant),
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /auth/shop/session
 * Confirms the presented session and returns the shop it authorizes.
 * Requires a valid session (enforced by the route middleware).
 */
function currentSession(req, res, next) {
  try {
    const tenant = tenantService.findTenant(req.shopSession.tenantId)

    res.json({
      success: true,
      role: req.shopSession.role,
      tenantId: req.shopSession.tenantId,
      expiresAt: req.shopSession.expiresAt,
      tenant: tenant ? toPublicTenant(tenant) : null,
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  shopLogin,
  currentSession,
}
