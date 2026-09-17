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

