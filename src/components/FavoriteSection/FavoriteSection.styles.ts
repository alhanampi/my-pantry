import styled from 'styled-components'
import Typography from '@mui/material/Typography'
import CardContent from '@mui/material/CardContent'

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
  gap: 10px;
  cursor: pointer;
  user-select: none;
`

export const SectionIconWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--scheme-accent-medium);
  flex-shrink: 0;
`

export const SectionTitle = styled(Typography).attrs({ variant: 'subtitle1' as const })`
  && {
    font-weight: 600;
    color: var(--scheme-primary-dark);
    flex: 1;
  }
`

export const ContentWrap = styled.div`
  padding-top: 12px;
`
