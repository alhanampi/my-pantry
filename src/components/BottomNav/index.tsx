import { MdStorefront, MdShoppingCart } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { NavPaper, StyledBottomNavigation, NavAction } from './BottomNav.styles'
import type { BottomNavProps } from '../../utils/types'

export default function BottomNav({ value, onChange }: BottomNavProps) {
  const { t } = useTranslation()

  return (
    <NavPaper elevation={4}>
      <StyledBottomNavigation
        value={value}
        onChange={(_, newValue: number) => onChange(newValue)}
      >
        <NavAction label={t('nav.pantry')} icon={<MdStorefront size={24} />} />
        <NavAction label={t('nav.shopping')} icon={<MdShoppingCart size={24} />} />
      </StyledBottomNavigation>
    </NavPaper>
  )
}
