import { useEffect, useMemo, useRef, useState } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Drawer from '@mui/material/Drawer'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { MdArrowBack, MdAutoAwesome, MdHistory, MdAddComment, MdOutlineLightbulb } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import ChatSidebar from './ChatSidebar'
import NewChatOnboarding from './NewChatOnboarding'
import ChatMessageList, { type SuggestionEvent } from './ChatMessageList'
import ChatComposer, { type ChatComposerHandle } from './ChatComposer'
import QuickReplies from './QuickReplies'
import ChatSkeleton from './ChatSkeleton'
import ConfirmActionDialog from '../../components/ConfirmActionDialog'
import RecipeDetailPanel from '../RecipesView/RecipeDetailPanel'
import RecipesSkeleton from '../RecipesView/RecipesSkeleton'
import {
  Wrapper,
  TopBar,
  TopBarTitle,
  TopBarActions,
  TopBarIconButton,
  ChatBody,
  ScrollArea,
  EmptyState,
  ErrorState,
  BackRow,
} from './ChatView.styles'
import { useConversations, useConversation, useCreateConversation, useDeleteConversation, useSuggestRecipe } from '../../hooks/useChat'
import { useChatSession } from '../../hooks/useChatSession'
import { useRecipeDetail } from '../../hooks/useRecipes'
import { useFavoriteIds, useFavoriteToggle } from '../../hooks/useFavorites'
import { useGeolocation } from '../../hooks/useGeolocation'
import { useNearbyStores } from '../../hooks/useNearbyStores'
import { usePantry } from '../../hooks/usePantry'
import { useAvailableHeight } from '../../hooks/useAvailableHeight'
import { DEFAULT_SHOP_TYPES } from '../../api/overpass'
import type { RecipeIngredient, ChatConversation } from '../../utils/types'

// Must exactly match MainContent's own bottom padding (App.styles.ts) — not
// BottomNav's rendered height. BottomNav overlays the page (position: fixed)
// so it doesn't take up document flow height on its own; MainContent's
// padding is what actually reserves that space in the flow. If ChatBody's
// height leaves even a few px less than this, the *page* (not just the
// message list) becomes tall enough to scroll, and since ChatBody sits in
// normal flow (not position: fixed to the viewport), scrolling the page
// drags the "pinned" composer out of view along with everything else —
// this was the actual bug, not the composer's own positioning. Keep these
// in sync with App.styles.ts's MainContent padding if that ever changes.
const MOBILE_BOTTOM_RESERVE = 72
const DESKTOP_BOTTOM_RESERVE = 16

export interface ChatViewProps {
  sendRecipeToShoppingList: UseMutationResult<
    string,
    Error,
    { recipeTitle: string; ingredients: RecipeIngredient[] }
  >
  onSentToList: (listId: string) => void
}

const MIN_MESSAGES_FOR_SUGGESTION = 2

