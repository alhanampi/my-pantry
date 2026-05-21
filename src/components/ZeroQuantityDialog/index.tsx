import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import { MdRemoveShoppingCart } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { StyledDialogTitle } from '../ConfirmDialog/ConfirmDialog.styles'
import type { ZeroQuantityDialogState } from '../../utils/types'

export type ZeroQuantityAction = 'cart' | 'cancel'

interface Props extends ZeroQuantityDialogState {
  onAction: (action: ZeroQuantityAction) => void
}

export default function ZeroQuantityDialog({ open, product, onAction }: Props) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onClose={() => onAction('cancel')} maxWidth="xs" fullWidth>
      <StyledDialogTitle>
        <MdRemoveShoppingCart size={26} color="var(--scheme-warning)" />
        {t('zeroQty.title', { name: product?.name ?? '' })}
      </StyledDialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {t('zeroQty.body')}
        </Typography>
      </DialogContent>

      <Stack spacing={1} sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button variant="contained" disableElevation fullWidth onClick={() => onAction('cart')}>
          {t('zeroQty.addToCart')}
        </Button>
        <Button variant="outlined" fullWidth onClick={() => onAction('cancel')}>
          {t('zeroQty.cancel')}
        </Button>
      </Stack>
    </Dialog>
  )
}
