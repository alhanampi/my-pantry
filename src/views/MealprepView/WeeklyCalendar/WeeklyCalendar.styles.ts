import styled from 'styled-components'

export const Grid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

export const DayRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

// Sits above its meal cards (rather than as a side column) so the row
// reads symmetrically regardless of how many cards it has.
export const DayLabel = styled.span`
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--scheme-text-primary);
`

export const MealsRow = styled.div`
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 10px;
`

export const MealCard = styled.button`
  display: flex;
  flex-direction: column;
  border: 1px solid var(--scheme-border);
  border-radius: 12px;
  background: var(--scheme-surface);
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  text-align: left;
  font-family: inherit;
  width: 150px;
  flex: 0 0 150px;
  transition: border-color 0.15s ease;

  &:hover,
  &:focus-visible {
    border-color: var(--scheme-accent-medium);
  }
`

export const MealImage = styled.div<{ $src: string }>`
  width: 100%;
  aspect-ratio: 4 / 3;
  background-image: url('${(p) => p.$src}');
  background-size: cover;
  background-position: center;
  background-color: var(--scheme-bg);
`

export const MealImagePlaceholder = styled.div`
  width: 100%;
  aspect-ratio: 4 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scheme-bg);
`

export const MealTypeTag = styled.span`
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--scheme-text-muted);
  padding: 8px 10px 0;
`

export const MealTitle = styled.span`
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--scheme-text-primary);
  padding: 2px 10px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

export const MealTime = styled.span`
  font-size: 0.7rem;
  color: var(--scheme-text-muted);
  padding: 4px 10px 10px;
`
