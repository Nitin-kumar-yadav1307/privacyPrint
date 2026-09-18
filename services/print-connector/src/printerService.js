/**
 * Chooses the print path per platform:
 *   Linux/macOS → real CUPS when available
 *   Windows     → real printing via SumatraPDF when available
 *   anywhere    → PDF fallback when neither is available
 * PRINT_MODE: auto (default) | cups | windows | pdf.
 */
const cupsPrinter = require('./cupsPrinter')
const windowsPrinter = require('./windowsPrinter')
const pdfFallback = require('./pdfFallback')
const { PRINT_MODE, PRINTER_NAME, WIN_PRINT_TOOL } = require('./config')

const DISCOVERY_TTL_MS = 30000
let cupsCache = null
let windowsCache = null

function discoverCups(force = false) {
  if (!force && cupsCache && Date.now() - cupsCache.at < DISCOVERY_TTL_MS) return cupsCache.discovery
  cupsCache = { at: Date.now(), discovery: cupsPrinter.discoverPrinters() }
  return cupsCache.discovery
}

function discoverWindows(force = false) {
  if (!force && windowsCache && Date.now() - windowsCache.at < DISCOVERY_TTL_MS) return windowsCache.discovery
  windowsCache = { at: Date.now(), discovery: windowsPrinter.discoverPrinters() }
  return windowsCache.discovery
}

/**
 * Pure mode selection — unit-testable on any OS.
 * On Windows the CUPS path cannot exist, so the Windows print tool is tried
 * first; elsewhere CUPS is tried. PDF fallback is always the last resort.
 */
function selectAutoMode(platform, { cupsAvailable, windowsAvailable }) {
  if (platform === 'win32') return windowsAvailable ? 'windows' : 'pdf'
  return cupsAvailable ? 'cups' : 'pdf'
}

/** Resolve the mode actually used for the next job. */
function resolveMode() {
  if (PRINT_MODE === 'pdf') return 'pdf'
  if (PRINT_MODE === 'cups') return 'cups'
  if (PRINT_MODE === 'windows') return 'windows'
  return selectAutoMode(process.platform, {
    cupsAvailable: process.platform === 'win32' ? false : discoverCups().available,
    windowsAvailable: process.platform === 'win32' ? discoverWindows().available : false,
  })
}

/** Status exposed to the shop dashboard. */
function status() {
  const mode = resolveMode()
  if (mode === 'pdf') return { mode: 'pdf', state: 'PDF_FALLBACK', printers: [] }
  if (mode === 'windows') {
    const discovery = discoverWindows()
    return {
      mode: 'windows',
      state: discovery.available ? 'CONNECTED' : discovery.reason,
      printers: discovery.printers,
    }
  }
  const discovery = discoverCups()
  return {
    mode: 'cups',
    state: discovery.available ? 'CONNECTED' : discovery.reason,
    printers: discovery.printers,
  }
}

/**
 * Print a downloaded document for a job.
 * @returns {{ok: boolean, mode: string, error?: string, outputPath?: string, manifestPath?: string}}
 */
function printDocument(filePath, job) {
  const mode = resolveMode()
  if (mode === 'windows') {
    const printer = PRINTER_NAME || discoverWindows().defaultPrinter || discoverWindows().printers[0]
    if (!printer) return { ok: false, mode: 'WINDOWS', error: 'No Windows printer available' }
    return windowsPrinter.printFile(WIN_PRINT_TOOL, printer, job.printSettings, filePath)
  }
  if (mode === 'cups') {
    const printer = PRINTER_NAME || discoverCups().printers[0]
    if (!printer) return { ok: false, mode: 'CUPS', error: 'No CUPS printer available' }
    return cupsPrinter.printFile(filePath, job.printSettings, printer)
  }
  return pdfFallback.printFile(filePath, job)
}

module.exports = { selectAutoMode, resolveMode, status, printDocument }