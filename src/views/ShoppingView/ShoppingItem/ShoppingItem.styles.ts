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
    background-color: ${({ $purchased }) => ($purchased ? 'var(--scheme-surface-alt)' : 'var(--scheme-surface)')};
    border: 1px solid ${({ $purchased }) => ($purchased ? 'var(--scheme-border)' : 'var(--scheme-accent-light)')};
    opacity: ${({ $purchased }) => ($purchased ? 0.65 : 1)};
    transition: all 0.2s;
  }
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
  }
`

export const DeleteButton = styled(IconButton)`
  && {
    color: #ef9a9a;
    &:hover {
      color: #c62828;
      background-color: #ffebee;
    }
  }
`
