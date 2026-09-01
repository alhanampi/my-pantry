import styled from 'styled-components'
import Button from '@mui/material/Button'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'

export const SidebarWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const NewChatButton = styled(Button)`
  && {
    text-transform: none;
  }
`

export const ConversationList = styled(List)`
  && {
    max-height: 55vh;
    overflow-y: auto;
  }
`

export const ConversationItem = styled(ListItemButton)<{ $active: boolean }>`
  && {
    border-radius: 10px;
    margin-bottom: 4px;
    background: ${(p) => (p.$active ? 'var(--scheme-accent-light)' : 'transparent')};
  }
`

export const ConversationTitle = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.85rem;
`

export const EmptySidebarText = styled.p`
  color: var(--scheme-text-muted);
  font-size: 0.85rem;
  padding: 8px 4px;
`
