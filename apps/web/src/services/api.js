import { useContext } from 'react'
import AppContext from '../context/appContext.js'

// Hook to get the API base URL from context
export function useApiBaseUrl() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApiBaseUrl must be used within AppProvider')
  return ctx.apiBaseUrl
}

/**
 * Fetch JSON from the API.
 * @param {string} baseUrl - The API base URL
 * @param {string} url - The endpoint path
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} The parsed JSON response
 */
export async function fetchJSON(baseUrl, url, options = {}) {
  const fullUrl = `${baseUrl}${url}`
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  const res = await fetch(fullUrl, { ...options, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * POST a JSON body to the API.
 * @returns {Promise<Object>}
 */
export async function postJSON(baseUrl, url, data) {
  return fetchJSON(baseUrl, url, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * PATCH (update) a JSON body to the API.
 * @returns {Promise<Object>}
 */
export async function patchJSON(baseUrl, url, data) {
  return fetchJSON(baseUrl, url, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

/**
 * Upload a file to the API using multipart/form-data.
 * Used for document uploads with print settings metadata.
 * @param {string} baseUrl - The API base URL
 * @param {string} url - The endpoint path
 * @param {File} file - The file to upload
 * @param {Object} fields - Additional form fields to send
 * @returns {Promise<Object>} The parsed JSON response
 */
export async function uploadFile(baseUrl, url, file, fields = {}) {
  const formData = new FormData()
  formData.append('document', file)
  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value)
  })

  const fullUrl = `${baseUrl}${url}`
  const res = await fetch(fullUrl, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `HTTP ${res.status}`)
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// Shop session (Phase 11)
//
// The shop signs in with its tenantId and the demo passcode and receives a
// signed, expiring session token. Shop pages attach it as a Bearer token on
// every call; the API then derives the tenant server-side instead of trusting
// a client-supplied tenantId.
// ---------------------------------------------------------------------------

const SHOP_TOKEN_KEY = 'shopToken'

export function getShopToken() {
  try {
    return localStorage.getItem(SHOP_TOKEN_KEY) || ''
  } catch {
    // Storage unavailable (e.g. private mode) — the session just won't persist.
    return ''
  }
}

function setShopToken(token) {
  try {
    if (token) {
      localStorage.setItem(SHOP_TOKEN_KEY, token)
    } else {
      localStorage.removeItem(SHOP_TOKEN_KEY)
    }
  } catch {
    /* ignore — same as getShopToken */
  }
}

/** Authorization headers for shop-authenticated API calls. */
export function shopAuthHeaders() {
  const token = getShopToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * POST /api/auth/shop/login — exchange the tenant selection and demo passcode
 * for a signed session token, which is stored for subsequent shop calls.
 * @param {string} baseUrl - The API base URL
 * @param {string} tenantId - The shop the operator is signing in to
 * @param {string} passcode - Demo credential
 * @returns {Promise<Object>} { success, token, role, expiresAt, tenant }
 */
export async function shopLogin(baseUrl, tenantId, passcode) {
  const data = await postJSON(baseUrl, '/api/auth/shop/login', { tenantId, passcode })
  if (data.token) setShopToken(data.token)
  return data
}

/** GET /api/auth/shop/session — verify the stored session on the server. */
export async function shopSession(baseUrl) {
  return fetchJSON(baseUrl, '/api/auth/shop/session', { headers: shopAuthHeaders() })
}

/** Clear the stored shop session (logout). */
export function shopLogout() {
  setShopToken('')
}

