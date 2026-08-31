import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import { MdWarningAmber } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { StyledDialogTitle } from '../ConfirmDialog/ConfirmDialog.styles'

export interface ConfirmActionDialogProps {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

// Generic "are you sure?" prompt — unlike ConfirmDialog (which is actually a
// post-action success/cancel notice despite the name), this asks BEFORE a
// destructive action runs. Used for deleting a shopping list and removing a
// recipe from favorites; reach for this rather than adding another
// one-off dialog per feature.
export default function ConfirmActionDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmActionDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <StyledDialogTitle>
        <MdWarningAmber size={26} color="var(--scheme-warning)" />
        {title}
      </StyledDialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {body}
        </Typography>
      </DialogContent>

      <Stack spacing={1} sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button variant="contained" color="error" disableElevation fullWidth onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="outlined" fullWidth onClick={onCancel}>
          {t('confirmAction.cancel')}
        </Button>
      </Stack>
    </Dialog>
  )
}
