import styled from 'styled-components'
import Typography from '@mui/material/Typography'

export const CardWrapper = styled.div`
  border: 1px solid var(--scheme-border);
  border-radius: 14px;
  overflow: hidden;
  background: var(--scheme-surface);
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s;

  &:hover {
    box-shadow: 0 2px 10px var(--scheme-shadow-xs);
    transform: translateY(-2px);
  }
`

export const ImageWrapper = styled.div`
  position: relative;
`

export const CardImage = styled.img`
  width: 100%;
  height: 140px;
  object-fit: cover;
  display: block;
  background: var(--scheme-surface-alt);
`

export const FavoriteButton = styled.button<{ $active: boolean }>`
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: var(--scheme-surface);
  box-shadow: 0 1px 4px var(--scheme-shadow-xs);
  cursor: pointer;
  // Deliberate exception to "no hardcoded colors" — the favorite heart is
  // meant to read as red regardless of the active color scheme (unlike
  // --scheme-accent-medium, which is too light/washed-out on some schemes),
  // same fixed value as RecipeDetailPanel's hero favorite button.
  color: ${(p) => (p.$active ? '#e53935' : 'var(--scheme-text-muted)')};

  &:hover {
    background: var(--scheme-surface-alt);
  }
`

export const CardBody = styled.div`
  padding: 10px 12px 12px;
`

export const CardTitle = styled(Typography).attrs({ variant: 'subtitle2' as const })`
  && {
    font-weight: 600;
    color: var(--scheme-primary-dark);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 2.6em;
  }
`

export const ChipsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
`

export const MetaRow = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 6px;
  color: var(--scheme-text-muted);
  font-size: 0.75rem;
`
