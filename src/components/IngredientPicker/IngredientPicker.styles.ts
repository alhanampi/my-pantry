import styled from 'styled-components'
import Typography from '@mui/material/Typography'

export const SectionLabel = styled(Typography).attrs({ variant: 'caption' as const })`
  && {
    display: block;
    color: var(--scheme-text-muted);
    margin: 10px 0 6px;
    &:first-child {
      margin-top: 0;
    }
  }
`

export const ChipsWrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

export const AddOtherRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
`
