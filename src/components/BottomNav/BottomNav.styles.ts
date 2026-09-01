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

    /* Material-3-style "active indicator": a pill behind the icon filled
       with the page background color, so the selected tab reads as if a
       bit of the page itself pokes up into the bar. Padding on the svg
       itself (not a wrapper) is what gives the pill its size, since
       react-icons renders the icon directly with no wrapping span. */
    svg {
      background-color: var(--scheme-bg);
      border-radius: 999px;
      padding: 6px;
    }
  }
`