export default function ChatView({ sendRecipeToShoppingList, onSentToList }: ChatViewProps) {
  const { t } = useTranslation()
  const { isSignedIn, isLoaded } = useAuth()

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ChatConversation | null>(null)
  const [suggestedRecipeId, setSuggestedRecipeId] = useState<number | null>(null)
  // Set right after creating a conversation from onboarding, so an effect
  // (below) can send the typed recipe/ingredient as the first message and
  // immediately ask for suggestions once that conversation is actually
  // active — see the effect's own comment for why this can't just happen
  // inline in the onSuccess callback.
  const [autoStart, setAutoStart] = useState<{ conversationId: string; initialQuery: string } | null>(null)
  // Each "suggest a recipe" result, positioned where it happened in the
  // conversation (see ChatMessageList's SuggestionEvent doc) — reset
  // whenever the active conversation changes so a switch never carries
  // stale suggestions over.
  const [suggestionEvents, setSuggestionEvents] = useState<SuggestionEvent[]>([])

  const conversationsQuery = useConversations()
  const conversationQuery = useConversation(activeConversationId)
  const createConversation = useCreateConversation()
  const deleteConversation = useDeleteConversation()
  const suggestRecipe = useSuggestRecipe()
  const detail = useRecipeDetail(suggestedRecipeId)
  const favoriteIds = useFavoriteIds()
  const favoriteToggle = useFavoriteToggle()
  const favoriteIdSet = useMemo(() => new Set(favoriteIds.data ?? []), [favoriteIds.data])

  const { coords, requestLocation } = useGeolocation()
  const { data: nearbyStores } = useNearbyStores(coords, DEFAULT_SHOP_TYPES)
  const { products: pantryProducts } = usePantry()

  const session = useChatSession(activeConversationId, [])
  const loadedConversationRef = useRef<string | null>(null)
  const composerRef = useRef<ChatComposerHandle>(null)
  // Always holds the latest session.messages, readable from inside async
  // callbacks (mutation onSuccess, effect .then chains) that would otherwise
  // see a stale snapshot from whatever render created them — see
  // pushSuggestionEvent's call sites for why this matters.
  const messagesRef = useRef(session.messages)
  messagesRef.current = session.messages

  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const chatBodyRef = useRef<HTMLDivElement | null>(null)
  const availableHeight = useAvailableHeight(
    chatBodyRef,
    isMobile ? MOBILE_BOTTOM_RESERVE : DESKTOP_BOTTOM_RESERVE,
  )

  // Computed here (not after the early returns below) so the auto-start
  // effect can safely reference it — it's a plain derived value, not a hook,
  // so moving it earlier changes nothing about when it's (re)computed.
  const nearbyStoresSummary =
    nearbyStores && nearbyStores.length > 0
      ? nearbyStores
          .slice(0, 5)
          .map((s) => `${s.name} (${s.distance}m)`)
          .join(', ')
      : undefined

  // Ingredient quick-reply chips are filtered down to pantry items actually
  // mentioned somewhere in the conversation so far (the opening message —
  // which is the typed recipe/ingredient from onboarding — plus anything
  // since, including the assistant's own follow-up questions), rather than
  // dumping the whole pantry regardless of what's being discussed. No extra
  // AI call: purely a local match against text already on screen.
  const conversationText = session.messages.map((m) => m.content).join(' ').toLowerCase()
  const relevantPantryNames = pantryProducts
    .filter((p) => conversationText.includes(p.name.toLowerCase()))
    .map((p) => p.name)

  const pushSuggestionEvent = (afterIndex: number, recipes: SuggestionEvent['recipes']): void => {
    setSuggestionEvents((prev) => [...prev, { id: `sugg-${Date.now()}-${prev.length}`, afterIndex, recipes }])
  }

  useEffect(() => {
    requestLocation()
    // Requested once on mount, per the product decision to ask for location
    // as soon as the Chat tab is entered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Entering the Chat tab always starts a fresh "new chat" onboarding step —
  // never silently resumes whatever conversation was last open. Past
  // conversations stay one tap away via the history icon/drawer. ChatView
  // itself unmounts/remounts on every tab switch (App.tsx only renders it
  // while currentView === 'chat'), so this naturally re-applies every time
  // the tab is (re)entered, not just on the very first app load.
  useEffect(() => {
    if (activeConversationId !== null || creatingNew) return
    setCreatingNew(true)
  }, [activeConversationId, creatingNew])

  useEffect(() => {
    if (conversationQuery.data && loadedConversationRef.current !== activeConversationId) {
      session.resetMessages(conversationQuery.data.messages)
      setSuggestionEvents([])
      loadedConversationRef.current = activeConversationId
    }
    // Only re-sync when switching conversations, not on every background
    // refetch — see useChatSession's own comment for why.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, conversationQuery.data])

  // Runs the "already offer something" flow right after onboarding creates a
  // conversation. Can't just do this inline in createConversation's onSuccess
  // callback: `session` there is still bound to the *old* activeConversationId
  // (null) from the render that captured it — session.sendMessage would be a
  // no-op. Waiting for a render where activeConversationId has actually
  // become the new id means `session` (re-derived every render) is the right
  // instance. Guarded by autoStart.conversationId so switching to an
  // unrelated, already-existing conversation never triggers this.
  useEffect(() => {
    if (!autoStart || autoStart.conversationId !== activeConversationId) return
    const { conversationId, initialQuery } = autoStart
    setAutoStart(null)
    if (initialQuery) {
      void session.sendMessage(initialQuery, nearbyStoresSummary).then(() => {
        suggestRecipe.mutate(conversationId, {
          onSuccess: (data) => pushSuggestionEvent(messagesRef.current.length, data.recipes),
        })
      })
    } else {
      suggestRecipe.mutate(conversationId, {
        onSuccess: (data) => pushSuggestionEvent(messagesRef.current.length, data.recipes),
      })
    }
    // session/suggestRecipe/nearbyStoresSummary are re-derived every render
    // and intentionally excluded — this should only re-run when autoStart or
    // activeConversationId actually change, not on every unrelated render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, activeConversationId])

  if (!isLoaded) return <ChatSkeleton />

  if (!isSignedIn) {
    return (
      <Wrapper>
        <EmptyState>
          <MdOutlineLightbulb size={48} color="var(--scheme-accent-medium)" />
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {t('chat.signedOutTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('chat.signedOutBody')}
          </Typography>
        </EmptyState>
      </Wrapper>
    )
  }

  const handleStartConversation = (payload: {
    dietaryRestrictions: string[]
    servings: number
    initialQuery: string
  }): void => {
    const { dietaryRestrictions, servings, initialQuery } = payload
    createConversation.mutate(
      { dietaryRestrictions, servings },
      {
        onSuccess: (conversation) => {
          setCreatingNew(false)
          setActiveConversationId(conversation.id)
          loadedConversationRef.current = conversation.id
          session.resetMessages([])
          setSuggestionEvents([])
          // Picked up by the auto-start effect above once activeConversationId
          // has actually become conversation.id on a subsequent render.
          setAutoStart({ conversationId: conversation.id, initialQuery })
        },
      },
    )
  }

  const handleToggleFavorite = (id: number): void => {
    favoriteToggle.requestToggle(id, favoriteIdSet.has(id))
  }

  const handleConfirmDelete = (): void => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    deleteConversation.mutate(id, {
      onSuccess: () => {
        if (activeConversationId === id) {
          setActiveConversationId(null)
          loadedConversationRef.current = null
          setSuggestionEvents([])
        }
      },
    })
  }

  const handleSuggestRecipe = (): void => {
    if (!activeConversationId) return
    const afterIndex = messagesRef.current.length
    suggestRecipe.mutate(activeConversationId, {
      onSuccess: (data) => pushSuggestionEvent(afterIndex, data.recipes),
    })
  }

  const handleSendToShoppingList = (payload: { recipeTitle: string; ingredients: RecipeIngredient[] }): void => {
    sendRecipeToShoppingList.mutate(payload, { onSuccess: (listId) => onSentToList(listId) })
  }

  const historyDrawer = (
    <Drawer
      anchor="right"
      open={historyOpen}
      onClose={() => setHistoryOpen(false)}
      PaperProps={{ sx: { width: 280, p: 2 } }}
    >
      <ChatSidebar
        conversations={conversationsQuery.data ?? []}
        activeConversationId={activeConversationId}
        onSelect={(id) => {
          setActiveConversationId(id)
          setCreatingNew(false)
          setHistoryOpen(false)
        }}
        onNewChat={() => {
          setCreatingNew(true)
          setActiveConversationId(null)
          setHistoryOpen(false)
        }}
        onDeleteClick={setDeleteTarget}
      />
    </Drawer>
  )

  // Sub-state: viewing a suggested recipe's full detail, in-tab — same
  // documented exception to the flat-views pattern RecipesView already uses.
  if (suggestedRecipeId !== null) {
    return (
      <Wrapper>
        <BackRow>
          <Button startIcon={<MdArrowBack size={18} />} onClick={() => setSuggestedRecipeId(null)} size="small">
            {t('chat.backToChat')}
          </Button>
        </BackRow>

        {detail.isLoading && <RecipesSkeleton />}
        {detail.isError && (
          <ErrorState>
            <Typography variant="body1">{t('recipes.errors.generic')}</Typography>
          </ErrorState>
        )}
        {detail.data && (
          <RecipeDetailPanel
            recipe={detail.data}
            onSendToShoppingList={handleSendToShoppingList}
            isSending={sendRecipeToShoppingList.isPending}
            initialServings={conversationQuery.data?.conversation.servings}
            isFavorite={favoriteIdSet.has(detail.data.id)}
            onToggleFavorite={handleToggleFavorite}
            isTogglingFavorite={favoriteToggle.pendingRecipeId === detail.data.id}
          />
        )}

        <ConfirmActionDialog
          open={favoriteToggle.pendingRemoveId !== null}
          title={t('recipes.removeFavoriteConfirmTitle')}
          body={t('recipes.removeFavoriteConfirmBody')}
          confirmLabel={t('recipes.removeFavorite')}
          onConfirm={favoriteToggle.confirmRemove}
          onCancel={favoriteToggle.cancelRemove}
        />
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      <TopBar>
        <TopBarTitle>{conversationQuery.data?.conversation.title ?? t('chat.title')}</TopBarTitle>
        <TopBarActions>
          <TopBarIconButton
            size="small"
            aria-label={t('chat.newChat')}
            onClick={() => {
              setCreatingNew(true)
              setActiveConversationId(null)
              setSuggestionEvents([])
            }}
          >
            <MdAddComment size={20} />
          </TopBarIconButton>
          <TopBarIconButton size="small" aria-label={t('chat.history')} onClick={() => setHistoryOpen(true)}>
            <MdHistory size={20} />
          </TopBarIconButton>
        </TopBarActions>
      </TopBar>

      {creatingNew && (
        <NewChatOnboarding onStart={handleStartConversation} isPending={createConversation.isPending} />
      )}

      {!creatingNew && activeConversationId !== null && (
        <ChatBody ref={chatBodyRef} style={{ height: availableHeight }}>
          <ScrollArea>
            <ChatMessageList
              messages={session.messages}
              suggestionEvents={suggestionEvents}
              onSelectRecipe={setSuggestedRecipeId}
              favoriteIds={favoriteIdSet}
              onToggleFavorite={handleToggleFavorite}
              pendingFavoriteId={favoriteToggle.pendingRecipeId}
            />

            {session.streamError && (
              <ErrorState>
                <Typography variant="body2">
                  {session.streamError === 'configError'
                    ? t('chat.errors.configError')
                    : session.streamError === 'quotaExceeded'
                      ? t('chat.errors.quotaExceeded')
                      : t('chat.errors.generic')}
                </Typography>
              </ErrorState>
            )}

            {session.messages.length >= MIN_MESSAGES_FOR_SUGGESTION && (
              <Button
                variant="outlined"
                size="small"
                startIcon={
                  suggestRecipe.isPending ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <MdAutoAwesome size={16} />
                  )
                }
                onClick={handleSuggestRecipe}
                disabled={suggestRecipe.isPending}
                sx={{ alignSelf: 'flex-start', mb: 1 }}
              >
                {suggestRecipe.isPending ? t('chat.suggesting') : t('chat.suggestRecipe')}
              </Button>
            )}
          </ScrollArea>

          {/* Once at least one batch of recipes has been offered, the
              "collecting info" phase is over — quick-reply chips stop being
              useful and just clutter the view from then on. */}
          {suggestionEvents.length === 0 && (
            <QuickReplies
              pantryItemNames={relevantPantryNames}
              onPickTime={(phrase) => composerRef.current?.appendPhrase(phrase)}
              onPickIngredient={(name) =>
                composerRef.current?.appendIngredient(name, t('chat.quickReplies.haveIngredientsPrefix'))
              }
            />
          )}

          <ChatComposer
            ref={composerRef}
            onSend={(content) => void session.sendMessage(content, nearbyStoresSummary)}
            disabled={session.isStreaming}
          />
        </ChatBody>
      )}

      {historyDrawer}

      <ConfirmActionDialog
        open={deleteTarget !== null}
        title={t('chat.deleteChatConfirmTitle')}
        body={t('chat.deleteChatConfirmBody', { title: deleteTarget?.title ?? '' })}
        confirmLabel={t('chat.deleteChat')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmActionDialog
        open={favoriteToggle.pendingRemoveId !== null}
        title={t('recipes.removeFavoriteConfirmTitle')}
        body={t('recipes.removeFavoriteConfirmBody')}
        confirmLabel={t('recipes.removeFavorite')}
        onConfirm={favoriteToggle.confirmRemove}
        onCancel={favoriteToggle.cancelRemove}
      />
    </Wrapper>
  )
}
