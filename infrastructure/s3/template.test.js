const assert = require('node:assert/strict')
const test = require('node:test')
const template = require('./template.json')
const bucket = template.Resources.DocumentBucket
const properties = bucket.Properties

test('storage is encrypted, ACL-free and blocks all public access', () => {
  assert.equal(template.AWSTemplateFormatVersion, '2010-09-09')
  assert.equal(bucket.Type, 'AWS::S3::Bucket')
  assert.deepEqual(properties.BucketEncryption, {
    ServerSideEncryptionConfiguration: [
      { ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } },
    ],
  })
  assert.deepEqual(properties.PublicAccessBlockConfiguration, {
    BlockPublicAcls: true, BlockPublicPolicy: true,
    IgnorePublicAcls: true, RestrictPublicBuckets: true,
  })
  assert.deepEqual(properties.OwnershipControls.Rules, [{ ObjectOwnership: 'BucketOwnerEnforced' }])
  assert.equal(properties.AccessControl, undefined)
  assert.equal(properties.WebsiteConfiguration, undefined)
})

test('policy denies insecure transport for bucket and objects without granting access', () => {
  const policy = template.Resources.DocumentBucketPolicy
  assert.equal(policy.Type, 'AWS::S3::BucketPolicy')
  assert.deepEqual(policy.Properties.Bucket, { Ref: 'DocumentBucket' })
  assert.deepEqual(policy.Properties.PolicyDocument.Statement, [{
    Sid: 'DenyInsecureTransport', Effect: 'Deny', Principal: '*', Action: 's3:*',
    Resource: [
      { 'Fn::GetAtt': ['DocumentBucket', 'Arn'] },
      { 'Fn::Sub': '${DocumentBucket.Arn}/*' },
    ],
    Condition: { Bool: { 'aws:SecureTransport': 'false' } },
  }])
})

test('incomplete multipart uploads expire without starting document retention at upload', () => {
  assert.deepEqual(properties.LifecycleConfiguration.Rules, [{
    Id: 'AbortIncompleteUploads', Status: 'Enabled',
    AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
  }])
  // Versions would leave copies behind after a simple DeleteObject.
  assert.equal(properties.VersioningConfiguration, undefined)
  assert.equal(properties.ObjectLockEnabled, undefined)
})

test('stack replacement/deletion retains storage and exports generated identifiers', () => {
  assert.equal(bucket.DeletionPolicy, 'Retain')
  assert.equal(bucket.UpdateReplacePolicy, 'Retain')
  assert.equal(properties.BucketName, undefined)
  assert.deepEqual(template.Outputs, {
    DocumentBucketName: { Value: { Ref: 'DocumentBucket' } },
    DocumentBucketArn: { Value: { 'Fn::GetAtt': ['DocumentBucket', 'Arn'] } },
  })
})
