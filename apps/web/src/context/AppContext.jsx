import { useState } from 'react'
import AppContext from './appContext.js'

// API base URL: set VITE_API_BASE_URL at build time for deployed environments
// (e.g. https://privacyprint-api.onrender.com). Falls back to local dev default.
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

export function AppProvider({ children }) {
  const [baseUrl, setApiBaseUrl] = useState(apiBaseUrl)

  return (
    <AppContext.Provider value={{ apiBaseUrl: baseUrl, setApiBaseUrl }}>
      {children}
    </AppContext.Provider>
  )
}

// Split into a separate hook file to satisfy react-refresh
