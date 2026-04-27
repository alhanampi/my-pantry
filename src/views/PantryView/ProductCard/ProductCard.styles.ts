import styled from 'styled-components'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'

export const StyledCardContent = styled(CardContent)`
  && {
    padding: 12px;
  }
  &&:last-child {
    padding-bottom: 12px;
  }
`

export const SummaryRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
`

export const DetailsGrid = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;
  margin-top: 8px;
`

export const ProductName = styled(Typography).attrs({ variant: 'body1' as const })`
  && {
    font-weight: 600;
    color: var(--scheme-primary-dark);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
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
  margin: 8px 0;
`

export const DeleteRow = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
`
