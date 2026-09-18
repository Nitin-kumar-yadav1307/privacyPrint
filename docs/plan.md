# PrivacyPrint — Agentic Development Instructions

You are the lead software engineer responsible for implementing the PrivacyPrint project in this repository.

Work **autonomously but incrementally**. Do NOT attempt to build the entire project in one operation.

The repository is already initialized with Git and has a GitHub remote.

---

# 1. PRODUCT

PrivacyPrint is a privacy-first, multi-tenant print-job platform.

Core idea:

> Customers configure their own print jobs and decide how long their temporary digital document should exist.

A customer should not need to install an application.

The customer uses a browser to:

1. Identify/select a print shop.
2. Upload a document.
3. Configure the complete print job.
4. Send the job to the selected print shop.
5. Track the job.
6. See when printing is completed.
7. See the retention/expiration lifecycle.

The shopkeeper uses a browser dashboard to:

1. Authenticate into their shop/tenant.
2. See only their own shop's print jobs.
3. View the customer's predefined print settings.
4. Click PRINT.
5. Mark/receive the print completion event.
6. Never need to reconfigure the customer's print settings.

For the hackathon, use a **printer simulator** instead of requiring a physical printer.

---

# 2. NON-NEGOTIABLE ARCHITECTURE

This is a **multi-tenant SaaS application**.

Do NOT implement it as a single-shop application and retrofit tenancy later.

Conceptually:

Customer
↓
Print Job
↓
Tenant / Print Shop
↓
Shop Dashboard
↓
Printer / Printer Simulator

Every print job must have a tenant/shop relationship.

Example:

{
jobId,
tenantId,
...
}

A shop user must only be able to access jobs belonging to their authorized tenant.

Never trust a client-provided tenantId for authorization.

Tenant authorization must be enforced server-side.

---

# 3. TARGET MONOREPO

Use this structure:

privacyPrint/
│
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   │   ├── customer/
│   │   │   │   └── shop/
│   │   │   ├── services/
│   │   │   ├── hooks/
│   │   │   ├── context/
│   │   │   └── types/
│   │   └── package.json
│   │
│   └── api/
│       ├── src/
│       │   ├── routes/
│       │   ├── controllers/
│       │   ├── services/
│       │   ├── middleware/
│       │   ├── models/
│       │   ├── utils/
│       │   └── server.js
│       └── package.json
│
├── services/
│   └── printer-simulator/
│       ├── src/
│       └── package.json
│
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── types/
│       │   ├── constants/
│       │   └── validation/
│       └── package.json
│
├── infrastructure/
│   ├── lambda/
│   ├── dynamodb/
│   ├── s3/
│   └── eventbridge/
│
├── docs/
│
├── uploads/
│   └── .gitkeep
│
├── .gitignore
├── package.json
└── README.md

Do not reorganize the repository unnecessarily.

---

# 4. TECHNOLOGY

Use JavaScript.

Frontend:

* React
* Vite
* ESLint

Backend:

* Node.js
* Express initially

Initial local development:

* Local filesystem for temporary development documents
* SQLite if persistence is required locally
* Printer simulator

AWS production/hackathon deployment:

* API Gateway
* AWS Lambda
* Amazon DynamoDB
* Amazon S3
* Amazon EventBridge / EventBridge Scheduler
* IAM
* CloudWatch

Use AWS meaningfully, not merely as an add-on.

The final architecture should make it clear why AWS is being used.

---

# 5. CUSTOMER PRINT SETTINGS

The customer controls the print job.

The UI must eventually support:

* Copies
* Pages/page range
* B&W or Color
* A4/A3
* Single-sided or Duplex
* Portrait/Landscape
* Retention/TTL

Example:

{
"copies": 2,
"pages": "1-3",
"color": "bw",
"paperSize": "A4",
"duplex": true,
"orientation": "portrait",
"retentionMinutes": 30
}

The shopkeeper should see these settings and should not have to configure them again.

---

# 6. JOB LIFECYCLE

Use explicit job states.

Suggested lifecycle:

CREATED
↓
READY
↓
PRINTING
↓
PRINTED
↓
EXPIRED

Also support appropriate failure/cancellation states such as:

FAILED
CANCELLED

Do not start the customer-selected retention timer merely when the job is uploaded if the intended product behavior is retention after printing.

The intended lifecycle is:

Upload
→ Job created
→ Shop receives job
→ Shop prints
→ Printer reports completion
→ Retention countdown starts
→ Document expires
→ Temporary document is removed

Abandoned jobs should have a separate safety timeout.

---

# 7. SECURITY REQUIREMENTS

Privacy is a core product requirement.

Implement progressively:

