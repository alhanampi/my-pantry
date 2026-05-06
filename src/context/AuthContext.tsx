import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react'
import { apiSyncUser, apiLinkUser } from '../api/authApi'
import LinkModal from '../components/AuthModal'

interface Partner {
  id: string
  username: string
}

interface AuthContextValue {
  partner: Partner | null
  linkUser: (username: string) => Promise<void>
  openLinkModal: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isSignedIn, isLoaded } = useUser()
  const { getToken } = useClerkAuth()
  const [partner, setPartner] = useState<Partner | null>(null)
  const [linkModalOpen, setLinkModalOpen] = useState(false)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) {
      setPartner(null)
      return
    }

    const sync = async () => {
      const token = await getToken()
      if (!token) return
      try {
        const { partner: p } = await apiSyncUser(token)
        setPartner(p)
      } catch {
        // sync failures are non-fatal
      }
    }

    void sync()
  }, [isLoaded, isSignedIn, user?.id])

  const linkUser = async (username: string) => {
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')
    const p = await apiLinkUser(token, username)
    setPartner(p)
  }

  return (
    <AuthContext.Provider value={{ partner, linkUser, openLinkModal: () => setLinkModalOpen(true) }}>
      {children}
      <LinkModal
        open={linkModalOpen}
        partner={partner}
        onClose={() => setLinkModalOpen(false)}
        onLink={linkUser}
      />
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
