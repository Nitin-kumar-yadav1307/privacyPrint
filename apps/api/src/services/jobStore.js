const fs = require('node:fs')
const path = require('node:path')
const { JOB_STATUS } = require('../constants')

// Single-process local store. AWS deployment will use DynamoDB instead.
function openJobStore(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  const filename = path.join(directory, 'jobs.json')
  let records = []
  try {
    const saved = JSON.parse(fs.readFileSync(filename, 'utf8'))
    if (saved.version !== 1 || !Array.isArray(saved.jobs)) throw new Error('Invalid store')
    records = saved.jobs
    const ids = new Set()
    for (const job of records) {
      const isRemote = job.document?.storage === 's3'
      const hasLocalPath = typeof job.document?.path === 'string' && job.document.path
      const hasRemoteKey = typeof job.document?.key === 'string' && job.document.key &&
        typeof job.document?.bucket === 'string' && job.document.bucket
      if (!job || typeof job.jobId !== 'string' || ids.has(job.jobId) ||
          typeof job.tenantId !== 'string' || !job.document ||
          (!isRemote && !hasLocalPath) || (isRemote && !hasRemoteKey) ||
          typeof job.printSettings !== 'object' || !job.printSettings ||
          !Object.values(JOB_STATUS).includes(job.status) ||
          !Number.isFinite(Date.parse(job.createdAt)) ||
          (job.status === JOB_STATUS.PRINTED && !Number.isFinite(Date.parse(job.expiresAt)))) {
        throw new Error('Invalid job record')
      }
      ids.add(job.jobId)
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('Job metadata could not be loaded; recovery stopped')
  }
  const jobs = new Map(records.map((job) => [job.jobId, job]))
  function save() {
    const temporary = `${filename}.tmp`
    try {
      const fd = fs.openSync(temporary, 'w', 0o600)
      try {
        fs.writeFileSync(fd, JSON.stringify({ version: 1, jobs: [...jobs.values()] }))
        fs.fsyncSync(fd)
      } finally {
        fs.closeSync(fd)
      }
      fs.renameSync(temporary, filename)
    } catch {
      try { fs.unlinkSync(temporary) } catch { /* Leave original metadata untouched. */ }
      throw new Error('Job metadata could not be saved')
    }
  }
  return { jobs, save }
}

module.exports = { openJobStore }
