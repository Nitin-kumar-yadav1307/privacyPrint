# Private S3 document storage — Phase 9 foundation

This CloudFormation template provisions storage only. The API still uses local
files; S3 uploads/deletion, tenant-authorized access, signed URLs, DynamoDB,
Lambda and EventBridge integration are **not implemented by this template**.
Do not use it with real customer documents yet.

## Security and retention decisions

- AWS-generated bucket name (no global-name collision configuration needed).
- Default SSE-S3 AES256 encryption at rest. This is not customer-managed KMS.
- All four public-access blocks enabled; ACLs disabled with BucketOwnerEnforced.
- Explicit denial of non-TLS bucket/object requests. No public Allow statements.
- No application IAM permissions yet: future runtime roles need least-privilege
  access and server-side tenant authorization. A private bucket alone does not
  isolate tenants from each other.
- Incomplete multipart uploads are aborted after one day. This does **not**
  expire completed documents and is not a precise timer.
- No object-age expiration: customer retention starts after printing, not upload.
  The eventual backend/scheduler must delete completed documents at their deadlines.
- Versioning and Object Lock are not enabled, so ordinary deletion will not leave
  previous versions intentionally retained by this stack.
- Stack deletion/replacement retains the bucket. This avoids accidental data loss
  during infrastructure changes but **does not satisfy document retention**.
  An operator must empty/delete retained buckets after verifying they are no longer
  needed. Retained objects continue incurring storage charges.

## Local checks

No AWS credentials or dependencies are needed:

```sh
node --test /home/nitin/Documents/programming/hackathon/privacyPrint/infrastructure/s3/template.test.js
```

These tests check JSON structure and security/retention invariants only. They do
not replace CloudFormation validation or live AWS access tests.

## Optional AWS validation/deployment

Requires AWS CLI v2 and an authenticated account with suitable CloudFormation/S3
permissions. Review the account and region first. The commands below use
`ap-south-1` and the stack name `privacyprint-document-storage`; change those
values deliberately if needed. Deployment creates billable AWS resources.
Never put credentials in the template, repository or shell command arguments.

```sh
aws sts get-caller-identity --region ap-south-1 --no-cli-pager
aws cloudformation validate-template --template-body file:///home/nitin/Documents/programming/hackathon/privacyPrint/infrastructure/s3/template.json --region ap-south-1 --no-cli-pager
aws cloudformation deploy --template-file /home/nitin/Documents/programming/hackathon/privacyPrint/infrastructure/s3/template.json --stack-name privacyprint-document-storage --region ap-south-1 --no-fail-on-empty-changeset --no-cli-pager
aws cloudformation describe-stacks --stack-name privacyprint-document-storage --region ap-south-1 --query 'Stacks[0].Outputs' --output json --no-cli-pager
```

AWS validation and deployment have not been run in the development environment:
the AWS CLI is not installed. Credential availability has not been checked.
After deployment, verify bucket encryption, ownership controls, public-access
blocks and the policy in AWS before connecting an application. Do not interpret
passing local tests as evidence of a deployed or working AWS integration.

## Preparatory uploader boundary

`/home/nitin/Documents/programming/hackathon/privacyPrint/apps/api/src/services/documentUploader.js`
exports `createDocumentUploader(options)`. Local storage is the default. S3 mode
requires an explicit bucket and an injected async `putObject` client accepting
S3-style request fields. No AWS SDK adapter is installed or configured yet.
Offline tests use a fake client and do not contact AWS.

The uploader checks bounded regular staging files, generates opaque object keys,
requests SSE-S3, and returns remote metadata only after the client succeeds.
Failures propagate without falling back to local success. Tenant key prefixes
are not authorization. The caller retains responsibility for staging-file cleanup.

**The API now awaits this uploader in local mode only.** It creates a job only
once the uploader confirms the local file and uses the returned local metadata.
Upload failures create no job and trigger staging-file cleanup. Remote metadata
must not be passed to the current local-only model, deletion or recovery code.
The next integration must coordinate remote metadata persistence, staging cleanup,
S3 deletion, and restart recovery.
Network errors can occur after S3 accepts an object, so remote orphan cleanup
also remains necessary. This is not a deployed or end-to-end S3 integration.

Run the offline uploader and API regression tests:

```sh
npm --prefix /home/nitin/Documents/programming/hackathon/privacyPrint/apps/api test
```
