/**
 * AWS repository for the expiry worker (DynamoDB + S3).
 * The AWS SDK is only loaded here, so unit tests can exercise the worker's
 * logic with a fake repository and no AWS dependencies installed.
 */
const { DynamoDBClient, ScanCommand, UpdateCommand } = require('@aws-sdk/client-dynamodb')
const { S3Client, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3')

function createRepository(env = process.env) {
  const jobsTable = env.JOBS_TABLE
  const bucket = env.DOCUMENT_BUCKET
  if (!jobsTable || !bucket) {
    throw new Error('JOBS_TABLE and DOCUMENT_BUCKET are required for the expiry worker')
  }

  const ddb = new DynamoDBClient({})
  const s3 = new S3Client({})

  function unmarshall(job) {
    return {
      jobId: job.jobId.S,
      tenantId: job.tenantId.S,
      status: job.status.S,
      createdAt: job.createdAt.S,
      expiresAt: job.expiresAt ? job.expiresAt.S : undefined,
      document: job.document ? JSON.parse(job.document.S) : undefined,
    }
  }

  /**
   * Active jobs the worker may act on (not yet terminal), for rule evaluation.
   * Scans for non-terminal statuses; expiresAt is evaluated by expiryCore.
   */
  async function findActive(now = Date.now()) {
    const result = await ddb.send(
      new ScanCommand({
        TableName: jobsTable,
        FilterExpression: '#s IN (:created, :ready, :printed)',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':created': { S: 'CREATED' },
          ':ready': { S: 'READY' },
          ':printed': { S: 'PRINTED' },
        },
      }),
    )
    return (result.Items || []).map(unmarshall)
  }

  /**
   * Delete the temporary document from S3 FIRST — privacy requires that the
   * digital copy is gone before the metadata says EXPIRED. A failed deletion
   * must leave the job untouched so the next invocation retries.
   */
  async function deleteDocument(job) {
    const document = job.document || {}
    const key = document.objectKey || document.filename
    if (!key) throw new Error('Document has no object key')
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  }

  async function markExpired(jobId) {
    await ddb.send(
      new UpdateCommand({
        TableName: jobsTable,
        Key: { jobId: { S: jobId } },
        ConditionExpression: '#s = :printed',
        UpdateExpression: 'SET #s = :expired, expiredAt = :at',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':printed': { S: 'PRINTED' },
          ':expired': { S: 'EXPIRED' },
          ':at': { S: new Date().toISOString() },
        },
      }),
    )
  }

  async function markCancelled(jobId, reason) {
    await ddb.send(
      new UpdateCommand({
        TableName: jobsTable,
        Key: { jobId: { S: jobId } },
        ConditionExpression: '#s IN (:created, :ready)',
        UpdateExpression: 'SET #s = :cancelled, cancellationReason = :reason',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':created': { S: 'CREATED' },
          ':ready': { S: 'READY' },
          ':cancelled': { S: 'CANCELLED' },
          ':reason': { S: reason },
        },
      }),
    )
  }

  return { findActive, deleteDocument, markExpired, markCancelled }
}

module.exports = { createRepository }