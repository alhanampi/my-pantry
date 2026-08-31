import FormControl from '@mui/material/FormControl'
import Select, { type SelectChangeEvent } from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import { useTranslation } from 'react-i18next'
import type { ShoppingList } from '../../../utils/types'

export interface ShoppingListSelectorProps {
  lists: ShoppingList[]
  selectedListId?: string
  onSelectList: (listId: string) => void
}

export default function ShoppingListSelector({ lists, selectedListId, onSelectList }: ShoppingListSelectorProps) {
  const { t } = useTranslation()

  if (lists.length <= 1) return null

  const value = selectedListId ?? lists.find((l) => l.isGeneral)?.id ?? lists[0]?.id ?? ''

  const handleChange = (e: SelectChangeEvent): void => onSelectList(e.target.value)

  return (
    <FormControl size="small" sx={{ minWidth: 180, mb: 1.5 }}>
      <Select value={value} onChange={handleChange} displayEmpty aria-label={t('shopping.selectList')}>
        {lists.map((list) => (
          <MenuItem key={list.id} value={list.id}>
            {list.isGeneral ? t('shopping.lists.general') : list.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}
