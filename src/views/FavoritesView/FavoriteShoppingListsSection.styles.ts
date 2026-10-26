import styled from 'styled-components'
import Typography from '@mui/material/Typography'

export const EmptyHint = styled.p`
  margin: 0;
  color: var(--scheme-text-muted);
  font-size: 0.875rem;
`

export const ListRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--scheme-border);
  cursor: pointer;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--scheme-bg);
  }
`

export const ListIconWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--scheme-accent-medium);
`

export const ListTextWrap = styled.div`
  flex: 1;
  min-width: 0;
`

export const ListName = styled(Typography).attrs({ variant: 'body2' as const })`
  && {
    font-weight: 500;
  }
`
