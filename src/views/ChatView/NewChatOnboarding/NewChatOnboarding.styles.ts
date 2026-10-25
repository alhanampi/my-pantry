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

export const GoalOptionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

export const GoalOptionButton = styled.button`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 14px 16px;
  border: 1px solid var(--scheme-border);
  border-radius: 12px;
  background: var(--scheme-bg);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover,
  &:focus-visible {
    border-color: var(--scheme-accent-medium);
    background: var(--scheme-surface);
  }
`

export const GoalOptionLabel = styled.span`
  font-weight: 600;
  color: var(--scheme-text-primary);
`

export const GoalOptionHint = styled.span`
  font-size: 0.8125rem;
  color: var(--scheme-text-secondary);
`

export const BackRow = styled.div`
  display: flex;
`
