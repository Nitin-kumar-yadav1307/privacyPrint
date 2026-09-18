# PrivacyPrint Expiry Worker

The event-driven cleaner that makes document expiry real: an EventBridge
schedule invokes this Lambda, which deletes expired temporary documents from
S3 **before** transitioning their jobs to `EXPIRED` in DynamoDB.

Why a Lambda and not a timer inside the web server? Because deletion must not
depend on the API process staying alive — retention is a promise to the
customer, and it is enforced by an independent, least-privilege worker whose
invocation is observable in CloudWatch.

## Rules (identical to the local checker)

- `PRINTED` + retention elapsed → delete S3 object → job `EXPIRED`
- `CREATED`/`READY` + 10 min stale → delete S3 object → job `CANCELLED` (safety)
- Failed deletions change nothing and retry on the next invocation — an
  `EXPIRED` job whose document still exists is impossible by construction.

## Layout

- `src/expiryCore.js` — pure lifecycle rules (no AWS)
- `src/dynamoRepository.js` — DynamoDB/S3 adapter (`@aws-sdk/clients`, loaded lazily)
- `src/index.js` — Lambda `handler`
- `tests/` — rule + handler tests with a fake repository (no AWS needed)

## Environment

| Variable | Meaning |
|---|---|
| `JOBS_TABLE` | DynamoDB jobs table (`privacyprint-jobs`) |
| `DOCUMENT_BUCKET` | Private S3 bucket holding temporary documents |

## Tests

```bash
npm install   # only needed to deploy (AWS SDK); unit tests run without it
npm test
```

Deployment packaging: zip `src/` as the function code for the
`privacyprint-expire-jobs` Lambda defined in `infrastructure/lambda/`.