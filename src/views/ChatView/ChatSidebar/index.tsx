import IconButton from '@mui/material/IconButton'
import { MdAdd, MdDeleteOutline, MdChatBubbleOutline } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import {
  SidebarWrapper,
  NewChatButton,
  ConversationList,
  ConversationItem,
  ConversationTitle,
  EmptySidebarText,
} from './ChatSidebar.styles'
import type { ChatConversation } from '../../../utils/types'

export interface ChatSidebarProps {
  conversations: ChatConversation[]
  activeConversationId: string | null
  onSelect: (id: string) => void
  onNewChat: () => void
  onDeleteClick: (conversation: ChatConversation) => void
}

export default function ChatSidebar({
  conversations,
  activeConversationId,
  onSelect,
  onNewChat,
  onDeleteClick,
}: ChatSidebarProps) {
  const { t } = useTranslation()

  return (
    <SidebarWrapper>
      <NewChatButton
        variant="contained"
        disableElevation
        startIcon={<MdAdd size={16} />}
        onClick={onNewChat}
        size="small"
      >
        {t('chat.newChat')}
      </NewChatButton>

      {conversations.length === 0 ? (
        <EmptySidebarText>{t('chat.emptySidebar')}</EmptySidebarText>
      ) : (
        <ConversationList disablePadding>
          {conversations.map((c) => (
            <ConversationItem
              key={c.id}
              $active={c.id === activeConversationId}
              onClick={() => onSelect(c.id)}
              selected={c.id === activeConversationId}
            >
              <MdChatBubbleOutline size={16} style={{ marginRight: 8, flexShrink: 0 }} />
              <ConversationTitle>{c.title}</ConversationTitle>
              <IconButton
                size="small"
                aria-label={t('chat.deleteChat')}
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteClick(c)
                }}
              >
                <MdDeleteOutline size={16} />
              </IconButton>
            </ConversationItem>
          ))}
        </ConversationList>
      )}
    </SidebarWrapper>
  )
}
