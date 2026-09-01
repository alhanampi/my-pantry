import {
  MdOutlineInventory2,
  MdOutlineShoppingCart,
  MdOutlineRestaurantMenu,
  MdOutlineFavorite,
  MdOutlineLightbulb,
} from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { NavPaper, StyledBottomNavigation, NavAction } from './BottomNav.styles'
import type { BottomNavProps } from '../../utils/types'

// Icon-only tabs — no label prop, so no text renders below the icon (the
// tab name is still exposed to assistive tech via aria-label). See
// BottomNav.styles.ts's NavAction for the size/centering adjustment that
// icon-only mode needs.
export default function BottomNav({ value, onChange }: BottomNavProps) {
  const { t } = useTranslation()

  return (
    <NavPaper elevation={4}>
      <StyledBottomNavigation value={value} onChange={(_, newValue: number) => onChange(newValue)} showLabels={false}>
        <NavAction aria-label={t('nav.pantry')} icon={<MdOutlineInventory2 size={24} />} />
        <NavAction aria-label={t('nav.recipes')} icon={<MdOutlineRestaurantMenu size={24} />} />
        <NavAction aria-label={t('nav.favorites')} icon={<MdOutlineFavorite size={24} />} />
        <NavAction aria-label={t('nav.chat')} icon={<MdOutlineLightbulb size={24} />} />
        <NavAction aria-label={t('nav.shopping')} icon={<MdOutlineShoppingCart size={24} />} />
      </StyledBottomNavigation>
    </NavPaper>
  )
}
