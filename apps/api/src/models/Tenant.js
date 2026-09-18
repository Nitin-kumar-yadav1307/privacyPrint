/**
 * Tenant (print shop) model.
 *
 * A tenant is the multi-tenant boundary for PrivacyPrint: every print job
 * belongs to exactly one tenant, and a shop user may only access jobs that
 * belong to their own tenant.
 *
 * Shape: { id, name, code, status }
 */

const TENANT_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
})

/**
 * Demo tenant registry.
 *
 * Phase 3 keeps tenants in source code so the hackathon demo works without a
 * database. A later phase stores tenants in DynamoDB. Shop codes follow the
 * specification example (SHOP-MUM-001, SHOP-MUM-002, ...).
 */
const DEMO_TENANTS = Object.freeze([
  Object.freeze({
    id: 'TENANT-001',
    name: 'QuickPrint Mumbai',
    code: 'SHOP-MUM-001',
    status: TENANT_STATUS.ACTIVE,
  }),
  Object.freeze({
    id: 'TENANT-002',
    name: 'Express Prints Bangalore',
    code: 'SHOP-BLR-001',
    status: TENANT_STATUS.ACTIVE,
  }),
  Object.freeze({
    id: 'TENANT-003',
    name: 'PrintHub Delhi',
    code: 'SHOP-DEL-001',
    status: TENANT_STATUS.ACTIVE,
  }),
  // Inactive shops must never be selectable and must not accept new jobs.
  Object.freeze({
    id: 'TENANT-004',
    name: 'Metro Copies Mumbai',
    code: 'SHOP-MUM-002',
    status: TENANT_STATUS.INACTIVE,
  }),
])

/**
 * Strip internal fields before a tenant is sent to a client.
 * @param {Object} tenant
 * @returns {{id: string, name: string, code: string, status: string}}
 */
function toPublicTenant(tenant) {
  return {
    id: tenant.id,
    name: tenant.name,
    code: tenant.code,
    status: tenant.status,
  }
}

module.exports = {
  TENANT_STATUS,
  DEMO_TENANTS,
  toPublicTenant,
}
