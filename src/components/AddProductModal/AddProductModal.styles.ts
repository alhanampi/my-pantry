import styled from 'styled-components'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'

export const StyledDialog = styled(Dialog)`
  & .MuiDialog-paper {
    margin: 8px;
    border-radius: 14px;
  }
  @media (min-width: 600px) {
    & .MuiDialog-paper {
      margin: 24px;
    }
  }
`

export const StyledDialogTitle = styled(DialogTitle)`
  && {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-right: 8px;
  }
`

export const StyledDialogContent = styled(DialogContent)`
  && {
    padding-top: 8px;
  }
`

export const StyledDialogActions = styled(DialogActions)`
  && {
    padding: 8px 24px 20px;
    gap: 8px;
  }
`

export const StyledCancelActions = styled(DialogActions)`
  && {
    padding: 8px 16px 16px;
    gap: 8px;
  }
`

export const SectionLabel = styled(Typography)`
  && {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--scheme-text-muted);
    margin: 12px 0 4px;
  }
`

export const ModalTitleText = styled.span`
  flex: 1;
`
