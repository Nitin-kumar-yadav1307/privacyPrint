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
  assert.deepEqual(template.Outputs.CloudFrontURL.Value, {
    'Fn::Sub': 'https://${CloudFrontDistribution.DomainName}',
  })
})

test('cloudfront distribution enables HTTPS redirect and SPA route fallback', () => {
  const cf = template.Resources.CloudFrontDistribution
  assert.ok(cf, 'CloudFrontDistribution resource exists')
  assert.equal(cf.Type, 'AWS::CloudFront::Distribution')
  const config = cf.Properties.DistributionConfig
  assert.equal(config.Enabled, true)
  assert.equal(config.DefaultRootObject, 'index.html')
  assert.equal(config.DefaultCacheBehavior.ViewerProtocolPolicy, 'redirect-to-https')
  const err404 = config.CustomErrorResponses.find((r) => r.ErrorCode === 404)
  assert.ok(err404, '404 error response fallback configured')
  assert.equal(err404.ResponseCode, 200)
  assert.equal(err404.ResponsePagePath, '/index.html')
})