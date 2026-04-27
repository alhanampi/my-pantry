import styled from 'styled-components'
import DialogTitle from '@mui/material/DialogTitle'
import DialogActions from '@mui/material/DialogActions'

export const StyledDialogTitle = styled(DialogTitle)`
  && {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 8px;
  }
`

export const StyledDialogActions = styled(DialogActions)`
  && {
    padding: 8px 24px 16px;
  }
`
