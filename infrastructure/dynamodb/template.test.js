const assert = require('node:assert/strict')
const test = require('node:test')
const template = require('./template.json')

const jobsTable = template.Resources.JobsTable
const tenantsTable = template.Resources.TenantsTable

test('jobs table is tenant-aware and expiry-driven', () => {
  assert.equal(jobsTable.Type, 'AWS::DynamoDB::Table')
  assert.equal(jobsTable.Properties.TableName, 'privacyprint-jobs')
  assert.equal(jobsTable.Properties.BillingMode, 'PAY_PER_REQUEST')
  assert.equal(jobsTable.Properties.TimeToLiveSpecification.AttributeName, 'expiresAtEpoch')
  assert.equal(jobsTable.Properties.TimeToLiveSpecification.Enabled, true)
  assert.equal(jobsTable.Properties.DeletionProtectionEnabled, true)
  assert.deepEqual(jobsTable.Properties.KeySchema, [{ AttributeName: 'jobId', KeyType: 'HASH' }])
  assert.deepEqual(jobsTable.Properties.GlobalSecondaryIndexes[0].KeySchema, [
    { AttributeName: 'tenantId', KeyType: 'HASH' },
    { AttributeName: 'status', KeyType: 'RANGE' },
  ])
})

test('tenants table stores only tenant metadata and remains protected', () => {
  assert.equal(tenantsTable.Type, 'AWS::DynamoDB::Table')
  assert.equal(tenantsTable.Properties.TableName, 'privacyprint-tenants')
  assert.equal(tenantsTable.Properties.DeletionProtectionEnabled, true)
  assert.deepEqual(tenantsTable.Properties.KeySchema, [{ AttributeName: 'tenantId', KeyType: 'HASH' }])
})
