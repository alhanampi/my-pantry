import { useState, useEffect } from 'react'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import { MdClose, MdInfoOutline, MdPeopleOutline, MdCheckCircleOutline } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import type { AuthUser } from '../../utils/types'
import type { AuthTab } from '../../context/AuthContext'
import { StyledAuthDialog, AuthHeader, AuthBody, ErrorBanner } from './AuthModal.styles'

interface AuthModalProps {
  open: boolean
  initialTab: AuthTab
  user: AuthUser | null
  onClose: () => void
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: (username: string, email: string, password: string) => Promise<void>
  onLink: (username: string) => Promise<void>
}

const emptyLogin = { email: '', password: '' }
const emptyRegister = { username: '', email: '', password: '' }

export default function AuthModal({
  open,
  initialTab,
  user,
  onClose,
  onLogin,
  onRegister,
  onLink,
}: AuthModalProps) {
  const { t } = useTranslation()
  const isLinkMode = initialTab === 'link'

  const [authTab, setAuthTab] = useState(initialTab === 'register' ? 1 : 0)
  const [loginForm, setLoginForm] = useState(emptyLogin)
  const [registerForm, setRegisterForm] = useState(emptyRegister)
  const [linkUsername, setLinkUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [linkSuccess, setLinkSuccess] = useState('')
  const [linkConfirm, setLinkConfirm] = useState(false)

  useEffect(() => {
    if (open) {
      setAuthTab(initialTab === 'register' ? 1 : 0)
      setLoginForm(emptyLogin)
      setRegisterForm(emptyRegister)
      setLinkUsername('')
      setError('')
      setLinkSuccess('')
    }
  }, [open, initialTab])

  const run = async (fn: () => Promise<void>) => {
    setLoading(true)
    setError('')
    setLinkSuccess('')
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = () => run(() => onLogin(loginForm.email, loginForm.password))

  const handleRegister = () =>
    run(() => onRegister(registerForm.username, registerForm.email, registerForm.password))

  const handleLink = () =>
    run(async () => {
      await onLink(linkUsername.trim())
      setLinkSuccess(t('auth.linkSuccess', { username: linkUsername.trim() }))
      setLinkUsername('')
    })

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || loading) return
    if (isLinkMode && linkUsername.trim()) void handleLink()
    else if (authTab === 0) void handleLogin()
    else void handleRegister()
  }

  // ── Link-only modal ──────────────────────────────────────────────────────────
  if (isLinkMode) {
    return (
      <StyledAuthDialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
        <AuthHeader>
          <IconButton
            onClick={onClose}
            disabled={loading}
            size="small"
            sx={{ position: 'absolute', top: 12, right: 12 }}
          >
            <MdClose size={18} />
          </IconButton>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
            {t('auth.linkTabTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('auth.linkTabSubtitle')}
          </Typography>
        </AuthHeader>

        <AuthBody onKeyDown={handleKeyDown}>
          {error && <ErrorBanner>{error}</ErrorBanner>}

          {user?.partner ? (
            <>
              <Typography variant="body2" color="text.secondary">
                {t('auth.linkedWith')}
              </Typography>
              <Chip
                icon={<MdPeopleOutline size={18} />}
                label={`@${user.partner.username}`}
                color="success"
                variant="outlined"
                sx={{ fontWeight: 600, fontSize: '0.95rem', py: 2.5 }}
              />
            </>
          ) : (
            <>
              {linkSuccess && (
                <Typography
                  variant="body2"
                  color="success.main"
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  <MdCheckCircleOutline size={18} />
                  {linkSuccess}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                <MdInfoOutline size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                {t('auth.linkTabInfo')}
              </Typography>
              <TextField
                label={t('auth.linkUsernameLabel')}
                value={linkUsername}
                onChange={(e) => setLinkUsername(e.target.value)}
                fullWidth
                autoFocus
                disabled={loading}
                inputProps={{ maxLength: 30 }}
              />
              <Button
                variant="contained"
                onClick={() => setLinkConfirm(true)}
                disabled={loading || !linkUsername.trim()}
                disableElevation
                fullWidth
                sx={{ py: 1.2 }}
              >
                {t('auth.linkButton')}
              </Button>
            </>
          )}
        </AuthBody>

        <Dialog open={linkConfirm} onClose={() => setLinkConfirm(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>
            {t('auth.linkConfirmTitle', { username: linkUsername })}
          </DialogTitle>
          <DialogContent>
            <DialogContentText>{t('auth.linkConfirmBody')}</DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setLinkConfirm(false)} variant="outlined" color="inherit">
              {t('modal.cancel')}
            </Button>
            <Button
              onClick={() => {
                setLinkConfirm(false)
                void handleLink()
              }}
              variant="contained"
              disableElevation
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {t('auth.confirmAction')}
            </Button>
          </DialogActions>
        </Dialog>
      </StyledAuthDialog>
    )
  }

  // ── Auth modal (login + register tabs) ───────────────────────────────────────
  return (
    <StyledAuthDialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <AuthHeader>
        <IconButton
          onClick={onClose}
          disabled={loading}
          size="small"
          sx={{ position: 'absolute', top: 12, right: 12 }}
        >
          <MdClose size={18} />
        </IconButton>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
          {authTab === 0 ? t('auth.loginTitle') : t('auth.registerTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('auth.guestMessage')}
        </Typography>
        <Tabs
          value={authTab}
          onChange={(_, v: number) => {
            setAuthTab(v)
            setError('')
          }}
          variant="fullWidth"
          TabIndicatorProps={{ style: { height: 3 } }}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label={t('auth.loginTab')} disabled={loading} />
          <Tab label={t('auth.registerTab')} disabled={loading} />
        </Tabs>
      </AuthHeader>

      <AuthBody onKeyDown={handleKeyDown}>
        {error && <ErrorBanner>{error}</ErrorBanner>}

        {authTab === 0 ? (
          <>
            <TextField
              label={t('auth.email')}
              type="email"
              value={loginForm.email}
              onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))}
              fullWidth
              autoFocus
              disabled={loading}
            />
            <TextField
              label={t('auth.password')}
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
              fullWidth
              disabled={loading}
            />
            <Button
              variant="contained"
              onClick={() => void handleLogin()}
              disabled={loading || !loginForm.email || !loginForm.password}
              disableElevation
              fullWidth
              sx={{ py: 1.2 }}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {loading ? '' : t('auth.loginButton')}
            </Button>
            <Divider />
            <Typography variant="body2" textAlign="center" color="text.secondary">
              {t('auth.noAccount')}{' '}
              <Button
                size="small"
                onClick={() => {
                  setAuthTab(1)
                  setError('')
                }}
                disabled={loading}
                sx={{ p: 0 }}
              >
                {t('auth.registerTab')}
              </Button>
            </Typography>
          </>
        ) : (
          <>
            <TextField
              label={t('auth.usernameLabel')}
              value={registerForm.username}
              onChange={(e) => setRegisterForm((p) => ({ ...p, username: e.target.value }))}
              fullWidth
              autoFocus
              disabled={loading}
              inputProps={{ maxLength: 30 }}
            />
            <TextField
              label={t('auth.email')}
              type="email"
              value={registerForm.email}
              onChange={(e) => setRegisterForm((p) => ({ ...p, email: e.target.value }))}
              fullWidth
              disabled={loading}
            />
            <TextField
              label={t('auth.passwordLabel')}
              type="password"
              value={registerForm.password}
              onChange={(e) => setRegisterForm((p) => ({ ...p, password: e.target.value }))}
              helperText={t('auth.passwordMin')}
              fullWidth
              disabled={loading}
            />
            <Button
              variant="contained"
              onClick={() => void handleRegister()}
              disabled={
                loading || !registerForm.username || !registerForm.email || !registerForm.password
              }
              disableElevation
              fullWidth
              sx={{ py: 1.2 }}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {loading ? '' : t('auth.registerButton')}
            </Button>
            <Divider />
            <Typography variant="body2" textAlign="center" color="text.secondary">
              {t('auth.hasAccount')}{' '}
              <Button
                size="small"
                onClick={() => {
                  setAuthTab(0)
                  setError('')
                }}
                disabled={loading}
                sx={{ p: 0 }}
              >
                {t('auth.loginTab')}
              </Button>
            </Typography>
          </>
        )}
      </AuthBody>
    </StyledAuthDialog>
  )
}
