import './i18n'
import { runMigrations } from './utils/migrations'
import React from 'react'

runMigrations()
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClerkProvider } from '@clerk/clerk-react'
import { ThemeContextProvider } from './contexts/ThemeContext'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5 * 60 * 1000 },
  },
})

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string
if (!CLERK_KEY) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY')

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={CLERK_KEY} afterSignOutUrl="/">
      <ThemeContextProvider>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ThemeContextProvider>
    </ClerkProvider>
  </React.StrictMode>
)
