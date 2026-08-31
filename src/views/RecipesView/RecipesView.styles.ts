import styled from 'styled-components'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'

export const Wrapper = styled.div`
  max-width: 900px;
  margin: 0 auto;
`

export const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  gap: 10px;
  color: var(--scheme-text-muted);
  text-align: center;
`

export const ErrorState = styled(EmptyState)`
  color: var(--scheme-error, #c62828);
`

export const BackRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
`

export const BackButton = styled(IconButton)`
  && {
    color: var(--scheme-text-primary);
  }
`

export const SectionTitle = styled(Typography).attrs({ variant: 'subtitle1' as const })`
  && {
    font-weight: 600;
    color: var(--scheme-primary-dark);
    margin: 16px 0 8px;
  }
`
