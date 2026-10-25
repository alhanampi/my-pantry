import { useState } from 'react'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import { MdSend } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { Row } from './RefinePlanInput.styles'

export interface RefinePlanInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

// Same small controlled-TextField-plus-send-button shape as
// ChatView/ChatComposer, trimmed down — no imperative handle/chip-insertion
// needed here, just a free-text ask the backend layers onto the existing
// plan (see useRefineMealPlan / POST /meal-plan/:id/refine).
export default function RefinePlanInput({ onSend, disabled = false }: RefinePlanInputProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')

  const handleSend = (): void => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  return (
    <Row>
      <TextField
        multiline
        maxRows={4}
        fullWidth
        size="small"
        placeholder={t('mealprep.refine.placeholder')}
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
          }
        }}
      />
      <IconButton
        color="primary"
        aria-label={t('mealprep.refine.send')}
        onClick={handleSend}
        disabled={disabled || !value.trim()}
      >
        {disabled ? <CircularProgress size={20} /> : <MdSend size={20} />}
      </IconButton>
    </Row>
  )
}
