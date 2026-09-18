You are working on the existing PrivacyPrint monorepo.

## Goal

Build the **Print Connector Agent** that creates the bridge between PrivacyPrint's shop print queue and an actual operating-system printer.

PrivacyPrint must no longer be architecturally dependent on a fake printer simulator.

The connector must support:

1. Linux/CUPS real printing using `lp`
2. PDF-output fallback when no physical printer is available
3. Reporting print lifecycle events back to the PrivacyPrint backend
4. Secure shop/tenant authentication
5. The existing customer → shop → print → retention lifecycle

The simulator may remain as a development fallback, but the new connector must be the primary real-world printing architecture.

---

# IMPORTANT PRODUCT PRINCIPLE

PrivacyPrint is NOT a CRUD dashboard.

The important real-world flow is:

Customer
→ uploads document
→ configures print intent
→ sends to selected shop
→ shop receives ready-to-print job
→ shop clicks PRINT
→ Print Connector obtains the job
→ document is downloaded temporarily
→ OS/CUPS receives the print request
→ physical printer prints OR PDF fallback produces an output file
→ connector reports PRINT_COMPLETED
→ retention countdown starts
→ temporary digital document expires and is deleted

The connector exists to make the transition from software to physical printing real.

---

# FIRST: INSPECT THE EXISTING REPOSITORY

Before changing anything:

1. Inspect the monorepo structure.
2. Inspect the existing API.
3. Inspect the existing customer flow.
4. Inspect the existing shop dashboard.
5. Inspect the existing printer simulator.
6. Inspect the existing job model/state machine.
7. Inspect how tenantId/shop authentication currently works.
8. Identify reusable code.
9. Do NOT rewrite working parts unnecessarily.

Report briefly:

* existing architecture
* current print-job lifecycle
* current API endpoints
* how a shop currently receives a job
* how PRINT is currently handled
* what the simulator currently does
* smallest implementation plan for this connector

Then implement the connector.

---

# NEW SERVICE

Create:

services/print-connector/

Suggested structure:

services/print-connector/
├── src/
│   ├── index.js
│   ├── config.js
│   ├── apiClient.js
│   ├── jobPoller.js
│   ├── printerService.js
│   ├── cupsPrinter.js
│   ├── pdfFallback.js
│   └── logger.js
├── output/
│   └── .gitkeep
├── package.json
└── README.md

Adjust the structure if the existing repository has a better convention.

---

# PRINT CONNECTOR RESPONSIBILITY

The connector runs on the shop computer.

It belongs to exactly one shop tenant.

Example configuration:

SHOP_ID=SHOP-MUM-001
SHOP_TOKEN=...
API_BASE_URL=...
PRINT_MODE=auto
POLL_INTERVAL_MS=3000

Never allow a customer/browser to provide or override SHOP_ID or SHOP_TOKEN.

The connector's identity determines the shop.

---

# JOB ACQUISITION

Use the existing backend architecture if possible.

Preferred lifecycle:

Shop clicks PRINT
↓
Backend changes job:
READY → PRINTING
↓
Connector sees PRINTING job
↓
Connector downloads temporary document
↓
Connector sends it to printer
↓
Connector reports completion
↓
Backend:
PRINTING → PRINTED

Do not invent a second unrelated job system.

Reuse the existing job model and endpoints where practical.

If the existing API needs a small connector-specific endpoint, add it cleanly.

For example, conceptually:

GET /api/connector/jobs

POST /api/connector/jobs/:jobId/complete

But inspect the existing API first and adapt to it.

Every connector request must be authorized for its shop tenant.

A connector for SHOP-MUM-001 must never retrieve or complete jobs belonging to SHOP-MUM-002.

The server must enforce this.

---

# DOCUMENT DOWNLOAD

When a connector receives a job:

1. Download the temporary document using the authorized backend mechanism.
2. Store it in a temporary local directory.
3. Never store it permanently.
4. Never commit downloaded documents to Git.
5. Never log document contents.
6. Never log sensitive document URLs if they contain credentials.
7. Delete the local temporary document after printing succeeds or fails according to the cleanup policy.

Use secure temporary file handling appropriate for Node.js/Linux.

---

# REAL LINUX PRINTING

Implement Linux/CUPS support.

The first supported real printer path should be:

Node.js
→ child_process
→ lp
→ CUPS
→ printer

Do NOT execute arbitrary shell strings.

Use spawn/spawnSync with argument arrays rather than constructing a shell command from user-controlled values.

Conceptually:

lp
-d printerName
-n copies
-P pages
-o media=A4
-o sides=two-sided-long-edge
document.pdf

But map the existing PrivacyPrint printSettings to actual CUPS arguments carefully.

Potential settings:

copies
pages
color / B&W
paperSize
duplex
orientation

