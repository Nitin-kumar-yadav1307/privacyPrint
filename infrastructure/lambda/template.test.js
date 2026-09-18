const assert = require('node:assert/strict')
const test = require('node:test')
const template = require('./template.json')

const fn = template.Resources.ExpireJobsFunction
const role = template.Resources.ExpireJobsFunctionRole

test('lambda role is least-privilege but includes required permissions for expiry cleanup', () => {
  assert.equal(fn.Type, 'AWS::Lambda::Function')
  assert.equal(fn.Properties.Runtime, 'nodejs22.x')
  assert.equal(fn.Properties.Timeout, 30)
  assert.equal(role.Type, 'AWS::IAM::Role')

  const statements = role.Properties.Policies[0].PolicyDocument.Statement
  assert.ok(statements.some((s) => /logs:PutLogEvents/.test(s.Action.join(','))))
  assert.ok(statements.some((s) => /dynamodb:UpdateItem/.test(s.Action.join(','))))
  assert.ok(statements.some((s) => /s3:DeleteObject/.test(s.Action.join(','))))
})

test('lambda is named for the expiry workflow and reports its ARN', () => {
  assert.equal(fn.Properties.FunctionName, 'privacyprint-expire-jobs')
  assert.deepEqual(template.Outputs.ExpireJobsFunctionArn, {
    Value: { 'Fn::GetAtt': ['ExpireJobsFunction', 'Arn'] },
  })
})
