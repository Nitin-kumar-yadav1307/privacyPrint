/** Minimal structured logging. Never log document contents or secrets. */
function log(level, message) {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`
  if (level === 'error') console.error(line)
  else console.log(line)
}

module.exports = {
  info: (msg) => log('info', msg),
  warn: (msg) => log('warn', msg),
  error: (msg) => log('error', msg),
}