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

const STARTUP_RETRY_MS = Math.max(1000, Number(process.env.STARTUP_RETRY_MS || 3000))
const STARTUP_RETRY_LIMIT = Math.max(1, Number(process.env.STARTUP_RETRY_LIMIT || 20))

async function bootstrapAuth() {
  if (apiClient.getShopToken()) return

  if (!config.SHOP_TENANT_ID) {
    logger.error('SHOP_TOKEN or SHOP_TENANT_ID is required — sign in as the shop and set one of them in the environment.')
    process.exit(1)
  }

  for (let attempt = 1; attempt <= STARTUP_RETRY_LIMIT; attempt += 1) {
    try {
      await apiClient.pingHealth()
      logger.info(`Logging in as ${config.SHOP_TENANT_ID}...`)
      const session = await apiClient.loginShop({
        tenantId: config.SHOP_TENANT_ID,
        passcode: config.SHOP_PASSCODE,
      })
      logger.info(`Authenticated as ${session.tenant?.code || config.SHOP_TENANT_ID}`)
      return
    } catch (err) {
      if (attempt === STARTUP_RETRY_LIMIT) {
        throw err
      }
      logger.warn(`API not ready yet (${attempt}/${STARTUP_RETRY_LIMIT}): ${err.message}`)
      await new Promise((resolve) => setTimeout(resolve, STARTUP_RETRY_MS))
    }
  }
}

fs.mkdirSync(config.OUTPUT_DIR, { recursive: true })
fs.mkdirSync(config.TMP_DIR, { recursive: true })

async function main() {
  await bootstrapAuth()

  const poller = new JobPoller({
    api: apiClient,
    printer: printerService,
    logger,
    pollIntervalMs: config.POLL_INTERVAL_MS,
  })

  // Keep-alive: the shop dashboard shows the connector online/offline, the
  // printer it detected by itself (name + how it is attached) and the print mode.
  const heartbeatMeta = () => {
    const current = printerService.status()
    return {
      mode: config.PRINT_MODE,
      printerState: current.state,
      printerName: current.printer?.name || null,
      printerConnection: current.printer?.connection || null,
      printerSource: current.printer?.source || null,
    }
  }
  const beat = () => apiClient.heartbeat(heartbeatMeta()).catch((err) => logger.warn(`Heartbeat failed: ${err.message}`))
  const heartbeatTimer = setInterval(beat, 10000)
  beat()

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
}

if (require.main === module) {
  main().catch((err) => {
    logger.error(`Connector failed to start: ${err.message}`)
    process.exit(1)
  })
}

module.exports = { bootstrapAuth, main }