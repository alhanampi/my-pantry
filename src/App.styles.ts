import styled from 'styled-components'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'

export const AppWrapper = styled.div`
  min-height: 100vh;
  background-color: var(--scheme-bg);
  display: flex;
  flex-direction: column;
`

export const MainContent = styled.main`
  flex: 1;
  padding: 16px;
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  box-sizing: border-box;
  @media (max-width: 599px) {
    padding: 10px 8px 72px;
  }
`

export const AppSnackbar = styled(Snackbar)`
  &.MuiSnackbar-anchorOriginBottomCenter {
    bottom: 80px;
    @media (min-width: 600px) {
      bottom: 24px;
    }
  }
`

export const AppAlert = styled(Alert)`
  && {
    border-radius: 8px;
  }
`
