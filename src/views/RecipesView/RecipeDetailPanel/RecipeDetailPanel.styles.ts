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
  // Deliberate exception to "no hardcoded colors" — same fixed red as
  // RecipeCard's favorite button, regardless of the active color scheme.
  color: ${(p) => (p.$active ? '#e53935' : 'var(--scheme-text-muted)')};

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

export const NutritionBarList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

export const NutritionBarRow = styled.div`
  display: grid;
  grid-template-columns: 7rem 1fr 2.75rem;
  align-items: center;
  gap: 10px;

  @media (max-width: 400px) {
    grid-template-columns: 5.5rem 1fr 2.5rem;
    gap: 6px;
  }
`

export const NutritionBarLabel = styled(Typography).attrs({ variant: 'caption' as const })`
  && {
    color: var(--scheme-text-muted);
    font-weight: 600;
  }
`

export const NutritionBarTrack = styled.div`
  height: 8px;
  border-radius: 4px;
  background: var(--scheme-surface-alt);
  overflow: hidden;
`

// $color is a fixed per-nutrient legend color (see NUTRIENT_COLORS in
// index.tsx) — same deliberate exception to "no hardcoded colors" as
// HeroFavoriteButton above: a nutrient-color legend needs to stay
// recognizable regardless of which of the 6 color schemes is active.
export const NutritionBarFill = styled.div<{ $pct: number; $color: string }>`
  height: 100%;
  width: ${(p) => p.$pct}%;
  max-width: 100%;
  background: ${(p) => p.$color};
  border-radius: 4px;
  transition: width 0.4s ease;
`

export const NutritionBarValue = styled(Typography).attrs({ variant: 'caption' as const })`
  && {
    color: var(--scheme-primary-dark);
    font-weight: 700;
    text-align: right;
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
