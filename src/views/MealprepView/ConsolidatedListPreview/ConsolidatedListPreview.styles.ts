import styled from 'styled-components'
import Typography from '@mui/material/Typography'

export const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border: 1px solid var(--scheme-border);
  border-radius: 14px;
  background: var(--scheme-surface);
`

export const Heading = styled(Typography).attrs({ variant: 'subtitle1' as const })`
  && {
    font-weight: 700;
  }
`

export const ItemList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const ItemRow = styled.li`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  font-size: 0.875rem;
`

export const ItemName = styled.span`
  color: var(--scheme-text-primary);
`

export const ItemQuantity = styled.span`
  color: var(--scheme-text-secondary);
  white-space: nowrap;
`

export const PantryNote = styled.span`
  display: block;
  font-size: 0.75rem;
  color: var(--scheme-accent-medium);
`

export const Actions = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
`
