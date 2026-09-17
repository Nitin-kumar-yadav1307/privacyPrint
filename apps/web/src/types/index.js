// Shared types for PrivacyPrint

/**
 * @typedef {Object} PrintSettings
 * @property {number} copies - Number of copies
 * @property {string} pages - Page range (e.g. "1-3", "all")
 * @property {'bw'|'color'} color - Black & white or color
 * @property {'A4'|'A3'} paperSize - Paper size
 * @property {boolean} duplex - Single-sided (false) or duplex (true)
 * @property {'portrait'|'landscape'} orientation - Page orientation
 * @property {number} retentionMinutes - Document retention period in minutes
 */

/**
 * @typedef {'CREATED'|'READY'|'PRINTING'|'PRINTED'|'EXPIRED'|'FAILED'|'CANCELLED'} JobStatus
 */

/**
 * @typedef {Object} PrintJob
 * @property {string} jobId - Unique job identifier
 * @property {string} tenantId - Associated print shop / tenant
 * @property {string} documentName - Original file name
 * @property {string} documentPath - Local path to uploaded document
 * @property {PrintSettings} printSettings - Customer's print configuration
 * @property {JobStatus} status - Current job status
 * @property {string} createdAt - ISO timestamp
 * @property {string|null} printedAt - ISO timestamp when printing completed
 * @property {string|null} expiresAt - ISO timestamp when document expires
 */

/**
 * @typedef {Object} Tenant
 * @property {string} id - Unique tenant identifier
 * @property {string} name - Shop / tenant display name
 * @property {string} code - Short shop code (e.g. "SHOP-MUM-001")
 * @property {'active'|'inactive'} status - Tenant status
 */
