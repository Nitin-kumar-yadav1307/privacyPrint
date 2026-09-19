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

## Zero-touch printer setup (deployed shops)

A deployed shop configures **nothing**. The connector asks the operating system
what printers exist and picks one by itself:

| Order | Choice | Why |
|---|---|---|
| 1 | `PRINTER_NAME`, if set | Optional override for unusual setups |
| 2 | The OS default printer | Usually the shop's real printer |
| 3 | A USB / local printer | Physically attached to this computer |
| 4 | A network printer (Wi-Fi/LAN) | Reached over IPP, DNS-SD or WSD |
| — | Virtual queues | **Never** auto-selected |

- **Linux/macOS:** CUPS does the discovery — its `usb` backend finds USB printers
  and Avahi/DNS-SD finds wireless ones. The connector reads `lpstat -p -d`
  (queues + system default) and `lpstat -v` (device URI) to tell USB from
  network. Modern USB printers are often exposed as IPP-over-USB
  (`ipp://localhost:60000/ipp/print`) and are correctly recognized as USB.
- **Windows:** installed printers are read via PowerShell
  (`Get-CimInstance Win32_Printer`); `PortName` distinguishes `USB001` from
  `WSD`/`IP_…` network ports, and virtual queues (Microsoft Print to PDF, Fax)
  are excluded.
- **Self-healing:** if no printer is known when a job arrives — a printer was
  just plugged in, or the previous one was switched off — discovery is forced
  again before the job is failed.
- **Visible in the dashboard:** every heartbeat publishes the chosen printer,
  how it is attached (`USB` / `NETWORK`) and why it was chosen, so a shopkeeper
  sees `Connector Online · HP_DeskJet_4900_series (USB)` without touching a
  config file.
- **Honest failures:** when nothing usable is found the job is reported
  `FAILED` with an actionable reason ("No printer detected — connect the printer
  over USB or Wi-Fi so CUPS can see it, then retry"). A job is never silently
  printed into a file.

## Setup (Linux / CUPS)

1. Install CUPS: `sudo apt install cups` (or your distro equivalent).
2. Connect the printer (USB or Wi-Fi) — no PrivacyPrint configuration needed.
   Verify the OS sees it: `lpstat -p -d`.
3. Let the connector sign in as your shop (it renews the session automatically):

```bash
SHOP_TENANT_ID=TENANT-002 \
SHOP_PASSCODE=privacyprint-demo \
API_BASE_URL=http://localhost:3001 \
PRINT_MODE=auto \
POLL_INTERVAL_MS=3000 \
npm start
```

If you already have a shop session token, you can keep using it instead:

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

- `SHOP_TOKEN` comes only from the environment (or the connector's own sign-in);
  customers/browsers can never supply or override shop identity.
- All `lp` invocations use `spawnSync` with argument arrays — no shell
  strings, and every setting is whitelisted (paper size, color, orientation,
  copies 1–99, page ranges) before reaching CUPS.
- Printer names come from OS discovery or `PRINTER_NAME`, never from job data,
  and settings that reach `lp`/SumatraPDF are validated values only.
- Document contents and secrets are never logged.
- Downloaded documents live in `.tmp/` and are deleted after each attempt;
  generated artifacts live in `output/` and are git-ignored.

## Is a job really printed?

`lp` exiting `0` only means CUPS **accepted** the job — a bad document or an
offline printer fails later, inside the filter chain. The connector therefore
watches its own request id in the queue for a short window:

- the job leaves the queue → `PRINTED` (verified);
- CUPS reports `job-completed-with-errors` / `job-failed`, or a filter error such
  as `load_file failed: … damaged file` → the job is reported `FAILED` with that
  reason instead of a false success;
- still queued when the window closes → reported as accepted (slow printing is
  not a failure).

The API additionally verifies document **content** at upload time (signature
check, not the client's Content-Type), so a text file renamed `.pdf` is rejected
before it can ever jam a printer queue.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `SHOP_TENANT_ID` | — | Shop the connector belongs to; it signs in itself |
| `SHOP_PASSCODE` | — | Credential used for that sign-in (demo passcode locally) |
| `SHOP_TOKEN` | — | Alternative to the two above: a session token copied from the dashboard |
| `API_BASE_URL` | `http://localhost:3001` | PrivacyPrint API |
| `PRINT_MODE` | `auto` | `auto` / `cups` / `windows` / `pdf` |
| `POLL_INTERVAL_MS` | `3000` | Poll cadence |
| `PRINTER_NAME` | auto-detected | **Optional** override of the automatic printer choice |
| `WIN_PRINT_TOOL` | `SumatraPDF.exe` | Windows print tool (SumatraPDF) |

Either `SHOP_TENANT_ID` + `SHOP_PASSCODE` or `SHOP_TOKEN` is required — the
connector refuses to start without a shop identity.

## Tests

```bash
npm test   # node --test tests/
```

Covers: settings validation, CUPS argument generation, PDF fallback artifact,
duplicate-print prevention, temp-file cleanup on failure, printer discovery and
connection classification (USB / network / virtual), automatic printer
selection, credential sign-in with retry, and CUPS outcome verification.

The real CUPS path needs a physical or CUPS-configured printer: it is never
claimed as tested unless actually run. Verified locally against a USB HP
DeskJet exposed through IPP-over-USB — the connector auto-detected the queue
with no `PRINTER_NAME`, printed the document, and reported the queue outcome.