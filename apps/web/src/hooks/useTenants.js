import { useCallback, useEffect, useState } from 'react'
import { useApiBaseUrl, fetchJSON } from '../services/api.js'

// The print shop directory changes rarely and several pages need it, so results
// are cached per API base URL instead of refetched on every navigation.
const directoryCache = new Map()

/**
 * Load the print shop (tenant) directory from the API.
 *
 * This is the single source of truth for shop names and codes in the UI.
 * The API only returns active shops, so inactive shops are never selectable.
 *
 * @returns {{tenants: Array, loading: boolean, error: string, getTenant: Function}}
 */
export function useTenants() {
  const apiBaseUrl = useApiBaseUrl()
  const [tenants, setTenants] = useState(() => directoryCache.get(apiBaseUrl) || [])
  const [loading, setLoading] = useState(() => !directoryCache.has(apiBaseUrl))
  const [error, setError] = useState('')

  useEffect(() => {
    if (directoryCache.has(apiBaseUrl)) return undefined

    const controller = new AbortController()

    async function load() {
      try {
        const data = await fetchJSON(apiBaseUrl, '/api/tenants', { signal: controller.signal })
        if (controller.signal.aborted) return
        const list = data.tenants || []
        directoryCache.set(apiBaseUrl, list)
        setTenants(list)
        setError('')
      } catch (e) {
        // Leave the cache empty so a later mount can retry the request.
        if (!controller.signal.aborted) setError(e.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    // Defer so React Strict Mode's first mount does not fire a request that is
    // aborted immediately, then report a cancelled initial load as an error.
    const timer = setTimeout(load, 0)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [apiBaseUrl])

  const getTenant = useCallback(
    (tenantId) => tenants.find((tenant) => tenant.id === tenantId) || null,
    [tenants],
  )

  return { tenants, loading, error, getTenant }
}