# Local printer simulator

A standalone, one-job CLI for the Phase 7 demo. Requires Node.js 22+ and the existing API dependencies installed. No additional dependencies.

Start the API in one terminal:

```sh
npm --prefix /home/nitin/Documents/programming/hackathon/privacyPrint/apps/api start
```

Upload a synthetic document through the customer UI, then run the command below with the receipt's job ID substituted for JOB_ID:

```sh
npm --prefix /home/nitin/Documents/programming/hackathon/privacyPrint/services/printer-simulator start -- TENANT-001 JOB_ID
```

`API_BASE_URL` overrides the default `http://localhost:3001`.

The CLI retrieves the selected READY job, displays its settings, calls `/print`, reports each copy, and calls `/complete`. Success requires a PRINTED response with an expiration timestamp. Retention begins only after completion; the API currently accelerates TTL for demo purposes. Errors exit nonzero. Requests time out after 10 seconds.

## Tests

```sh
npm --prefix /home/nitin/Documents/programming/hackathon/privacyPrint/services/printer-simulator test
```

Tests start Express on an ephemeral loopback port, verify progress and state guards, exercise tenant mismatch and interruption handling, and upload a synthetic file before running the real CLI. The uploaded test file is removed during cleanup.

## Limitations

- No physical printing, rendering, or document download occurs.
- This is an alternative to the existing browser simulator. Use only one simulator/operator per job; the current API has no exclusive printer claim, so concurrent clients are not safe.
- A stopped simulation leaves the job PRINTING without starting retention. Recovery/retry orchestration is not implemented.
- Tenant query parameters provide filtering, **not authenticated authorization**. Keep this local/demo-only until server-side authentication is implemented.
- The local API removes temporary files before marking jobs EXPIRED or CANCELLED. Failed scheduled cleanup is retried by the running expiry checker. Rejected submissions also remove their uploaded files; a removal failure returns a server error and requires operational cleanup.

## Local restart recovery

Job metadata is saved after every service mutation to `/home/nitin/Documents/programming/hackathon/privacyPrint/apps/api/data/jobs.json`. `DATA_DIR` overrides its directory; `UPLOAD_DIR` overrides the private upload directory. Keep them separate, on persistent local storage, accessible only to the API account. The default data directory is Git-ignored; custom locations must also stay out of Git. Metadata contains filenames, settings, and internal paths and is not encrypted by this local implementation.

Starting the API restores metadata before listening, processes overdue retention/abandonment, marks active jobs with missing files FAILED, and removes unreferenced direct-child files older than 10 minutes. Recent orphan files are left until a later startup. `.gitkeep` and directories are never swept; symlink targets are never deleted. Corrupt metadata or out-of-area stored paths stop startup rather than trigger an unsafe sweep. Do not delete metadata to bypass a recovery error: preserve both directories and investigate offline.

Only **one API process** may own these directories. Snapshots use a flushed temporary file and atomic rename; failed writes roll back in-memory mutations. Document removal and metadata writes are not a single transaction: recovery reconciles a missing document after interruption, but cannot reconstruct already-deleted contents or prove print completion. This is process-restart recovery, not a guarantee against power loss or disk failure. Jobs already in PRINTING are preserved without automatic reprinting or retention reset; manual resolution is still required. Historical metadata pruning, multi-process locking, and DynamoDB persistence are future work.
