import styled from 'styled-components'

export const HeaderCell = styled.div<{ $flex?: number; $minWidth?: string }>`
  flex: ${({ $flex }) => $flex ?? 1};
  min-width: ${({ $minWidth }) => $minWidth ?? '80px'};
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 10px 8px;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--scheme-primary);
  cursor: pointer;
  user-select: none;
  border-radius: 6px;
  transition: background 0.15s;
  white-space: nowrap;
  &:hover {
    background: var(--scheme-accent-light);
  }
`

export const SortIcon = styled.span<{ $active: boolean }>`
  display: flex;
  align-items: center;
  color: ${({ $active }) => ($active ? 'var(--scheme-primary)' : 'var(--scheme-text-muted)')};
  font-size: 16px;
`
