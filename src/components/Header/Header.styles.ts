import styled from 'styled-components'
import AppBar from '@mui/material/AppBar'

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

export const DesktopActions = styled.div`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: auto;
  @media (max-width: 599px) {
    display: none;
  }
`

export const MobileHamburger = styled.div`
  display: none;
  margin-left: auto;
  @media (max-width: 599px) {
    display: flex;
    align-items: center;
    gap: 2px;
  }
`

export const DesktopTabs = styled.div`
  display: none;
  @media (min-width: 600px) {
    display: block;
    background: var(--scheme-on-primary-tabs);
  }
`

export const UserGreeting = styled.span`
  font-size: 0.78rem;
  color: var(--scheme-on-primary);
  white-space: nowrap;
  @media (max-width: 599px) {
    display: none;
  }
`