Do not blindly pass arbitrary values from the browser into the shell.

Whitelist supported values.

---

# PRINTER DISCOVERY

Add a way to discover local CUPS printers.

Use:

lpstat -p -d

or another appropriate CUPS command.

Expose a connector status such as:

CONNECTED
NO_PRINTER
CUPS_UNAVAILABLE

The connector README should explain how to install/configure CUPS on Linux.

Do NOT assume that every printer supports every setting.

The connector should detect basic printer availability before attempting a job.

---

# PDF FALLBACK

The project MUST work without physical printer hardware.

Implement:

PRINT_MODE=pdf

In this mode, instead of sending the PDF to a physical printer, produce a printable PDF output in:

services/print-connector/output/

For example:

output/
└── JOB-8F32A-print.pdf

The generated file should represent the actual requested print operation as closely as practical.

If copies=2, the fallback should represent two copies.

If a page range is selected, only the requested pages should appear.

If practical, preserve orientation/paper-size information.

The goal is not to fake a successful print event.

The connector must actually process the input document and produce the output artifact.

This gives us a hardware-independent demonstration:

Customer sends document
→ shop clicks PRINT
→ connector downloads real document
→ connector processes it
→ output PDF appears
→ connector reports completion
→ retention begins

---

# AUTO MODE

Support:

PRINT_MODE=auto

Behavior:

1. Detect whether CUPS is available.
2. Detect whether a configured/default printer exists.
3. If a usable printer exists, print through CUPS.
4. Otherwise use PDF fallback.
5. Clearly report which mode was used.

Example:

PRINT_MODE_USED=CUPS

or

PRINT_MODE_USED=PDF_FALLBACK

Do not silently pretend PDF fallback was physical printing.

The shop dashboard/status should make the distinction visible.

---

# PRINT SETTINGS

Respect the customer's print intent.

The connector should receive something similar to:

{
"jobId": "JOB-8F32A",
"tenantId": "SHOP-MUM-001",
"document": {
"originalName": "resume.pdf"
},
"printSettings": {
"copies": 2,
"pages": "1-3",
"color": "bw",
"paperSize": "A4",
"duplex": true,
"orientation": "portrait"
}
}

Validate everything before printing.

Important:

* copies must be a safe integer range
* pages must use a validated format
* color must be an allowed value
* paper size must be an allowed value
* duplex must be boolean
* orientation must be an allowed value
* printer name must come from trusted connector configuration/discovery, not arbitrary browser input

---

# PRINT RESULT

The connector must distinguish at least:

PRINT_STARTED
PRINT_COMPLETED
PRINT_FAILED

For example:

{
"jobId": "JOB-8F32A",
"status": "PRINT_COMPLETED",
"mode": "CUPS",
"completedAt": "..."
}

or:

{
"jobId": "JOB-8F32A",
"status": "PRINT_COMPLETED",
"mode": "PDF_FALLBACK",
"outputPath": "...",
"completedAt": "..."
}

Do NOT claim physical printing when PDF fallback was used.

---

# RETENTION INTEGRATION

The connector should NOT independently decide the customer's retention policy.

The backend remains authoritative.

After PRINT_COMPLETED:

Backend starts:

printedAt
+
customer-selected retention period
==================================

expiresAt

Then the existing expiration mechanism handles deletion.

The connector must only report the print result.

Do not duplicate the retention state machine unnecessarily.

---

# FAILURE HANDLING

If printing fails:

PRINTING → FAILED

or use the existing failure state if already implemented.

Do not report success if `lp` fails.

Capture useful operational error information without logging document contents or secrets.

If a temporary downloaded document remains after failure, clean it according to the project's secure cleanup policy.

---

# IDEMPOTENCY

The connector must not accidentally print the same job repeatedly because polling happens every few seconds.

Implement protection such as:

* local in-memory processing set
* backend job state
* idempotency endpoint
* or a combination

The backend should remain the source of truth.

A job that has already been completed must not be printed again merely because the connector polls again.

---

# SECURITY REQUIREMENTS

This service handles potentially sensitive documents.

Do NOT:

* log PDF contents
* log document bytes
* expose the local output directory through a public web server
* accept arbitrary shell commands
* allow arbitrary printer names from customers
* trust tenantId supplied by the customer
* store documents permanently
* commit documents to Git

Use environment variables for credentials.

Update `.gitignore` so that:

