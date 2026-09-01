import { useEffect, useRef } from 'react'
import CircularProgress from '@mui/material/CircularProgress'
import RecipeCard from '../RecipeCard'
import { Grid, Sentinel, LoadingRow } from './RecipeCardGrid.styles'
import type { RecipeCard as RecipeCardType } from '../../../utils/types'

export interface RecipeCardGridProps {
  recipes: RecipeCardType[]
  onSelect: (id: number) => void
  // Optional — omitted entirely by FavoriteRecipesView, which renders a
  // bounded list with no pagination, so there's no sentinel/infinite-scroll
  // behavior to wire up there.
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onLoadMore?: () => void
  favoriteIds?: Set<number>
  onToggleFavorite?: (id: number) => void
  // Id of the recipe whose favorite toggle is currently in flight, if any —
  // see RecipeCard's isTogglingFavorite prop.
  pendingFavoriteId?: number
}

export default function RecipeCardGrid({
  recipes,
  onSelect,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  favoriteIds,
  onToggleFavorite,
  pendingFavoriteId,
}: RecipeCardGridProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasNextPage || !onLoadMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore()
      },
      { rootMargin: '200px' },
    )
    observer.observe(node)

    // Critical cleanup — without disconnect() the observer keeps firing
    // callbacks against a stale onLoadMore closure (and leaks) across
    // re-renders/unmounts, since IntersectionObserver isn't garbage
    // collected just because the observed node unmounts.
    return () => observer.disconnect()
  }, [hasNextPage, onLoadMore])

  return (
    <div>
      <Grid>
        {recipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onClick={onSelect}
            isFavorite={favoriteIds?.has(recipe.id)}
            onToggleFavorite={onToggleFavorite}
            isTogglingFavorite={pendingFavoriteId === recipe.id}
          />
        ))}
      </Grid>
      {onLoadMore && <Sentinel ref={sentinelRef} />}
      {isFetchingNextPage && (
        <LoadingRow>
          <CircularProgress size={28} />
        </LoadingRow>
      )}
    </div>
  )
}
