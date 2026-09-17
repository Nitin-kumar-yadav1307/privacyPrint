import { createContext } from 'react'

/**
 * App-wide React context.
 * Extracted to a separate file to satisfy the react-refresh/only-export-components
 * ESLint rule (a file must only export components if it contains JSX).
 */
const AppContext = createContext(null)

export default AppContext
