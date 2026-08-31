import styled from 'styled-components'

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
`

export const Sentinel = styled.div`
  height: 1px;
`

export const LoadingRow = styled.div`
  display: flex;
  justify-content: center;
  padding: 16px 0;
`
