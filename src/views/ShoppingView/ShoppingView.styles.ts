import styled from 'styled-components'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'

export const Wrapper = styled.div`
  max-width: 700px;
  margin: 0 auto;
`

export const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  gap: 10px;
  color: #9e9e9e;
  text-align: center;
`

export const TopBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
`

export const CountText = styled(Typography).attrs({ variant: 'caption' as const })`
  && {
    margin-left: auto;
  }
`

export const ClearButton = styled(Button)`
  && {
    color: #757575;
    border-color: #bdbdbd;
  }
`

export const ItemsPaper = styled(Paper)`
  && {
    border: 1px solid var(--scheme-border);
    border-radius: 16px;
    overflow: hidden;
  }
`

export const ItemsBox = styled.div`
  padding: 8px;
`
