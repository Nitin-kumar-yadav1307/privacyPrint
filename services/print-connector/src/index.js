/**
 * PrivacyPrint Print Connector — entry point.
 *
 * Runs on the shop's computer, authenticates as exactly one shop tenant with
 * SHOP_TOKEN, polls for PRINTING jobs, downloads them temporarily, prints via
 * CUPS (or PDF fallback), reports the result, then deletes the local copy.
 */
const fs = require('fs')
const config = require('./config')
const logger = require('./logger')
const apiClient = require('./apiClient')
const printerService = require('./printerService')
const { JobPoller } = require('./jobPoller')

if (!config.SHOP_TOKEN) {
  logger.error('SHOP_TOKEN is required — sign in as the shop and set the token in the environment.')
  process.exit(1)
}

fs.mkdirSync(config.OUTPUT_DIR, { recursive: true })
fs.mkdirSync(config.TMP_DIR, { recursive: true })

const poller = new JobPoller({
  api: apiClient,
  printer: printerService,
  logger,
  pollIntervalMs: config.POLL_INTERVAL_MS,
})

// Keep-alive: the shop dashboard shows the connector online/offline,
// including its print mode and printer state.
const heartbeatTimer = setInterval(() => {
  apiClient
    .heartbeat({ mode: config.PRINT_MODE, printerState: printerService.status().state })
    .catch((err) => logger.warn(`Heartbeat failed: ${err.message}`))
}, 10000)
apiClient.heartbeat().catch((err) => logger.warn(`Initial heartbeat failed: ${err.message}`))

logger.info(`Connector started (mode=${config.PRINT_MODE}, poll=${config.POLL_INTERVAL_MS}ms)`)
logger.info(`Printer status: ${JSON.stringify(printerService.status())}`)
poller.start()

function shutdown() {
  logger.info('Shutting down connector')
  poller.stop()
  clearInterval(heartbeatTimer)
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)