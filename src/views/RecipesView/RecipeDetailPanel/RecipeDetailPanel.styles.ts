import styled from 'styled-components'
import Typography from '@mui/material/Typography'

export const DetailWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

export const HeroImageWrapper = styled.div`
  position: relative;
`

export const HeroImage = styled.img`
  width: 100%;
  max-height: 320px;
  object-fit: cover;
  border-radius: 14px;
  background: var(--scheme-surface-alt);
`

export const HeroFavoriteButton = styled.button<{ $active: boolean }>`
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: var(--scheme-surface);
  box-shadow: 0 1px 6px var(--scheme-shadow-sm);
  cursor: pointer;
  color: ${(p) => (p.$active ? 'var(--scheme-accent-medium)' : 'var(--scheme-text-muted)')};

  &:hover {
    background: var(--scheme-surface-alt);
  }
`

export const Title = styled(Typography).attrs({ variant: 'h6' as const })`
  && {
    font-weight: 700;
    color: var(--scheme-primary-dark);
  }
`

export const ServingsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

export const NutritionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
`

export const NutritionCell = styled.div`
  text-align: center;
  padding: 10px 4px;
  border-radius: 10px;
  background: var(--scheme-surface-alt);
  border: 1px solid var(--scheme-border);
`

export const NutritionValue = styled(Typography).attrs({ variant: 'subtitle1' as const })`
  && {
    font-weight: 700;
    color: var(--scheme-primary-dark);
  }
`

export const NutritionLabel = styled(Typography).attrs({ variant: 'caption' as const })`
  && {
    color: var(--scheme-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
`

export const IngredientsList = styled.ul`
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`

export const InstructionsList = styled.ol`
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`
