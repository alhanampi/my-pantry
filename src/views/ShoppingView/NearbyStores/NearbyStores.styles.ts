import styled from 'styled-components'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'

export const StoresPaper = styled(Paper)`
  && {
    margin-top: 16px;
    padding: 16px;
    border: 1px solid var(--scheme-border);
    border-radius: 16px;
  }
`

export const StoresTitle = styled(Typography).attrs({ variant: 'subtitle1' as const })`
  && {
    font-weight: 700;
    color: var(--scheme-primary);
    margin-bottom: 2px;
  }
`

export const StoresSubtitle = styled(Typography).attrs({ variant: 'caption' as const })`
  && {
    display: block;
    margin-bottom: 12px;
  }
`

export const SearchButton = styled(Button)`
  && {
    margin-bottom: 12px;
  }
`

export const StoreAlert = styled(Alert)`
  && {
    margin-bottom: 8px;
    border-radius: 12px;
  }
`

export const StoreDivider = styled(Divider)`
  && {
    margin-bottom: 8px;
  }
`

export const StoreListItem = styled(ListItemButton)`
  && {
    padding-top: 4px;
    padding-bottom: 4px;
    border-radius: 8px;
  }
`

export const StoreIconCell = styled(ListItemIcon)`
  && {
    min-width: 32px;
  }
`

export const StoreName = styled(Typography).attrs({ variant: 'body2' as const })`
  && {
    font-weight: 500;
  }
`

export const TypeFormControl = styled(FormControl)`
  && {
    width: 100%;
    margin-bottom: 12px;
  }
`

export const ChipsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`
