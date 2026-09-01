import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import type { ChatConversation, RecipeCard } from '../utils/types'
import {
  apiListConversations,
  apiCreateConversation,
  apiGetConversation,
  apiDeleteConversation,
  apiSuggestRecipe,
} from '../api/chatApi'

// Chat requires sign-in — unlike Recipes/Favorites, conversation history is
// DB-persisted and inherently tied to an account, so there's no guest branch
// here (see the plan's "no guest mode for chat" decision).

export function useConversations() {
  const { getToken, isSignedIn } = useAuth()

  return useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: async (): Promise<ChatConversation[]> => {
      const token = await getToken()
      if (!token) return []
      return apiListConversations(token)
    },
    enabled: !!isSignedIn,
  })
}

export function useConversation(id: string | null) {
  const { getToken } = useAuth()

  return useQuery({
    queryKey: ['chat', 'conversation', id],
    queryFn: async () => {
      const token = await requireToken(getToken)
      return apiGetConversation(token, id!)
    },
    enabled: id !== null,
  })
}

// getToken() is async and must be awaited before use, per
// docs/data-fetching.md; this just adds the "must be signed in" guard shared
// by every mutation/query below.
async function requireToken(getToken: () => Promise<string | null>): Promise<string> {
  const token = await getToken()
  if (!token) throw new Error('Not authenticated')
  return token
}

export function useCreateConversation() {
  const { getToken } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      dietaryRestrictions,
      servings,
    }: {
      dietaryRestrictions: string[]
      servings: number
    }): Promise<ChatConversation> => {
      const token = await requireToken(getToken)
      return apiCreateConversation(token, dietaryRestrictions, servings)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
    },
  })
}

export function useDeleteConversation() {
  const { getToken } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const token = await requireToken(getToken)
      return apiDeleteConversation(token, id)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
    },
  })
}

export function useSuggestRecipe() {
  const { getToken } = useAuth()
  const { i18n } = useTranslation()

  return useMutation({
    mutationFn: async (
      conversationId: string,
    ): Promise<{ recipes: RecipeCard[] }> => {
      const token = await requireToken(getToken)
      return apiSuggestRecipe(token, conversationId, i18n.language)
    },
  })
}
