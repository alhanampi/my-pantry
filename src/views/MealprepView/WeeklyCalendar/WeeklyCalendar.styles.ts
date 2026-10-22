import styled from 'styled-components'

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
`

export const DayCard = styled.button`
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
  transition: border-color 0.15s ease;

  &:hover,
  &:focus-visible {
    border-color: var(--scheme-accent-medium);
  }
`

export const DayImage = styled.div<{ $src: string }>`
  width: 100%;
  aspect-ratio: 4 / 3;
  background-image: url('${(p) => p.$src}');
  background-size: cover;
  background-position: center;
  background-color: var(--scheme-bg);
`

export const DayLabel = styled.span`
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--scheme-accent-medium);
  padding: 8px 10px 0;
`

export const DayTitle = styled.span`
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--scheme-text-primary);
  padding: 2px 10px 10px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`
