const { simulateJob } = require('./simulator')

if (require.main === module) {
  const [tenantId, jobId] = process.argv.slice(2)
  simulateJob({
    tenantId,
    jobId,
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
  }).catch((error) => {
    console.error(`Simulator stopped: ${error.message}`)
    console.error('Usage: npm start -- TENANT-001 <jobId>')
    process.exitCode = 1
  })
}
