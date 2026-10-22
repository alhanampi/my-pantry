import styled from 'styled-components'
import Typography from '@mui/material/Typography'

export const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

export const Heading = styled(Typography).attrs({ variant: 'subtitle2' as const })`
  && {
    font-weight: 600;
  }
`

export const LoadingRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--scheme-text-secondary);
  font-size: 0.875rem;
`

export const EmptyHint = styled.p`
  color: var(--scheme-text-secondary);
  font-size: 0.875rem;
  margin: 0;
`
