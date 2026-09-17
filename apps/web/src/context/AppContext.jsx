import { createContext, useState } from 'react'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:3001')

  return (
    <AppContext.Provider value={{ apiBaseUrl, setApiBaseUrl }}>
      {children}
    </AppContext.Provider>
  )
}

// Split into a separate hook file to satisfy react-refresh
