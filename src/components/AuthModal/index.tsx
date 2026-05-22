import { useState, useEffect } from 'react'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'
import { MdClose, MdInfoOutline, MdPeopleOutline, MdCheckCircleOutline, MdMailOutline } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { StyledAuthDialog, AuthHeader, AuthBody, ErrorBanner } from './AuthModal.styles'
import type { PendingInvite } from '../../api/authApi'

interface Partner {
  id: string
  username: string
}

interface LinkModalProps {
  open: boolean
  partner: Partner | null
  pendingInviteSent: { recipientUsername: string } | null
  pendingInvitesReceived: PendingInvite[]
  loadingInvites: boolean
  onClose: () => void
  onSendInvite: (username: string) => Promise<void>
  onConfirmInvite: (token: string) => Promise<void>
  onDeclineInvite: (token: string) => Promise<void>
}

export default function LinkModal({
  open,
  partner,
  pendingInviteSent,
  pendingInvitesReceived,
  loadingInvites,
  onClose,
  onSendInvite,
  onConfirmInvite,
  onDeclineInvite,
}: LinkModalProps) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionToken, setActionToken] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setUsername('')
      setError('')
    }
  }, [open])

  const handleSend = async () => {
    setLoading(true)
    setError('')
    try {
      await onSendInvite(username.trim())
      setUsername('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async (token: string) => {
    setActionToken(token)
    setError('')
    try {
      await onConfirmInvite(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.errorGeneric'))
    } finally {
      setActionToken(null)
    }
  }

  const handleDecline = async (token: string) => {
    setActionToken(token)
    try {
      await onDeclineInvite(token)
    } catch {
      // non-fatal
    } finally {
      setActionToken(null)
    }
  }

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

      <AuthBody>
        {error && <ErrorBanner>{error}</ErrorBanner>}

        {/* Already linked */}
        {partner ? (
          <>
            <Typography variant="body2" color="text.secondary">
              {t('auth.linkedWith')}
            </Typography>
            <Chip
              icon={<MdPeopleOutline size={18} />}
              label={`@${partner.username}`}
              color="success"
              variant="outlined"
              sx={{ fontWeight: 600, fontSize: '0.95rem', py: 2.5 }}
            />
          </>
        ) : (
          <>
            {/* Pending received invitations */}
            {loadingInvites && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                <CircularProgress size={20} />
              </Box>
            )}
            {pendingInvitesReceived.length > 0 && (
              <>
                <Typography variant="body2" fontWeight={600}>
                  {t('invite.pendingTitle')}
                </Typography>
                {pendingInvitesReceived.map((invite) => (
                  <Box
                    key={invite.token}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      p: 1.5,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                    }}
                  >
                    <Typography variant="body2">
                      {t('invite.pendingFrom', { username: invite.senderUsername })}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        disabled={actionToken === invite.token}
                        onClick={() => void handleDecline(invite.token)}
                      >
                        {t('invite.decline')}
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        disableElevation
                        disabled={actionToken === invite.token}
                        startIcon={
                          actionToken === invite.token ? (
                            <CircularProgress size={14} color="inherit" />
                          ) : undefined
                        }
                        onClick={() => void handleConfirm(invite.token)}
                      >
                        {t('invite.accept')}
                      </Button>
                    </Box>
                  </Box>
                ))}
                <Divider />
              </>
            )}

            {/* Send invitation — or show sent confirmation */}
            {pendingInviteSent ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography
                  variant="body2"
                  color="success.main"
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  <MdCheckCircleOutline size={18} />
                  {t('invite.sent', { username: pendingInviteSent.recipientUsername })}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                  <MdMailOutline size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                  {t('invite.sentBody')}
                </Typography>
              </Box>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary">
                  <MdInfoOutline size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {t('auth.linkTabInfo')}
                </Typography>
                <TextField
                  label={t('auth.linkUsernameLabel')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !loading && username.trim()) void handleSend()
                  }}
                  fullWidth
                  autoFocus
                  disabled={loading}
                  inputProps={{ maxLength: 30 }}
                />
                <Button
                  variant="contained"
                  onClick={() => void handleSend()}
                  disabled={loading || !username.trim()}
                  disableElevation
                  fullWidth
                  sx={{ py: 1.2 }}
                  startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                  {t('invite.sendButton')}
                </Button>
              </>
            )}
          </>
        )}
      </AuthBody>
    </StyledAuthDialog>
  )
}
