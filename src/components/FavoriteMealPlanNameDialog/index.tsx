import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import { MdOutlineCalendarMonth } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { StyledDialogTitle } from '../ConfirmDialog/ConfirmDialog.styles'

export interface FavoriteMealPlanNameDialogProps {
  open: boolean
  isPending?: boolean
  onConfirm: (name: string) => void
  onCancel: () => void
}

// Small name prompt for "favorite this meal plan" — modeled on
// ConfirmActionDialog, but with a TextField instead of a yes/no body, since
// the name is what tells several saved weeks apart later in Favorites. The
// name is optional: leaving it blank saves with a backend-generated default
// (date-based, see favoriteMealPlans.ts's defaultName).
export default function FavoriteMealPlanNameDialog({
  open,
  isPending = false,
  onConfirm,
  onCancel,
}: FavoriteMealPlanNameDialogProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')

  useEffect(() => {
    if (open) setName('')
  }, [open])

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <StyledDialogTitle>
        <MdOutlineCalendarMonth size={24} color="var(--scheme-primary)" />
        {t('mealprep.favoritePlanNamePrompt')}
      </StyledDialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        <TextField
          fullWidth
          autoFocus
          size="small"
          placeholder={t('mealprep.favoritePlanNamePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          inputProps={{ maxLength: 80 }}
        />
      </DialogContent>

      <Stack spacing={1} sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button
          variant="contained"
          disableElevation
          fullWidth
          disabled={isPending}
          onClick={() => onConfirm(name.trim())}
        >
          {t('mealprep.favoritePlan')}
        </Button>
        <Button variant="outlined" fullWidth onClick={onCancel} disabled={isPending}>
          {t('confirmAction.cancel')}
        </Button>
      </Stack>
    </Dialog>
  )
}
