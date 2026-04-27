import { MdArrowUpward, MdArrowDownward, MdUnfoldMore } from 'react-icons/md'
import { HeaderCell, SortIcon } from './SortableHeader.styles'
import type { SortableHeaderProps } from '../../../utils/types'

export default function SortableHeader({
  label,
  columnKey,
  sortConfig,
  onSort,
  flex,
  minWidth,
}: SortableHeaderProps) {
  const isActive = sortConfig.key === columnKey
  const isAsc = isActive && sortConfig.direction === 'asc'
  const isDesc = isActive && sortConfig.direction === 'desc'

  return (
    <HeaderCell
      $flex={flex}
      $minWidth={minWidth}
      onClick={() => onSort(columnKey)}
      role="columnheader"
      aria-sort={isAsc ? 'ascending' : isDesc ? 'descending' : 'none'}
    >
      {label}
      <SortIcon $active={isActive}>
        {!isActive && <MdUnfoldMore />}
        {isAsc && <MdArrowUpward />}
        {isDesc && <MdArrowDownward />}
      </SortIcon>
    </HeaderCell>
  )
}
