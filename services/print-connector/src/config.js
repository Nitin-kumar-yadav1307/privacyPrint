/**
 * Print connector configuration (environment-driven).
 * The connector runs on the shop's own computer and belongs to exactly one shop.
 */
const path = require('path')

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001'
const SHOP_TOKEN = process.env.SHOP_TOKEN || ''

const PRINT_MODE_INPUT = process.env.PRINT_MODE || 'auto'
const PRINT_MODE = ['auto', 'cups', 'pdf'].includes(PRINT_MODE_INPUT) ? PRINT_MODE_INPUT : 'auto'

const POLL_INTERVAL_MS = Math.max(500, Number(process.env.POLL_INTERVAL_MS || 3000))
const PRINTER_NAME = process.env.PRINTER_NAME || ''

// Generated print artifacts (PDF fallback) — never committed to Git.
const OUTPUT_DIR = path.resolve(__dirname, '..', 'output')
// Short-lived downloads — deleted after every print attempt.
const TMP_DIR = path.resolve(__dirname, '..', '.tmp')

module.exports = { API_BASE_URL, SHOP_TOKEN, PRINT_MODE, POLL_INTERVAL_MS, PRINTER_NAME, OUTPUT_DIR, TMP_DIR }