import { useEffect, useRef } from 'react'
import CircularProgress from '@mui/material/CircularProgress'
import RecipeCard from '../RecipeCard'
import { Grid, Sentinel, LoadingRow } from './RecipeCardGrid.styles'
import type { RecipeCard as RecipeCardType } from '../../../utils/types'

export interface RecipeCardGridProps {
  recipes: RecipeCardType[]
  onSelect: (id: number) => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
}

export default function RecipeCardGrid({
  recipes,
  onSelect,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: RecipeCardGridProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasNextPage) return

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
          <RecipeCard key={recipe.id} recipe={recipe} onClick={onSelect} />
        ))}
      </Grid>
      <Sentinel ref={sentinelRef} />
      {isFetchingNextPage && (
        <LoadingRow>
          <CircularProgress size={28} />
        </LoadingRow>
      )}
    </div>
  )
}
