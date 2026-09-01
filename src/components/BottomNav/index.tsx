import {
  MdOutlineStorefront,
  MdOutlineShoppingCart,
  MdOutlineRestaurantMenu,
  MdOutlineFavorite,
  MdOutlineLightbulb,
} from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { NavPaper, StyledBottomNavigation, NavAction } from './BottomNav.styles'
import type { BottomNavProps } from '../../utils/types'

export default function BottomNav({ value, onChange }: BottomNavProps) {
  const { t } = useTranslation()

  return (
    <NavPaper elevation={4}>
      <StyledBottomNavigation value={value} onChange={(_, newValue: number) => onChange(newValue)}>
        <NavAction label={t('nav.pantry')} icon={<MdOutlineStorefront size={24} />} />
        <NavAction label={t('nav.recipes')} icon={<MdOutlineRestaurantMenu size={24} />} />
        <NavAction label={t('nav.favorites')} icon={<MdOutlineFavorite size={24} />} />
        <NavAction label={t('nav.chat')} icon={<MdOutlineLightbulb size={24} />} />
        <NavAction label={t('nav.shopping')} icon={<MdOutlineShoppingCart size={24} />} />
      </StyledBottomNavigation>
    </NavPaper>
  )
}
