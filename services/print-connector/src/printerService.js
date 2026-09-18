/**
 * Chooses the print path: real CUPS when available, PDF fallback otherwise.
 * PRINT_MODE=auto (default) | cups | pdf.
 */
const cupsPrinter = require('./cupsPrinter')
const pdfFallback = require('./pdfFallback')
const { PRINT_MODE, PRINTER_NAME } = require('./config')

const DISCOVERY_TTL_MS = 30000
let discoveryCache = { at: 0, discovery: null }

function discover(force = false) {
  if (!force && discoveryCache.discovery && Date.now() - discoveryCache.at < DISCOVERY_TTL_MS) {
    return discoveryCache.discovery
  }
  discoveryCache = { at: Date.now(), discovery: cupsPrinter.discoverPrinters() }
  return discoveryCache.discovery
}

/** Resolve the mode actually used for the next job. */
function resolveMode() {
  if (PRINT_MODE === 'pdf') return 'pdf'
  if (PRINT_MODE === 'cups') return 'cups'
  return discover().available ? 'cups' : 'pdf'
}

/** Status exposed to the shop dashboard. */
function status() {
  const discovery = discover()
  if (PRINT_MODE === 'pdf') return { mode: 'pdf', state: 'PDF_FALLBACK', printers: discovery.printers }
  if (PRINT_MODE === 'cups') {
    return { mode: 'cups', state: discovery.available ? 'CONNECTED' : discovery.reason, printers: discovery.printers }
  }
  return {
    mode: 'auto',
    state: discovery.available ? 'CONNECTED' : 'PDF_FALLBACK',
    printers: discovery.printers,
  }
}

/**
 * Print a downloaded document for a job.
 * @returns {{ok: boolean, mode: string, error?: string, outputPath?...}}
 */
function printDocument(filePath, job) {
  if (resolveMode() === 'cups') {
    const printer = PRINTER_NAME || discover().printers[0]
    if (!printer) return { ok: false, mode: 'CUPS', error: 'No CUPS printer available' }
    return cupsPrinter.printFile(filePath, job.printSettings, printer)
  }
  return pdfFallback.printFile(filePath, job)
}

module.exports = { resolveMode, status, printDocument }