* HTTPS in deployed environments
* No public S3 buckets
* Encryption at rest
* Short-lived signed URLs where appropriate
* Server-side tenant authorization
* Minimal stored customer information
* No unnecessary PII
* Automatic document expiration/removal
* Audit-friendly job state transitions
* Never commit uploaded documents to Git
* Never expose AWS credentials in source code
* Environment variables for secrets/configuration
* Validate uploaded file types and reasonable file sizes

Do not claim that deletion guarantees forensic impossibility.

Use wording such as:

"Temporary document removed after its configured retention period."

---

# 8. IMPORTANT BROWSER/PRINTER CONSTRAINT

A normal browser cannot silently control arbitrary local printers because of browser security restrictions.

Therefore:

For the hackathon MVP:

Customer Browser
→ PrivacyPrint Backend
→ Shop Dashboard
→ Printer Simulator

Later, production architecture can use a lightweight shop-side Print Connector/Agent for actual local printer integration.

Do NOT pretend that a browser can universally print to an arbitrary shopkeeper's local printer without an appropriate integration.

---

# 9. DEVELOPMENT STRATEGY

Work in small chunks.

Never make dozens of unrelated changes in one step.

For EVERY chunk:

1. Inspect the existing repository.
2. Decide the smallest useful implementation.
3. Implement it.
4. Run relevant tests/lint/build.
5. Fix errors.
6. Inspect the Git diff.
7. Make ONE meaningful Git commit.
8. Push the commit to the configured GitHub remote.
9. Only then move to the next chunk.

Never skip testing.

Never commit broken code intentionally.

Never make giant commits containing unrelated features.

---

# 10. COMMIT CONVENTION

Use conventional-style commits.

Examples:

chore: initialize monorepo
feat: initialize React web application
feat: add customer print configuration
feat: add tenant-aware job model
feat: add print job API
feat: add shop dashboard
feat: add printer simulator
feat: implement job expiration
feat: add S3 document storage
feat: add DynamoDB job persistence
feat: add EventBridge expiration
feat: add tenant authorization
test: add job lifecycle tests
fix: prevent cross-tenant job access

Each meaningful chunk gets its own commit.

Before every commit:

git status
git diff
run tests/lint/build

Then:

git add <specific-files>
git commit -m "..."
git push

Do not blindly use:

git add -A

if that could accidentally include sensitive files.

---

# 11. NEVER COMMIT CUSTOMER DOCUMENTS

The uploads directory must remain ignored except for:

uploads/.gitkeep

Never commit:

* PDFs
* Aadhaar documents
* PAN documents
* resumes
* certificates
* images containing personal information
* .env files
* AWS credentials

If test documents are required, generate synthetic/fake documents.

---

# 12. PHASE PLAN

Follow these phases in order.

## PHASE 0 — Repository audit

Inspect the existing repository.

Do not unnecessarily recreate existing work.

Verify:

* Git status
* Git branch
* Git remote
* Existing frontend
* Existing .gitignore
* Existing commits

If the repository already contains the initial React application, continue from there.

Commit only if changes are actually required.

---

## PHASE 1 — Frontend foundation

Complete:

* React/Vite setup
* clean project structure
* routing
* basic layout
* reusable UI components
* customer area
* shop area

Keep UI clean and simple.

---

## PHASE 2 — Customer flow

Implement:

Customer landing page
→ select shop
→ upload document
→ configure print settings
→ review job
→ submit

The customer must control all print settings.

Use mock tenant/shop data initially.

---

## PHASE 3 — Tenant model

Create a clear tenant model.

Example:

Tenant:

{
id,
name,
code,
status
}

Example shops:

SHOP-MUM-001
SHOP-MUM-002

Ensure jobs reference tenantId.

---

## PHASE 4 — Backend

Create:

apps/api

Implement:

* Express server
* health endpoint
* job creation endpoint
* job retrieval
* job status
* validation
* temporary file handling

Initially local development is acceptable.

---

## PHASE 5 — Print job API

Implement job creation.

A job should contain concepts similar to:

{
jobId,
tenantId,
document,
printSettings,
status,
createdAt,
printedAt,
expiresAt
}

Do not store unnecessary customer PII.

---

## PHASE 6 — Shop dashboard

Implement:

Shop login/mock authentication initially if real authentication is not yet implemented.

Dashboard must:

* identify current tenant
* list only that tenant's jobs
* show job status
* show document name
* show print settings
* allow PRINT

Test that Shop A cannot retrieve Shop B's jobs.

---

## PHASE 7 — Printer simulator

Create:

services/printer-simulator

The simulator should:

1. Receive a print job.
2. Show the settings.
3. Simulate printing.
4. Show progress.
5. Complete the job.
6. Notify the backend.

Example:

PRINTING
Copy 1/2
Copy 2/2
PRINT COMPLETED

---

## PHASE 8 — Lifecycle and expiration

Implement:

READY
→ PRINTING
→ PRINTED
→ EXPIRED

