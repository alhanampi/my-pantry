import { createContext, useContext, useState, type ReactNode } from 'react'
import { apiLogin, apiRegister, apiLinkUser } from '../api/authApi'
import type { AuthUser } from '../utils/types'
import AuthModal from '../components/AuthModal'

export type AuthTab = 'login' | 'register' | 'link'

interface AuthContextValue {
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  linkUser: (username: string) => Promise<void>
  logout: () => void
  openAuthModal: (tab?: AuthTab) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const USER_KEY = 'mi-despensa-auth-user'

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadUser)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState<AuthTab>('login')

  const persist = (u: AuthUser) => {
    localStorage.setItem(USER_KEY, JSON.stringify(u))
    setUser(u)
  }

  const login = async (email: string, password: string) => {
    const u = await apiLogin(email, password)
    persist(u)
    setModalOpen(false)
  }

  const register = async (username: string, email: string, password: string) => {
    const u = await apiRegister(username, email, password)
    persist(u)
    setModalOpen(false)
  }

  const linkUser = async (username: string) => {
    const partner = await apiLinkUser(username)
    if (user) persist({ ...user, partner })
  }

  const logout = () => {
    localStorage.removeItem('mi-despensa-token')
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }

  const openAuthModal = (tab: AuthTab = 'register') => {
    setModalTab(tab)
    setModalOpen(true)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, linkUser, logout, openAuthModal }}>
      {children}
      <AuthModal
        open={modalOpen}
        initialTab={modalTab}
        user={user}
        onClose={() => setModalOpen(false)}
        onLogin={login}
        onRegister={register}
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
