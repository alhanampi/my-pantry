import styled from 'styled-components'
import Typography from '@mui/material/Typography'

export const OnboardingWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  border: 1px solid var(--scheme-border);
  border-radius: 14px;
  background: var(--scheme-surface);
`

export const OnboardingTitle = styled(Typography).attrs({ variant: 'h6' as const })`
  && {
    font-weight: 700;
    color: var(--scheme-primary-dark);
  }
`

export const FieldLabel = styled(Typography).attrs({ variant: 'subtitle2' as const })`
  && {
    font-weight: 600;
    margin-bottom: 8px;
  }
`

export const ServingsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`
