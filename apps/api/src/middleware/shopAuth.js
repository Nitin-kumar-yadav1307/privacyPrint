const { verifyToken, SHOP_ROLE } = require('../services/authService')
const tenantService = require('../services/tenantService')
const { TENANT_STATUS } = require('../models/Tenant')
const { AUTH_SECRET, AUTH_REQUIRED } = require('../config')

/**
 * Resolve the tenant a request is allowed to act on.
 *
 * Rules, in order:
 * 1. A valid `Authorization: Bearer <token>` shop session is authoritative.
 *    Its tenant always wins, and a conflicting client-supplied tenantId is
 *    rejected with 403 — this is what makes cross-tenant access fail even when
 *    the caller rewrites the query string.
 * 2. With no session, `AUTH_REQUIRED` decides: when true the request is
 *    rejected with 401; when false (local demo default) the supplied tenantId
 *    is accepted as a *selection*, not as proof of authorization.
 *
 * `required` marks endpoints that only a shop operator may call.
 */
function createTenantResolver({ required = false } = {}) {
  return function resolveTenant(req, res, next) {
    const header = req.get('authorization')

    if (header !== undefined) {
      const [scheme, token, extra] = header.split(' ')
      if (!/^Bearer$/i.test(scheme || '') || !token || extra !== undefined) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authorization header must be "Bearer <token>"',
        })
      }

      const session = verifyToken(token, { secret: AUTH_SECRET })
      if (!session || session.role !== SHOP_ROLE) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Shop session is invalid or has expired',
        })
      }

      // A session for a shop that was since disabled must stop working.
      const tenant = tenantService.findTenant(session.tenantId)
      if (!tenant || tenant.status !== TENANT_STATUS.ACTIVE) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'This shop is no longer active',
        })
      }

      const supplied = suppliedTenant(req)
      if (supplied && supplied !== tenant.id) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'The requested tenant does not match the authenticated shop',
        })
      }

      req.shopSession = { ...session, tenantId: tenant.id }
      req.authorizedTenantId = tenant.id
      return next()
    }

    if (required && AUTH_REQUIRED) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'A shop session is required for this operation',
      })
    }

    const supplied = suppliedTenant(req)
    if (!supplied) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'tenantId query parameter is required',
      })
    }

    req.authorizedTenantId = supplied
    next()
  }
}

/** Read the client-supplied tenant from the query string or parsed body. */
function suppliedTenant(req) {
  const raw = req.query?.tenantId ?? req.body?.tenantId
  if (typeof raw !== 'string') return ''
  return raw.trim()
}

/**
 * Strict variant used by session-inspection routes: a valid shop session is
 * always required, regardless of whether AUTH_REQUIRED is enabled.
 */
function requireShopSession(req, res, next) {
  const header = req.get('authorization')
  const [scheme, token, extra] = (header || '').split(' ')

  if (!/^Bearer$/i.test(scheme || '') || !token || extra !== undefined) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authorization header must be "Bearer <token>"',
    })
  }

  const session = verifyToken(token, { secret: AUTH_SECRET })
  if (!session || session.role !== SHOP_ROLE) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Shop session is invalid or has expired',
    })
  }

  const tenant = tenantService.findTenant(session.tenantId)
  if (!tenant || tenant.status !== TENANT_STATUS.ACTIVE) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'This shop is no longer active',
    })
  }

  req.shopSession = { ...session, tenantId: tenant.id }
  req.authorizedTenantId = tenant.id
  next()
}

const resolveTenant = createTenantResolver()
const requireShopTenant = createTenantResolver({ required: true })

/**
 * Tenant guard for `POST /jobs`, mounted BEFORE multer.
 *
 * Ordering matters: if authorization ran after the upload, a rejected request
 * would already have written a customer document to disk.
 *
 * With a shop session the tenant is fully authoritative here. Without one, the
 * local-demo flow defers the decision to the controller, which validates the
 * submitted form body against the tenant registry — multer has not parsed that
 * body yet at this point, which is exactly why it cannot be checked here.
 */
function resolveCreateTenant(req, res, next) {
  if (req.get('authorization') === undefined) {
    if (AUTH_REQUIRED) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'A shop session is required for this operation',
      })
    }
    return next()
  }
  return createTenantResolver({ required: true })(req, res, next)
}

module.exports = {
  createTenantResolver,
  resolveTenant,
  requireShopTenant,
  resolveCreateTenant,
  requireShopSession,
  suppliedTenant,
}
