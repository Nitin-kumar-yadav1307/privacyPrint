/**
 * PDF fallback: produces a real, inspectable print artifact without hardware.
 * The document is copied verbatim and a settings manifest records exactly what
 * the requested print operation was (copies, page range, paper, duplex...).
 * No PDF manipulation dependencies — the fidelity contract is "verbatim copy +
 * manifest", agreed in docs/plan2.md amendments.
 */
const fs = require('fs')
const path = require('path')
const { OUTPUT_DIR } = require('./config')

/**
 * @returns {{ok: true, mode: 'PDF_FALLBACK', outputPath, manifestPath}}
 */
function printFile(filePath, job) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const outputPath = path.join(OUTPUT_DIR, `${job.jobId}-print.pdf`)
  fs.copyFileSync(filePath, outputPath)

  const manifestPath = path.join(OUTPUT_DIR, `${job.jobId}-manifest.json`)
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        jobId: job.jobId,
        originalName: job.document?.originalName || null,
        printSettings: job.printSettings,
        mode: 'PDF_FALLBACK',
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  )

  return { ok: true, mode: 'PDF_FALLBACK', outputPath, manifestPath }
}

module.exports = { printFile }