services/print-connector/output/*

is ignored except for `.gitkeep`.

Also ignore any temporary connector directories/files.

---

# TESTING WITHOUT A PRINTER

The project must be testable on a Linux machine without physical printer hardware.

Add tests for:

1. print settings validation
2. CUPS command argument generation
3. tenant isolation
4. PDF fallback
5. copies
6. page range
7. failure handling
8. duplicate job prevention
9. temporary document cleanup

Do NOT require a physical printer for automated tests.

For the real CUPS path, provide a manual test procedure.

---

# MANUAL REAL-PRINTER TEST

Add documentation explaining:

1. Install CUPS.
2. Connect/configure a printer.
3. Run:

lpstat -p -d

4. Configure the connector with the printer.
5. Start PrivacyPrint API.
6. Start connector.
7. Create/send a print job.
8. Shop clicks PRINT.
9. Verify the physical printer receives the job.
10. Verify connector reports PRINT_COMPLETED.
11. Verify backend starts retention.
12. Verify document eventually expires.

Do not claim the test passed unless it was actually run.

---

# SHOP UI

Make the smallest necessary UI change to clearly show:

Printer status:

* Connector online/offline
* Printer available/unavailable
* Current print mode

When a job is printed:

PRINTING
→ PRINT COMPLETED

If PDF fallback is used, display something like:

"Printed via PDF fallback"

Do not label PDF fallback as a physical printer.

The shopkeeper experience should remain simple:

Review customer-defined settings
→ PRINT

The shopkeeper should not have to re-enter the customer's settings.

---

# CUSTOMER UI

Do not turn this into a generic CRUD dashboard.

The customer should continue seeing the meaningful lifecycle:

SEND TO SHOP
→ WAITING FOR SHOP
→ PRINTING
→ PRINT COMPLETED
→ DOCUMENT RETENTION
→ DOCUMENT EXPIRED

---

# README

Add:

## Print Connector

Explain:

* what it is
* why browser-only printing is insufficient
* how it connects PrivacyPrint to OS printing
* Linux/CUPS setup
* PDF fallback
* environment variables
* development mode
* security considerations
* real printer testing

Make the architecture easy to explain to hackathon judges.

---

# ACCEPTANCE CRITERIA

The implementation is complete only when:

[ ] Print Connector service exists
[ ] Connector authenticates as one shop tenant
[ ] Connector cannot cross tenant boundaries
[ ] Connector can obtain PRINTING jobs
[ ] Connector downloads the actual temporary document
[ ] Connector validates print settings
[ ] Connector supports Linux/CUPS printing
[ ] Connector supports PDF fallback
[ ] Connector reports PRINT_STARTED
[ ] Connector reports PRINT_COMPLETED
[ ] Connector reports PRINT_FAILED
[ ] Duplicate printing is prevented
[ ] Temporary local document is cleaned up
[ ] Backend remains authoritative for retention
[ ] Existing lifecycle remains intact
[ ] No sensitive documents are committed to Git
[ ] Tests pass
[ ] README contains setup instructions
[ ] Existing functionality is not unnecessarily rewritten

---

# WORKFLOW REQUIREMENT

Work in ONE focused implementation chunk.

Do not redesign unrelated parts of PrivacyPrint.

After implementation:

1. Run tests.
2. Run lint.
3. Run the connector locally in PDF fallback mode.
4. Perform an end-to-end test if the existing application supports it.
5. Inspect git diff.
6. Verify no sensitive files are included.
7. Commit only the changes for this chunk.
8. Push to the existing GitHub repository.

Use a commit message such as:

feat: add real print connector

Finally report:

* files changed
* what was implemented
* tests run
* whether PDF fallback was actually tested
* whether CUPS was actually tested
* whether a physical printer was actually tested
* commit hash
* push status

Do NOT claim physical printing works unless you actually tested it with a physical printer.

---

# AMENDMENTS (agreed review of this plan)

1. **Document download endpoints are REQUIRED scope, not implied.** The API
   currently serves only job metadata — no endpoint returns document bytes.
   Add under the existing shop-session middleware:
   - `GET /api/connector/jobs` — PRINTING jobs for the authenticated shop
   - `GET /api/connector/jobs/:jobId/document` — tenant-checked stream of the
     stored document (local storage streams the file; S3 mode may use a short
     -lived presigned URL)
   - `POST /api/connector/jobs/:jobId/complete` — completion/failure callback
   - `POST /api/connector/heartbeat` — powers the shop UI online/offline badge
2. **PDF fallback fidelity is trimmed.** The fallback copies the document
   verbatim and emits a settings manifest (requested copies, page range,
   paper, duplex) alongside it. Do NOT add PDF-manipulation dependencies
   (pdf-lib/qpdf) unless already available on the machine.
3. **Add a `PRINT_FAILED` job status.** The state machine has no failure state
   today; `lp` failure and download failure map `PRINTING → PRINT_FAILED`
   via the completion callback.
4. **Connector identity comes from connector config only** (`SHOP_TOKEN`,
   signed by the same auth stack). The customer flow is unchanged and the
   tenantId can never be supplied by the client.
