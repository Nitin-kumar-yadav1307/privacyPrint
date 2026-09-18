# PrivacyPrint Print Connector

The shop-side agent that turns a PrivacyPrint job into **real paper**.

A browser can never drive a physical printer — that's a hard sandbox limitation
of the web platform, not a missing feature. Every real print service (Google
Cloud Print, HP ePrint, Printerous) solved it the same way: a small agent runs
on the shop's own computer, authenticated as that one shop, and does the last
mile locally. This is that agent.

## What it does

```
Customer → API → Shop clicks PRINT (job → PRINTING)
                     ↓
        Connector polls for PRINTING jobs
                     ↓
        downloads the document (tenant-checked, PRINTING-only endpoint)
                     ↓
        lp → CUPS → physical printer      (or PDF fallback)
                     ↓
        reports PRINT_COMPLETED / PRINT_FAILED
                     ↓
        backend starts the retention countdown → document deleted on expiry
```

- The connector's identity determines the shop: it authenticates with the same
  signed shop session as the dashboard. A connector for SHOP A can never see,
  download, or complete SHOP B's jobs — enforced server-side.
- The backend remains authoritative for retention and expiry; the connector
  only reports print results.
- The temporary download is deleted after every attempt, success or failure.

## Windows judges/shop owners

- The **web app is fully OS-agnostic** — customer flow and shop dashboard work
  in any browser; no connector needed for the demo (the dashboard simulator
  completes jobs when no connector is online).
- The connector itself runs on Windows with Node 18+:
  - `PRINT_MODE=pdf` (or `auto`, which auto-detects no CUPS and falls back)
    produces the PDF artifact + manifest in `output/`.
  - Real physical printing needs CUPS, which Windows does not ship; auto mode
    detects this and uses the PDF fallback instead of failing.
- Configuration: copy `.env.example` to `.env` and fill in `SHOP_TOKEN` —
  the connector loads `.env` automatically (`--env-file-if-exists`). Inline
  environment variables also work in PowerShell:
  `$env:SHOP_TOKEN="..."; npm start`.

## Windows real printing

Physical printing works on Windows too, via **SumatraPDF** (the standard
silent-command-line PDF printer):

1. Download the portable `SumatraPDF.exe` (no installer needed).
2. Put it in `PATH`, or point `WIN_PRINT_TOOL` at its full path.
3. The printer must be installed on Windows (Settings → Printers) —
   `auto` mode detects it, or set `PRINTER_NAME`.

Settings mapping: copies (`2x`), page ranges (`1-2`), duplex/simplex, paper
size, and orientation are all passed as a whitelisted `-print-settings`
string via an argument-array `spawn` — never a shell command. Note: very old
SumatraPDF versions may ignore the portrait/landscape token; upgrade if
orientation does not apply.

`PRINT_MODE` values: `auto` (detects CUPS on Linux/macOS, SumatraPDF on
Windows, PDF fallback otherwise) · `cups` · `windows` · `pdf`.

## Setup (Linux / CUPS)

1. Install CUPS: `sudo apt install cups` (or your distro equivalent).
2. Connect the printer (USB or network) and verify: `lpstat -p -d`.
3. Sign in as the shop in PrivacyPrint and copy the session token, then run:

```bash
SHOP_TOKEN=<shop session token> \
API_BASE_URL=http://localhost:3001 \
PRINT_MODE=auto \
POLL_INTERVAL_MS=3000 \
node src/index.js
```

## Print modes

| PRINT_MODE | Behavior |
|---|---|
| `auto` (default) | CUPS printer if one is detected, otherwise PDF fallback |
| `cups` | Always real CUPS printing (`lp`, argument arrays, whitelisted settings) |
| `pdf` | No hardware needed: copies the document verbatim to `output/<jobId>-print.pdf` and writes `<jobId>-manifest.json` with the exact requested print operation |

PDF fallback is **never labeled as physical printing** — the shop UI and job
reports distinguish `CUPS` from `PDF_FALLBACK`.

## Security

- `SHOP_TOKEN` comes only from the environment; customers/browsers can never
  supply or override shop identity.
- All `lp` invocations use `spawnSync` with argument arrays — no shell
  strings, and every setting is whitelisted (paper size, color, orientation,
  copies 1–99, page ranges) before reaching CUPS.
- Document contents and secrets are never logged.
- Downloaded documents live in `.tmp/` and are deleted after each attempt;
  generated artifacts live in `output/` and are git-ignored.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `SHOP_TOKEN` | — (required) | Signed shop session token |
| `API_BASE_URL` | `http://localhost:3001` | PrivacyPrint API |
| `PRINT_MODE` | `auto` | `auto` / `cups` / `pdf` |
| `POLL_INTERVAL_MS` | `3000` | Poll cadence |
| `PRINTER_NAME` | auto-detected | Specific CUPS printer (`lpstat -p -d`) |

## Tests

```bash
npm test   # node --test tests/
```

Covers: settings validation, CUPS argument generation, PDF fallback artifact,
duplicate-print prevention, temp-file cleanup on failure. The real CUPS path
requires a physical or CUPS-configured printer and is covered by the manual
procedure above — it is never claimed as tested unless actually run.