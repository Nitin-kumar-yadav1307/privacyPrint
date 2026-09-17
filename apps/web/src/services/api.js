const API_BASE = 'http://localhost:3001'

export async function fetchJSON(url, options = {}) {
  const fullUrl = `${API_BASE}${url}`
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

export async function postJSON(url, data) {
  return fetchJSON(url, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function patchJSON(url, data) {
  return fetchJSON(url, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}
