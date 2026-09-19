const assert = require('node:assert/strict')
const test = require('node:test')
const template = require('./template.json')

const bucket = template.Resources.WebBucket
const policy = template.Resources.WebBucketBucketPolicy || template.Resources.WebBucketPolicy

test('web bucket serves the SPA with an explicit public-read policy only', () => {
  assert.equal(bucket.Properties.WebsiteConfiguration.IndexDocument, 'index.html')
  assert.equal(bucket.Properties.WebsiteConfiguration.ErrorDocument, 'index.html')
  assert.equal(bucket.Properties.PublicAccessBlockConfiguration.BlockPublicPolicy, undefined,
    'website hosting requires allowing the public-read bucket policy')
  const statement = policy.Properties.PolicyDocument.Statement
    .find((s) => s.Sid === 'PublicReadWebsiteContent')
  assert.equal(statement.Action, 's3:GetObject', 'public access is read-only')
  assert.ok(statement.Resource['Fn::Sub'].endsWith('/*'))
})

test('web outputs give the deploy script the URL and bucket name', () => {
  assert.deepEqual(template.Outputs.WebsiteURL.Value, { 'Fn::GetAtt': ['WebBucket', 'WebsiteURL'] })
  assert.deepEqual(template.Outputs.WebBucketName.Value, { Ref: 'WebBucket' })
})