After printing:

* calculate expiresAt
* schedule/process expiration
* remove temporary document
* update job status

For demo mode, allow accelerated TTL while preserving the real lifecycle concept.

Example:

Customer chooses:

10 minutes

Demo mode may simulate:

10 seconds

Clearly label this as demo behavior.

---

## PHASE 9 — AWS

Move the meaningful backend components to AWS.

Target:

Customer
↓
API Gateway
↓
Lambda
↓
DynamoDB
+
S3
↓
Shop Dashboard

Use:

S3
→ temporary encrypted documents

DynamoDB
→ tenants/jobs/metadata

Lambda
→ API/business logic

EventBridge
→ expiration scheduling

CloudWatch
→ logs/monitoring

IAM
→ least-privilege access

---

## PHASE 10 — AWS tenant isolation

Ensure tenant isolation exists in the actual AWS implementation.

Never rely only on frontend filtering.

The backend must derive/validate the authorized tenant.

Test cross-tenant access explicitly.

---

## PHASE 11 — Security hardening

Review:

* authorization
* tenant isolation
* file validation
* file size limits
* signed URL expiry
* S3 access
* secrets
* CORS
* error handling
* logging
* PII minimization
* expiration behavior

---

## PHASE 12 — UX/polish

Add:

* clear status indicators
* loading states
* errors
* success states
* responsive layout
* customer job receipt
* expiration countdown
* shop dashboard polish

Optional:

Privacy Receipt:

Job ID
Print completed
Retention period
Expiration time
Temporary document removed

Do NOT call this cryptographic proof of deletion.

---

## PHASE 13 — Documentation

Update README and docs.

Document:

* Problem
* Solution
* Architecture
* Multi-tenancy
* AWS services
* Security
* Document lifecycle
* Printer limitation
* Demo mode
* Local development
* Deployment
* Hackathon learning

Include an architecture diagram.

---

# 13. DEMO FLOW

The final demo should be able to show:

1. Customer opens PrivacyPrint.
2. Customer selects a print shop.
3. Customer uploads a synthetic sensitive-looking document.
4. Customer chooses:

   * 2 copies
   * pages 1-2
   * B&W
   * A4
   * Duplex
   * Portrait
   * 10-minute retention
5. Customer submits.
6. Job ID is generated.
7. Shop dashboard receives the job.
8. Shopkeeper sees exactly the customer's configuration.
9. Shopkeeper clicks PRINT.
10. Printer simulator shows progress.
11. Print completes.
12. TTL begins.
13. Expiration occurs.
14. Temporary document is removed.
15. Job becomes EXPIRED.
16. Show AWS architecture/resources.
17. Demonstrate tenant isolation.

---

# 14. DO NOT OVERENGINEER

This is a four-day hackathon.

Prioritize:

1. Working end-to-end flow
2. Multi-tenancy
3. Privacy/document lifecycle
4. Meaningful AWS usage
5. Security
6. Good UX
7. Documentation

Avoid spending excessive time on:

* unnecessary microservices
* Kubernetes
* complicated event buses
* unnecessary AI
* elaborate billing
* unnecessary social/login features
* production-scale infrastructure that isn't needed for the demo

---

# 15. CODING RULES

Write readable beginner-friendly JavaScript.

Prefer:

* small functions
* clear names
* modular code
* explicit error handling
* validation
* comments only where useful

Avoid:

* giant files
* giant functions
* duplicated logic
* hard-coded secrets
* hidden global state
* unnecessary dependencies

Before introducing a dependency, ask whether native functionality or an existing dependency already solves the problem.

---

# 16. AGENT BEHAVIOR

You are allowed to make implementation decisions within the architecture above.

However:

* Do not change the core product idea.
* Do not remove multi-tenancy.
* Do not remove customer-controlled print settings.
* Do not remove document expiration.
* Do not remove meaningful AWS integration.
* Do not pretend browser-only printing can control arbitrary local printers.
* Do not store real customer documents in Git.
* Do not skip tests.
* Do not make giant changes without commits.

If something is ambiguous, choose the simplest implementation consistent with this specification.

After completing each chunk, report:

CHUNK COMPLETED: <description>

FILES CHANGED: <files>

TESTS:
<commands/results>

COMMIT:
<commit hash + message>

PUSH:
<success/failure>

NEXT CHUNK: <description>

Then continue to the next chunk.

---

# 17. FIRST ACTION

Start by inspecting the current repository.

Run/inspect:

git status
git branch
git remote -v
git log --oneline -10
find . -maxdepth 3 -type f | sort

Then inspect the existing React application.

DO NOT delete existing work.

DO NOT rebuild the repository from scratch.

Determine which parts of Phase 0 and Phase 1 are already completed.

Then implement only the next smallest missing chunk.

After verifying it works, commit and push it before continuing.
