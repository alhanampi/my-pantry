import styled from 'styled-components'

export const SwatchGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  min-width: 168px;
`

export const SwatchButton = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s;
  &:hover {
    background: rgba(0, 0, 0, 0.06);
  }
`

export const SwatchCircle = styled.span<{ $color: string; $active: boolean }>`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  border: 3px solid ${({ $active }) => ($active ? 'rgba(0,0,0,0.45)' : 'transparent')};
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  transition: transform 0.15s, border-color 0.15s;
  transform: ${({ $active }) => ($active ? 'scale(1.15)' : 'scale(1)')};
`

export const SwatchLabel = styled.span<{ $active: boolean }>`
  font-size: 0.68rem;
  color: var(--scheme-text-secondary, #616161);
  font-weight: ${({ $active }) => ($active ? 700 : 400)};
  white-space: nowrap;
`
