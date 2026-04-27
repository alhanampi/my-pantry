import styled from 'styled-components'
import Dialog from '@mui/material/Dialog'

export const StyledAuthDialog = styled(Dialog)`
  && .MuiDialog-paper {
    border-radius: 16px;
    padding: 0;
    width: 100%;
    max-width: 420px;
  }
`

export const AuthHeader = styled.div`
  padding: 28px 28px 0;
  text-align: center;
`

export const AuthBody = styled.div`
  padding: 20px 28px 28px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`

export const ErrorBanner = styled.div`
  background: var(--scheme-error-bg);
  color: var(--scheme-error);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 0.85rem;
`
