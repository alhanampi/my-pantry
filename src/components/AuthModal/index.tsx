import { useState, useEffect } from 'react'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import { MdClose, MdInfoOutline, MdPeopleOutline, MdCheckCircleOutline } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { StyledAuthDialog, AuthHeader, AuthBody, ErrorBanner } from './AuthModal.styles'

interface Partner {
  id: string
  username: string
}

interface LinkModalProps {
  open: boolean
  partner: Partner | null
  onClose: () => void
  onLink: (username: string) => Promise<void>
}

export default function LinkModal({ open, partner, onClose, onLink }: LinkModalProps) {
  const { t } = useTranslation()
  const [linkUsername, setLinkUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [linkSuccess, setLinkSuccess] = useState('')
  const [linkConfirm, setLinkConfirm] = useState(false)

  useEffect(() => {
    if (open) {
      setLinkUsername('')
      setError('')
      setLinkSuccess('')
    }
  }, [open])

  const handleLink = async () => {
    setLoading(true)
    setError('')
    setLinkSuccess('')
    try {
      await onLink(linkUsername.trim())
      setLinkSuccess(t('auth.linkSuccess', { username: linkUsername.trim() }))
      setLinkUsername('')
    } catch (err) {
      setError(
        err instanceof Error
          ? t(err.message, { defaultValue: err.message })
          : t('auth.errorGeneric')
      )
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading && linkUsername.trim()) void handleLink()
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

      <AuthBody onKeyDown={handleKeyDown}>
        {error && <ErrorBanner>{error}</ErrorBanner>}

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
