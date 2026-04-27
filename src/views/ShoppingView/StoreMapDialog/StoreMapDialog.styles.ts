import styled from 'styled-components'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'

export const StyledMapDialog = styled(Dialog)`
  & .MuiDialog-paper {
    border-radius: 14px;
    overflow: hidden;
  }
`

export const MapDialogTitle = styled(DialogTitle)`
  && {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
  }
`

export const MapDialogContent = styled(DialogContent)`
  && {
    padding: 0;
  }
`

export const MapDialogActions = styled(DialogActions)`
  && {
    padding: 8px 16px 12px;
  }
`

export const MapWrapper = styled.div`
  height: 350px;
  width: 100%;
`

export const StoreMarker = styled.div`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--scheme-primary);
  border: 3px solid white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  cursor: pointer;
`

export const UserMarker = styled.div`
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--scheme-info-dark);
  border: 3px solid white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
`
