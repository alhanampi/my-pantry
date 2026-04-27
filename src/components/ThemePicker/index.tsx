import { useState } from 'react'
import Popover from '@mui/material/Popover'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { MdPalette } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { useColorScheme } from '../../contexts/ThemeContext'
import { schemes } from '../../styles/colorSchemes'
import type { ColorScheme } from '../../styles/colorSchemes'
import { SwatchGrid, SwatchButton, SwatchCircle, SwatchLabel } from './ThemePicker.styles'

export default function ThemePicker() {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const { colorScheme, setColorScheme } = useColorScheme()
  const { t, i18n } = useTranslation()

  const handleSelect = (scheme: ColorScheme) => {
    setColorScheme(scheme)
    setAnchor(null)
  }

  return (
    <>
      <Tooltip title={t('header.colorScheme')}>
        <IconButton
          onClick={(e) => setAnchor(e.currentTarget)}
          color="inherit"
          size="medium"
          aria-label={t('header.colorScheme')}
        >
          <MdPalette size={22} color="rgba(255,255,255,0.85)" />
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { borderRadius: 2, p: 1.5, mt: 0.5 } }}
      >
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', display: 'block', mb: 1, fontWeight: 600 }}
        >
          {t('header.colorScheme')}
        </Typography>
        <SwatchGrid>
          {(Object.entries(schemes) as [ColorScheme, (typeof schemes)[ColorScheme]][]).map(
            ([key, scheme]) => (
              <SwatchButton key={key} onClick={() => handleSelect(key)}>
                <SwatchCircle $color={scheme.swatch} $active={colorScheme === key} />
                <SwatchLabel $active={colorScheme === key}>
                  {i18n.language === 'en' ? scheme.labelEn : scheme.labelEs}
                </SwatchLabel>
              </SwatchButton>
            )
          )}
        </SwatchGrid>
      </Popover>
    </>
  )
}
