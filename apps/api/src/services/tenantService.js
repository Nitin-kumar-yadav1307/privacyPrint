/**
 * Tenant lookup service.
 *
 * Tenants come from the in-code demo registry for now. This module is the only
 * place that reads the registry, so a later phase can swap in DynamoDB without
 * touching controllers.
 *
 * These helpers answer "is this a known, active shop?". They do NOT authorize a
 * request: a client-supplied tenantId is still untrusted input.
 */

const { DEMO_TENANTS, TENANT_STATUS, toPublicTenant } = require('../models/Tenant')

/** All tenants, including inactive ones. */
function allTenants() {
  return DEMO_TENANTS
}

/**
 * Active tenants that a customer may select, in registry order.
 * @returns {Array<{id: string, name: string, code: string, status: string}>}
 */
function listActiveTenants() {
  return DEMO_TENANTS
    .filter((tenant) => tenant.status === TENANT_STATUS.ACTIVE)
    .map(toPublicTenant)
}

/**
 * Find a tenant by exact id. Leading/trailing whitespace is ignored.
 * @param {string} tenantId
 * @returns {Object|null} The tenant record, or null when unknown
 */
function findTenant(tenantId) {
  if (typeof tenantId !== 'string') return null
  const id = tenantId.trim()
  if (!id) return null
  return DEMO_TENANTS.find((tenant) => tenant.id === id) || null
}

/**
 * @param {string} tenantId
 * @returns {boolean} True only for a known tenant with ACTIVE status
 */
function isActiveTenant(tenantId) {
  return findTenant(tenantId)?.status === TENANT_STATUS.ACTIVE
}

module.exports = {
  allTenants,
  listActiveTenants,
  findTenant,
  isActiveTenant,
}
