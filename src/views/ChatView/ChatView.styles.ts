import styled from 'styled-components'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'

export const Wrapper = styled.div`
  max-width: 700px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
`

// Full-width, single-conversation layout — no permanent side-by-side
// sidebar. Past conversations live behind the history icon in TopBar
// (opened as a Drawer), so the message list/composer always get the full
// width, like a normal messaging app.
export const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 8px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--scheme-border);
`

export const TopBarTitle = styled(Typography).attrs({ variant: 'subtitle1' as const })`
  && {
    font-weight: 600;
    color: var(--scheme-primary-dark);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const TopBarActions = styled.div`
  display: flex;
  gap: 4px;
  flex-shrink: 0;
`

export const TopBarIconButton = styled(IconButton)`
  && {
    color: var(--scheme-text-primary);
  }
`

// Height is set inline (see useAvailableHeight) rather than via CSS — it
// depends on where this element actually lands on screen, which varies with
// the header's real rendered height (desktop tabs row vs. mobile). Flex
// column so ScrollArea (flex: 1) grows/shrinks and the composer, as the
// last child, is always pinned at the bottom of this fixed-height box —
// unlike `position: sticky`, this holds even with zero/few messages.
export const ChatBody = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 0;
`

export const ScrollArea = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
`

export const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  gap: 10px;
  color: var(--scheme-text-muted);
  text-align: center;
`

export const ErrorState = styled(EmptyState)`
  color: var(--scheme-error, #c62828);
`

export const BackRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
`

export const SectionTitle = styled(Typography).attrs({ variant: 'subtitle1' as const })`
  && {
    font-weight: 600;
    color: var(--scheme-primary-dark);
    margin: 16px 0 8px;
  }
`
