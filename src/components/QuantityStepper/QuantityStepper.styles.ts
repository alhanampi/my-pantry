import styled from 'styled-components'

export const StepperWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 1px;
  background: var(--scheme-accent-light);
  border-radius: 20px;
  padding: 2px 4px;
  flex-shrink: 0;
`

export const StepperValue = styled.span`
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--scheme-primary);
  min-width: 22px;
  text-align: center;
  line-height: 1;
`
