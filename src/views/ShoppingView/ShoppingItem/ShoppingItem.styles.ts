import styled from 'styled-components'
import ListItem from '@mui/material/ListItem'
import Checkbox from '@mui/material/Checkbox'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'

export const StyledListItem = styled(ListItem)<{ $purchased: boolean }>`
  && {
    padding: 4px 8px;
    border-radius: 12px;
    margin-bottom: 2px;
    flex-direction: column;
    align-items: stretch;
    background-color: ${({ $purchased }) => ($purchased ? 'var(--scheme-surface-alt)' : 'var(--scheme-surface)')};
    border: 1px solid ${({ $purchased }) => ($purchased ? 'var(--scheme-border)' : 'var(--scheme-accent-light)')};
    opacity: ${({ $purchased }) => ($purchased ? 0.65 : 1)};
    transition: all 0.2s;
  }
`

export const SummaryRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
`

export const ItemCheckbox = styled(Checkbox)`
  && {
    padding: 4px;
    margin-right: 4px;
  }
`

export const ItemName = styled(Typography).attrs({ variant: 'body2' as const })<{ $purchased: boolean }>`
  && {
    font-weight: 500;
    color: ${({ $purchased }) => ($purchased ? 'var(--scheme-text-muted)' : 'var(--scheme-primary-dark)')};
    text-decoration: ${({ $purchased }) => ($purchased ? 'line-through' : 'none')};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const DeleteButton = styled(IconButton)`
  && {
    color: var(--scheme-error-light);
    &:hover {
      color: var(--scheme-error);
      background-color: var(--scheme-error-bg);
    }
  }
`

export const DetailsGrid = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;
  margin-top: 4px;
  padding: 0 4px;
`

export const DetailLabel = styled(Typography).attrs({ variant: 'caption' as const })`
  && {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--scheme-text-muted);
  }
`

export const DetailValue = styled(Typography).attrs({ variant: 'body2' as const })`
  && {
    color: var(--scheme-text-primary);
  }
`

export const SummaryDivider = styled.hr`
  border: none;
  border-top: 1px solid var(--scheme-border);
  margin: 6px 0;
`

