import styled from 'styled-components'
import Paper from '@mui/material/Paper'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'

export const NavPaper = styled(Paper)`
  && {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1100;
    border-top: 1px solid var(--scheme-border);
    display: block;
    @media (min-width: 600px) {
      display: none;
    }
  }
`

export const StyledBottomNavigation = styled(BottomNavigation)`
  && {
    background-color: var(--scheme-surface);
  }
`

export const NavAction = styled(BottomNavigationAction)`
  &&.Mui-selected {
    color: var(--scheme-primary);
  }
`
