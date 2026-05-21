import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import { MdRemoveShoppingCart } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { StyledDialogTitle } from '../ConfirmDialog/ConfirmDialog.styles'
import type { ZeroShoppingDialogState } from '../../utils/types'

export type ZeroShoppingAction = 'delete' | 'cancel'

interface Props extends ZeroShoppingDialogState {
  onAction: (action: ZeroShoppingAction) => void
}

export default function ZeroShoppingQtyDialog({ open, item, onAction }: Props) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onClose={() => onAction('cancel')} maxWidth="xs" fullWidth>
      <StyledDialogTitle>
        <MdRemoveShoppingCart size={26} color="var(--scheme-warning)" />
        {t('zeroShoppingQty.title', { name: item?.name ?? '' })}
      </StyledDialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {t('zeroShoppingQty.body')}
        </Typography>
      </DialogContent>

      <Stack spacing={1} sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button variant="contained" color="error" disableElevation fullWidth onClick={() => onAction('delete')}>
          {t('zeroShoppingQty.confirm')}
        </Button>
        <Button variant="outlined" fullWidth onClick={() => onAction('cancel')}>
          {t('zeroShoppingQty.cancel')}
        </Button>
      </Stack>
    </Dialog>
  )
}
