import styled from 'styled-components'
import AppBar from '@mui/material/AppBar'
import InputBase from '@mui/material/InputBase'

export const StyledAppBar = styled(AppBar)`
  && {
    position: sticky;
    top: 0;
    z-index: 100;
  }
`

export const TopRow = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  gap: 4px;
`

export const TitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`

export const SearchBox = styled.div`
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 20px;
  padding: 3px 12px;
  flex: 1;
  min-width: 0;
  transition: background 0.2s;
  &:focus-within {
    background: rgba(255, 255, 255, 0.28);
  }
  @media (max-width: 599px) {
    display: none;
  }
`

export const SearchBoxMobile = styled.div`
  display: none;
  @media (max-width: 599px) {
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.18);
    border-radius: 20px;
    padding: 3px 12px;
    width: 100%;
    margin: 0 0 6px;
    &:focus-within {
      background: rgba(255, 255, 255, 0.28);
    }
  }
`

export const StyledInputBase = styled(InputBase)`
  && {
    color: white;
    flex: 1;
    font-size: 14px;
    & .MuiInputBase-input {
      padding: 4px 0;
      &::placeholder {
        color: rgba(255, 255, 255, 0.7);
        opacity: 1;
      }
    }
  }
`

export const ActionsGroup = styled.div`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: auto;
`

export const DesktopTabs = styled.div`
  display: none;
  @media (min-width: 600px) {
    display: block;
    background: rgba(0, 0, 0, 0.15);
  }
`

export const SearchIconWrapper = styled.span`
  display: flex;
  flex-shrink: 0;
  margin-right: 4px;
`

export const UserGreeting = styled.span`
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
  @media (max-width: 599px) {
    display: none;
  }
`
