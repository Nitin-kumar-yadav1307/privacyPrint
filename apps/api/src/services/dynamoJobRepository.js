/**
 * DynamoDB job repository (AWS mode).
 *
 * Selected when JOBS_TABLE is set. Every mutation is awaited before the
 * response is sent, so the expiry-worker Lambda — which scans this same
 * table — can always see current job state, including `expiresAtEpoch`
 * (the table's TTL attribute) and the document's S3 location.
 */
const { JOBS_TABLE } = require('../config')

let documentClientFactory = null // test seam

function createDynamoJobRepository({ tableName = JOBS_TABLE } = {}) {
  if (!tableName) throw new Error('JOBS_TABLE is required for the DynamoDB job repository')
  const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
  const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb')
  const client = documentClientFactory
    ? documentClientFactory()
    : DynamoDBDocumentClient.from(new DynamoDBClient({}), {
        marshallOptions: { removeUndefinedValues: true },
      })

  /**
   * The retention record. expiresAtEpoch drives the table's TTL (a hard
   * backstop for metadata cleanup); the expiry worker uses expiresAt (ISO)
   * for its decision and document for the S3 deletion.
   */
  function withEpoch(job) {
    if (job.expiresAt) {
      const epoch = Math.floor(Date.parse(job.expiresAt) / 1000)
      if (Number.isFinite(epoch)) return { ...job, expiresAtEpoch: epoch }
    }
    const { expiresAtEpoch, ...rest } = job
    return rest
  }

  return {
    isRemote: true,
    tableName,
    async create(job) {
      await client.send(new PutCommand({
        TableName: tableName,
        Item: withEpoch(job),
        ConditionExpression: 'attribute_not_exists(jobId)',
      }))
    },
    /** Create-or-replace; used for state transitions. */
    async put(job) {
      await client.send(new PutCommand({ TableName: tableName, Item: withEpoch(job) }))
    },
    /** Strongly consistent read: transitions must see the latest status. */
    async get(jobId) {
      const result = await client.send(new GetCommand({
        TableName: tableName,
        Key: { jobId },
        ConsistentRead: true,
      }))
      return result.Item ? { ...result.Item } : null
    },
    async listByTenant(tenantId) {
      const result = await client.send(new QueryCommand({
        TableName: tableName,
        IndexName: 'tenant-status-index',
        KeyConditionExpression: 'tenantId = :tenant',
        ExpressionAttributeValues: { ':tenant': tenantId },
      }))
      return (result.Items || []).map((item) => ({ ...item }))
    },
    async listAll() {
      const items = []
      let cursor
      do {
        const result = await client.send(new ScanCommand({
          TableName: tableName,
          ...(cursor ? { ExclusiveStartKey: cursor } : {}),
        }))
        items.push(...(result.Items || []))
        cursor = result.LastEvaluatedKey
      } while (cursor)
      return items
    },
  }
}

module.exports = {
  createDynamoJobRepository,
  /** Test seam only: supply a fake DocumentClient factory (unit tests). */
  _setDocumentClientFactory: (factory) => { documentClientFactory = factory },
}