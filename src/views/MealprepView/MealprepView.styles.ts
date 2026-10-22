import styled from 'styled-components'
import Typography from '@mui/material/Typography'

export const Wrapper = styled.div`
  max-width: 700px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
`

export const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

export const Title = styled(Typography).attrs({ variant: 'h6' as const })`
  && {
    font-weight: 700;
    color: var(--scheme-primary-dark);
  }
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
`

export const ActionsRow = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`
