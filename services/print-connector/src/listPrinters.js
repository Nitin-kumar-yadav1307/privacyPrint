#!/usr/bin/env node
/**
 * Dry-run printer check: what the connector would detect, choose, and whether
 * the device can actually print right now. No API access, no printing.
 *
 *   npm run printers
 */
const printerService = require('./printerService')
const logger = require('./logger')

const status = printerService.status()
logger.info(JSON.stringify(status, null, 2))
if (!status.printer?.name) {
  logger.warn('No printer selected — connect one (USB or Wi-Fi) so the OS can see it, then run this again.')
  process.exit(1)
}
if (status.health?.state && status.health.state !== 'OK' && status.health.state !== 'UNKNOWN') {
  logger.warn(`Printer "${status.printer.name}" reports ${status.health.state}${status.health.message ? `: ${status.health.message}` : ''}`)
  process.exit(1)
}
logger.info(`OK: would print via "${status.printer.name}" (${status.printer.connection}, ${status.printer.source})`)
