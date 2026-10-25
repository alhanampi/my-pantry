import styled from 'styled-components'
import Typography from '@mui/material/Typography'

export const DetailWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

export const HeroImage = styled.img`
  width: 100%;
  max-height: 320px;
  object-fit: cover;
  border-radius: 14px;
  background: var(--scheme-surface-alt);
`

export const HeroPlaceholder = styled.div`
  width: 100%;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: var(--scheme-surface-alt);
`

export const Title = styled(Typography).attrs({ variant: 'h6' as const })`
  && {
    font-weight: 700;
    color: var(--scheme-primary-dark);
  }
`

export const Description = styled(Typography).attrs({ variant: 'body2' as const, color: 'text.secondary' as const })`
  && {
    line-height: 1.5;
  }
`

export const ServingsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

export const SectionTitle = styled(Typography).attrs({ variant: 'subtitle2' as const })`
  && {
    font-weight: 700;
    color: var(--scheme-primary-dark);
    margin-bottom: 6px;
  }
`

export const IngredientsList = styled.ul`
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`

export const InstructionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`

export const InstructionStep = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
`

export const StepNumber = styled.span`
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--scheme-primary);
  color: var(--scheme-on-primary);
  font-weight: 700;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
`

export const InstructionText = styled(Typography).attrs({ variant: 'body2' as const })`
  && {
    line-height: 1.6;
  }
`

export const NotesBox = styled.div`
  border: 1px solid var(--scheme-border);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--scheme-surface-alt);
`
