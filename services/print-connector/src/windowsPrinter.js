/**
 * Real Windows printing via SumatraPDF's silent command-line interface.
 *
 * Why SumatraPDF: it is the standard tool for silent PDF printing on Windows
 * (single portable executable, no printer-driver UI, no dialogs). It prints
 * to the Windows print spooler, so any printer installed on the shop PC works.
 *
 * Security: identical discipline to the CUPS path — spawn with argument
 * arrays (never a shell string), every setting whitelisted before use.
 * Sumatra settings tokens are documented at:
 * https://www.sumatrapdfreader.org/docs/SumatraPDF-cmd-line-arguments
 */
const { spawnSync } = require('child_process')
const { validateSettings } = require('./cupsPrinter')

const PAPER_NAMES = { A4: 'a4', A3: 'a3' }

/**
 * Map PrivacyPrint settings to a SumatraPDF `-print-settings` string.
 * Example for 2 copies, pages 1-2, duplex, A4, portrait: "2x,1-2,duplex,paper=a4,portrait"
 */
function buildPrintSettings(settings) {
  validateSettings(settings)
  const tokens = []
  if (settings.copies > 1) tokens.push(`${settings.copies}x`)
  if (settings.pages !== 'all') tokens.push(String(settings.pages))
  tokens.push(settings.duplex ? 'duplex' : 'simplex')
  tokens.push(`paper=${PAPER_NAMES[settings.paperSize]}`)
  tokens.push(settings.orientation === 'landscape' ? 'landscape' : 'portrait')
  return tokens.join(',')
}

/**
 * Full argument array for a silent print job.
 * @returns {string[]} e.g. [tool, '-print-to', 'HP Deskjet', '-silent', ...]
 */
function buildPrintArgs(printTool, printerName, settings, filePath) {
  validateSettings(settings)
  return [
    printTool,
    '-print-to', printerName,
    '-silent',
    '-exit-when-done',
    '-print-settings', buildPrintSettings(settings),
    filePath,
  ]
}

/** Parse `Get-CimInstance Win32_Printer` output lines of "Name|IsDefault". */
function parsePrinters(output) {
  const printers = []
  let defaultPrinter = null
  for (const line of String(output || '').split('\n')) {
    const [name, isDefault] = line.trim().split('|')
    if (!name) continue
    printers.push(name)
    if (String(isDefault).toLowerCase() === 'true') defaultPrinter = name
  }
  return { printers, defaultPrinter }
}

/** Detect printers installed on the Windows machine (PowerShell, no WMI shell strings). */
function discoverPrinters() {
  try {
    const result = spawnSync(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command',
        'Get-CimInstance Win32_Printer | ForEach-Object { "$($_.Name)|$($_.Default)" }'],
      { encoding: 'utf8', timeout: 8000 },
    )
    if (result.error || result.status !== 0) {
      return { available: false, printers: [], defaultPrinter: null, reason: 'DISCOVERY_UNAVAILABLE' }
    }
    const { printers, defaultPrinter } = parsePrinters(result.stdout)
    return {
      available: printers.length > 0,
      printers,
      defaultPrinter,
      reason: printers.length > 0 ? null : 'NO_PRINTER',
    }
  } catch {
    return { available: false, printers: [], defaultPrinter: null, reason: 'DISCOVERY_UNAVAILABLE' }
  }
}

/**
 * Send a document to the Windows print spooler via SumatraPDF.
 * @returns {{ok: boolean, mode: 'WINDOWS', error?: string}}
 */
function printFile(printTool, printerName, settings, filePath) {
  const args = buildPrintArgs(printTool, printerName, settings, filePath)
  const result = spawnSync(args[0], args.slice(1), { encoding: 'utf8', timeout: 120000 })
  if (result.error) return { ok: false, mode: 'WINDOWS', error: `print tool failed: ${result.error.message}` }
  if (result.status !== 0) {
    // Operational error only — never log document contents or paths.
    return { ok: false, mode: 'WINDOWS', error: `print tool exited with status ${result.status}` }
  }
  return { ok: true, mode: 'WINDOWS' }
}

module.exports = { buildPrintSettings, buildPrintArgs, parsePrinters, discoverPrinters, printFile }