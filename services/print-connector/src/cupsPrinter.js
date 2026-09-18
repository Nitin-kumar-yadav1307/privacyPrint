/**
 * Real Linux/CUPS printing via `lp`.
 *
 * Security: arguments are always passed as an array to spawnSync — never a
 * shell string — and every value is whitelisted before it reaches CUPS.
 */
const { spawnSync } = require('child_process')

const PAPER_SIZES = ['A4', 'A3']
const COLOR_MODES = ['bw', 'color']
const ORIENTATIONS = ['portrait', 'landscape']

/** Assert every setting is an allowed value before it can reach `lp`. */
function validateSettings(settings) {
  const errors = []
  if (!Number.isInteger(settings.copies) || settings.copies < 1 || settings.copies > 99) {
    errors.push('copies must be an integer between 1 and 99')
  }
  if (settings.pages !== 'all' && !/^\d+(-\d+)?$/.test(String(settings.pages))) {
    errors.push('pages must be "all" or a range like "1-2"')
  }
  if (!COLOR_MODES.includes(settings.color)) errors.push('color must be "bw" or "color"')
  if (!PAPER_SIZES.includes(settings.paperSize)) errors.push('paperSize must be "A4" or "A3"')
  if (typeof settings.duplex !== 'boolean') errors.push('duplex must be true or false')
  if (!ORIENTATIONS.includes(settings.orientation)) errors.push('orientation must be portrait or landscape')
  if (errors.length > 0) throw new Error(`Invalid print settings: ${errors.join('; ')}`)
}

/**
 * Map PrivacyPrint settings to CUPS `lp` arguments.
 * The printer name always comes from trusted configuration/discovery.
 */
function buildLpArgs(settings, filePath, printerName) {
  validateSettings(settings)
  const args = ['-d', printerName, '-n', String(settings.copies)]

  if (settings.pages !== 'all') args.push('-P', String(settings.pages))
  args.push('-o', settings.color === 'bw' ? 'ColorModel=Gray' : 'ColorModel=RGB')
  args.push('-o', `media=${settings.paperSize}`)
  args.push('-o', settings.duplex ? 'sides=two-sided-long-edge' : 'sides=one-sided')
  if (settings.orientation === 'landscape') args.push('-o', 'landscape')

  // "--" ends option parsing so the file path can never be read as a flag.
  args.push('--', filePath)
  return args
}

/** Detect local CUPS printers with `lpstat -p -d`. */
function discoverPrinters() {
  try {
    const result = spawnSync('lpstat', ['-p', '-d'], { encoding: 'utf8', timeout: 5000 })
    if (result.error || result.status !== 0) {
      return { available: false, printers: [], reason: 'CUPS_UNAVAILABLE' }
    }
    const printers = (result.stdout || '')
      .split('\n')
      .map((line) => (line.match(/^printer (\S+)/) || [])[1])
      .filter(Boolean)
    return {
      available: printers.length > 0,
      printers,
      reason: printers.length > 0 ? null : 'NO_PRINTER',
    }
  } catch {
    return { available: false, printers: [], reason: 'CUPS_UNAVAILABLE' }
  }
}

/**
 * Send a document to CUPS.
 * @returns {{ok: boolean, mode: 'CUPS', error?: string}}
 */
function printFile(filePath, settings, printerName) {
  const args = buildLpArgs(settings, filePath, printerName)
  const result = spawnSync('lp', args, { encoding: 'utf8', timeout: 30000 })
  if (result.error) return { ok: false, mode: 'CUPS', error: `lp failed: ${result.error.message}` }
  if (result.status !== 0) {
    // Capture the operational error without ever logging document contents.
    return { ok: false, mode: 'CUPS', error: `lp exited with status ${result.status}` }
  }
  return { ok: true, mode: 'CUPS' }
}

module.exports = { validateSettings, buildLpArgs, discoverPrinters, printFile }