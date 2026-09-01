import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { useUnitSystem } from '../../hooks/useUnitSystem'

export interface UnitSystemToggleProps {
  // 'header' styles the label to read against the dark app-bar background
  // (desktop toolbar); 'plain' uses the theme's default text color (mobile
  // drawer list item, RecipeDetailPanel).
  variant?: 'header' | 'plain'
}

// Same preference everywhere it's rendered — Header's Preferencias section
// and RecipeDetailPanel both call this, and both read/write through
// useUnitSystem, so toggling from either place updates the single persisted
// default (including what the chat prompt sees). unchecked = metric,
// checked = imperial.
export default function UnitSystemToggle({ variant = 'header' }: UnitSystemToggleProps) {
  const { t } = useTranslation()
  const { unitSystem, setUnitSystem, isPending } = useUnitSystem()
  const isHeader = variant === 'header'

  const label = unitSystem === 'metric' ? t('header.unitSystemMetric') : t('header.unitSystemImperial')

  const handleChange = (): void => {
    setUnitSystem(unitSystem === 'metric' ? 'imperial' : 'metric')
  }

  return (
    <Tooltip title={t('header.unitSystem')}>
      <FormControlLabel
        sx={{ ml: 0, gap: 0.5 }}
        control={
          <Switch
            checked={unitSystem === 'imperial'}
            onChange={handleChange}
            disabled={isPending}
            size="small"
            // MUI's Switch renders a plain checkbox input by default (role
            // "checkbox", not "switch") — this is semantically a two-state
            // switch, so declare the correct ARIA role explicitly.
            inputProps={{ role: 'switch' }}
            sx={
              isHeader
                ? {
                    '& .MuiSwitch-switchBase.Mui-checked': { color: 'var(--scheme-on-primary)' },
                    '& .MuiSwitch-track': { bgcolor: 'var(--scheme-on-primary-muted)' },
                    '& .MuiSwitch-thumb': { bgcolor: 'var(--scheme-on-primary)' },
                  }
                : undefined
            }
          />
        }
        label={
          <Typography
            variant="caption"
            sx={isHeader ? { color: 'var(--scheme-on-primary)', fontWeight: 700 } : undefined}
          >
            {label}
          </Typography>
        }
      />
    </Tooltip>
  )
}
