const assert = require('node:assert/strict')
const test = require('node:test')
const template = require('./template.json')

const fn = template.Resources.ApiFunction
const role = template.Resources.ApiFunctionRole
const url = template.Resources.ApiFunctionUrl

test('api lambda exposes the express app through a function url', () => {
  assert.equal(fn.Type, 'AWS::Lambda::Function')
  assert.equal(fn.Properties.Handler, 'src/lambda.handler')
  assert.equal(fn.Properties.Runtime, 'nodejs22.x')
  assert.equal(fn.Properties.Code, '../../apps/api/dist/lambda.zip')
  assert.equal(url.Properties.AuthType, 'NONE')
  assert.deepEqual(url.Properties.Cors.AllowMethods, ['GET', 'POST', 'OPTIONS'])
  assert.deepEqual(template.Outputs.ApiFunctionUrl.Value, {
    'Fn::GetAtt': ['ApiFunctionUrl', 'FunctionUrl'],
  })
})

test('api lambda runs in enforced production auth with scoped s3 access', () => {
  const env = fn.Properties.Environment.Variables
  assert.equal(env.NODE_ENV, 'production')
  assert.equal(env.AUTH_REQUIRED, 'true')
  assert.deepEqual(env.AUTH_SECRET, { Ref: 'AuthSecret' })
  assert.deepEqual(env.DOCUMENT_BUCKET, { Ref: 'DocumentBucketName' })
  const statements = role.Properties.Policies[0].PolicyDocument.Statement
  const s3 = statements.find((s) => Array.isArray(s.Action) && s.Action.includes('s3:GetObject'))
  assert.ok(s3, 'role grants object-level S3 access')
  assert.match(s3.Resource['Fn::Sub'], /\/\*$/, 'S3 access is object-scoped, never bucket-wide')
  assert.ok(!statements.some((s) => /dynamodb/.test(String(s.Action))), 'API role does not touch DynamoDB')
})