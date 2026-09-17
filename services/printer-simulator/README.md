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
- The current API expiration/cancellation implementation changes status but does not delete uploaded files. Automatic document removal remains an outstanding Phase 8 requirement.
