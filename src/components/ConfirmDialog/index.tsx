import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { MdCheckCircle, MdErrorOutline } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { StyledDialogTitle, StyledDialogActions } from './ConfirmDialog.styles'
import type { ConfirmDialogProps } from '../../utils/types'

export default function ConfirmDialog({ open, type, data, onClose }: ConfirmDialogProps) {
  const { t } = useTranslation()
  const isSuccess = type === 'success'

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <StyledDialogTitle>
        {isSuccess ? (
          <MdCheckCircle size={28} color="#2e7d32" />
        ) : (
          <MdErrorOutline size={28} color="#e65100" />
        )}
        {isSuccess ? t('confirm.successTitle') : t('confirm.cancelTitle')}
      </StyledDialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          {isSuccess
            ? t('confirm.successBody', { name: data?.name ?? '' })
            : t('confirm.cancelBody')}
        </Typography>
      </DialogContent>

      <StyledDialogActions>
        <Button onClick={onClose} variant="contained" disableElevation>
          {t('confirm.ok')}
        </Button>
      </StyledDialogActions>
    </Dialog>
  )
}
