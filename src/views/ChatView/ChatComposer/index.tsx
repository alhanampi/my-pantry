import { forwardRef, useImperativeHandle, useState } from 'react'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import { MdSend } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { ComposerRow } from './ChatComposer.styles'

export interface ChatComposerProps {
  onSend: (content: string) => void
  disabled?: boolean
}

// Exposed to QuickReplies (via a ref held by ChatView) so tapping a quick
// reply chip can insert text into whatever's already been typed, instead of
// overwriting it — the internal `value` state stays owned by ChatComposer,
// nothing is lifted, so the existing controlled-by-props test shape doesn't
// change.
export interface ChatComposerHandle {
  // For a one-off phrase (time chips) — appended as a new sentence.
  appendPhrase: (phrase: string) => void
  // For an ingredient name (pantry chips) — merges into an existing
  // "<prefix>a, b, c" fragment instead of repeating the prefix each tap.
  appendIngredient: (name: string, prefix: string) => void
}

const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer(
  { onSend, disabled = false },
  ref,
) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')

  useImperativeHandle(ref, () => ({
    appendPhrase: (phrase: string) => {
      setValue((prev) => {
        const trimmed = prev.trim()
        if (!trimmed) return phrase
        if (trimmed.endsWith(phrase)) return prev
        return `${trimmed} ${phrase}`
      })
    },
    appendIngredient: (name: string, prefix: string) => {
      setValue((prev) => {
        const trimmed = prev.trimEnd()
        if (trimmed.startsWith(prefix)) {
          const existing = trimmed
            .slice(prefix.length)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
          if (existing.includes(name)) return prev
          return `${prefix}${[...existing, name].join(', ')}`
        }
        if (!trimmed) return `${prefix}${name}`
        return `${trimmed} ${prefix}${name}`
      })
    },
  }))

  const handleSend = (): void => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  return (
    <ComposerRow>
      <TextField
        multiline
        maxRows={4}
        fullWidth
        size="small"
        placeholder={t('chat.placeholder')}
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
        aria-label={t('chat.send')}
        onClick={handleSend}
        disabled={disabled || !value.trim()}
      >
        {disabled ? <CircularProgress size={20} /> : <MdSend size={20} />}
      </IconButton>
    </ComposerRow>
  )
})

export default ChatComposer
