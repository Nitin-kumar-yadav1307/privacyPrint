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
const { checkPrinterHealth, healthFailureReason, PRINTER_HEALTH } = require('./printerHealth')
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

/** Discovery result for the platform's print system (never the PDF fallback). */
function discoverFor(platform = process.platform, force = false) {
  if (platform === 'win32') return discoverWindows(force)
  return discoverCups(force)
}

/** Connection kinds a real document can come out of, best first. */
const CONNECTION_PRIORITY = ['USB', 'LOCAL', 'NETWORK', 'UNKNOWN']

/**
 * Pure printer choice — deterministic and testable on any OS.
 *
 * Order: explicit override (PRINTER_NAME) → the OS default printer → a directly
 * attached printer (USB beats network) → any remaining real printer. Virtual
 * queues are skipped: nobody wants a shop job silently printed into a PDF file.
 *
 * @returns {{name: string|null, source: 'CONFIGURED'|'OS_DEFAULT'|'AUTO_DETECTED'|'NONE',
 *            connection: string}}
 */
function selectPrinter({ configured, defaultPrinter, details }) {
  const list = Array.isArray(details) ? details : []
  const find = (name) => list.find((entry) => entry.name === name)

  if (configured) {
    const known = find(configured)
    return { name: configured, source: 'CONFIGURED', connection: known ? known.connection : 'UNKNOWN' }
  }
  const defaultEntry = defaultPrinter ? find(defaultPrinter) : null
  if (defaultPrinter && defaultEntry?.connection !== 'VIRTUAL') {
    return { name: defaultPrinter, source: 'OS_DEFAULT', connection: defaultEntry ? defaultEntry.connection : 'UNKNOWN' }
  }
  for (const connection of CONNECTION_PRIORITY) {
    const match = list.find((entry) => entry.connection === connection)
    if (match) return { name: match.name, source: 'AUTO_DETECTED', connection: match.connection }
  }
  return { name: null, source: 'NONE', connection: 'UNKNOWN' }
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

/**
 * Status exposed to the shop dashboard: which printer the connector configured
 * itself for, how it is attached, why it was chosen, and whether the device can
 * actually accept a document right now.
 */
function status() {
  const mode = resolveMode()
  if (mode === 'pdf') {
    return {
      mode: 'pdf',
      state: 'PDF_FALLBACK',
      printer: { name: null, source: 'NONE', connection: 'UNKNOWN' },
      health: { state: PRINTER_HEALTH.UNKNOWN, message: '' },
      printers: [],
    }
  }

  const discovery = mode === 'windows' ? discoverWindows() : discoverCups()
  const printer = selectPrinter({
    configured: PRINTER_NAME,
    defaultPrinter: discovery.defaultPrinter,
    details: discovery.details,
  })

  // A configured printer that is no longer installed is reported honestly
  // instead of silently printing somewhere else.
  let state = discovery.available ? 'CONNECTED' : discovery.reason
  if (printer.name && !discovery.printers.includes(printer.name)) state = 'PRINTER_NOT_FOUND'

  // Real device health (only meaningful where CUPS exists): an idle/enabled
  // queue whose device is unplugged must not look "ready" to the shop.
  const health = printer.name ? checkPrinterHealth(printer.name) : { state: PRINTER_HEALTH.UNKNOWN, message: '', blocking: false }
  if (health.blocking) state = health.state

  return {
    mode,
    state,
    printer,
    health: { state: health.state, message: health.message },
    printers: discovery.printers,
    availablePrinters: (discovery.details || []).map((entry) => ({
      name: entry.name,
      connection: entry.connection,
    })),
  }
}

/**
 * Print a downloaded document for a job.
 *
 * Self-healing: when no usable printer is known yet (the shop just plugged one
 * in, or the previous one was switched off), discovery is forced once more
 * before the attempt is failed.
 *
 * @returns {{ok: boolean, mode: string, error?: string, health?: string, outputPath?: string, manifestPath?: string}}
 */
async function printDocument(filePath, job, deps = {}) {
  const mode = deps.mode || resolveMode()
  if (mode === 'windows') {
    const args = { configured: PRINTER_NAME, details: discoverWindows().details }
    let chosen = selectPrinter({ ...args, defaultPrinter: discoverWindows().defaultPrinter })
    if (!chosen.name) {
      const retry = discoverWindows(true)
      chosen = selectPrinter({ configured: PRINTER_NAME, defaultPrinter: retry.defaultPrinter, details: retry.details })
    }
    if (!chosen.name) {
      return {
        ok: false,
        mode: 'WINDOWS',
        error: 'No printer detected — install the printer on this computer (USB or network), then retry',
      }
    }
    return windowsPrinter.printFile(WIN_PRINT_TOOL, chosen.name, job.printSettings, filePath)
  }
  if (mode === 'cups') {
    let discovery = deps.cupsDiscovery || discoverCups()
    let chosen = selectPrinter({ configured: PRINTER_NAME, defaultPrinter: discovery.defaultPrinter, details: discovery.details })
    if (!chosen.name && !deps.cupsDiscovery) {
      discovery = discoverCups(true)
      chosen = selectPrinter({ configured: PRINTER_NAME, defaultPrinter: discovery.defaultPrinter, details: discovery.details })
    }
    if (!chosen.name) {
      return {
        ok: false,
        mode: 'CUPS',
        error: 'No printer detected — connect the printer over USB or Wi-Fi so CUPS can see it, then retry',
      }
    }
    // Pre-flight: a queue that is idle/enabled can still be unplugged or out
    // of paper. Sending a job into that state jams the queue, so it is refused
    // with an actionable reason instead. UNKNOWN (no lpstat, e.g. Windows) never
    // blocks — the post-print verification in cupsPrinter remains the backstop.
    const health = checkPrinterHealth(chosen.name, deps.healthRunner ? { runner: deps.healthRunner } : deps)
    if (health.blocking) {
      return {
        ok: false,
        mode: 'CUPS',
        health: health.state,
        error: healthFailureReason(health, chosen.name),
      }
    }
    return cupsPrinter.printFile(filePath, job.printSettings, chosen.name, deps.printDeps)
  }
  return pdfFallback.printFile(filePath, job)
}

module.exports = { selectAutoMode, selectPrinter, resolveMode, discoverFor, status, printDocument }