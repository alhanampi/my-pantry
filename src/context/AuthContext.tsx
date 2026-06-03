import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import {
  apiSyncUser,
  apiSendInvite,
  apiGetInviteInfo,
  apiConfirmInvite,
  apiDeclineInvite,
  apiGetPendingInvites,
  type PendingInvite,
} from '../api/authApi'
import { useGuestMigration } from '../hooks/useGuestMigration'
import LinkModal from '../components/AuthModal'

interface Partner {
  id: string
  username: string
}

interface AuthContextValue {
  partner: Partner | null
  pendingInviteSent: { recipientUsername: string; confirmUrl: string } | null
  pendingInvitesReceived: PendingInvite[]
  loadingInvites: boolean
  sendInvite: (username: string) => Promise<void>
  confirmInvite: (token: string) => Promise<void>
  declineInvite: (token: string) => Promise<void>
  openLinkModal: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isSignedIn, isLoaded } = useUser()
  const { getToken } = useClerkAuth()
  const { t } = useTranslation()
  const migration = useGuestMigration()

  const [partner, setPartner] = useState<Partner | null>(null)
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [pendingInviteSent, setPendingInviteSent] = useState<{ recipientUsername: string; confirmUrl: string } | null>(null)
  const [pendingInvitesReceived, setPendingInvitesReceived] = useState<PendingInvite[]>([])
  const [loadingInvites, setLoadingInvites] = useState(false)

  // URL-based invite confirmation state
  const [urlInviteToken, setUrlInviteToken] = useState<string | null>(null)
  const [urlInviteInfo, setUrlInviteInfo] = useState<{ senderUsername: string } | null>(null)
  const [inviteConfirmOpen, setInviteConfirmOpen] = useState(false)
  const [inviteActionLoading, setInviteActionLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')

  // Extract ?invite=<token> from URL on first render and clean it from the address bar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('invite')
    if (token) {
      setUrlInviteToken(token)
      const clean = new URL(window.location.href)
      clean.searchParams.delete('invite')
      window.history.replaceState({}, '', clean.toString())
    }
  }, [])

  // Migrate guest localStorage data to the server on sign-in
  useEffect(() => {
    if (isLoaded && isSignedIn) migration.mutate()
  }, [isLoaded, isSignedIn, user?.id])

  // Sync user on sign-in and load pending invites
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) {
      setPartner(null)
      setPendingInvitesReceived([])
      return
    }

    const sync = async () => {
      const token = await getToken()
      if (!token) return
      try {
        const { partner: p } = await apiSyncUser(token)
        setPartner(p)
      } catch {
        // non-fatal
      }
    }
    void sync()
  }, [isLoaded, isSignedIn, user?.id])

  // When signed in and a URL invite token is present, fetch invite info and show dialog
  useEffect(() => {
    if (!isSignedIn || !urlInviteToken) return
    const fetch = async () => {
      const token = await getToken()
      if (!token) return
      try {
        const info = await apiGetInviteInfo(token, urlInviteToken)
        setUrlInviteInfo(info)
        setInviteConfirmOpen(true)
      } catch {
        // Expired, wrong user, or already used — silently discard
        setUrlInviteToken(null)
      }
    }
    void fetch()
  }, [isSignedIn, urlInviteToken])

  const loadPendingInvites = useCallback(async () => {
    if (!isSignedIn) return
    setLoadingInvites(true)
    try {
      const token = await getToken()
      if (!token) return
      const { invites } = await apiGetPendingInvites(token)
      setPendingInvitesReceived(invites)
    } catch {
      // non-fatal
    } finally {
      setLoadingInvites(false)
    }
  }, [isSignedIn, getToken])

  // Load pending invites when the link modal opens
  useEffect(() => {
    if (linkModalOpen) void loadPendingInvites()
  }, [linkModalOpen])

  const sendInvite = async (username: string) => {
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')
    const { recipientUsername, confirmUrl } = await apiSendInvite(token, username)
    setPendingInviteSent({ recipientUsername, confirmUrl })
  }

  const confirmInvite = async (inviteToken: string) => {
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')
    const { partner: p } = await apiConfirmInvite(token, inviteToken)
    setPartner(p)
    setPendingInvitesReceived((prev) => prev.filter((i) => i.token !== inviteToken))
  }

  const declineInvite = async (inviteToken: string) => {
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')
    await apiDeclineInvite(token, inviteToken)
    setPendingInvitesReceived((prev) => prev.filter((i) => i.token !== inviteToken))
  }

  const handleConfirmUrlInvite = async () => {
    if (!urlInviteToken) return
    setInviteActionLoading(true)
    setInviteError('')
    try {
      await confirmInvite(urlInviteToken)
      setInviteConfirmOpen(false)
      setUrlInviteToken(null)
      setUrlInviteInfo(null)
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : t('auth.errorGeneric'))
    } finally {
      setInviteActionLoading(false)
    }
  }

  const handleDeclineUrlInvite = async () => {
    if (!urlInviteToken) return
    setInviteActionLoading(true)
    try {
      await declineInvite(urlInviteToken)
    } catch {
      // non-fatal
    } finally {
      setInviteConfirmOpen(false)
      setUrlInviteToken(null)
      setUrlInviteInfo(null)
      setInviteActionLoading(false)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        partner,
        pendingInviteSent,
        pendingInvitesReceived,
        loadingInvites,
        sendInvite,
        confirmInvite,
        declineInvite,
        openLinkModal: () => setLinkModalOpen(true),
      }}
    >
      {children}

      <LinkModal
        open={linkModalOpen}
        partner={partner}
        pendingInviteSent={pendingInviteSent}
        pendingInvitesReceived={pendingInvitesReceived}
        loadingInvites={loadingInvites}
        onClose={() => {
          setLinkModalOpen(false)
          setPendingInviteSent(null)
        }}
        onSendInvite={sendInvite}
        onConfirmInvite={confirmInvite}
        onDeclineInvite={declineInvite}
      />

      {/* Invite confirmation dialog — triggered by ?invite=<token> in the URL */}
      <Dialog open={inviteConfirmOpen} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {t('invite.confirmTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('invite.confirmBody', { username: urlInviteInfo?.senderUsername ?? '…' })}
          </DialogContentText>
          {inviteError && (
            <DialogContentText color="error" sx={{ mt: 1 }}>
              {inviteError}
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => void handleDeclineUrlInvite()}
            variant="outlined"
            color="inherit"
            disabled={inviteActionLoading}
          >
            {t('invite.decline')}
          </Button>
          <Button
            onClick={() => void handleConfirmUrlInvite()}
            variant="contained"
            disableElevation
            disabled={inviteActionLoading}
            startIcon={inviteActionLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {t('invite.accept')}
          </Button>
        </DialogActions>
      </Dialog>
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
