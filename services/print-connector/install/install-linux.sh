#!/usr/bin/env bash
# PrivacyPrint connector — one-time Linux/macOS install.
#
# Installs the connector as a systemd user service (auto-start on boot) with a
# pre-filled, pre-authenticated configuration. After this, a shopkeeper does
# nothing: the service stays online and any printer the OS sees is used
# automatically (PRINTER_NAME is intentionally NOT set — discovery picks the
# USB/network printer by itself).
#
#   ./install-linux.sh --api https://api.example.com --tenant TENANT-002 --passcode privacyprint-demo
#
# The connector sources live OUTSIDE this repo copy in production; for the
# hackathon we point the service at the repo checkout.
set -euo pipefail

API_URL="http://localhost:3001"
TENANT=""
PASSCODE="privacyprint-demo"
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
UNIT_DIR="${HOME}/.config/systemd/user"
ENV_DIR="${HOME}/.config/privacyprint"
SERVICE_NAME="privacyprint-connector"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api) API_URL="$2"; shift 2 ;;
    --tenant) TENANT="$2"; shift 2 ;;
    --passcode) PASSCODE="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$TENANT" ]]; then
  echo "ERROR: --tenant is required (the shop's tenant id, e.g. TENANT-002)" >&2
  exit 2
fi

# Dependency checks with actionable messages.
if ! command -v node >/dev/null; then
  echo "ERROR: Node.js >= 18 is required (https://nodejs.org)." >&2
  exit 1
fi
if command -v lpstat >/dev/null; then
  # ipp-usb is udev-activated per USB printer on modern Fedora/Ubuntu; it is
  # "inactive" simply because no USB printer is attached right now. Only warn
  # if the binary is entirely missing — without it USB printers never appear.
  if ! command -v ipp-usb >/dev/null && ! systemctl list-unit-files 2>/dev/null | grep -qi ipp-usb; then
    echo "WARNING: ipp-usb is not installed. USB printers may not appear to CUPS." >&2
    echo "         Install it (e.g. 'sudo dnf install ipp-usb' or 'sudo apt install ipp-usb')." >&2
  fi
else
  echo "NOTE: CUPS not found — the connector will run in PDF fallback mode until a print system is available." >&2
fi

mkdir -p "$ENV_DIR" "$UNIT_DIR"
ENV_FILE="${ENV_DIR}/connector.env"
cat > "$ENV_FILE" <<EOF
# Managed by install-linux.sh — re-run the installer to change these.
API_BASE_URL=${API_URL}
SHOP_TENANT_ID=${TENANT}
SHOP_PASSCODE=${PASSCODE}
POLL_INTERVAL_MS=3000
EOF
chmod 600 "$ENV_FILE"

cat > "${UNIT_DIR}/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=PrivacyPrint print connector
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=$(command -v node) --env-file=${ENV_FILE} ${SRC_DIR}/src/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now "${SERVICE_NAME}.service"

echo
echo "Installed. The connector starts now and on every boot."
echo "  status:   systemctl --user status ${SERVICE_NAME}"
echo "  logs:     journalctl --user -u ${SERVICE_NAME} -f"
echo "  printers: cd ${SRC_DIR} && npm run printers"
echo "Plug the printer in over USB or Wi-Fi — it is picked up automatically."
