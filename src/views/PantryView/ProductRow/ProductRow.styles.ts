import styled from 'styled-components'
import type { ExpiryStatus } from '../../../utils/types'

export const Row = styled.div`
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--scheme-border);
  background: var(--scheme-surface);
  transition: background 0.15s;
  min-width: 600px;
  &:hover {
    background: var(--scheme-surface-alt);
  }
  &:last-child {
    border-bottom: none;
  }
`

export const Cell = styled.div<{ $flex?: number; $minWidth?: string }>`
  flex: ${({ $flex }) => $flex ?? 1};
  min-width: ${({ $minWidth }) => $minWidth ?? '80px'};
  padding: 10px 8px;
  font-size: 0.875rem;
  color: #212121;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const NameCell = styled(Cell)`
  font-weight: 500;
  color: var(--scheme-primary-dark);
`

export const ExpiryText = styled.span<{ $status: ExpiryStatus }>`
  font-size: 0.875rem;
  font-weight: ${({ $status }) => ($status !== 'none' ? 600 : 400)};
  color: ${({ $status }) => {
    if ($status === 'expired') return '#c62828'
    if ($status === 'soon') return '#e65100'
    return '#424242'
  }};
`

export const MutedCell = styled(Cell)`
  color: var(--scheme-text-secondary);
`

export const NameCellContent = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

export const ActionsCell = styled.div`
  width: 72px;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  gap: 2px;
  padding: 4px;
`
